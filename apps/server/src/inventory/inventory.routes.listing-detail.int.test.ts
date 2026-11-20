import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';

// API tests of `GET /api/listings/{id}?includeCancelled=` (CU-130, CU-292, CU-122, CU-125,
// CU-086; Technical Specification 2.7) on the initial settings of the seed migration: MV-A is an
// Apple MacBook Pro 13, a notebook with battery and battery capacity. The model listing is
// created through the API (#197); prices, delivery scope, sale and cancellation have no writing
// endpoint before #204, #206 and S9, so the tests write them into the database.

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let ids: Record<
  | 'mvA'
  | 'used'
  | 'ram'
  | 'storage'
  | 'storageType'
  | 'keyboard'
  | 'os'
  | 'osVersion'
  | 'powerSupply'
  | 'battery'
  | 'batteryCapacity'
  | 'nvme'
  | 'german'
  | 'macos'
  | 'originalPowerSupply'
  | 'withBattery'
  | 'shop'
  | 'kleinanzeigen',
  number
>;

const STAMP = '2026-11-16T08:00:00.000Z';

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  const { sqlite } = t.database;
  const one = <T>(sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...params) as T;
  const valueId = (label: string) =>
    one<{ id: number }>('SELECT id FROM pick_list_value WHERE label = ?', label).id;
  const notebook = one<{ id: number }>("SELECT id FROM device_type WHERE name = 'Notebook'").id;
  const attributeId = (label: string) =>
    one<{ id: number }>(
      'SELECT id FROM attribute WHERE device_type_id = ? AND label = ?',
      notebook,
      label,
    ).id;
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
    used: valueId('gebraucht'),
    ram: attributeId('RAM'),
    storage: attributeId('Speicherkapazität'),
    storageType: attributeId('Speichertyp'),
    keyboard: attributeId('Tastaturlayout'),
    os: attributeId('Betriebssystem'),
    osVersion: attributeId('Betriebssystem-Version'),
    powerSupply: attributeId('Netzteil'),
    battery: attributeId('Akku'),
    batteryCapacity: attributeId('Akkukapazität'),
    nvme: valueId('SSD (NVMe)'),
    german: valueId('Deutsch (QWERTZ)'),
    macos: valueId('macOS'),
    originalPowerSupply: valueId('mit Netzteil (original)'),
    withBattery: valueId('mit Akku'),
    shop: channelId('shop'),
    kleinanzeigen: channelId('kleinanzeigen'),
  };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

/** Captures a checked device of MV-A through the API; returns its id. */
async function captureDevice(wiNr: string, capacity: object = { percent: 85 }): Promise<number> {
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/devices',
    headers: SAME_ORIGIN_WRITE,
    payload: {
      wiNr,
      supplierId: null,
      modelTemplateId: ids.mvA,
      conditionValueId: ids.used,
      visualGrade: '2',
      conditionDescription: '',
      values: {
        [ids.ram]: 16,
        [ids.storage]: 512,
        [ids.storageType]: ids.nvme,
        [ids.keyboard]: ids.german,
        [ids.os]: ids.macos,
        [ids.osVersion]: 'macOS 14',
        [ids.powerSupply]: ids.originalPowerSupply,
        [ids.battery]: ids.withBattery,
        [ids.batteryCapacity]: capacity,
      },
      confirmedKeys: [],
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: number }>().id;
}

/** Creates the model listing MI-A from the device "626198"; returns its id and the device id. */
async function createListing() {
  const deviceId = await captureDevice('626198');
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/listings',
    headers: SAME_ORIGIN_WRITE,
    payload: { fromDeviceId: deviceId, deviceVersion: 1 },
  });
  expect(response.statusCode).toBe(201);
  return { listingId: response.json<{ id: number }>().id, deviceId };
}

/** Assigns a further captured device to the model listing through the API. */
async function assign(deviceId: number, listingId: number) {
  const response = await t.app.inject({
    method: 'POST',
    url: `/api/devices/${deviceId}/assignment`,
    headers: SAME_ORIGIN_WRITE,
    payload: { version: 1, listingId },
  });
  expect(response.statusCode).toBe(200);
}

const run = (sql: string, ...params: unknown[]) => t.database.sqlite.prepare(sql).run(...params);
const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });

/** A delivery scope text block, active; returns its id. */
const insertTextBlock = (name: string) =>
  Number(
    run(
      `INSERT INTO text_block (name, name_key, kind, body, active, all_device_types, all_channels,
         version, created_at, updated_at)
       VALUES (?, ?, 'delivery_scope', ?, 1, 1, 1, 1, ?, ?)`,
      name,
      name.toLowerCase(),
      name,
      STAMP,
      STAMP,
    ).lastInsertRowid,
  );

