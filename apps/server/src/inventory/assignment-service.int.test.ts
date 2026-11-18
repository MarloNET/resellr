import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { type ChangeReport, createUnitOfWork, emptyChangeReport } from '../db/unit-of-work.ts';
import { createClock } from '../shared/clock.ts';
import type { ChangeEvent } from '../shared/events.ts';
import { createAssignmentService } from './assignment-service.ts';

// Integration and API tests of `POST /api/listings` (CU-123, CU-125, CU-128, CU-130; Technical
// Specification 2.6) on the initial settings of the seed migration: MV-A is an Apple MacBook Pro
// 13 (A1989), a notebook with RAM, storage, storage type, keyboard layout, operating system,
// power supply and battery as variant attributes (Requirements 9.3).

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
  | 'hungarian'
  | 'macos'
  | 'originalPowerSupply'
  | 'withBattery',
  number
>;

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
    hungarian: valueId('Ungarisch'),
    macos: valueId('macOS'),
    originalPowerSupply: valueId('mit Netzteil (original)'),
    withBattery: valueId('mit Akku'),
  };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

/** The device values of MI-A: RAM 16 GB, 512 GB NVMe, German keyboard, macOS 14, 85 %. */
const values = (change: Record<string, unknown> = {}) => ({
  [ids.ram]: 16,
  [ids.storage]: 512,
  [ids.storageType]: ids.nvme,
  [ids.keyboard]: ids.german,
  [ids.os]: ids.macos,
  [ids.osVersion]: 'macOS 14',
  [ids.powerSupply]: ids.originalPowerSupply,
  [ids.battery]: ids.withBattery,
  [ids.batteryCapacity]: { percent: 85 },
  ...change,
});

/** Captures a checked device of MV-A through the API; returns its id. */
async function captureDevice(
  wiNr: string,
  change: { visualGrade?: string; conditionDescription?: string; values?: object } = {},
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
      visualGrade: change.visualGrade ?? '2',
      conditionDescription: change.conditionDescription ?? '',
      values: change.values ?? values(),
      confirmedKeys: [],
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: number }>().id;
}

const createListing = (payload: Record<string, unknown>) =>
  t.app.inject({ method: 'POST', url: '/api/listings', headers: SAME_ORIGIN_WRITE, payload });

const rows = <T>(sql: string, ...params: unknown[]) =>
  t.database.sqlite.prepare(sql).all(...params) as T[];
const count = (table: string) =>
  rows<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]?.n ?? 0;

