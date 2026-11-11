import { describe, expect, it } from 'vitest';

import { CRASH_GRACE_MS, createRestartPolicy, MAX_RESTARTS } from './restart-policy.ts';

const MINUTE = 60_000;

/** A policy on a clock the test moves; `crashAt(minute)` asks it after the wait of that crash. */
function policyOnClock() {
  let now = 0;
  const policy = createRestartPolicy({ now: () => now });
  return {
    crashAt: (minutes: number) => {
      now = minutes * MINUTE + CRASH_GRACE_MS;
      return policy.mayRestart();
    },
  };
}

describe('restart policy (CU-262, H-10, H-12)', () => {
  it('waits 5 s after a crash and allows 3 restarts in 10 minutes', () => {
    expect(CRASH_GRACE_MS).toBe(5000);
    expect(MAX_RESTARTS).toBe(3);
  });

  it('restarts after the first three crashes and refuses the fourth crash in the window', () => {
    const { crashAt } = policyOnClock();

    expect([crashAt(0), crashAt(1), crashAt(2), crashAt(3)]).toEqual([true, true, true, false]);
  });

  it('refuses the fourth crash even when it comes just before the first restart leaves the window', () => {
    const { crashAt } = policyOnClock();
    crashAt(0);
    crashAt(4);
    crashAt(8);

    // The first restart was at 0:05; at 9:59 + 5 s it is 9 min 59 s old, still in the window.
    expect(crashAt(9 + 59 / 60)).toBe(false);
  });

  it('counts in a sliding window: a restart older than 10 minutes no longer counts', () => {
    const { crashAt } = policyOnClock();
    crashAt(0);
    crashAt(4);
    crashAt(8);

    // At 10:00 + 5 s the restart at 0:05 is exactly 10 minutes old and leaves the window.
    expect(crashAt(10)).toBe(true);
    // In the window from 4:05 on: restarts at 4:05, 8:05 and 10:05.
    expect(crashAt(11)).toBe(false);
  });

  it('does not count a refused restart in the window', () => {
    const { crashAt } = policyOnClock();
    crashAt(0);
    crashAt(1);
    crashAt(2);
    expect(crashAt(3)).toBe(false);

    // Restarts at 1:05 and 2:05 are still in the window at 10:30 + 5 s.
    expect(crashAt(10.5)).toBe(true);
  });
});
