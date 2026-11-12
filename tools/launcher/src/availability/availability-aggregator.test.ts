import { describe, expect, it } from 'vitest';

import {
  AVAILABLE_AFTER_PROBE_MS,
  type AvailabilityMark,
  type DaySummary,
  marksFromLogEntries,
  summarizeDays,
} from './availability-aggregator.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const BUSINESS_DAY_MS = 10 * HOUR;

/** Instant of a wall-clock time in Berlin; November is UTC+1, July UTC+2. */
const t = (local: string): number =>
  Date.parse(`${local}:00${local.startsWith('2026-07') ? '+02:00' : '+01:00'}`);

/** Checks every 5 minutes from `from` to `to`, both included. */
function probes(from: string, to: string, ok = true): AvailabilityMark[] {
  const marks: AvailabilityMark[] = [];
  for (let at = t(from); at <= t(to); at += 5 * MINUTE) marks.push({ at, kind: 'probe', ok });
  return marks;
}

const day = (date: string, shares: Partial<Omit<DaySummary, 'date'>>): DaySummary => ({
  date,
  availableMs: 0,
  unavailableMs: 0,
  stoppedByUserMs: 0,
  pcOffMs: 0,
  unmeasuredMs: 0,
  ...shares,
});

// Tuesday 10 November 2026; the timeline ends the next morning unless a test says otherwise.
const TUESDAY = '2026-11-10';
const END = t('2026-11-11T07:00');

