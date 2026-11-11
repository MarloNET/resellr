import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readDailyFiles } from '@resellr/runtime-shared/daily-jsonl-writer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHealthClient } from './health-client.ts';
import { type HealthProbe, PROBE_TIMEOUT_MS, startHealthProbe } from './health-probe.ts';

let logDir: string;
let server: Server | undefined;
let probe: HealthProbe | undefined;

beforeEach(() => {
  logDir = mkdtempSync(join(tmpdir(), 'resellr-health-probe-int-'));
});

afterEach(async () => {
  probe?.stop();
  server?.closeAllConnections();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
  rmSync(logDir, { recursive: true, force: true });
});

/** A loopback server that answers `GET /api/ops/health` with `ready`, or never answers. */
async function startServer(answers: boolean): Promise<number> {
  server = createServer((_, response) => {
    if (!answers) return;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ state: 'ready', startId: 'start-1' }));
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

const entries = () =>
  readDailyFiles({ dir: logDir, kind: 'availability' }).flatMap((f) => f.entries);

describe('health-probe against a loopback server (CU-265, CU-266)', () => {
  it('writes { ts, ok: true } into the availability log of the day when the server is ready', async () => {
    const port = await startServer(true);

    probe = startHealthProbe({ healthClient: createHealthClient({ port }), logDir });

    await expect.poll(entries).toEqual([{ ts: expect.any(String), ok: true }]);
    const [file] = readDailyFiles({ dir: logDir, kind: 'availability' });
    expect(file!.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it(
    'counts a check as failed when no answer comes within 5 s',
    async () => {
      const port = await startServer(false);
      const started = performance.now();
      let probedAfter = 0;

      probe = startHealthProbe({
        healthClient: createHealthClient({ port }),
        logDir,
        onProbe: () => (probedAfter = performance.now() - started),
      });

      await expect
        .poll(entries, { timeout: PROBE_TIMEOUT_MS + 3000 })
        .toEqual([{ ts: expect.any(String), ok: false }]);
      expect(probedAfter).toBeGreaterThanOrEqual(PROBE_TIMEOUT_MS - 50);
      expect(probedAfter).toBeLessThan(PROBE_TIMEOUT_MS + 2000);
    },
    PROBE_TIMEOUT_MS + 10_000,
  );
});
