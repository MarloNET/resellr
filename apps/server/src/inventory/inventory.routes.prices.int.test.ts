import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { type ChangeReport, createUnitOfWork, emptyChangeReport } from '../db/unit-of-work.ts';
import { createClock } from '../shared/clock.ts';
import type { ChangeEvent } from '../shared/events.ts';
import { createPriceService } from './price-service.ts';

// API and integration tests of `PUT /api/listings/{id}/prices/{channelId}` (CU-126, CU-125,
// CU-130, CU-161; Technical Specification 2.7) on the initial settings of the seed migration:
// Shop, Kleinanzeigen and eBay are active, only Kleinanzeigen allows "Verhandlungsbasis"
// (Requirements 9.12). MI-A is created from a checked device of MV-A through the API (#197).

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let ids: Record<'mvA' | 'used' | 'shop' | 'kleinanzeigen' | 'ebay', number>;

const PRICE_RULE = 'Preis: Zahl größer 0 mit höchstens zwei Nachkommastellen';

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  const { sqlite } = t.database;
  const one = <T>(sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...params) as T;
  const notebook = one<{ id: number }>("SELECT id FROM device_type WHERE name = 'Notebook'").id;
  const channelId = (code: string) =>
    one<{ id: number }>('SELECT id FROM channel WHERE code = ?', code).id;
  ids = {
    mvA: insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: insertManufacturer(sqlite, 'Apple'),
      modelName: 'MacBook Pro 13',
      typeDesignation: 'A1989',
      mpn: 'MR9Q2D/A',
    }),
    used: one<{ id: number }>("SELECT id FROM pick_list_value WHERE label = 'gebraucht'").id,
    shop: channelId('shop'),
    kleinanzeigen: channelId('kleinanzeigen'),
    ebay: channelId('ebay'),
  };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

/**
 * Creates MI-A from a checked device of MV-A through the API; returns its id. The device values
 * are left out: prices check no attribute values (A-39, AC-REQ-005-12 (c)), so the model listing
 * has none.
 */
async function createListing(): Promise<number> {
  // A device without the required values is only possible while they are deactivated, so the test
  // writes it into the database like the data of the example of AC-REQ-005-12.
  const { sqlite } = t.database;
  const stamp = '2026-11-16T08:00:00.000Z';
  const deviceId = Number(
    sqlite
      .prepare(
        `INSERT INTO device (wi_nr, wi_nr_key, model_template_id, condition_value_id, visual_grade,
           condition_description, device_values, review_keys, capture_status, stock_status,
           captured_at, captured_on, version, updated_at)
         VALUES ('626198', '626198', ?, ?, 2, '', '{}', '[]', 'checked', 'available', ?,
           '2026-11-16', 1, ?)`,
      )
      .run(ids.mvA, ids.used, stamp, stamp).lastInsertRowid,
  );
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/listings',
    headers: SAME_ORIGIN_WRITE,
    payload: { fromDeviceId: deviceId, deviceVersion: 1 },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: number }>().id;
}

const putPrice = (listingId: number, channelId: number, payload: object) =>
  t.app.inject({
    method: 'PUT',
    url: `/api/listings/${listingId}/prices/${channelId}`,
    headers: SAME_ORIGIN_WRITE,
    payload,
  });

const rows = (sql: string, ...params: unknown[]) =>
  t.database.sqlite.prepare(sql).all(...params) as Record<string, unknown>[];

const listingVersion = (id: number) =>
  rows('SELECT version FROM listing WHERE id = ?', id)[0]?.version as number;

const priceAudit = () =>
  rows(
    `SELECT object_type, object_category, object_id, object_label, old_value, new_value
       FROM audit_entry WHERE action = 'price_updated' ORDER BY id`,
  );