describe('POST /api/listings (CU-123, Technical Specification 2.6)', () => {
  it('AC-REQ-019-01 creates from the checked device "626198" a model listing with quantity 1, article number "626198", EAN marking original, empty delivery scope, the variant data and the other listed device values', async () => {
    const deviceId = await captureDevice('626198');

    const response = await createListing({ fromDeviceId: deviceId, deviceVersion: 1 });

    expect(response.statusCode).toBe(201);
    const listing = response.json();
    expect(listing).toEqual({
      id: expect.any(Number),
      modelTemplateId: ids.mvA,
      conditionValueId: ids.used,
      visualGrade: 2,
      conditionDescription: '',
      variantValues: {
        [ids.ram]: 16,
        [ids.storage]: 512,
        [ids.storageType]: ids.nvme,
        [ids.keyboard]: ids.german,
        [ids.os]: ids.macos,
        [ids.powerSupply]: ids.originalPowerSupply,
        [ids.battery]: ids.withBattery,
      },
      // The battery capacity stays at the device (2.6, A-16).
      otherValues: { [ids.osVersion]: 'macOS 14' },
      deliveryScopeTextBlockIds: [],
      articleNumber: '626198',
      eanMode: 'original',
      ownEan: null,
      displayTitle: 'MacBook Pro 13',
      quantity: 1,
      version: 1,
    });

    // No delivery scope, no prices, no photos (AC-REQ-019-01).
    expect(count('listing_delivery_scope')).toBe(0);
    expect(count('listing_price')).toBe(0);
    expect(count('listing_photo')).toBe(0);
    // The device is assigned and has a new version.
    expect(
      rows('SELECT listing_id, assigned_at IS NOT NULL AS assigned, version FROM device'),
    ).toEqual([{ listing_id: listing.id, assigned: 1, version: 2 }]);
    // The derived stock columns as CU-128 forms them from the devices (3.3).
    const [stored] = rows<{ quantity: number; stock_json: string; stock_hash: string }>(
      'SELECT quantity, stock_json, stock_hash, article_number_key FROM listing',
    );
    expect(stored).toMatchObject({ quantity: 1, article_number_key: '626198' });
    expect(JSON.parse(stored?.stock_json ?? '')).toEqual({
      quantity: 1,
      wiNrs: [],
      batteryText: '',
    });
    expect(stored?.stock_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('AC-REQ-019-01 writes the audit entries for the creation and the assignment', async () => {
    const deviceId = await captureDevice('626198');

    const { id } = (await createListing({ fromDeviceId: deviceId, deviceVersion: 1 })).json<{
      id: number;
    }>();

    const entries = rows<Record<string, unknown>>(
      `SELECT object_type, object_category, object_id, object_label, action, old_value, new_value
         FROM audit_entry WHERE action <> 'created' OR object_type = 'listing' ORDER BY id`,
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      object_type: 'listing',
      object_category: 'listing',
      object_id: id,
      object_label: 'MacBook Pro 13',
      action: 'created',
      old_value: null,
    });
    expect(JSON.parse(String(entries[0]?.new_value))).toEqual({
      Modellvorlage: 'MacBook Pro 13',
      Zustand: 'gebraucht',
      'Optik-Note': 2,
      RAM: '16',
      Speicherkapazität: '512',
      Speichertyp: 'SSD (NVMe)',
      Tastaturlayout: 'Deutsch (QWERTZ)',
      Betriebssystem: 'macOS',
      'Betriebssystem-Version': 'macOS 14',
      Netzteil: 'mit Netzteil (original)',
      Akku: 'mit Akku',
      Artikelnummer: '626198',
      'EAN-Kennzeichnung': 'Original',
    });
    expect(entries[1]).toMatchObject({
      object_type: 'device',
      object_category: 'device',
      object_id: deviceId,
      object_label: 'Gerät 626198',
      action: 'assigned',
      old_value: null,
      new_value: JSON.stringify({ 'Modell-Inserat': 'MacBook Pro 13' }),
    });
  });

  it('AC-REQ-019-02 rejects the same variant data as MI-A with variant_duplicate and a reference to MI-A; nothing is created', async () => {
    const miA = (
      await createListing({ fromDeviceId: await captureDevice('626198'), deviceVersion: 1 })
    ).json<{ id: number }>().id;
    // Other WI-Nr, battery capacity and operating system version: no variant data (2.6).
    const deviceId = await captureDevice('626199', {
      // Condition description after trim() and lower case is the same as an empty one.
      conditionDescription: '  ',
      values: values({ [ids.batteryCapacity]: { percent: 70 }, [ids.osVersion]: 'macOS 15' }),
    });
    const auditEntries = count('audit_entry');

    const response = await createListing({ fromDeviceId: deviceId, deviceVersion: 1 });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'variant_duplicate',
      message: 'Gleiche Variantenangaben wie Modell-Inserat MacBook Pro 13; bitte dort zuordnen',
      details: { listingId: miA },
    });
    expect(count('listing')).toBe(1);
    expect(count('audit_entry')).toBe(auditEntries);
    expect(rows('SELECT listing_id, version FROM device WHERE id = ?', deviceId)).toEqual([
      { listing_id: null, version: 1 },
    ]);
  });

  it('AC-REQ-019-03 creates a second model listing of MV-A from a device with visual grade 4 and "Display gebrochen"', async () => {
    await createListing({ fromDeviceId: await captureDevice('626198'), deviceVersion: 1 });
    const deviceId = await captureDevice('626199', {
      visualGrade: '4',
      conditionDescription: 'Display gebrochen',
    });

    const response = await createListing({ fromDeviceId: deviceId, deviceVersion: 1 });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      visualGrade: 4,
      conditionDescription: 'Display gebrochen',
      articleNumber: '626199',
      quantity: 1,
    });
    expect(rows('SELECT model_template_id FROM listing')).toEqual([
      { model_template_id: ids.mvA },
      { model_template_id: ids.mvA },
    ]);
  });

  it('AC-REQ-019-06 creates an own model listing from a device that differs only in the keyboard layout "Ungarisch"', async () => {
    await createListing({ fromDeviceId: await captureDevice('626198'), deviceVersion: 1 });
    const deviceId = await captureDevice('626199', {
      values: values({ [ids.keyboard]: ids.hungarian }),
    });

    const response = await createListing({ fromDeviceId: deviceId, deviceVersion: 1 });

    expect(response.statusCode).toBe(201);
    expect(response.json().variantValues).toMatchObject({ [ids.keyboard]: ids.hungarian });
    expect(count('listing')).toBe(2);
  });

  it('rejects a taken article number with article_number_taken at the field and takes another one', async () => {
    await createListing({
      fromDeviceId: await captureDevice('626198'),
      deviceVersion: 1,
      articleNumber: '626199',
    });
    const deviceId = await captureDevice('626199', { visualGrade: '4' });

    const taken = await createListing({ fromDeviceId: deviceId, deviceVersion: 1 });

    expect(taken.statusCode).toBe(422);
    expect(taken.json().error).toMatchObject({
      code: 'article_number_taken',
      message: 'Artikelnummer bereits vergeben',
      details: { path: 'articleNumber' },
    });
    expect(count('listing')).toBe(1);

    // The article number is unique without regard to case (2.7).
    const sameKey = await createListing({
      fromDeviceId: deviceId,
      deviceVersion: 1,
      articleNumber: 'MI-626199'.toLowerCase(),
    });
    expect(sameKey.statusCode).toBe(201);
    expect(sameKey.json().articleNumber).toBe('mi-626199');
  });

  it('rejects an article number of another form with validation_failed at the field', async () => {
    const deviceId = await captureDevice('626198');

    const response = await createListing({
      fromDeviceId: deviceId,
      deviceVersion: 1,
      articleNumber: 'MI A',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'validation_failed',
      fields: [
        {
          path: 'articleNumber',
          message: 'Artikelnummer: 1 bis 30 Zeichen, nur Buchstaben, Ziffern und -',
        },
      ],
    });
    expect(count('listing')).toBe(0);
  });

  it('rejects an outdated device version with 409 version_conflict', async () => {
    const deviceId = await captureDevice('626198');

    const response = await createListing({ fromDeviceId: deviceId, deviceVersion: 2 });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('version_conflict');
    expect(count('listing')).toBe(0);
  });

  it('rejects a sold device with device_not_available', async () => {
    const deviceId = await captureDevice('626198');
    t.database.sqlite.prepare("UPDATE device SET stock_status = 'sold' WHERE id = ?").run(deviceId);

    const response = await createListing({ fromDeviceId: deviceId, deviceVersion: 1 });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'device_not_available',
      message: 'Gerät ist bereits verkauft oder storniert',
    });
    expect(count('listing')).toBe(0);
  });

  it('rejects an assigned device with already_assigned until it can leave its model listing (#199)', async () => {
    const deviceId = await captureDevice('626198');
    await createListing({ fromDeviceId: deviceId, deviceVersion: 1 });

    const response = await createListing({
      fromDeviceId: deviceId,
      deviceVersion: 2,
      articleNumber: 'MI-B',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'already_assigned',
      message: 'Gerät ist bereits einem Modell-Inserat zugeordnet',
    });
    expect(count('listing')).toBe(1);
  });

  it('rejects an unknown device as a program error of the user interface (400)', async () => {
    const response = await createListing({ fromDeviceId: 999, deviceVersion: 1 });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
  });
});

