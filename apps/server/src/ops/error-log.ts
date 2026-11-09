import { createDailyJsonlWriter } from '@resellr/runtime-shared/daily-jsonl-writer';

export interface ErrorLogOptions {
  /** Log folder (`RESELLR_LOG_DIR`, Technical Specification 2.19). */
  dir: string;
  appVersion: string;
  /** Start identifier from the supervisor (`RESELLR_START_ID`); null when started directly. */
  startId: string | null;
  now?: () => Date;
}

export interface ErrorLog {
  /** Technical error with the reference number shown to the user (REQ-073). */
  error(entry: { refNo: string; function: string; error: unknown }): void;
  /** Warning without reference number, e.g. a request rejected by `local-guard` (2.0.2). */
  warn(entry: { function: string; message: string }): void;
}

/**
 * Error log `errors-<date>.jsonl` (Technical Specification 2.19): `ts, level, refNo, function,
 * message, stack, appVersion, startId`. Callers pass no field values or request content
 * (Baseline 8.4); a thrown value that is not an Error is recorded by its type only.
 */
export function createErrorLog({ dir, appVersion, startId, now }: ErrorLogOptions): ErrorLog {
  const writer = createDailyJsonlWriter({ dir, kind: 'errors', now });

  const write = (entry: {
    level: 'error' | 'warn';
    refNo: string | null;
    function: string;
    message: string;
    stack: string | null;
  }) => writer.write({ ...entry, appVersion, startId });

  return {
    error: ({ refNo, function: fn, error }) =>
      write({
        level: 'error',
        refNo,
        function: fn,
        message:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : `non-Error value of type ${typeof error}`,
        stack: error instanceof Error ? (error.stack ?? null) : null,
      }),
    warn: ({ function: fn, message }) =>
      write({ level: 'warn', refNo: null, function: fn, message, stack: null }),
  };
}
