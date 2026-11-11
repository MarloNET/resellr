import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readDailyFiles } from '@resellr/runtime-shared/daily-jsonl-writer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HealthState } from './health-client.ts';
import { PROBE_INTERVAL_MS, PROBE_TIMEOUT_MS, startHealthProbe } from './health-probe.ts';

let logDir: string;

beforeEach(() => {
  logDir = mkdtempSync(join(tmpdir(), 'resellr-health-probe-'));
  vi.useFakeTimers({ now: new Date('2026-11-10T09:00:00.000Z') });
});

afterEach(() => {
  vi.useRealTimers();
  rmSync(logDir, { recursive: true, force: true });
});

const entries = () => readDailyFiles({ dir: logDir, kind: 'availability' });

describe('availability check (CU-265, OD-05 a)', () => {
  it('checks every 5 minutes with a time limit of 5 s', () => {
    expect(PROBE_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(PROBE_TIMEOUT_MS).toBe(5000);
  });

  it('writes { ts, ok } into availability-<date>.jsonl at once and then every 5 minutes', async () => {
    const answers: (HealthState | null)[] = ['ready', null, 'starting', 'ready'];
    const getHealth = vi.fn(async () => answers.shift() ?? null);
    const probes: string[] = [];

    const probe = startHealthProbe({
      healthClient: { getHealth },
      logDir,
      onProbe: (at) => probes.push(at.toISOString()),
    });
    await vi.advanceTimersByTimeAsync(3 * PROBE_INTERVAL_MS);
    probe.stop();
    await vi.advanceTimersByTimeAsync(2 * PROBE_INTERVAL_MS);

    expect(getHealth.mock.calls).toEqual([[5000], [5000], [5000], [5000]]);
    expect(entries()).toEqual([
      {
        day: '2026-11-10',
        entries: [
          { ts: '2026-11-10T09:00:00.000Z', ok: true },
          // No answer within the time limit, and a server that is not `ready`, count as failed.
          { ts: '2026-11-10T09:05:00.000Z', ok: false },
          { ts: '2026-11-10T09:10:00.000Z', ok: false },
          { ts: '2026-11-10T09:15:00.000Z', ok: true },
        ],
      },
    ]);
    expect(probes).toEqual([
      '2026-11-10T09:00:00.000Z',
      '2026-11-10T09:05:00.000Z',
      '2026-11-10T09:10:00.000Z',
      '2026-11-10T09:15:00.000Z',
    ]);
  });

  it('writes nothing for a check that is still running when it is stopped', async () => {
    let answer: (state: HealthState | null) => void = () => {};
    const probe = startHealthProbe({
      healthClient: { getHealth: () => new Promise((resolve) => (answer = resolve)) },
      logDir,
    });

    probe.stop();
    answer('ready');
    await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS);

    expect(entries()).toEqual([]);
  });
});
