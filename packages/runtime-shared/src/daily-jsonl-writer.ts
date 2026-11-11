import { appendFileSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
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

/** Pattern of the daily files of a kind; group 1 is the day. */
function dailyFilePattern(kind: string): RegExp {
  if (!/^[a-z]+$/.test(kind)) {
    throw new Error(`Invalid daily file kind: ${JSON.stringify(kind)}`);
  }
  return new RegExp(`^${kind}-(\\d{4}-\\d{2}-\\d{2})\\.jsonl$`);
}

/** Names in the folder; none if it does not exist. */
function listNames(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

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
  const dailyFile = dailyFilePattern(kind);
  let currentDay: string | null = null;

  const deleteExpiredFiles = (): string[] => {
    const names = listNames(dir);
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

/** Entries of one daily file. */
export interface DailyFile {
  /** Calendar day of the file, `YYYY-MM-DD`. */
  day: string;
  /** Its lines that are JSON objects, in file order. */
  entries: Record<string, unknown>[];
}

/**
 * Reads the daily files of a kind, oldest day first. Lines that are no JSON object are skipped,
 * e.g. the last line of a file that a power failure cut off.
 */
export function readDailyFiles({ dir, kind }: { dir: string; kind: string }): DailyFile[] {
  const dailyFile = dailyFilePattern(kind);
  return listNames(dir)
    .flatMap((name) => {
      const day = dailyFile.exec(name)?.[1];
      return day === undefined ? [] : [{ day, name }];
    })
    .sort((a, b) => a.day.localeCompare(b.day))
    .map(({ day, name }) => ({
      day,
      entries: readFileSync(join(dir, name), 'utf8').split('\n').flatMap(parseObjectLine),
    }));
}

function parseObjectLine(line: string): Record<string, unknown>[] {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? [value as Record<string, unknown>]
      : [];
  } catch {
    return [];
  }
}
