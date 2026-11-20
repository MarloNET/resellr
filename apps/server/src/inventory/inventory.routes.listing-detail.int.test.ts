import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { stockColumnDifferences, syncStockColumns } from '../../test/stock.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { type ChangeReport, createUnitOfWork, emptyChangeReport } from '../db/unit-of-work.ts';
import type { ChangeEvent } from '../shared/events.ts';
import { createInventoryReader } from './inventory-reader.ts';
import { createListingStockUpdater, formStockColumns } from './listing-stock-updater.ts';

// API tests of `GET /api/listings/{id}?includeCancelled=` (CU-130, CU-292, CU-122, CU-125,
// CU-086; Technical Specification 2.7) on the initial settings of the seed migration: MV-A is an
// Apple MacBook Pro 13, a notebook with battery and battery capacity. The model listing is
// created through the API (#197); prices, delivery scope, sale and cancellation have no writing
// endpoint before #204, #206 and S9, so the tests write them into the database. With #209 the
// stock data (CU-120, CU-128, CU-129; DER-65-02, DER-65-03).

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
  | 'withoutBattery'
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
    withoutBattery: valueId('ohne Akku'),
    shop: channelId('shop'),
    kleinanzeigen: channelId('kleinanzeigen'),
  };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

/**
 * Captures a checked device of MV-A through the API, with "mit Akku" and the battery capacity or,
 * with `null`, with "ohne Akku" and no battery capacity; returns its id.
 */
