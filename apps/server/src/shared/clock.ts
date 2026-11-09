/** Server clock (Technical Specification 2.0.1): "today" is the calendar day in Europe/Berlin. */
export interface Clock {
  now(): Date;
  /** Calendar day `YYYY-MM-DD` in Europe/Berlin. */
  today(): string;
}

/**
 * Test clock, only with `--test-clock` (CU-032): `set` moves the clock to an instant and it keeps
 * running from there, so timestamps stay monotonic (MAR-239, F-3).
 */
export interface TestClock extends Clock {
  set(instant: Date): void;
}

/** Command line argument of the server that switches to the test clock. */
export const TEST_CLOCK_FLAG = '--test-clock';

const berlinDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function createClock(options?: { testClock?: false }): Clock;
export function createClock(options: { testClock: true }): TestClock;
export function createClock(options: { testClock: boolean }): Clock | TestClock;
export function createClock({ testClock = false }: { testClock?: boolean } = {}):
  Clock | TestClock {
  let offsetMs = 0;
  const now = () => new Date(Date.now() + offsetMs);
  const clock: Clock = { now, today: () => berlinDate.format(now()) };
  if (!testClock) return clock;
  return {
    ...clock,
    set: (instant) => {
      offsetMs = instant.getTime() - Date.now();
    },
  };
}