describe('createFromDevice events (CU-123, CU-128; Technical Specification 2.0.4, 2.6)', () => {
  it('reports ListingCreated and StockChanged of the new model listing in its transaction', async () => {
    const deviceId = await captureDevice('626198');
    const seen: ChangeEvent[] = [];
    const record = vi.fn(async (event: ChangeEvent): Promise<ChangeReport> => {
      // The handler runs before the commit and sees the new model listing (2.0.4).
      seen.push(event);
      return emptyChangeReport();
    });
    const uow = createUnitOfWork<DB>(t.database.db, {
      change: { ListingCreated: record, StockChanged: record },
    });
    const service = createAssignmentService({ uow, clock: createClock() });

    const listing = await service.createFromDevice({ fromDeviceId: deviceId, deviceVersion: 1 });

    expect(seen).toEqual([
      { type: 'ListingCreated', listingId: listing.id },
      { type: 'StockChanged', listingId: listing.id },
    ]);
  });

  it('stores nothing when a handler of ListingCreated fails', async () => {
    const deviceId = await captureDevice('626198');
    const uow = createUnitOfWork<DB>(t.database.db, {
      change: {
        ListingCreated: async () => {
          throw new Error('channel contents failed');
        },
      },
    });
    const service = createAssignmentService({ uow, clock: createClock() });

    await expect(
      service.createFromDevice({ fromDeviceId: deviceId, deviceVersion: 1 }),
    ).rejects.toThrow('channel contents failed');
    expect(count('listing')).toBe(0);
    expect(rows('SELECT listing_id, version FROM device')).toEqual([
      { listing_id: null, version: 1 },
    ]);
  });
});