async function captureDevice(
  wiNr: string,
  capacity: object | null = { percent: 85 },
): Promise<number> {
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
        ...(capacity === null
          ? { [ids.battery]: ids.withoutBattery }
          : { [ids.battery]: ids.withBattery, [ids.batteryCapacity]: capacity }),
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

/** Assigns a further captured device to the model listing through the API; returns the answer. */
async function assign(deviceId: number, listingId: number, confirmDeviation = false) {
  const response = await t.app.inject({
    method: 'POST',
    url: `/api/devices/${deviceId}/assignment`,
    headers: SAME_ORIGIN_WRITE,
    payload: { version: 1, listingId, ...(confirmDeviation && { confirmDeviation }) },
  });
  expect(response.statusCode).toBe(200);
  return response.json<{ listing: { id: number; quantity: number } }>();
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
      stock: { quantity: 1, wiNrs: ['626198'], batteryText: '85 %', stockHash: expect.any(String) },
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
    // Sale and cancellation get their endpoints in S9; the stock columns as CU-128 forms them.
    await syncStockColumns(t.database.db);

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
    // Sold and cancelled devices do not count in the stock data (2.8.2).
    expect(without.stock).toMatchObject({ quantity: 1, wiNrs: ['626198'], batteryText: '85 %' });
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

describe('stock data of a model listing (CU-120, CU-128, CU-129; Technical Specification 2.8.2, 3.3)', () => {
  const stockOf = async (listingId: number) =>
    (await get(`/api/listings/${listingId}`)).json<{ stock: Record<string, unknown> }>().stock;

  it('DER-65-02 after an assignment GET returns the new stock data and the answer the new quantity', async () => {
    const { listingId } = await createListing();
    const before = await stockOf(listingId);

    const answer = await assign(await captureDevice('626199', { percent: 90 }), listingId);

    expect(answer.listing).toEqual({ id: listingId, quantity: 2 });
    const after = await stockOf(listingId);
    expect(after).toEqual({
      quantity: 2,
      wiNrs: ['626198', '626199'],
      batteryText: '85–90 %',
      stockHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(after.stockHash).not.toBe(before.stockHash);
  });

  it('DER-65-02 after rebooking a device into a new model listing GET returns the stock data of both', async () => {
    const { listingId: miA } = await createListing();
    const moved = await captureDevice('626199', { percent: 90 });
    await assign(moved, miA);
    const patched = await t.app.inject({
      method: 'PATCH',
      url: `/api/devices/${moved}`,
      headers: SAME_ORIGIN_WRITE,
      payload: { version: 2, visualGrade: '4', confirmedKeys: [] },
    });
    expect(patched.statusCode).toBe(200);

    const created = await t.app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: SAME_ORIGIN_WRITE,
      payload: { fromDeviceId: moved, deviceVersion: 3 },
    });

    expect(created.statusCode).toBe(201);
    const miB = created.json<{ id: number; quantity: number }>();
    expect(miB.quantity).toBe(1);
    expect(await stockOf(miA)).toMatchObject({
      quantity: 1,
      wiNrs: ['626198'],
      batteryText: '85 %',
    });
    expect(await stockOf(miB.id)).toMatchObject({
      quantity: 1,
      wiNrs: ['626199'],
      batteryText: '90 %',
    });
  });

  it('DER-65-02 after a change of the battery capacity of an assigned device CU-128 forms the stock data anew, and GET returns them', async () => {
    const { listingId } = await createListing();
    const second = await captureDevice('626199', { percent: 90 });
    await assign(second, listingId);
    expect(await stockOf(listingId)).toMatchObject({ batteryText: '85–90 %' });

    // The change of the device values triggering it follows with #192 (2.5); here the update.
    const { report } = await createUnitOfWork<DB>(t.database.db).run(async (uow) => {
      await uow.db
        .updateTable('device')
        .set({
          device_values: JSON.stringify({
            [ids.battery]: ids.withBattery,
            [ids.batteryCapacity]: { notDeterminable: true },
          }),
        })
        .where('id', '=', second)
        .execute();
      return createListingStockUpdater(uow).update(listingId);
    });

    expect(report).toEqual(emptyChangeReport());
    expect(await stockOf(listingId)).toMatchObject({
      quantity: 2,
      wiNrs: ['626198', '626199'],
      batteryText: '85 % bzw. nicht ermittelbar',
    });
  });

  it('DER-65-01 a device assigned with "trotzdem zuordnen" and "ohne Akku" does not enter the battery text (AC-REQ-036-05)', async () => {
    const first = await captureDevice('626198', { notDeterminable: true });
    const created = await t.app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: SAME_ORIGIN_WRITE,
      payload: { fromDeviceId: first, deviceVersion: 1 },
    });
    const listingId = created.json<{ id: number }>().id;

    await assign(await captureDevice('626199', null), listingId, true);

    expect(await stockOf(listingId)).toMatchObject({
      quantity: 2,
      wiNrs: ['626198', '626199'],
      batteryText: 'nicht ermittelbar',
    });
  });

  it('DER-65-03 CU-128 writes the stock columns in the transaction of the device change and reports StockChanged', async () => {
    const { listingId, deviceId } = await createListing();
    const stored = () =>
      t.database.sqlite
        .prepare('SELECT quantity, stock_json, stock_hash FROM listing WHERE id = ?')
        .get(listingId);
    const before = stored();
    const seen: ChangeEvent[] = [];
    const uow = createUnitOfWork<DB>(t.database.db, {
      change: {
        StockChanged: async (event): Promise<ChangeReport> => {
          seen.push(event);
          return emptyChangeReport();
        },
      },
    });

    // A failing action rolls back the device change and the stock columns together.
    const failing = uow.run(async (tx) => {
      await tx.db
        .updateTable('device')
        .set({ stock_status: 'sold' })
        .where('id', '=', deviceId)
        .execute();
      await createListingStockUpdater(tx).update(listingId);
      throw new Error('after the update');
    });
    await expect(failing).rejects.toThrow('after the update');
    expect(stored()).toEqual(before);

    await uow.run(async (tx) => {
      await tx.db
        .updateTable('device')
        .set({ stock_status: 'sold' })
        .where('id', '=', deviceId)
        .execute();
      return createListingStockUpdater(tx).update(listingId);
    });
    expect(seen).toEqual([{ type: 'StockChanged', listingId }]);
    expect(stored()).toEqual({
      quantity: 0,
      stock_json: '{"quantity":0,"wiNrs":[],"batteryText":""}',
      stock_hash: '74f68861b8f71e9b878b5b1b24fe0b6535a9992a0a894753c3dae776abcc15f3',
    });
  });

  it('DER-65-03 the invariant test finds stock columns that differ from the new forming from the devices', async () => {
    const { listingId, deviceId } = await createListing();
    const reader = createInventoryReader(t.database.db);
    const formed = await formStockColumns(t.database.db, listingId);
    expect((await reader.findListing(listingId))?.stock).toEqual({
      ...JSON.parse(formed.stock_json),
      stockHash: formed.stock_hash,
    });

    expect(await stockColumnDifferences(t.database.db)).toEqual([]);

    // A device change past CU-128 leaves the columns behind the devices.
    run("UPDATE device SET stock_status = 'sold' WHERE id = ?", deviceId);

    expect((await reader.findListing(listingId))?.stock).toMatchObject({ quantity: 1 });
    expect(await stockColumnDifferences(t.database.db)).toEqual([
      {
        listingId,
        stored: expect.objectContaining({ quantity: 1 }),
        formed: expect.objectContaining({ quantity: 0 }),
      },
    ]);
    // Written as CU-128 forms them, so the invariant test after this test passes.
    await syncStockColumns(t.database.db);
    expect(await stockColumnDifferences(t.database.db)).toEqual([]);
  });
});
