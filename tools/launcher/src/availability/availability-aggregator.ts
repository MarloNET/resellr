import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readDailyFiles } from '@resellr/runtime-shared/daily-jsonl-writer';
import { writeFileAtomic } from '@resellr/runtime-shared/runtime-state-files';

/** One line per summarised day in the log folder (Technical Specification 2.18, 2.19). */
export const AVAILABILITY_DAYS_FILE_NAME = 'availability-days.jsonl';

/** After a check its result holds until the next one, at most this long (2.18). */
export const AVAILABLE_AFTER_PROBE_MS = 6 * 60 * 1000;

/** Lines of `availability-days.jsonl` older than this many months are deleted (FIND-221). */
export const DAYS_RETENTION_MONTHS = 24;

/** Business hours of REQ-065: Monday to Saturday, 8 to 18 o'clock Europe/Berlin. */
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What the logs tell about the availability at an instant:
 * - `probe`: entry of the availability check (CU-265)
 * - `down`: `crash`, `gave_up` or `start_aborted`; no server until the next successful start
 * - `ready`: `server_ready`, a successful start
 * - `stopped_by_user`: orderly shutdown by the user
 * - `start`: start attempt (`supervisor_started`, `server_started`)
 */
export type AvailabilityMark =
  | { at: number; kind: 'probe'; ok: boolean }
  | { at: number; kind: 'down' | 'ready' | 'stopped_by_user' | 'start' };

/** Line of `availability-days.jsonl`: shares of the business hours of one day in milliseconds. */
export interface DaySummary {
  /** Calendar day in Europe/Berlin, `YYYY-MM-DD`. */
  date: string;
  availableMs: number;
  unavailableMs: number;
  stoppedByUserMs: number;
  pcOffMs: number;
  unmeasuredMs: number;
}

type Share = 'availableMs' | 'unavailableMs' | 'stoppedByUserMs' | 'pcOffMs' | 'unmeasuredMs';

interface Segment {
  from: number;
  to: number;
  share: Share;
}

const OPERATIONS_MARKS: Record<string, Exclude<AvailabilityMark['kind'], 'probe'>> = {
  crash: 'down',
  gave_up: 'down',
  start_aborted: 'down',
  server_ready: 'ready',
  stopped_by_user: 'stopped_by_user',
  supervisor_started: 'start',
  server_started: 'start',
};

/**
 * Marks and Windows starts from the entries of the availability and operations logs, in time
 * order. Windows starts come from `bootTime` of `supervisor_started` (2.18). Entries without a
 * valid `ts` are skipped.
 */
export function marksFromLogEntries({
  availability,
  operations,
}: {
  availability: readonly Record<string, unknown>[];
  operations: readonly Record<string, unknown>[];
}): { marks: AvailabilityMark[]; boots: number[] } {
  const marks: AvailabilityMark[] = [];
  const boots: number[] = [];
  for (const entry of operations) {
    const at = instantOf(entry.ts);
    const kind = typeof entry.event === 'string' ? OPERATIONS_MARKS[entry.event] : undefined;
    if (at === null || kind === undefined) continue;
    marks.push({ at, kind });
    const bootTime = entry.event === 'supervisor_started' ? instantOf(entry.bootTime) : null;
    if (bootTime !== null) boots.push(bootTime);
  }
  for (const entry of availability) {
    const at = instantOf(entry.ts);
    if (at !== null && typeof entry.ok === 'boolean')
      marks.push({ at, kind: 'probe', ok: entry.ok });
  }
  // Stable: at the same instant an event of the operations log comes before a check.
  marks.sort((a, b) => a.at - b.at);
  return { marks, boots };
}

/**
 * Shares of the business hours per day (CU-269, Technical Specification 2.18
 * "Verfügbarkeitsauswertung", OD-05 a, FIND-113), only Monday to Saturday 8 to 18 o'clock
 * Europe/Berlin:
 *
 * - available: after a successful check until the next mark, at most 6 minutes
 * - not available: after a failed check likewise; after `crash`, `gave_up` or `start_aborted`
 *   until the next successful start (`server_ready` or a successful check)
 * - stopped by the user: from `stopped_by_user` until the next start attempt
 * - PC off: a gap without events with a Windows start in it
 * - without measurement: every other gap
 *
 * The timeline ends at `end`; time after it counts in no share.
 */
export function summarizeDays({
  days,
  marks,
  boots,
  end,
}: {
  days: readonly string[];
  marks: readonly AvailabilityMark[];
  boots: readonly number[];
  end: number;
}): DaySummary[] {
  const segments = classifyGaps(coveredSegments(marks, end), boots, end);
  return days.map((date) => {
    const summary: DaySummary = {
      date,
      availableMs: 0,
      unavailableMs: 0,
      stoppedByUserMs: 0,
      pcOffMs: 0,
      unmeasuredMs: 0,
    };
    const window = businessWindow(date);
    if (window === null) return summary;
    for (const { from, to, share } of segments) {
      const overlap = Math.min(to, window.to) - Math.max(from, window.from);
      if (overlap > 0) summary[share] += overlap;
    }
    return summary;
  });
}

