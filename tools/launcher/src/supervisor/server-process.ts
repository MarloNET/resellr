import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ExitCode } from '@resellr/runtime-shared/exit-codes';
import type { RuntimeEnv, RuntimePaths } from '@resellr/runtime-shared/paths';
import { readStartResult } from '@resellr/runtime-shared/runtime-state-files';

/** Entry of `resellr-server` in the source tree; the packaging step replaces it with `app/server.mjs`. */
export const SERVER_ENTRY = fileURLToPath(
  new URL('../../../../apps/server/src/main.ts', import.meta.url),
);

/**
 * Test hook: path of a script the supervisor starts instead of `resellr-server`, so integration
 * tests can let the server end with a chosen exit code (#119 test expectation).
 */
export const TEST_SERVER_ENTRY_ENV = 'RESELLR_TEST_SERVER_ENTRY';

/** How a run of the server process ended, from its exit code (2.18 "Exit-Codes"). */
export type ServerEnd =
  | { kind: 'stopped' }
  /** `refNo` from `start-result.json` of this start, null if the file names another start. */
  | { kind: 'aborted'; refNo: string | null }
  | { kind: 'already_running' }
  /** Every other exit code, also 12 and an end by a signal. */
  | { kind: 'crashed'; exitCode: number | null; signal: NodeJS.Signals | null };

export interface ServerProcessOptions {
  paths: RuntimePaths;
  /** Identifier of this start attempt (`RESELLR_START_ID`). */
  startId: string;
  /** Environment of the supervisor, passed on to the server. */
  env: RuntimeEnv;
  serverEntry?: string;
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
 */
export function startServerProcess({
  paths,
  startId,
  env,
  serverEntry = env[TEST_SERVER_ENTRY_ENV] || SERVER_ENTRY,
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
  child.on('message', (message: unknown) => {
    const { type, startId: reported } = (message ?? {}) as { type?: unknown; startId?: unknown };
    if (ready || type !== 'ready' || reported !== startId) return;
    ready = true;
    onReady();
  });

  const ended = new Promise<ServerEnd>((resolve) => {
    // `error` without `exit` means the process could not be started at all.
    child.once('error', () => resolve({ kind: 'crashed', exitCode: null, signal: null }));
    child.once('exit', (exitCode, signal) =>
      resolve(classifyServerExit(exitCode, signal, () => abortRefNo(paths.logDir, startId))),
    );
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