describe('PUT /api/listings/{id}/prices/{channelId} (CU-126, Technical Specification 2.7)', () => {
  it('saves the prices of Shop 269,00 € and Kleinanzeigen 279,00 € per channel (preparing AC-REQ-032-01)', async () => {
    const listingId = await createListing();

    const shop = await putPrice(listingId, ids.shop, { version: 1, amountCents: 26900, vb: false });
    expect(shop.statusCode).toBe(200);
    expect(shop.json()).toEqual({
      listing: { version: 2 },
      prices: [{ channelId: ids.shop, amountCents: 26900, vb: false, source: 'manual' }],
    });

    const kleinanzeigen = await putPrice(listingId, ids.kleinanzeigen, {
      version: 2,
      amountCents: 27900,
      vb: false,
    });
    expect(kleinanzeigen.statusCode).toBe(200);

    expect(
      rows(
        'SELECT channel_id, amount_cents, vb, source FROM listing_price WHERE listing_id = ? ORDER BY channel_id',
        listingId,
      ),
    ).toEqual(
      [
        { channel_id: ids.shop, amount_cents: 26900, vb: 0, source: 'manual' },
        { channel_id: ids.kleinanzeigen, amount_cents: 27900, vb: 0, source: 'manual' },
      ].sort((a, b) => a.channel_id - b.channel_id),
    );
  });

  it('saves 50 € with "Verhandlungsbasis" for Kleinanzeigen as vb = true (preparing AC-REQ-032-02)', async () => {
    const listingId = await createListing();

    const response = await putPrice(listingId, ids.kleinanzeigen, {
      version: 1,
      amountCents: 5000,
      vb: true,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().prices).toEqual([
      { channelId: ids.kleinanzeigen, amountCents: 5000, vb: true, source: 'manual' },
    ]);
    expect(
      rows('SELECT amount_cents, vb, source FROM listing_price WHERE listing_id = ?', listingId),
    ).toEqual([{ amount_cents: 5000, vb: 1, source: 'manual' }]);
  });

  it.each([
    ['0', 0],
    ['„12,345“', 1234.5],
  ])(
    'AC-REQ-032-03 rejects a price of %s with the price rule and stores nothing',
    async (_, amountCents) => {
      const listingId = await createListing();

      const response = await putPrice(listingId, ids.shop, { version: 1, amountCents, vb: false });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'validation_failed',
        message: '',
        fields: [{ path: 'amountCents', message: PRICE_RULE }],
      });
      expect(rows('SELECT * FROM listing_price')).toEqual([]);
      expect(listingVersion(listingId)).toBe(1);
      expect(priceAudit()).toEqual([]);
    },
  );

  it('AC-REQ-032-04 rejects "Verhandlungsbasis" for Shop, which does not allow it, and stores nothing', async () => {
    const listingId = await createListing();

    const response = await putPrice(listingId, ids.shop, {
      version: 1,
      amountCents: 26900,
      vb: true,
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'validation_failed',
      fields: [{ path: 'vb', code: 'vb_not_allowed' }],
    });
    expect(rows('SELECT * FROM listing_price')).toEqual([]);
    expect(listingVersion(listingId)).toBe(1);
  });

  it('answers version_conflict for an outdated version and stores nothing (2.0.3)', async () => {
    const listingId = await createListing();
    expect(
      (await putPrice(listingId, ids.shop, { version: 1, amountCents: 26900, vb: false }))
        .statusCode,
    ).toBe(200);

    const response = await putPrice(listingId, ids.kleinanzeigen, {
      version: 1,
      amountCents: 27900,
      vb: false,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({ code: 'version_conflict' });
    expect(rows('SELECT channel_id FROM listing_price')).toEqual([{ channel_id: ids.shop }]);
    expect(listingVersion(listingId)).toBe(2);
  });

  it('DER-62-04 answers with the prices of all channels and the new version of the model listing', async () => {
    const listingId = await createListing();
    await putPrice(listingId, ids.shop, { version: 1, amountCents: 26900, vb: false });
    await putPrice(listingId, ids.kleinanzeigen, { version: 2, amountCents: 5000, vb: true });

    const response = await putPrice(listingId, ids.shop, {
      version: 3,
      amountCents: 28900,
      vb: false,
    });

    expect(response.statusCode).toBe(200);
    const answer = response.json<{ listing: { version: number }; prices: object[] }>();
    expect(answer.listing).toEqual({ version: 4 });
    expect(answer.prices).toHaveLength(2);
    expect(answer.prices).toEqual(
      expect.arrayContaining([
        { channelId: ids.shop, amountCents: 28900, vb: false, source: 'manual' },
        { channelId: ids.kleinanzeigen, amountCents: 5000, vb: true, source: 'manual' },
      ]),
    );
    // The detail of UI-014 shows the same state.
    const detail = await t.app.inject({
      method: 'GET',
      url: `/api/listings/${listingId}`,
      headers: { host: HOST },
    });
    expect(detail.json()).toMatchObject({ version: 4, prices: answer.prices });
  });

  it('turns a price of a price rule into a manual one on saving (2.7)', async () => {
    const listingId = await createListing();
    t.database.sqlite
      .prepare(
        "INSERT INTO listing_price (listing_id, channel_id, amount_cents, vb, source) VALUES (?, ?, 29900, 0, 'rule')",
      )
      .run(listingId, ids.ebay);

    const response = await putPrice(listingId, ids.ebay, {
      version: 1,
      amountCents: 29900,
      vb: false,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      listing: { version: 2 },
      prices: [{ channelId: ids.ebay, amountCents: 29900, vb: false, source: 'manual' }],
    });
  });

  it('keeps the version and writes no audit entry for an unchanged price', async () => {
    const listingId = await createListing();
    await putPrice(listingId, ids.shop, { version: 1, amountCents: 26900, vb: false });

    const response = await putPrice(listingId, ids.shop, {
      version: 2,
      amountCents: 26900,
      vb: false,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().listing).toEqual({ version: 2 });
    expect(priceAudit()).toHaveLength(1);
  });

  it('writes the audit entry price_updated with the old and the new price (3.6, REQ-072)', async () => {
    const listingId = await createListing();
    await putPrice(listingId, ids.kleinanzeigen, { version: 1, amountCents: 27900, vb: false });
    await putPrice(listingId, ids.kleinanzeigen, { version: 2, amountCents: 5000, vb: true });

    expect(priceAudit()).toEqual([
      {
        object_type: 'listing',
        object_category: 'listing',
        object_id: listingId,
        object_label: 'MacBook Pro 13',
        old_value: null,
        new_value: JSON.stringify({ Kanal: 'Kleinanzeigen', Preis: '279,00 €', VB: 'Nein' }),
      },
      {
        object_type: 'listing',
        object_category: 'listing',
        object_id: listingId,
        object_label: 'MacBook Pro 13',
        old_value: JSON.stringify({ Kanal: 'Kleinanzeigen', Preis: '279,00 €', VB: 'Nein' }),
        new_value: JSON.stringify({ Kanal: 'Kleinanzeigen', Preis: '50,00 €', VB: 'Ja' }),
      },
    ]);
  });

  it.each([
    ['an unknown model listing', 'listing'],
    ['an unknown channel', 'channel'],
  ])('answers not_found for %s', async (_, unknown) => {
    const listingId = await createListing();

    const response = await putPrice(
      unknown === 'listing' ? listingId + 1 : listingId,
      unknown === 'channel' ? 999 : ids.shop,
      { version: 1, amountCents: 26900, vb: false },
    );

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({ code: 'not_found' });
  });

  it.each([
    ['a missing vb', { version: 1, amountCents: 26900 }],
    ['a string amount', { version: 1, amountCents: '269,00', vb: false }],
    ['a source', { version: 1, amountCents: 26900, vb: false, source: 'rule' }],
  ])('answers bad_request for %s', async (_, payload) => {
    const listingId = await createListing();

    const response = await putPrice(listingId, ids.shop, payload);

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ code: 'bad_request' });
  });
});

describe('price service events (CU-126; Technical Specification 2.0.4, 2.7, 4.4.0)', () => {
  it('reports ContentInputsChanged for the model listing and the channel in its transaction', async () => {
    const listingId = await createListing();
    const seen: ChangeEvent[] = [];
    const record = vi.fn(async (event: ChangeEvent): Promise<ChangeReport> => {
      seen.push(event);
      return emptyChangeReport();
    });
    const uow = createUnitOfWork<DB>(t.database.db, { change: { ContentInputsChanged: record } });
    const service = createPriceService({ uow, clock: createClock() });

    await service.save(listingId, ids.kleinanzeigen, { version: 1, amountCents: 5000, vb: true });
    // An unchanged price reports nothing.
    await service.save(listingId, ids.kleinanzeigen, { version: 2, amountCents: 5000, vb: true });

    expect(seen).toEqual([
      { type: 'ContentInputsChanged', listingIds: [listingId], channelIds: [ids.kleinanzeigen] },
    ]);
  });
});