describe('daily summary (CU-269, Technical Specification 2.18 "Verfügbarkeitsauswertung")', () => {
  it('counts the time after a successful check as available for at most 6 minutes', () => {
    expect(AVAILABLE_AFTER_PROBE_MS).toBe(6 * MINUTE);

    const [summary] = summarizeDays({
      days: [TUESDAY],
      marks: [{ at: t('2026-11-10T09:00'), kind: 'probe', ok: true }],
      boots: [],
      end: END,
    });

    expect(summary).toEqual(
      day(TUESDAY, { availableMs: 6 * MINUTE, unmeasuredMs: BUSINESS_DAY_MS - 6 * MINUTE }),
    );
  });

  it('counts only Monday to Saturday 8 to 18 o’clock Europe/Berlin', () => {
    const marks = [
      ...probes('2026-11-07T06:00', '2026-11-07T20:00'), // Saturday
      ...probes('2026-11-08T06:00', '2026-11-08T20:00'), // Sunday
      ...probes('2026-11-09T06:00', '2026-11-09T20:00'), // Monday
    ];

    expect(
      summarizeDays({
        days: ['2026-11-07', '2026-11-08', '2026-11-09'],
        marks,
        boots: [],
        end: t('2026-11-10T07:00'),
      }),
    ).toEqual([
      day('2026-11-07', { availableMs: BUSINESS_DAY_MS }),
      day('2026-11-08', {}),
      day('2026-11-09', { availableMs: BUSINESS_DAY_MS }),
    ]);
  });

  it('follows summer and winter time of Europe/Berlin', () => {
    // 15:00 to 17:00 UTC is 17 to 19 o'clock in July and 16 to 18 o'clock in November.
    const marks = [
      ...probes('2026-07-14T17:00', '2026-07-14T19:00'),
      ...probes('2026-11-10T16:00', '2026-11-10T18:00'),
    ];

    expect(
      summarizeDays({ days: ['2026-07-14', TUESDAY], marks, boots: [], end: END }).map(
        (summary) => summary.availableMs,
      ),
    ).toEqual([1 * HOUR, 2 * HOUR]);
  });

  it('counts failed checks as not available', () => {
    const marks = [
      ...probes('2026-11-10T07:55', '2026-11-10T09:55'),
      ...probes('2026-11-10T10:00', '2026-11-10T10:25', false),
      ...probes('2026-11-10T10:30', '2026-11-10T18:00'),
    ];

    expect(summarizeDays({ days: [TUESDAY], marks, boots: [], end: END })).toEqual([
      day(TUESDAY, { availableMs: BUSINESS_DAY_MS - 30 * MINUTE, unavailableMs: 30 * MINUTE }),
    ]);
  });

  it('crash: not available from the crash until the restarted server is ready', () => {
    const marks: AvailabilityMark[] = [
      ...probes('2026-11-10T07:55', '2026-11-10T12:00'),
      { at: t('2026-11-10T12:01'), kind: 'down' },
      { at: t('2026-11-10T12:01'), kind: 'start' },
      { at: t('2026-11-10T12:02'), kind: 'ready' },
      ...probes('2026-11-10T12:02', '2026-11-10T18:02'),
    ];

    expect(summarizeDays({ days: [TUESDAY], marks, boots: [], end: END })).toEqual([
      day(TUESDAY, { availableMs: BUSINESS_DAY_MS - 1 * MINUTE, unavailableMs: 1 * MINUTE }),
    ]);
  });

  it('restart given up: not available until the next successful start, also over a night with a Windows start', () => {
    const marks: AvailabilityMark[] = [
      ...probes('2026-11-10T07:55', '2026-11-10T13:55'),
      { at: t('2026-11-10T14:00'), kind: 'down' }, // crash
      { at: t('2026-11-10T14:00'), kind: 'start' },
      { at: t('2026-11-10T14:01'), kind: 'down' }, // crash
      { at: t('2026-11-10T14:01'), kind: 'start' },
      { at: t('2026-11-10T14:02'), kind: 'down' }, // crash
      { at: t('2026-11-10T14:02'), kind: 'start' },
      { at: t('2026-11-10T14:03'), kind: 'down' }, // gave_up
      // Next morning: Windows started at 7:30, the user starts resellr at 9:00.
      { at: t('2026-11-11T09:00'), kind: 'start' },
      { at: t('2026-11-11T09:01'), kind: 'ready' },
      ...probes('2026-11-11T09:01', '2026-11-11T18:01'),
    ];

    expect(
      summarizeDays({
        days: [TUESDAY, '2026-11-11'],
        marks,
        boots: [t('2026-11-11T07:30')],
        end: t('2026-11-12T07:00'),
      }),
    ).toEqual([
      day(TUESDAY, { availableMs: 6 * HOUR, unavailableMs: 4 * HOUR }),
      day('2026-11-11', {
        availableMs: 9 * HOUR - 1 * MINUTE,
        unavailableMs: 1 * HOUR + 1 * MINUTE,
      }),
    ]);
  });

  it('stopped by the user: counted apart from the event until the next start attempt', () => {
    const marks: AvailabilityMark[] = [
      ...probes('2026-11-10T07:55', '2026-11-10T15:00'),
      { at: t('2026-11-10T15:02'), kind: 'stopped_by_user' },
      { at: t('2026-11-10T16:00'), kind: 'start' },
      { at: Date.parse('2026-11-10T15:00:30Z'), kind: 'ready' }, // 16:00:30 in Berlin
      ...probes('2026-11-10T16:00', '2026-11-10T18:00').map((mark) => ({
        ...mark,
        at: mark.at + 30_000,
      })),
    ];

    expect(summarizeDays({ days: [TUESDAY], marks, boots: [], end: END })).toEqual([
      day(TUESDAY, {
        availableMs: 7 * HOUR + 2 * MINUTE + 1 * HOUR + 59 * MINUTE + 30_000,
        stoppedByUserMs: 58 * MINUTE,
        // From the start attempt to the first check nothing is measured.
        unmeasuredMs: 30_000,
      }),
    ]);
  });

  it('shutdown: a gap without events with a Windows start in it counts as PC off', () => {
    const marks: AvailabilityMark[] = [
      ...probes('2026-11-10T07:55', '2026-11-10T12:00'),
      { at: t('2026-11-10T13:01'), kind: 'start' }, // supervisor_started, bootTime 13:00
      { at: t('2026-11-10T13:01'), kind: 'start' }, // server_started
      { at: t('2026-11-10T13:02'), kind: 'ready' },
      ...probes('2026-11-10T13:02', '2026-11-10T18:02'),
    ];

    expect(
      summarizeDays({ days: [TUESDAY], marks, boots: [t('2026-11-10T13:00')], end: END }),
    ).toEqual([
      day(TUESDAY, {
        // Up to 12:06 (6 minutes after the last check) and from 13:02 on.
        availableMs: 4 * HOUR + 6 * MINUTE + 4 * HOUR + 58 * MINUTE,
        pcOffMs: 56 * MINUTE,
      }),
    ]);
  });

  it('gap: a gap without events and without a Windows start counts as without measurement', () => {
    const marks: AvailabilityMark[] = [
      ...probes('2026-11-10T07:55', '2026-11-10T12:00'),
      // The supervisor ended unexpectedly; the next one starts at 12:30 without a Windows start.
      { at: t('2026-11-10T12:30'), kind: 'start' },
      { at: t('2026-11-10T12:31'), kind: 'ready' },
      ...probes('2026-11-10T12:31', '2026-11-10T18:01'),
    ];

    expect(
      summarizeDays({ days: [TUESDAY], marks, boots: [t('2026-11-10T07:00')], end: END }),
    ).toEqual([
      day(TUESDAY, {
        availableMs: 4 * HOUR + 6 * MINUTE + 5 * HOUR + 29 * MINUTE,
        unmeasuredMs: 25 * MINUTE,
      }),
    ]);
  });

  it('start_aborted at 9:00 without a later ready: not available until 18:00 (Nachtrag MAR-498)', () => {
    // The entries the supervisor writes for an aborted start (CU-296), 8:00 and 9:00 in Berlin.
    const { marks, boots } = marksFromLogEntries({
      availability: [],
      operations: [
        {
          ts: '2026-11-10T08:00:00.000Z',
          event: 'supervisor_started',
          bootTime: '2026-11-10T07:50:00.000Z',
        },
        { ts: '2026-11-10T08:00:00.000Z', event: 'start_aborted', refNo: 'R-7K2M-9QX4' },
        { ts: '2026-11-10T08:00:00.000Z', event: 'supervisor_ended' },
      ],
    });

    expect(summarizeDays({ days: [TUESDAY], marks, boots, end: END })).toEqual([
      day(TUESDAY, { pcOffMs: 1 * HOUR, unavailableMs: 9 * HOUR }),
    ]);
  });

  it('a failed check without a later mark: not available for 6 minutes, then a gap', () => {
    const [summary] = summarizeDays({
      days: [TUESDAY],
      marks: [{ at: t('2026-11-10T09:00'), kind: 'probe', ok: false }],
      boots: [],
      end: END,
    });

    expect(summary).toEqual(
      day(TUESDAY, { unavailableMs: 6 * MINUTE, unmeasuredMs: BUSINESS_DAY_MS - 6 * MINUTE }),
    );
  });

  it('counts the time after the end of the timeline as nothing', () => {
    const marks = probes('2026-11-10T07:55', '2026-11-10T11:55');

    const [summary] = summarizeDays({
      days: [TUESDAY],
      marks,
      boots: [],
      end: t('2026-11-10T12:00'),
    });

    expect(summary).toEqual(day(TUESDAY, { availableMs: 4 * HOUR }));
  });
});

