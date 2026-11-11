import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

import { readConfiguredPort } from '@resellr/runtime-shared/configured-port';
import { createDailyJsonlWriter } from '@resellr/runtime-shared/daily-jsonl-writer';
import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';
import {
  resolveRuntimePaths,
  type RuntimeEnv,
  type RuntimePaths,
} from '@resellr/runtime-shared/paths';

import { createChromeOpener } from './chrome-opener.ts';
import { createHealthClient } from './health-client.ts';
import { launcherPageUrl } from './launcher-pages-location.ts';
import { createLauncherStateWriter } from './launcher-state-writer.ts';
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

/**
 * Test hook: program folder in place of the folder of `process.execPath`, so integration tests
 * can give the launcher pages and `launcher-state.js` their own folder (#120 test expectation).
 */
export const TEST_PROGRAM_DIR_ENV = 'RESELLR_TEST_PROGRAM_DIR';

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
      default:
        // `stop` (#123) and `availability-report` (#116) are not built yet.
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
  const operationsLog = createDailyJsonlWriter({ dir: paths.logDir, kind: 'operations' });
  // `resellr-node.exe` lies in the program folder (2.19), like for the server.
  const programDir = env[TEST_PROGRAM_DIR_ENV] || dirname(process.execPath);
  return runOpenCommand({
    healthClient: createHealthClient({ port }),
    chromeOpener: createChromeOpener({
      warn: (event) => operationsLog.write({ level: 'warn', event }),
    }),
    startFailedPageUrl: (refNo) => launcherPageUrl(programDir, 'lp-02', { ref: refNo }),
    subscribe: () => subscribeToSupervisor(pipePath),
    becomeSupervisor: async (onPhase) => {
      const pipe = await listenSupervisorPipe(pipePath);
      if (pipe === null) return 'taken';
      await supervise(pipe, paths, env, onPhase);
      return 'ended';
    },
    newRequestId: randomUUID,
    waitingPageUrl: (request) => launcherPageUrl(programDir, 'lp-01', { request }),
    launcherState: createLauncherStateWriter(programDir),
  });
}

/** Command `supervise` (2.18): becomes the supervisor, or ends at once if one runs; no Chrome. */
async function runSupervise(env: RuntimeEnv): Promise<LauncherExitCode> {
  const paths = resolveRuntimePaths(env);
  const pipe = await listenSupervisorPipe(pipePathFor(env));
  if (pipe !== null) await supervise(pipe, paths, env);
  return LauncherExitCode.Success;
}

function supervise(
  pipe: SupervisorPipeServer,
  paths: RuntimePaths,
  env: RuntimeEnv,
  onPhase?: (event: PhaseEvent) => void,
): Promise<void> {
  return runSupervisor({
    pipe,
    onPhase,
    startServer: ({ startId, onReady }) => startServerProcess({ paths, startId, env, onReady }),
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
