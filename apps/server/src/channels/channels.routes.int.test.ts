import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST } from '../../test/test-app.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';

// `GET /api/channels` in S2 (CU-163, Technical Specification 2.3, addendum MAR-773) against the
// initial settings (#150).

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const get = (query = '') =>
  t.app.inject({ method: 'GET', url: `/api/channels${query}`, headers: { host: HOST } });

describe('GET /api/channels (CU-163)', () => {
  it('lists the three channels of the initial settings by sort_order with exactly five fields', async () => {
    const response = await get();

    expect(response.statusCode).toBe(200);
    const { items, total } = response.json();
    expect(total).toBe(3);
    expect(items).toEqual([
      { id: expect.any(Number), code: 'shop', name: 'Shop', active: true, sortOrder: 1 },
      {
        id: expect.any(Number),
        code: 'kleinanzeigen',
        name: 'Kleinanzeigen',
        active: true,
        sortOrder: 2,
      },
      { id: expect.any(Number), code: 'ebay', name: 'eBay', active: true, sortOrder: 3 },
    ]);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(['active', 'code', 'id', 'name', 'sortOrder']);
    }
  });

  it('lists a deactivated channel as well, in its place', async () => {
    t.database.sqlite.prepare("UPDATE channel SET active = 0 WHERE code = 'kleinanzeigen'").run();

    const { items } = (await get()).json();

    expect(
      items.map(({ code, active }: { code: string; active: boolean }) => [code, active]),
    ).toEqual([
      ['shop', true],
      ['kleinanzeigen', false],
      ['ebay', true],
    ]);
  });

  it('pages with limit and offset and keeps the total', async () => {
    const response = await get('?limit=1&offset=1');

    expect(response.json()).toEqual({
      items: [expect.objectContaining({ code: 'kleinanzeigen' })],
      total: 3,
    });
  });

  it('rejects a limit above 200', async () => {
    expect((await get('?limit=201')).statusCode).toBe(400);
  });
});
