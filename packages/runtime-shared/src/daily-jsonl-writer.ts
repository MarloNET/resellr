import { appendFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/** Daily files older than this are deleted (Technical Specification 2.19, Housekeeping). */
const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar days follow Europe/Berlin like every other "today" in resellr (2.0.1).
const berlinDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const toDay = (instant: Date): string => berlinDate.format(instant);

/** The calendar day `days` before `day`, both as `YYYY-MM-DD`. */
const daysBefore = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) - days * DAY_MS).toISOString().slice(0, 10);

export interface DailyJsonlWriterOptions {
  /** Log folder that holds the daily files. */
  dir: string;
  /** File name prefix such as `errors`, `operations` or `availability`. */
  kind: string;
  now?: () => Date;
}

export interface DailyJsonlWriter {
  /**
   * Appends the entry as one JSON line, with `ts` set to the current instant, to `<kind>-<YYYY-MM-DD>.jsonl`.
   * A `ts` field in the entry is replaced. A failed cleanup of expired files never prevents the write.
   */
  write(entry: Record<string, unknown>): void;
  /**
   * Deletes the daily files of this kind older than 30 days and returns their names. A file that is
   * already gone counts as deleted. If a file cannot be deleted, the others are still tried and the
   * first error is thrown afterwards.
   */
  deleteExpiredFiles(): string[];
}

/**
 * Writes JSON Lines into one file per day and kind. The first write of each day also
 * deletes the expired files of the kind, so a long-running process keeps the folder clean.
 */
export function createDailyJsonlWriter({
  dir,
  kind,
  now = () => new Date(),
}: DailyJsonlWriterOptions): DailyJsonlWriter {
  if (!/^[a-z]+$/.test(kind)) {
    throw new Error(`Invalid daily file kind: ${JSON.stringify(kind)}`);
  }
  const dailyFile = new RegExp(`^${kind}-(\\d{4}-\\d{2}-\\d{2})\\.jsonl$`);
  let currentDay: string | null = null;

  const deleteExpiredFiles = (): string[] => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const oldestKept = daysBefore(toDay(now()), RETENTION_DAYS);
    const expired = names.filter((name) => {
      const day = dailyFile.exec(name)?.[1];
      return day !== undefined && day < oldestKept;
    });
    let firstError: unknown;
    for (const name of expired) {
      try {
        unlinkSync(join(dir, name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') firstError ??= error;
      }
    }
    if (firstError !== undefined) throw firstError;
    return expired;
  };

  const write = (entry: Record<string, unknown>): void => {
    const instant = now();
    const day = toDay(instant);
    if (day !== currentDay) {
      mkdirSync(dir, { recursive: true });
      currentDay = day;
      try {
        deleteExpiredFiles();
      } catch {
        // Losing the entry would be worse than keeping an old file; the next day retries.
      }
    }
    // `ts` comes first in the line and always holds the current instant.
    const ts = instant.toISOString();
    const line = JSON.stringify(Object.assign({ ts }, entry, { ts }));
    appendFileSync(join(dir, `${kind}-${day}.jsonl`), `${line}\n`, 'utf8');
  };

  return { write, deleteExpiredFiles };
}
