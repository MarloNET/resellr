import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let writes: number;
let release: () => void;
let started: Promise<void>;

beforeEach(async () => {
  t = createTestApp();
  writes = 0;
  let markStarted!: () => void;
  started = new Promise((resolve) => {
    markStarted = resolve;
  });
  t.app.get('/api/test/items', async () => ({ items: [], total: 0 }));
  t.app.post('/api/test/items', async () => {
    writes += 1;
    return { ok: true };
  });
  t.app.post('/api/test/slow', async () => {
    markStarted();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return { ok: true };
  });
  t.app.post('/api/test/uncounted', { config: { uncountedWrite: true } }, async () => {
    markStarted();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return { ok: true };
  });
  t.app.post('/api/test/slow-fail', async () => {
    markStarted();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    throw new Error('boom');
  });
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const errorCode = (body: string) => (JSON.parse(body) as { error: { code: string } }).error.code;

describe('write gate (E11)', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    'in state stopping rejects a new %s with 503 shutting_down',
    async (method) => {
      t.lifecycle.set('stopping');

      const response = await t.app.inject({
        method,
        url: '/api/test/items',
        headers: SAME_ORIGIN_WRITE,
        payload: {},
      });

      expect(response.statusCode).toBe(503);
      expect(errorCode(response.body)).toBe('shutting_down');
      expect(JSON.parse(response.body)).toMatchObject({ error: { referenceNumber: null } });
      expect(writes).toBe(0);
    },
  );

  it('in state stopping reads keep working', async () => {
    t.lifecycle.set('stopping');

    const api = await t.app.inject({
      method: 'GET',
      url: '/api/test/items',
      headers: { host: HOST },
    });
    const page = await t.app.inject({ method: 'GET', url: '/', headers: { host: HOST } });

    expect(api.statusCode).toBe(200);
    expect(page.statusCode).toBe(200);
  });

  it.each(['starting', 'ready'] as const)('in state %s writes are accepted', async (state) => {
    t.lifecycle.set(state);

    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(writes).toBe(1);
  });

  it('local-guard runs before the write gate', async () => {
    t.lifecycle.set('stopping');

    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: { ...SAME_ORIGIN_WRITE, host: 'localhost:4310' },
      payload: {},
    });

    expect(errorCode(response.body)).toBe('forbidden_host');
  });

  it('counts running writes and lets a running write finish after stopping', async () => {
    expect(t.writeGate.activeWrites()).toBe(0);

    const pending = t.app.inject({
      method: 'POST',
      url: '/api/test/slow',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });
    await started;
    expect(t.writeGate.activeWrites()).toBe(1);

    t.lifecycle.set('stopping');
    const idle = t.writeGate.waitUntilIdle(10_000);
    release();

    expect((await pending).statusCode).toBe(200);
    await expect(idle).resolves.toBe(true);
    expect(t.writeGate.activeWrites()).toBe(0);
  });

  it('a failed write stops counting as well', async () => {
    const pending = t.app.inject({
      method: 'POST',
      url: '/api/test/slow-fail',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });
    await started;
    expect(t.writeGate.activeWrites()).toBe(1);
    release();

    expect((await pending).statusCode).toBe(500);
    expect(t.writeGate.activeWrites()).toBe(0);
  });

  it('rejected writes and reads are not counted', async () => {
    await t.app.inject({ method: 'GET', url: '/api/test/items', headers: { host: HOST } });
    await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: { ...SAME_ORIGIN_WRITE, origin: 'http://x' },
      payload: {},
    });
    t.lifecycle.set('stopping');
    await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });

    expect(t.writeGate.activeWrites()).toBe(0);
  });

  it('waitUntilIdle reports false when a write runs longer than the limit', async () => {
    const pending = t.app.inject({
      method: 'POST',
      url: '/api/test/slow',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });
    await started;

    await expect(t.writeGate.waitUntilIdle(20)).resolves.toBe(false);

    release();
    await pending;
  });

  it('waitUntilIdle resolves at once without running writes', async () => {
    await expect(t.writeGate.waitUntilIdle(0)).resolves.toBe(true);
  });

  it('does not count a write whose route sets uncountedWrite, e.g. the shutdown itself (2.17 step 3)', async () => {
    const pending = t.app.inject({
      method: 'POST',
      url: '/api/test/uncounted',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });
    await started;

    expect(t.writeGate.activeWrites()).toBe(0);
    await expect(t.writeGate.waitUntilIdle(0)).resolves.toBe(true);

    release();
    expect((await pending).statusCode).toBe(200);
  });

  it('rejects a write whose route sets uncountedWrite in state stopping as well', async () => {
    t.lifecycle.set('stopping');

    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/uncounted',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });

    expect(response.statusCode).toBe(503);
    expect(errorCode(response.body)).toBe('shutting_down');
  });
});
