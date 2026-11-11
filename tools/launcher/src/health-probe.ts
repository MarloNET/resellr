import { createDailyJsonlWriter } from '@resellr/runtime-shared/daily-jsonl-writer';

import type { HealthClient } from './health-client.ts';

/** Interval of the availability check (Technical Specification 2.18, OD-05 a). */
export const PROBE_INTERVAL_MS = 5 * 60 * 1000;

/** Time limit of one check; without an answer within it the check failed. */
export const PROBE_TIMEOUT_MS = 5000;

export interface HealthProbeOptions {
  /** Server client (CU-266) for the port the caller determined through CU-309. */
  healthClient: Pick<HealthClient, 'getHealth'>;
  /** Log folder that holds `availability-<date>.jsonl`. */
  logDir: string;
  now?: () => Date;
  /** Called after each entry with its instant, e.g. for the daily summary after midnight. */
  onProbe?(at: Date): void;
}

export interface HealthProbe {
  /** Ends the checks; a check still running writes nothing. */
  stop(): void;
}

/**
 * Availability check `health-probe` (CU-265, Technical Specification 2.18, OD-05 a): while the
 * server is `ready`, `GET /api/ops/health` at once and then every 5 minutes with a time limit of
 * 5 s, and one entry `{ ts, ok }` per check in `availability-<date>.jsonl`. `ok` is true only
 * for the answer `ready`. The first check comes at once, so the time after `ready` is measured.
 */
export function startHealthProbe({
  healthClient,
  logDir,
  now = () => new Date(),
  onProbe,
}: HealthProbeOptions): HealthProbe {
  const writer = createDailyJsonlWriter({ dir: logDir, kind: 'availability', now });
  let stopped = false;

  const check = async () => {
    const state = await healthClient.getHealth(PROBE_TIMEOUT_MS);
    if (stopped) return;
    const at = now();
    writer.write({ ok: state === 'ready' });
    onProbe?.(at);
  };

  const run = () => {
    // A failed write must not end the supervisor; the next check tries again.
    check().catch(() => {});
  };
  run();
  const timer = setInterval(run, PROBE_INTERVAL_MS);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
