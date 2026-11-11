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

export interface LauncherLog {
  /** Warning of `open`: Chrome is not registered, the address opens through `explorer.exe` (2.19). */
  chromeNotFound(): void;
  /** Event `crash` with its reference number, also into the error log (2.18, FIND-210). */
  crash(entry: CrashEntry): void;
}

type Details = Record<string, string | number | null>;

/**
 * Launcher log (CU-296, Technical Specification 2.18, 2.19): events of the launcher in the same
 * daily operations log as the server, through the same `DailyJsonlWriter`. Every entry has
 * `ts`, `level`, `event`, the details, `appVersion` and `startId` (the start the process watches,
 * otherwise null, e.g. for `open`). Every reference number also goes into the error log with
 * `refNo` and `function` `launcher.<event>`, so the hint to the error log holds (2.0.5).
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

  const writeError = (event: string, startId: string, refNo: string, message: string) =>
    errors.write({
      level: 'error',
      refNo,
      function: `launcher.${event}`,
      message,
      stack: null,
      appVersion,
      startId,
    });

  return {
    chromeNotFound: () => write('warn', 'chrome_not_found', null),
    crash: ({ startId, refNo, exitCode, signal }) => {
      write('warn', 'crash', startId, { refNo, exitCode, signal });
      writeError(
        'crash',
        startId,
        refNo,
        `resellr-server ended unexpectedly ${exitCode === null ? `by signal ${signal}` : `with exit code ${exitCode}`}`,
      );
    },
  };
}