describe('marks from the logs (CU-269)', () => {
  it('reads checks, launcher and server events and the Windows start of supervisor_started', () => {
    const { marks, boots } = marksFromLogEntries({
      availability: [
        { ts: '2026-11-10T08:00:00.000Z', ok: true },
        { ts: '2026-11-10T08:05:00.000Z', ok: false },
        { ts: 'not a time', ok: true },
        { ts: '2026-11-10T08:06:00.000Z', ok: 'yes' },
      ],
      operations: [
        {
          ts: '2026-11-10T07:59:00.000Z',
          event: 'supervisor_started',
          bootTime: '2026-11-10T07:58:00.000Z',
        },
        { ts: '2026-11-10T07:59:01.000Z', event: 'server_started' },
        { ts: '2026-11-10T07:59:30.000Z', event: 'server_ready' },
        { ts: '2026-11-10T09:00:00.000Z', event: 'crash' },
        { ts: '2026-11-10T09:01:00.000Z', event: 'gave_up' },
        { ts: '2026-11-10T09:02:00.000Z', event: 'start_aborted' },
        { ts: '2026-11-10T09:03:00.000Z', event: 'stopped_by_user' },
        { ts: '2026-11-10T09:04:00.000Z', event: 'chrome_not_found' },
      ],
    });

    const at = (iso: string) => Date.parse(iso);
    expect(marks).toEqual([
      { at: at('2026-11-10T07:59:00.000Z'), kind: 'start' },
      { at: at('2026-11-10T07:59:01.000Z'), kind: 'start' },
      { at: at('2026-11-10T07:59:30.000Z'), kind: 'ready' },
      { at: at('2026-11-10T08:00:00.000Z'), kind: 'probe', ok: true },
      { at: at('2026-11-10T08:05:00.000Z'), kind: 'probe', ok: false },
      { at: at('2026-11-10T09:00:00.000Z'), kind: 'down' },
      { at: at('2026-11-10T09:01:00.000Z'), kind: 'down' },
      { at: at('2026-11-10T09:02:00.000Z'), kind: 'down' },
      { at: at('2026-11-10T09:03:00.000Z'), kind: 'stopped_by_user' },
    ]);
    expect(boots).toEqual([at('2026-11-10T07:58:00.000Z')]);
  });
});