/** Time spans the marks assign to a share; whatever lies between them is a gap. */
function coveredSegments(marks: readonly AvailabilityMark[], end: number): Segment[] {
  const sorted = [...marks].filter((mark) => mark.at < end).sort((a, b) => a.at - b.at);
  const segments: Segment[] = [];
  let state: { share: Share; from: number; until: number } | null = null;

  const close = (at: number) => {
    if (state !== null) {
      const to = Math.min(state.until, at);
      if (to > state.from) segments.push({ from: state.from, to, share: state.share });
    }
    state = null;
  };

  for (const mark of sorted) {
    const current = state as { share: Share; until: number } | null;
    const downUntilReady = current?.share === 'unavailableMs' && current.until === Infinity;
    switch (mark.kind) {
      case 'probe':
        close(mark.at);
        state = {
          share: mark.ok ? 'availableMs' : 'unavailableMs',
          from: mark.at,
          until: mark.at + AVAILABLE_AFTER_PROBE_MS,
        };
        break;
      case 'down':
        close(mark.at);
        state = { share: 'unavailableMs', from: mark.at, until: Infinity };
        break;
      case 'stopped_by_user':
        close(mark.at);
        state = { share: 'stoppedByUserMs', from: mark.at, until: Infinity };
        break;
      case 'ready':
        if (downUntilReady) close(mark.at);
        break;
      case 'start':
        if (current?.share === 'stoppedByUserMs') close(mark.at);
        break;
    }
  }
  close(end);
  return segments;
}

/** Adds the gaps between the covered spans: PC off with a Windows start in it, else unmeasured. */
function classifyGaps(covered: Segment[], boots: readonly number[], end: number): Segment[] {
  const segments: Segment[] = [];
  let gapFrom = -Infinity;
  const addGap = (to: number) => {
    if (to <= gapFrom) return;
    const pcOff = boots.some((boot) => boot >= gapFrom && boot < to);
    segments.push({ from: gapFrom, to, share: pcOff ? 'pcOffMs' : 'unmeasuredMs' });
  };
  for (const segment of covered) {
    addGap(segment.from);
    segments.push(segment);
    gapFrom = segment.to;
  }
  addGap(end);
  return segments;
}

/** Business hours of a day as instants, or null on a Sunday. */
function businessWindow(date: string): { from: number; to: number } | null {
  if (new Date(`${date}T00:00:00.000Z`).getUTCDay() === 0) return null;
  return {
    from: berlinInstant(date, BUSINESS_START_HOUR),
    to: berlinInstant(date, BUSINESS_END_HOUR),
  };
}

const berlinParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Calendar day in Europe/Berlin like every other "today" in resellr (2.0.1). */
export function berlinDay(instant: number): string {
  const part = partsOf(instant);
  return `${part.year}-${part.month}-${part.day}`;
}

function partsOf(instant: number): Record<string, string> {
  return Object.fromEntries(
    berlinParts.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
}

/**
 * Instant of a full hour on a day in Europe/Berlin. The clock changes at night, so the offset
 * at that hour in UTC is the offset at the hour itself for the business hours.
 */
function berlinInstant(date: string, hour: number): number {
  const guess = Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);
  const part = partsOf(guess);
  const wallClock = Date.UTC(
    Number(part.year),
    Number(part.month) - 1,
    Number(part.day),
    Number(part.hour),
    Number(part.minute),
  );
  return guess - (wallClock - guess);
}

/** The calendar day `days` after `date` (negative: before). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function instantOf(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

/** Lines of `availability-days.jsonl`; lines that are no valid summary are skipped. */
export function readDaySummaries(logDir: string): DaySummary[] {
  let text: string;
  try {
    text = readFileSync(join(logDir, AVAILABILITY_DAYS_FILE_NAME), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return text.split('\n').flatMap((line) => {
    try {
      const value = JSON.parse(line) as Partial<DaySummary> | null;
      return typeof value?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
        ? [value as DaySummary]
        : [];
    } catch {
      return [];
    }
  });
}

export interface SummarizeMissingDaysOptions {
  logDir: string;
  now?: () => Date;
  /** Windows start of this boot, so the gap up to `now` is classified before it is logged. */
  bootTime?: number;
}

/**
 * Summarises every day after the last line of `availability-days.jsonl` up to yesterday
 * (Europe/Berlin), appends one line per day and deletes lines older than 24 months (2.18, 2.19
 * Housekeeping, FIND-221). Without any line it begins with the oldest daily log file. The
 * supervisor calls it at its start and at the first check after midnight. Returns the new lines.
 */
export function summarizeMissingDays({
  logDir,
  now = () => new Date(),
  bootTime,
}: SummarizeMissingDaysOptions): DaySummary[] {
  const end = now().getTime();
  const today = berlinDay(end);
  const existing = readDaySummaries(logDir);
  const availability = readDailyFiles({ dir: logDir, kind: 'availability' });
  const operations = readDailyFiles({ dir: logDir, kind: 'operations' });

  const lastDate = existing.at(-1)?.date;
  const firstDate =
    lastDate !== undefined
      ? addDays(lastDate, 1)
      : [...availability, ...operations].map((file) => file.day).sort()[0];
  const days: string[] = [];
  for (let date = firstDate; date !== undefined && date < today; date = addDays(date, 1)) {
    days.push(date);
  }

  let added: DaySummary[] = [];
  if (days.length > 0) {
    const { marks, boots } = marksFromLogEntries({
      availability: availability.flatMap((file) => file.entries),
      operations: operations.flatMap((file) => file.entries),
    });
    if (bootTime !== undefined) boots.push(bootTime);
    added = summarizeDays({ days, marks, boots, end });
  }

  const oldestKept = monthsBefore(today, DAYS_RETENTION_MONTHS);
  const kept = [...existing, ...added].filter((summary) => summary.date >= oldestKept);
  if (added.length > 0 || kept.length !== existing.length) {
    writeFileAtomic(
      join(logDir, AVAILABILITY_DAYS_FILE_NAME),
      kept.map((summary) => `${JSON.stringify(summary)}\n`).join(''),
    );
  }
  return added;
}

/** The same calendar day `months` months before `date`; at a month end the last day instead. */
function monthsBefore(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