describe('GET /api/listings/{id} (CU-292, Technical Specification 2.7)', () => {
  it('DER-60-01 returns the new model listing with head data, listing values, its device, stock data and version', async () => {
    const { listingId, deviceId } = await createListing();

    const response = await get(`/api/listings/${listingId}`);

    expect(response.statusCode).toBe(200);
    const detail = response.json();
    expect(detail).toMatchObject({
      id: listingId,
      modelTemplateId: ids.mvA,
      conditionValueId: ids.used,
      visualGrade: 2,
      conditionDescription: '',
      otherValues: { [ids.osVersion]: 'macOS 14' },
      deliveryScopeTextBlockIds: [],
      articleNumber: '626198',
      eanMode: 'original',
      ownEan: null,
      // Until S5 the display title is the model name of the model template (4.4.0).
      displayTitle: 'MacBook Pro 13',
      quantity: 1,
      version: 1,
      // Until #209 the WI-Nrs and the battery text of the stock data are empty (Nachtrag MAR-1053).
      stock: { quantity: 1, wiNrs: [], batteryText: '', stockHash: expect.any(String) },
      prices: [],
      deliveryScope: [],
    });
    expect(detail.variantValues).toMatchObject({ [ids.ram]: 16, [ids.os]: ids.macos });
    expect(detail.devices).toEqual([
      {
        id: deviceId,
        wiNr: '626198',
        stockStatus: 'available',
        soldChannelId: null,
        soldOn: null,
        batteryCapacity: { percent: 85 },
        capturedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
    ]);
    const stored = t.database.sqlite
      .prepare('SELECT stock_hash FROM listing WHERE id = ?')
      .get(listingId) as { stock_hash: string };
    expect(detail.stock.stockHash).toBe(stored.stock_hash);
  });

  it('returns the prices by channel and the delivery scope as text blocks with their names in their order', async () => {
    const { listingId } = await createListing();
    const charger = insertTextBlock('Netzteil');
    const manual = insertTextBlock('Handbuch');
    run(
      'INSERT INTO listing_delivery_scope (listing_id, text_block_id, position) VALUES (?, ?, 1), (?, ?, 2)',
      listingId,
      manual,
      listingId,
      charger,
    );
    run(
      `INSERT INTO listing_price (listing_id, channel_id, amount_cents, vb, source)
       VALUES (?, ?, 26900, 0, 'manual'), (?, ?, 27900, 1, 'rule')`,
      listingId,
      ids.shop,
      listingId,
      ids.kleinanzeigen,
    );

    const detail = (await get(`/api/listings/${listingId}`)).json();

    expect(detail.deliveryScopeTextBlockIds).toEqual([manual, charger]);
    expect(detail.deliveryScope).toEqual([
      { id: manual, name: 'Handbuch' },
      { id: charger, name: 'Netzteil' },
    ]);
    expect(detail.prices).toEqual(
      expect.arrayContaining([
        { channelId: ids.shop, amountCents: 26900, vb: false, source: 'manual' },
        { channelId: ids.kleinanzeigen, amountCents: 27900, vb: true, source: 'rule' },
      ]),
    );
    expect(detail.prices).toHaveLength(2);
  });

  it('DER-60-03 lists a cancelled device only with includeCancelled=true, a sold one always with channel and date', async () => {
    const { listingId, deviceId } = await createListing();
    const sold = await captureDevice('626199', { notDeterminable: true });
    await assign(sold, listingId);
    const cancelled = await captureDevice('626200');
    await assign(cancelled, listingId);
    run(
      "UPDATE device SET stock_status = 'sold', sold_channel_id = ?, sold_on = '2026-11-17' WHERE id = ?",
      ids.shop,
      sold,
    );
    run(
      `UPDATE device SET stock_status = 'cancelled', listing_id = NULL,
         cancelled_from_listing_id = ?, cancel_reason = 'defekt', cancelled_at = ? WHERE id = ?`,
      listingId,
      STAMP,
      cancelled,
    );

    const without = (await get(`/api/listings/${listingId}`)).json();
    const withCancelled = (await get(`/api/listings/${listingId}?includeCancelled=true`)).json();
    const explicitlyWithout = (
      await get(`/api/listings/${listingId}?includeCancelled=false`)
    ).json();

    expect(without.devices.map((device: { id: number }) => device.id)).toEqual([deviceId, sold]);
    expect(explicitlyWithout.devices).toEqual(without.devices);
    expect(without.devices[1]).toMatchObject({
      wiNr: '626199',
      stockStatus: 'sold',
      soldChannelId: ids.shop,
      soldOn: '2026-11-17',
      batteryCapacity: { notDeterminable: true },
    });
    expect(withCancelled.devices.map((device: { id: number }) => device.id)).toEqual([
      deviceId,
      sold,
      cancelled,
    ]);
    expect(withCancelled.devices[2]).toMatchObject({ wiNr: '626200', stockStatus: 'cancelled' });
  });

  it('leaves out a cancelled device of another model listing and a device assigned elsewhere', async () => {
    const { listingId } = await createListing();
    const other = await captureDevice('700001');
    run(
      `UPDATE device SET stock_status = 'cancelled', cancelled_from_listing_id = NULL,
         cancel_reason = 'defekt', cancelled_at = ? WHERE id = ?`,
      STAMP,
      other,
    );

    const detail = (await get(`/api/listings/${listingId}?includeCancelled=true`)).json();

    expect(detail.devices.map((device: { wiNr: string }) => device.wiNr)).toEqual(['626198']);
  });

  it('answers 404 not_found for an unknown model listing', async () => {
    const response = await get('/api/listings/999');

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it('answers 400 bad_request for another value of includeCancelled', async () => {
    const { listingId } = await createListing();

    const response = await get(`/api/listings/${listingId}?includeCancelled=1`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'bad_request' } });
  });
});
