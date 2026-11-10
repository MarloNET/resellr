import { readConfiguredPort } from '@resellr/runtime-shared/configured-port';
import { createDailyJsonlWriter } from '@resellr/runtime-shared/daily-jsonl-writer';
import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';
import { resolveRuntimePaths, type RuntimeEnv } from '@resellr/runtime-shared/paths';

import { createChromeOpener } from './chrome-opener.ts';
import { createHealthClient } from './health-client.ts';
import { runOpenCommand } from './open-command.ts';

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
      default:
        // `supervise` (#119), `stop` (#123) and `availability-report` (#116) are not built yet.
        return LauncherExitCode.Failed;
    }
  } catch {
    return LauncherExitCode.Failed;
  }
}

function runOpen(env: RuntimeEnv): Promise<LauncherExitCode> {
  const { dataDir, logDir } = resolveRuntimePaths(env);
  // The same rule as the server, read anew on every call; the launcher only reads `config.json`
  // and writes no warning about it (2.19, Nachtrag MAR-296).
  const { port } = readConfiguredPort(dataDir);
  const operationsLog = createDailyJsonlWriter({ dir: logDir, kind: 'operations' });
  return runOpenCommand({
    healthClient: createHealthClient({ port }),
    chromeOpener: createChromeOpener({
      warn: (event) => operationsLog.write({ level: 'warn', event }),
    }),
  });
}

if (import.meta.main) {
  process.exitCode = await runCli(process.argv.slice(2));
}
