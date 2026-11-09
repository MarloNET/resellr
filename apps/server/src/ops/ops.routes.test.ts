import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST, TEST_APP_VERSION } from '../../test/test-app.ts';

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
