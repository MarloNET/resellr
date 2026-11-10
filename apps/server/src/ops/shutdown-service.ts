import type { ServerResponse } from 'node:http';
import { join } from 'node:path';

import { ExitCode } from '@resellr/runtime-shared/exit-codes';
import { createReferenceNumber } from '@resellr/runtime-shared/reference-number';
import { writeFileAtomic } from '@resellr/runtime-shared/runtime-state-files';

import type { Database } from '../db/database.ts';
import { ShuttingDownError } from '../shared/domain-error.ts';
import type { ErrorLog } from './error-log.ts';
import type { LifecycleState } from './lifecycle-state.ts';
import type { OperationsLog } from './operations-log.ts';

/** End marker in the data folder, only after an orderly shutdown (2.19). */
export const SHUTDOWN_MARKER_FILE_NAME = 'shutdown-marker.json';

/** Longest wait for running writes; longer actions check `isStopping()` themselves (2.17 step 3). */
export const WRITE_WAIT_MS = 10_000;

/** The process ends at the latest this long after the response was handed over (FIND-217). */
export const EXIT_DELAY_MS = 5_000;

/** `shutdown-marker.json` (2.19): read by the startup check for the kind of the last end. */
export interface ShutdownMarker {
  endedAt: string;
  appVersion: string;
  startId: string | null;
}

export interface ShutdownServiceOptions {
  lifecycle: LifecycleState;
  /** `waitUntilIdle` of the write gate (CU-024): true once no write runs, false after the limit. */
  waitForWrites: (timeoutMs: number) => Promise<boolean>;
  database: Pick<Database<unknown>, 'checkpoint' | 'closeConnection' | 'reopen'>;
  dataDir: string;
  appVersion: string;
  /** Start identifier from the supervisor (`RESELLR_START_ID`); null when started directly. */
  startId: string | null;
  now: () => Date;
  errorLog: ErrorLog;
  operationsLog: OperationsLog;
  /** Ends the process; `main.ts` passes `process.exit`. */
  exit: (code: number) => void;
}

export type ShutdownResult =
  | { state: 'stopped'; dataDirPath: string }
  /** resellr runs on; `refNo` is in the error log. */
  | { state: 'failed'; refNo: string };

export interface ShutdownService {
  /**
   * Steps 1 to 6 and 8 of the orderly shutdown (2.17) and the event `stopped_by_user` of step 7.
   * Throws `ShuttingDownError` unless the state is `ready`.
   */
  shutdown(): Promise<ShutdownResult>;
  /** Rest of step 7: exit code 0 once `response` is sent or closed, at the latest after 5 s. */
  exitAfterResponse(response: ServerResponse): void;
}

/**
 * Orderly shutdown (CU-245, Technical Specification 2.17, Baseline 9.6): afterwards the data
 * folder can be copied as it is (REQ-106). Step 7 "release the single-instance lock" follows
 * with CU-246 (#133).
 */
export function createShutdownService({
  lifecycle,
  waitForWrites,
  database,
  dataDir,
  appVersion,
  startId,
  now,
  errorLog,
  operationsLog,
  exit,
}: ShutdownServiceOptions): ShutdownService {
  const writeMarker = () => {
    const marker: ShutdownMarker = { endedAt: now().toISOString(), appVersion, startId };
    writeFileAtomic(join(dataDir, SHUTDOWN_MARKER_FILE_NAME), `${JSON.stringify(marker)}\n`);
  };

  return {
    async shutdown() {
      // Steps 1 and 2: from here on the write gate rejects new writes with 503.
      if (!lifecycle.beginStopping()) throw new ShuttingDownError();
      // Step 3: after the limit the checkpoint fails if a write still holds the connection.
      await waitForWrites(WRITE_WAIT_MS);

      try {
        database.checkpoint();
        database.closeConnection();
        writeMarker();
      } catch (error) {
        // Step 8: resellr runs on; no marker exists, because writing it is the last step.
        const refNo = createReferenceNumber();
        errorLog.error({ refNo, function: 'ops.shutdown', error });
        try {
          database.reopen();
        } catch (reopenError) {
          // Stay reachable so the user can retry the shutdown (FIND-284).
          errorLog.error({ refNo, function: 'ops.shutdown', error: reopenError });
        }
        lifecycle.set('ready');
        operationsLog.warn('shutdown_failed', { refNo });
        return { state: 'failed', refNo };
      }

      operationsLog.event('stopped_by_user');
      return { state: 'stopped', dataDirPath: dataDir };
    },

    exitAfterResponse(response) {
      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        exit(ExitCode.StoppedByUser);
      };
      const timer = setTimeout(end, EXIT_DELAY_MS);
      // `close` without `finish`: the browser went away before the response was complete.
      response.once('finish', end);
      response.once('close', end);
    },
  };
}
