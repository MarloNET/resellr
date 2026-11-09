import { createDailyJsonlWriter } from '@resellr/runtime-shared/daily-jsonl-writer';

export interface OperationsLogOptions {
  /** Log folder (`RESELLR_LOG_DIR`, Technical Specification 2.19). */
  dir: string;
  appVersion: string;
  /** Start identifier from the supervisor (`RESELLR_START_ID`); null when started directly. */
  startId: string | null;
  now?: () => Date;
}

/**
 * Details of an event: ids, counts, reasons and reference numbers only, never field values or
 * request content (Baseline 8.4).
 */
export type OperationsEventDetails = Record<string, string | number | boolean | null>;

export interface OperationsLog {
  /** Operating event of the server, e.g. `server_started` or `server_ready` (Baseline 10.7). */
  event(event: string, details?: OperationsEventDetails): void;
  /** Warning, e.g. a rejected `handoverDir` (2.19, FIND-212). */
  warn(event: string, details?: OperationsEventDetails): void;
}

/**
 * Operations log `operations-<date>.jsonl` (CU-037, Technical Specification 2.19): one JSON line
 * per event with `ts, level, event`, the details, `appVersion` and `startId`. The launcher
 * writes its own events into the same daily file through the same `DailyJsonlWriter` (CU-296).
 */
export function createOperationsLog({
  dir,
  appVersion,
  startId,
  now,
}: OperationsLogOptions): OperationsLog {
  const writer = createDailyJsonlWriter({ dir, kind: 'operations', now });

  const write = (level: 'info' | 'warn', event: string, details: OperationsEventDetails = {}) =>
    writer.write({ level, event, ...details, appVersion, startId });

  return {
    event: (event, details) => write('info', event, details),
    warn: (event, details) => write('warn', event, details),
  };
}
