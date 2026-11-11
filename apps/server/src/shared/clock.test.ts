import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { type Clock, createClock, createClockFromArgs, type TestClock } from './clock.ts';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('clock (CU-032)', () => {
  it('returns the current instant', () => {
    expect(createClock().now().toISOString()).toBe('2026-11-09T10:00:00.000Z');
  });

  it.each([
    ['2026-11-09T22:59:59.999Z', '2026-11-09'],
    ['2026-11-09T23:00:00.000Z', '2026-11-10'],
    ['2026-07-31T21:59:59.999Z', '2026-07-31'],
    ['2026-07-31T22:00:00.000Z', '2026-08-01'],
  ])('at %s today is %s in Europe/Berlin', (instant, day) => {
    vi.setSystemTime(new Date(instant));

    expect(createClock().today()).toBe(day);
  });

  it('the normal clock cannot be set', () => {
    const clock = createClock();

    expectTypeOf(clock).toEqualTypeOf<Clock>();
    expect('set' in clock).toBe(false);
    expect('set' in createClock({ testClock: false })).toBe(false);
  });

  it('the test clock moves to an instant and keeps running from there', () => {
    const clock = createClock({ testClock: true });
    expectTypeOf(clock).toEqualTypeOf<TestClock>();

    clock.set(new Date('2027-12-14T10:00:00.000Z'));
    expect(clock.now().toISOString()).toBe('2027-12-14T10:00:00.000Z');
    expect(clock.today()).toBe('2027-12-14');

    vi.advanceTimersByTime(1500);
    expect(clock.now().toISOString()).toBe('2027-12-14T10:00:01.500Z');
  });

  it('without --test-clock the arguments give the normal clock', () => {
    const clock = createClockFromArgs(['node', 'main.ts']);

    expect('set' in clock).toBe(false);
    expect(clock.now().toISOString()).toBe('2026-11-09T10:00:00.000Z');
  });

  it('--test-clock gives the test clock at the current instant', () => {
    const clock = createClockFromArgs(['node', 'main.ts', '--test-clock']);

    expect('set' in clock).toBe(true);
    expect(clock.now().toISOString()).toBe('2026-11-09T10:00:00.000Z');
  });

  it('--test-clock=<instant> starts the test clock at that instant, and it keeps running', () => {
    const clock = createClockFromArgs(['node', 'main.ts', '--test-clock=2027-12-14T10:00:00.000Z']);

    expect('set' in clock).toBe(true);
    expect(clock.today()).toBe('2027-12-14');
    vi.advanceTimersByTime(1500);
    expect(clock.now().toISOString()).toBe('2027-12-14T10:00:01.500Z');
  });

  it('rejects --test-clock with a value that is no instant', () => {
    expect(() => createClockFromArgs(['node', 'main.ts', '--test-clock=morgen'])).toThrow(
      '--test-clock=morgen is no ISO 8601 instant',
    );
  });

  it.each([
    ['a day that does not exist', '2027-02-30T10:00:00Z'],
    ['February 29 outside a leap year', '2027-02-29T10:00:00Z'],
    ['month 13', '2027-13-01T10:00:00Z'],
    ['day 0', '2027-02-00T10:00:00Z'],
    ['hour 24', '2027-02-28T24:00:00Z'],
    ['hour 25', '2027-02-28T25:00:00Z'],
    ['minute 60', '2027-02-28T10:60:00Z'],
    ['second 60', '2027-02-28T10:00:60Z'],
    ['an offset of 24 hours', '2027-02-28T10:00:00+24:00'],
    ['an offset minute of 60', '2027-02-28T10:00:00+01:60'],
    ['no time', '2027-02-28'],
    ['no Z or offset', '2027-02-28T10:00:00'],
  ])('E3 rejects --test-clock with %s (%s)', (_, value) => {
    expect(() => createClockFromArgs(['node', 'main.ts', `--test-clock=${value}`])).toThrow(
      `--test-clock=${value} is no ISO 8601 instant`,
    );
  });

  it.each([
    ['2027-02-28T10:00:00Z', '2027-02-28T10:00:00.000Z'],
    ['2027-12-14T10:00:00.000Z', '2027-12-14T10:00:00.000Z'],
    ['2028-02-29T23:59:59.999Z', '2028-02-29T23:59:59.999Z'],
    ['2027-12-14T10:00+01:00', '2027-12-14T09:00:00.000Z'],
    ['2027-12-14T10:00:00-05:30', '2027-12-14T15:30:00.000Z'],
    ['2027-12-14T00:00:00+14:00', '2027-12-13T10:00:00.000Z'],
  ])('E3 accepts --test-clock=%s as the instant %s', (value, instant) => {
    const clock = createClockFromArgs(['node', 'main.ts', `--test-clock=${value}`]);

    expect(clock.now().toISOString()).toBe(instant);
  });

  it('returns a new Date each time so callers cannot move the clock', () => {
    const clock = createClock();

    clock.now().setTime(0);

    expect(clock.now().toISOString()).toBe('2026-11-09T10:00:00.000Z');
  });
});
