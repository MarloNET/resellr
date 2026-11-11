import { uptime } from 'node:os';
import { dirname } from 'node:path';

import { readConfiguredPort } from '@resellr/runtime-shared/configured-port';
import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';
import {
  resolveRuntimePaths,
  type RuntimeEnv,
  type RuntimePaths,
} from '@resellr/runtime-shared/paths';
import { updateRuntimeState } from '@resellr/runtime-shared/runtime-state-files';

import { summarizeMissingDays } from './availability/availability-aggregator.ts';
import { writeAvailabilityReport } from './availability/availability-report.ts';
import { createChromeOpener } from './chrome-opener.ts';
import { createHealthClient } from './health-client.ts';
import { startHealthProbe } from './health-probe.ts';
import { createLauncherLog, type LauncherLog } from './launcher-log.ts';
import { launcherPageUrl } from './launcher-pages-location.ts';
import { runOpenCommand } from './open-command.ts';
import { startServerProcess } from './supervisor/server-process.ts';
import { runSupervisor } from './supervisor/supervisor.ts';
import {
  listenSupervisorPipe,
  type PhaseEvent,
  subscribeToSupervisor,
  supervisorPipePath,
  type SupervisorPipeServer,
} from './supervisor/supervisor-pipe.ts';

const APP_VERSION = '0.1.0';

/** A call of `resellr-launcher` (Technical Specification 2.18, command table). */
export type LauncherCommand =
  | { name: 'open' }
  | { name: 'supervise' }
  | { name: 'stop'; forUpdate: boolean }
  | { name: 'availability-report'; month: string };

const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** Reads the command line arguments after the script; null for an invalid call. */
export function parseCommand(args: readonly string[]): LauncherCommand | null {
  const [name, ...rest] = args;
  switch (name) {
    case 'open':
    case 'supervise':
      return rest.length === 0 ? { name } : null;
    case 'stop':
      if (rest.length === 0) return { name, forUpdate: false };
      return rest.length === 1 && rest[0] === '--for-update' ? { name, forUpdate: true } : null;
    case 'availability-report': {
      const [month, ...extra] = rest;
      return month !== undefined && MONTH.test(month) && extra.length === 0
        ? { name, month }
        : null;
    }
    default:
      return null;
  }
}

/**
 * Entry of `resellr-launcher` (CU-258): reads the command and runs it. The launcher has no
 * console (ADR-008), so every failure ends with exit code 1 instead of a message.
 */
export async function runCli(
  args: readonly string[],
  env: RuntimeEnv = process.env,
): Promise<LauncherExitCode> {
  const command = parseCommand(args);
  try {
    switch (command?.name) {
      case 'open':
        return await runOpen(env);
      case 'supervise':
        return await runSupervise(env);
      case 'availability-report':
        writeAvailabilityReport({ logDir: resolveRuntimePaths(env).logDir, month: command.month });
        return LauncherExitCode.Success;
      default:
        // `stop` (#123) is not built yet.
        return LauncherExitCode.Failed;
    }
  } catch {
    return LauncherExitCode.Failed;
  }
}

function runOpen(env: RuntimeEnv): Promise<LauncherExitCode> {
  const paths = resolveRuntimePaths(env);
  const pipePath = pipePathFor(env);
  // The same rule as the server, read anew on every call; the launcher only reads `config.json`
  // and writes no warning about it (2.19, Nachtrag MAR-296).
  const { port } = readConfiguredPort(paths.dataDir);
  const launcherLog = createLauncherLog({ dir: paths.logDir, appVersion: APP_VERSION });
  // `resellr-node.exe` lies in the program folder (2.19), like for the server.
  const programDir = dirname(process.execPath);
  return runOpenCommand({
    healthClient: createHealthClient({ port }),
    // The only warning of CU-267 is `chrome_not_found` (2.19, Nachtrag MAR-366).
    chromeOpener: createChromeOpener({ warn: () => launcherLog.chromeNotFound() }),
    startFailedPageUrl: (refNo) => launcherPageUrl(programDir, 'lp-02', { ref: refNo }),
    subscribe: () => subscribeToSupervisor(pipePath),
    becomeSupervisor: async (onPhase) => {
      const pipe = await listenSupervisorPipe(pipePath);
      if (pipe === null) return 'taken';
      await supervise({ pipe, paths, env, port, launcherLog, onPhase });
      return 'ended';
    },
  });
}

/** Command `supervise` (2.18): becomes the supervisor, or ends at once if one runs; no Chrome. */
async function runSupervise(env: RuntimeEnv): Promise<LauncherExitCode> {
  const paths = resolveRuntimePaths(env);
  const pipe = await listenSupervisorPipe(pipePathFor(env));
  if (pipe !== null) {
    await supervise({
      pipe,
      paths,
      env,
      port: readConfiguredPort(paths.dataDir).port,
      launcherLog: createLauncherLog({ dir: paths.logDir, appVersion: APP_VERSION }),
    });
  }
  return LauncherExitCode.Success;
}

function supervise({
  pipe,
  paths,
  env,
  port,
  launcherLog,
  onPhase,
}: {
  pipe: SupervisorPipeServer;
  paths: RuntimePaths;
  env: RuntimeEnv;
  port: number;
  launcherLog: LauncherLog;
  onPhase?: (event: PhaseEvent) => void;
}): Promise<void> {
  const healthClient = createHealthClient({ port });
  // Windows start of this boot, for "PC aus" in the daily summary (2.18).
  const bootTime = Date.now() - uptime() * 1000;
  return runSupervisor({
    pipe,
    onPhase,
    startServer: ({ startId, onReady }) => startServerProcess({ paths, startId, env, onReady }),
    onCrash: ({ startId, refNo, at, exitCode, signal }) => {
      launcherLog.crash({ startId, refNo, exitCode, signal });
      updateRuntimeState(paths.logDir, { lastCrashAt: at.toISOString() });
    },
    startHealthProbe: (onProbe) =>
      startHealthProbe({ healthClient, logDir: paths.logDir, onProbe }),
    summarizeAvailability: () => summarizeMissingDays({ logDir: paths.logDir, bootTime }),
  });
}

/** The pipe of this user's supervisor, from `%LOCALAPPDATA%` (H-14). */
function pipePathFor(env: RuntimeEnv): string {
  const localAppData = env.LOCALAPPDATA;
  if (!localAppData) throw new Error('LOCALAPPDATA is not set');
  return supervisorPipePath(localAppData);
}

if (import.meta.main) {
  process.exitCode = await runCli(process.argv.slice(2));
}
