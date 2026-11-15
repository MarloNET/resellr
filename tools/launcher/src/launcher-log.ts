import { createDailyJsonlWriter } from '@resellr/runtime-shared/daily-jsonl-writer';

export interface LauncherLogOptions {
  /** Log folder (Technical Specification 2.19). */
  dir: string;
  appVersion: string;
  now?: () => Date;
}

/** End of a crashed server run, as CU-264 reports it. */
export interface CrashEntry {
  /** Start the supervisor watched when the server crashed. */
  startId: string;
  refNo: string;
  exitCode: number | null;
  signal: string | null;
}

/**
 * Why a start was aborted (2.18 "Referenznummern in beiden Protokollen", Nachtrag MAR-498):
 * `start_aborted` the server aborted it (exit code 10 with a start result of this start),
 * `start_result_missing` exit code 10 without one, `start_limit` no `ready` within 10 minutes.
 * The value is the `function` `launcher.<cause>` in the error log.
 */
export type StartAbortCause = 'start_aborted' | 'start_result_missing' | 'start_limit';

/** End of the server after `stop`; `cause` names an end by the start limit (Nachtrag MAR-764). */
export type StopCrashEntry = CrashEntry & { cause?: 'start_limit' };

/** A reference number the launcher shows, with the start it belongs to. */
export interface ShownRefNo {
  /** Start the supervisor watched, null for `open`. */
  startId: string | null;
  refNo: string;
}

export interface LauncherLog {
  /** Start of the supervisor with the Windows start of this boot, for "PC aus" (2.18). */
  supervisorStarted(entry: { bootTime: Date }): void;
  /** End of the supervisor; `startId` is the last start it watched. */
  supervisorEnded(entry: { startId: string | null }): void;
  /** Warning of `open`: Chrome is not registered, the address opens through `explorer.exe` (2.19). */
  chromeNotFound(): void;
  /** Event `crash` with its reference number, also into the error log (2.18, FIND-210). */
  crash(entry: CrashEntry): void;
  /** Event `start_aborted` for every `aborted`, also into the error log (Nachtrag MAR-498). */
  startAborted(entry: ShownRefNo & { cause: StartAbortCause }): void;
  /** Event `gave_up` after the fourth crash in 10 minutes, also into the error log. */
  gaveUp(entry: ShownRefNo): void;
  /** Warning `already_running` (exit code 11), also into the error log (Nachtrag MAR-382). */
  alreadyRunning(entry: ShownRefNo): void;
  /** Event `start_timeout` of `open` after 120 s without a result, also into the error log (K-07). */
  startTimeout(entry: ShownRefNo): void;
  /**
   * Event `stop_crash`: the server ended with a code other than 0 while stopping (FIND-234), or
   * by the start limit in `stop_pending` (Nachtrag MAR-764).
   */
  stopCrash(entry: StopCrashEntry): void;
  /**
   * Event `shutdown_failed`: the server still runs 30 s after `stop`, also into the error log as
   * `launcher.shutdown_timeout` (Nachtrag MAR-764).
   */
  shutdownTimeout(entry: ShownRefNo): void;
}

type Details = Record<string, string | number | null>;

/** English description of each launcher entry in the error log, without field values. */
const ERROR_MESSAGES = {
  start_aborted: 'start of resellr-server aborted, the cause is in the entry of the server',
  start_result_missing: 'start of resellr-server aborted without a start result of this start',
  start_limit: 'start of resellr-server ended after 10 minutes without ready',
  gave_up: 'resellr-server not restarted after the fourth crash in 10 minutes',
  already_running: 'resellr-server ended because another server already runs',
  start_timeout: 'no result of the start of resellr-server after 120 s',
  shutdown_timeout: 'resellr-server still runs 30 s after the request to stop',
} as const;

const exitDescription = ({ exitCode, signal }: CrashEntry) =>
  exitCode === null ? `by signal ${signal}` : `with exit code ${exitCode}`;

/**
 * Launcher log (CU-296, Technical Specification 2.18, 2.19): events of the launcher in the same
 * daily operations log as the server, through the same `DailyJsonlWriter`. Every entry has
 * `ts`, `level`, `event`, the details, `appVersion` and `startId` (the start the process watches,
 * otherwise null, e.g. for `open`). Every reference number the launcher shows (`start_timeout`,
 * `start_aborted`, `crash`, `gave_up`, `already_running`, `shutdown_failed`) also goes into the error log with
 * `refNo` and `function` `launcher.<event>`, so the hint to the error log holds (2.0.5, FIND-210).
 */
export function createLauncherLog({ dir, appVersion, now }: LauncherLogOptions): LauncherLog {
  const operations = createDailyJsonlWriter({ dir, kind: 'operations', now });
  const errors = createDailyJsonlWriter({ dir, kind: 'errors', now });

  const write = (
    level: 'info' | 'warn',
    event: string,
    startId: string | null,
    details: Details = {},
  ) => operations.write({ level, event, ...details, appVersion, startId });

  const writeError = (fn: string, startId: string | null, refNo: string, message: string) =>
    errors.write({
      level: 'error',
      refNo,
      function: `launcher.${fn}`,
      message,
      stack: null,
      appVersion,
      startId,
    });

  /** An event with a shown reference number: operations log first, then the error log. */
  const writeShown = (
    event: string,
    fn: keyof typeof ERROR_MESSAGES,
    { startId, refNo }: ShownRefNo,
  ) => {
    write('warn', event, startId, { refNo });
    writeError(fn, startId, refNo, ERROR_MESSAGES[fn]);
  };

  return {
    supervisorStarted: ({ bootTime }) =>
      write('info', 'supervisor_started', null, { bootTime: bootTime.toISOString() }),
    supervisorEnded: ({ startId }) => write('info', 'supervisor_ended', startId),
    chromeNotFound: () => write('warn', 'chrome_not_found', null),
    crash: (entry) => {
      const { startId, refNo, exitCode, signal } = entry;
      write('warn', 'crash', startId, { refNo, exitCode, signal });
      writeError(
        'crash',
        startId,
        refNo,
        `resellr-server ended unexpectedly ${exitDescription(entry)}`,
      );
    },
    startAborted: ({ cause, ...shown }) => writeShown('start_aborted', cause, shown),
    gaveUp: (shown) => writeShown('gave_up', 'gave_up', shown),
    alreadyRunning: (shown) => writeShown('already_running', 'already_running', shown),
    startTimeout: (shown) => writeShown('start_timeout', 'start_timeout', shown),
    shutdownTimeout: (shown) => writeShown('shutdown_failed', 'shutdown_timeout', shown),
    // Only the operations log: LP-03 shows the number of `error`, not of `stop_crash` (2.18).
    stopCrash: ({ startId, refNo, exitCode, signal, cause }) =>
      write('warn', 'stop_crash', startId, {
        refNo,
        exitCode,
        signal,
        ...(cause === undefined ? {} : { cause }),
      }),
  };
}
