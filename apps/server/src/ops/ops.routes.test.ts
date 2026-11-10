import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { isReferenceNumber } from '@resellr/runtime-shared/reference-number';
import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST, SAME_ORIGIN_WRITE, TEST_APP_VERSION } from '../../test/test-app.ts';
import { SHUTDOWN_MARKER_FILE_NAME } from './shutdown-service.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

describe('ops routes (CU-041)', () => {
  it.each(['starting', 'ready', 'stopping'] as const)(
    'E1 GET /api/ops/health answers 200 with state %s and startId, without Origin',
    async (state) => {
      t.lifecycle.set(state);

      const response = await t.app.inject({
        method: 'GET',
        url: '/api/ops/health',
        headers: { host: HOST },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ state, startId: null });
    },
  );

  it('E2 GET /api/ops/status answers 200 with dataDirPath and appVersion and nothing else', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/ops/status',
      headers: { host: HOST },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toStrictEqual({ dataDirPath: t.dataDir, appVersion: TEST_APP_VERSION });
  });

  it('is behind local-guard: a cross-site read is rejected (G-5)', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/ops/status',
      headers: { host: HOST, 'sec-fetch-site': 'cross-site' },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('POST /api/ops/shutdown (CU-041, 2.17)', () => {
  const shutdown = (payload: unknown = {}) =>
    t.app.inject({
      method: 'POST',
      url: '/api/ops/shutdown',
      headers: SAME_ORIGIN_WRITE,
      payload: payload as object,
    });

  it('answers 200 with dataDirPath only after checkpoint, close and marker, then ends with exit code 0', async () => {
    const response = await shutdown();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toStrictEqual({ dataDirPath: t.dataDir });
    expect(t.database.sqlite.open).toBe(false);
    expect(existsSync(join(t.dataDir, SHUTDOWN_MARKER_FILE_NAME))).toBe(true);
    expect(t.lifecycle.get()).toBe('stopping');
    expect(t.exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('answers 503 shutting_down in state stopping', async () => {
    t.lifecycle.set('stopping');

    const response = await shutdown();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: { code: 'shutting_down', referenceNumber: null },
    });
    expect(t.database.sqlite.open).toBe(true);
    expect(t.exit).not.toHaveBeenCalled();
  });

  it('DER-96-08 a failed checkpoint answers 500 internal_error with the reference number of the error log entry; resellr runs on', async () => {
    t.database.sqlite.exec('CREATE TABLE item (id INTEGER PRIMARY KEY)');
    t.database.sqlite.exec('INSERT INTO item DEFAULT VALUES');
    t.database.sqlite.pragma('busy_timeout = 0');
    const reader = new BetterSqlite3(join(t.dataDir, 'resellr.db'));
    let response;
    try {
      reader.exec('BEGIN');
      reader.prepare('SELECT count(*) FROM item').get();
      response = await shutdown();
    } finally {
      reader.close();
    }

    expect(response.statusCode).toBe(500);
    const { error } = response.json<{ error: { code: string; referenceNumber: string } }>();
    expect(error.code).toBe('internal_error');
    expect(isReferenceNumber(error.referenceNumber)).toBe(true);
    expect(t.readErrorLog()).toEqual([
      expect.objectContaining({ refNo: error.referenceNumber, function: 'ops.shutdown' }),
    ]);
    expect(existsSync(join(t.dataDir, SHUTDOWN_MARKER_FILE_NAME))).toBe(false);
    expect(t.lifecycle.get()).toBe('ready');
    expect(t.exit).not.toHaveBeenCalled();
    // resellr runs on: health reports ready and the next shutdown works.
    const health = await t.app.inject({
      method: 'GET',
      url: '/api/ops/health',
      headers: { host: HOST },
    });
    expect(health.json()).toMatchObject({ state: 'ready' });
    expect((await shutdown()).statusCode).toBe(200);
  });

  it('waits for a running counted write before checkpoint, close and marker (step 3, FIND-285)', async () => {
    // Own app: routes for a test are added before `ready()`.
    const s = createTestApp();
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    let release!: () => void;
    s.app.post('/api/test/slow', async () => {
      markStarted();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { ok: true };
    });
    await s.app.ready();
    const markerPath = join(s.dataDir, SHUTDOWN_MARKER_FILE_NAME);
    try {
      const write = s.app.inject({
        method: 'POST',
        url: '/api/test/slow',
        headers: SAME_ORIGIN_WRITE,
        payload: {},
      });
      await started;
      let shutdownDone = false;
      const shutdownResponse = s.app
        .inject({
          method: 'POST',
          url: '/api/ops/shutdown',
          headers: SAME_ORIGIN_WRITE,
          payload: {},
        })
        .finally(() => {
          shutdownDone = true;
        });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(s.lifecycle.get()).toBe('stopping');
      expect(shutdownDone).toBe(false);
      expect(s.database.sqlite.open).toBe(true);
      expect(existsSync(markerPath)).toBe(false);

      release();
      expect((await write).statusCode).toBe(200);
      expect((await shutdownResponse).statusCode).toBe(200);
      expect(s.database.sqlite.open).toBe(false);
      expect(existsSync(markerPath)).toBe(true);
    } finally {
      await s.close();
    }
  });

  it('rejects a body other than {} with 400 bad_request and does not stop', async () => {
    const response = await shutdown({ force: true });

    expect(response.statusCode).toBe(400);
    expect(t.lifecycle.get()).toBe('ready');
  });
});
