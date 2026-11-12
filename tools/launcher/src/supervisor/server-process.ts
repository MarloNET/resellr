import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ExitCode } from '@resellr/runtime-shared/exit-codes';
import {
  IS_BUNDLED,
  programFolderPaths,
  type RuntimeEnv,
  type RuntimePaths,
} from '@resellr/runtime-shared/paths';
import { readStartResult } from '@resellr/runtime-shared/runtime-state-files';

/**
 * Entry of `resellr-server`: in the package `app/server.mjs` beside `resellr-node.exe` (2.19),
 * in the source tree `apps/server/src/main.ts`.
 */
export const SERVER_ENTRY = IS_BUNDLED
  ? programFolderPaths(dirname(process.execPath)).serverEntry
  : fileURLToPath(new URL('../../../../apps/server/src/main.ts', import.meta.url));

/**
 * Test hook: path of a script the supervisor starts instead of `resellr-server`, so integration
 * tests can let the server end with a chosen exit code (#119 test expectation).
 */
export const TEST_SERVER_ENTRY_ENV = 'RESELLR_TEST_SERVER_ENTRY';

/** Start limit (2.18 step 5, K-07): a start without `ready` 10 minutes after the spawn hangs. */
export const START_LIMIT_MS = 10 * 60 * 1000;

/**
 * Test hook (6.2 g): `<time-out>,<start limit>` in milliseconds, e.g. `2000,6000`, shortens the
 * time-out of `open` (120 s) and the start limit (10 min) for integration tests.
 */
export const TEST_START_TIMEOUTS_ENV = 'RESELLR_TEST_START_TIMEOUTS';

/** The shortened limits of the test hook; null without a valid value. */
export function testStartTimeouts(env: RuntimeEnv): { timeoutMs: number; limitMs: number } | null {
  const match = /^(\d+),(\d+)$/.exec(env[TEST_START_TIMEOUTS_ENV] ?? '');
  return match ? { timeoutMs: Number(match[1]), limitMs: Number(match[2]) } : null;
}

/** How a run of the server process ended, from its exit code (2.18 "Exit-Codes"). */
export type ServerEnd =
  | { kind: 'stopped' }
  /** `refNo` from `start-result.json` of this start, null if the file names another start. */
  | { kind: 'aborted'; refNo: string | null }
  | { kind: 'already_running' }
  /** No `ready` within the start limit; the supervisor ended the process (K-07), no crash. */
  | { kind: 'start_limit' }
  /** Every other exit code, also 12 and an end by a signal. */
  | { kind: 'crashed'; exitCode: number | null; signal: NodeJS.Signals | null };

export interface ServerProcessOptions {
  paths: RuntimePaths;
  /** Identifier of this start attempt (`RESELLR_START_ID`). */
  startId: string;
  /** Environment of the supervisor, passed on to the server. */
  env: RuntimeEnv;
  serverEntry?: string;
  /** Start limit until `ready`; the test hook shortens it. */
  limitMs?: number;
  /** Called once when the server reports `{ type: 'ready', startId }` with this `startId`. */
  onReady(): void;
}

export interface ServerProcess {
  /** Resolves when the process has ended. */
  ended: Promise<ServerEnd>;
}

/**
 * Starts `resellr-server` (CU-264, Technical Specification 2.18 "Überwachung") with the same
 * Node.js (`resellr-node.exe`, no console window, S-2), hidden and not detached: Node.js puts it in
 * the job object of the supervisor, and the IPC channel ends with the supervisor (H-13, S-3).
 *
 * Start limit (K-07): without `ready` of this start within 10 minutes it ends the process and
 * reports `start_limit`, whatever exit code follows. Windows ends a process at once on every
 * `kill()`; `SIGKILL` does the same under Linux, where the server would wait out its hanging start
 * on SIGTERM (#320). A migration run lost this way is rolled back by SQLite (CU-029).
 */
export function startServerProcess({
  paths,
  startId,
  env,
  serverEntry = env[TEST_SERVER_ENTRY_ENV] || SERVER_ENTRY,
  limitMs = testStartTimeouts(env)?.limitMs ?? START_LIMIT_MS,
  onReady,
}: ServerProcessOptions): ServerProcess {
  const child = spawn(process.execPath, [serverEntry], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    windowsHide: true,
    env: {
      ...env,
      RESELLR_START_ID: startId,
      RESELLR_DATA_DIR: paths.dataDir,
      RESELLR_LOG_DIR: paths.logDir,
      RESELLR_HANDOVER_DIR: paths.handoverDir,
      RESELLR_UPDATE_COPY_DIR: paths.updateCopyDir,
    },
  });

  let ready = false;
  let limitReached = false;
  const limit = setTimeout(() => {
    limitReached = true;
    child.kill('SIGKILL');
  }, limitMs);

  child.on('message', (message: unknown) => {
    const { type, startId: reported } = (message ?? {}) as { type?: unknown; startId?: unknown };
    if (ready || limitReached || type !== 'ready' || reported !== startId) return;
    ready = true;
    clearTimeout(limit);
    onReady();
  });

  const ended = new Promise<ServerEnd>((resolve) => {
    // `error` without `exit` means the process could not be started at all.
    child.once('error', () => {
      clearTimeout(limit);
      resolve({ kind: 'crashed', exitCode: null, signal: null });
    });
    child.once('exit', (exitCode, signal) => {
      clearTimeout(limit);
      resolve(
        limitReached
          ? { kind: 'start_limit' }
          : classifyServerExit(exitCode, signal, () => abortRefNo(paths.logDir, startId)),
      );
    });
  });

  return { ended };
}

/** Sorts an exit code of the server (2.18): 0, 10 and 11 have a meaning, every other is a crash. */
export function classifyServerExit(
  exitCode: number | null,
  signal: NodeJS.Signals | null,
  readAbortRefNo: () => string | null,
): ServerEnd {
  switch (exitCode) {
    case ExitCode.StoppedByUser:
      return { kind: 'stopped' };
    case ExitCode.StartAborted:
      return { kind: 'aborted', refNo: readAbortRefNo() };
    case ExitCode.AlreadyRunning:
      return { kind: 'already_running' };
    default:
      return { kind: 'crashed', exitCode, signal };
  }
}

/** Reference number of the abort of this start; an older start result is never used (FIND-112 b). */
function abortRefNo(logDir: string, startId: string): string | null {
  let result;
  try {
    result = readStartResult(logDir);
  } catch {
    return null;
  }
  return result?.startId === startId && result.state === 'aborted' && result.refNo
    ? result.refNo
    : null;
}
