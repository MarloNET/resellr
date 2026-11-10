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

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Clock of the server process from its command line arguments (CU-032): the normal clock, with
 * `--test-clock` the test clock, and with `--test-clock=<ISO 8601 instant>` the test clock
 * started at that instant, e.g. 400 days after the first use (AC-REQ-104-04, 6.2).
 */
export function createClockFromArgs(argv: readonly string[]): Clock {
  const prefix = `${TEST_CLOCK_FLAG}=`;
  const arg = argv.find((value) => value === TEST_CLOCK_FLAG || value.startsWith(prefix));
  if (arg === undefined) return createClock();
  const clock = createClock({ testClock: true });
  if (arg === TEST_CLOCK_FLAG) return clock;
  const value = arg.slice(prefix.length);
  const instant = new Date(value);
  if (!ISO_INSTANT.test(value) || Number.isNaN(instant.getTime())) {
    throw new Error(`${arg} is no ISO 8601 instant`);
  }
  clock.set(instant);
  return clock;
}
