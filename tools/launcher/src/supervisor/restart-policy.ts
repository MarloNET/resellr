/** Wait after a crash before the supervisor restarts the server (Technical Specification 2.18, H-12). */
export const CRASH_GRACE_MS = 5000;

/** At most this many restarts in the sliding window (2.18, Baseline 9.6). */
export const MAX_RESTARTS = 3;

/** Length of the sliding window of the restart limit. */
export const RESTART_WINDOW_MS = 10 * 60 * 1000;

export interface RestartPolicy {
  /**
   * Asked at the end of the wait after a crash: true, and the restart counts, if fewer than 3
   * restarts lie in the last 10 minutes; false otherwise (the fourth crash in the window).
   */
  mayRestart(): boolean;
}

/**
 * Restart rule of the supervisor (CU-262, Technical Specification 2.18 "Absturz und
 * Neustartgrenze", H-10, H-12): at most 3 restarts in a sliding window of 10 minutes. Only
 * restarts that happen count; the start limit (K-07) and exit codes 0, 10 and 11 never reach it.
 */
export function createRestartPolicy({
  now = Date.now,
}: { now?: () => number } = {}): RestartPolicy {
  const restarts: number[] = [];
  return {
    mayRestart: () => {
      const at = now();
      while (restarts.length > 0 && restarts[0]! <= at - RESTART_WINDOW_MS) restarts.shift();
      if (restarts.length >= MAX_RESTARTS) return false;
      restarts.push(at);
      return true;
    },
  };
}
