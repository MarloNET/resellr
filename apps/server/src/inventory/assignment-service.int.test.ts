import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { type ChangeReport, createUnitOfWork, emptyChangeReport } from '../db/unit-of-work.ts';
import { createClock } from '../shared/clock.ts';
import type { ChangeEvent } from '../shared/events.ts';
import { createAssignmentService } from './assignment-service.ts';

// Integration and API tests of `POST /api/listings`, `GET /api/model-templates/{id}/listings`
// and `POST /api/devices/{id}/assignment` (CU-123, CU-125, CU-128, CU-130, CU-294; Technical
// Specification 2.6) on the initial settings of the seed migration: MV-A is an Apple MacBook Pro
// 13 (A1989), a notebook with RAM, storage, storage type, keyboard layout, operating system,
// power supply and battery as variant attributes (Requirements 9.3); MV-B is a notebook of
// another model.

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let ids: Record<
  | 'mvA'
  | 'mvB'
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
  const apple = insertManufacturer(sqlite, 'Apple');
  ids = {
    mvA: insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: apple,
      modelName: 'MacBook Pro 13',
      typeDesignation: 'A1989',
      mpn: 'MR9Q2D/A',
    }),
    mvB: insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: apple,
      modelName: 'MacBook Air 13',
      typeDesignation: 'A2337',
      mpn: 'MGN63D/A',
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
  change: {
    visualGrade?: string;
    conditionDescription?: string;
    values?: object;
    modelTemplateId?: number;
  } = {},
): Promise<number> {
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/devices',
    headers: SAME_ORIGIN_WRITE,
    payload: {
      wiNr,
      supplierId: null,
      modelTemplateId: change.modelTemplateId ?? ids.mvA,
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

  it('takes the value of a deactivated variant attribute into the variant values (K-03)', async () => {
    const deviceId = await captureDevice('626198');
    t.database.sqlite.prepare('UPDATE attribute SET active = 0 WHERE id = ?').run(ids.storageType);

    const response = await createListing({ fromDeviceId: deviceId, deviceVersion: 1 });

    expect(response.statusCode).toBe(201);
    expect(response.json().variantValues).toMatchObject({ [ids.storageType]: ids.nvme });
    expect(response.json().otherValues).not.toHaveProperty(String(ids.storageType));
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

    const another = await createListing({
      fromDeviceId: deviceId,
      deviceVersion: 1,
      articleNumber: 'mi-626199',
    });
    expect(another.statusCode).toBe(201);
    expect(another.json().articleNumber).toBe('mi-626199');
  });

  it('rejects an article number that differs only in case with article_number_taken (2.7)', async () => {
    await createListing({
      fromDeviceId: await captureDevice('626198'),
      deviceVersion: 1,
      articleNumber: 'MI-A',
    });
    const deviceId = await captureDevice('626199', { visualGrade: '4' });

    const response = await createListing({
      fromDeviceId: deviceId,
      deviceVersion: 1,
      articleNumber: 'mi-a',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'article_number_taken',
      details: { path: 'articleNumber' },
    });
    expect(count('listing')).toBe(1);
  });

  it('rejects an article number of another form with validation_failed at the field', async () => {
    const deviceId = await captureDevice('626198');

    const response = await createListing({
      fromDeviceId: deviceId,
      deviceVersion: 1,
      articleNumber: 'ab_1',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'validation_failed',
      fields: [
        {
          path: 'articleNumber',
          message: 'Artikelnummer: 1 bis 30 Zeichen, nur Buchstaben, Ziffern und „-“',
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

  describe('order of the checks: the first matching stage wins (2.6, Nachtrag MAR-1053)', () => {
    it('checks the request schema before the device', async () => {
      const response = await createListing({
        fromDeviceId: 999,
        deviceVersion: 1,
        articleNumber: 'ab_1',
      });

      expect(response.statusCode).toBe(422);
      expect(response.json().error.code).toBe('validation_failed');
    });

    it('checks the device version before the stock status', async () => {
      const deviceId = await captureDevice('626198');
      t.database.sqlite
        .prepare("UPDATE device SET stock_status = 'sold' WHERE id = ?")
        .run(deviceId);

      const response = await createListing({ fromDeviceId: deviceId, deviceVersion: 2 });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('version_conflict');
    });

    it('checks the stock status before the variant data', async () => {
      await createListing({ fromDeviceId: await captureDevice('626198'), deviceVersion: 1 });
      const deviceId = await captureDevice('626199');
      t.database.sqlite
        .prepare("UPDATE device SET stock_status = 'cancelled' WHERE id = ?")
        .run(deviceId);

      const response = await createListing({ fromDeviceId: deviceId, deviceVersion: 1 });

      expect(response.json().error.code).toBe('device_not_available');
      expect(count('listing')).toBe(1);
    });

    it('checks the variant data before the article number', async () => {
      await createListing({
        fromDeviceId: await captureDevice('626198'),
        deviceVersion: 1,
        articleNumber: '626199',
      });
      const deviceId = await captureDevice('626199');

      const response = await createListing({ fromDeviceId: deviceId, deviceVersion: 1 });

      expect(response.json().error.code).toBe('variant_duplicate');
      expect(count('listing')).toBe(1);
    });
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

const assign = (deviceId: number, payload: Record<string, unknown>) =>
  t.app.inject({
    method: 'POST',
    url: `/api/devices/${deviceId}/assignment`,
    headers: SAME_ORIGIN_WRITE,
    payload,
  });

/** MI-A: a model listing of MV-A from the device "626198" with quantity 1; returns its id. */
async function createMiA(): Promise<number> {
  const response = await createListing({
    fromDeviceId: await captureDevice('626198'),
    deviceVersion: 1,
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: number }>().id;
}

const quantityOf = (listingId: number) =>
  rows<{ quantity: number }>('SELECT quantity FROM listing WHERE id = ?', listingId)[0]?.quantity;

describe('GET /api/model-templates/{id}/listings (CU-294, Technical Specification 2.6)', () => {
  const choice = (modelTemplateId: number) =>
    t.app.inject({
      method: 'GET',
      url: `/api/model-templates/${modelTemplateId}/listings`,
      headers: { host: HOST },
    });

  it('DER-58-01 lists each model listing of the model template with its title, variant data and quantity by id', async () => {
    const miA = await createMiA();
    const miB = (
      await createListing({
        fromDeviceId: await captureDevice('626199', {
          visualGrade: '4',
          conditionDescription: 'Display gebrochen',
          values: values({ [ids.ram]: 8 }),
        }),
        deviceVersion: 1,
      })
    ).json<{ id: number }>().id;
    // A model listing of another model template is no choice.
    await createListing({
      fromDeviceId: await captureDevice('626200', { modelTemplateId: ids.mvB }),
      deviceVersion: 1,
    });

    const response = await choice(ids.mvA);

    expect(response.statusCode).toBe(200);
    const variantValues = (ram: string) => [
      { label: 'RAM', value: ram },
      { label: 'Speicherkapazität', value: '512' },
      { label: 'Speichertyp', value: 'SSD (NVMe)' },
      { label: 'Tastaturlayout', value: 'Deutsch (QWERTZ)' },
      { label: 'Betriebssystem', value: 'macOS' },
      { label: 'Netzteil', value: 'mit Netzteil (original)' },
      { label: 'Akku', value: 'mit Akku' },
    ];
    expect(response.json()).toEqual({
      items: [
        {
          id: miA,
          displayTitle: 'MacBook Pro 13',
          variantSummary: {
            conditionLabel: 'gebraucht',
            visualGrade: 2,
            conditionDescription: '',
            variantValues: variantValues('16'),
          },
          quantity: 1,
        },
        {
          id: miB,
          displayTitle: 'MacBook Pro 13',
          variantSummary: {
            conditionLabel: 'gebraucht',
            visualGrade: 4,
            conditionDescription: 'Display gebrochen',
            variantValues: variantValues('8'),
          },
          quantity: 1,
        },
      ],
    });
  });

  it('AC-REQ-017-03 answers an empty list for a model template without model listing', async () => {
    const response = await choice(ids.mvA);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
  });

  it('answers not_found for an unknown model template', async () => {
    const response = await choice(999);

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('not_found');
  });
});

describe('POST /api/devices/{id}/assignment (CU-123, Technical Specification 2.6)', () => {
  it('AC-REQ-017-01 assigns a checked, unassigned device without deviation to MI-A, whose quantity rises from 1 to 2', async () => {
    const miA = await createMiA();
    expect(quantityOf(miA)).toBe(1);
    // Other WI-Nr, battery capacity and operating system version: no variant data (2.6).
    const deviceId = await captureDevice('626199', {
      values: values({ [ids.batteryCapacity]: { percent: 70 }, [ids.osVersion]: 'macOS 15' }),
    });

    const response = await assign(deviceId, { version: 1, listingId: miA });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      device: { id: deviceId, wiNr: '626199', listingId: miA, version: 2 },
      listing: { id: miA, quantity: 2 },
      // Until S5 no handler reports channels (4.4.0).
      adjustStockChannels: [],
    });
    expect(quantityOf(miA)).toBe(2);
    expect(
      rows(
        'SELECT listing_id, assigned_at IS NOT NULL AS assigned, version FROM device WHERE id = ?',
        deviceId,
      ),
    ).toEqual([{ listing_id: miA, assigned: 1, version: 2 }]);
    const [stored] = rows<{ stock_json: string }>(
      'SELECT stock_json FROM listing WHERE id = ?',
      miA,
    );
    expect(JSON.parse(stored?.stock_json ?? '')).toMatchObject({ quantity: 2 });
  });

  it('AC-REQ-017-01 writes the audit entry of the assignment', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199');

    await assign(deviceId, { version: 1, listingId: miA });

    const entries = rows<Record<string, unknown>>(
      `SELECT object_type, object_category, object_id, object_label, action, old_value, new_value
         FROM audit_entry WHERE object_id = ? AND action = 'assigned'`,
      deviceId,
    );
    expect(entries).toEqual([
      {
        object_type: 'device',
        object_category: 'device',
        object_id: deviceId,
        object_label: 'Gerät 626199',
        action: 'assigned',
        old_value: null,
        new_value: JSON.stringify({ 'Modell-Inserat': 'MacBook Pro 13' }),
      },
    ]);
  });

  it('AC-REQ-017-02 rejects a device of another model template with other_model_template; nothing is stored', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199', { modelTemplateId: ids.mvB });
    const auditEntries = count('audit_entry');

    const response = await assign(deviceId, { version: 1, listingId: miA });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'other_model_template',
      message: 'Gerät gehört zu anderer Modellvorlage',
    });
    expect(quantityOf(miA)).toBe(1);
    expect(count('audit_entry')).toBe(auditEntries);
    expect(rows('SELECT listing_id, version FROM device WHERE id = ?', deviceId)).toEqual([
      { listing_id: null, version: 1 },
    ]);
  });

  it('AC-REQ-017-04 rejects a device assigned to MI-A with already_assigned; it stays assigned to MI-A', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199', { visualGrade: '4' });
    const miB = (await createListing({ fromDeviceId: deviceId, deviceVersion: 1 })).json<{
      id: number;
    }>().id;
    const assigned = rows<{ id: number }>('SELECT id FROM device WHERE listing_id = ?', miA)[0];
    if (assigned === undefined) throw new Error('MI-A has no device');

    const response = await assign(assigned.id, { version: 2, listingId: miB });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'already_assigned',
      message: 'Gerät ist bereits einem Modell-Inserat zugeordnet',
    });
    expect(rows('SELECT listing_id, version FROM device WHERE id = ?', assigned.id)).toEqual([
      { listing_id: miA, version: 2 },
    ]);
    expect([quantityOf(miA), quantityOf(miB)]).toEqual([1, 1]);
  });

  it('rejects a sold device with device_not_available', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199');
    t.database.sqlite.prepare("UPDATE device SET stock_status = 'sold' WHERE id = ?").run(deviceId);

    const response = await assign(deviceId, { version: 1, listingId: miA });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'device_not_available',
      message: 'Gerät ist bereits verkauft oder storniert',
    });
    expect(quantityOf(miA)).toBe(1);
  });

  it('rejects an outdated device version with 409 version_conflict; nothing is stored', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199');

    const response = await assign(deviceId, { version: 2, listingId: miA });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('version_conflict');
    expect(quantityOf(miA)).toBe(1);
  });

  it('answers not_found for an unknown device', async () => {
    const miA = await createMiA();

    const response = await assign(999, { version: 1, listingId: miA });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('not_found');
  });

  it('rejects an unknown model listing as a program error of the user interface (400)', async () => {
    const deviceId = await captureDevice('626199');

    const response = await assign(deviceId, { version: 1, listingId: 999 });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
  });

  it('rejects a request without model listing as a program error of the user interface (400)', async () => {
    const deviceId = await captureDevice('626199');

    const response = await assign(deviceId, { version: 1 });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
  });

  describe('order of the checks: the first matching stage wins (2.6)', () => {
    it('checks the device version before the stock status', async () => {
      const miA = await createMiA();
      const deviceId = await captureDevice('626199');
      t.database.sqlite
        .prepare("UPDATE device SET stock_status = 'sold' WHERE id = ?")
        .run(deviceId);

      const response = await assign(deviceId, { version: 2, listingId: miA });

      expect(response.json().error.code).toBe('version_conflict');
    });

    it('checks the stock status before the assignment', async () => {
      const miA = await createMiA();
      const [device] = rows<{ id: number }>('SELECT id FROM device WHERE listing_id = ?', miA);
      t.database.sqlite
        .prepare("UPDATE device SET stock_status = 'sold' WHERE id = ?")
        .run(device?.id);

      const response = await assign(device?.id ?? 0, { version: 2, listingId: miA });

      expect(response.json().error.code).toBe('device_not_available');
    });

    it('checks the assignment before the model template', async () => {
      await createMiA();
      const deviceId = await captureDevice('626200', { modelTemplateId: ids.mvB });
      const miOfB = (await createListing({ fromDeviceId: deviceId, deviceVersion: 1 })).json<{
        id: number;
      }>().id;
      const miA = rows<{ id: number }>(
        'SELECT id FROM listing WHERE model_template_id = ?',
        ids.mvA,
      )[0]?.id;

      const response = await assign(deviceId, { version: 2, listingId: miA });

      expect(response.json().error.code).toBe('already_assigned');
      expect(quantityOf(miOfB)).toBe(1);
    });
  });
});

describe('assign events (CU-123, CU-128; Technical Specification 2.0.4, 2.6)', () => {
  it('reports StockChanged of the model listing and answers the channels of its report', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199');
    const seen: ChangeEvent[] = [];
    const uow = createUnitOfWork<DB>(t.database.db, {
      change: {
        StockChanged: async (event) => {
          seen.push(event);
          return { ...emptyChangeReport(), adjustStockChannels: [2] };
        },
      },
    });
    const service = createAssignmentService({ uow, clock: createClock() });

    const result = await service.assign(deviceId, { version: 1, listingId: miA });

    expect(seen).toEqual([{ type: 'StockChanged', listingId: miA }]);
    expect(result).toMatchObject({ listing: { id: miA, quantity: 2 }, adjustStockChannels: [2] });
  });

  it('stores nothing when a handler of StockChanged fails', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199');
    const uow = createUnitOfWork<DB>(t.database.db, {
      change: {
        StockChanged: async () => {
          throw new Error('stock flags failed');
        },
      },
    });
    const service = createAssignmentService({ uow, clock: createClock() });

    await expect(service.assign(deviceId, { version: 1, listingId: miA })).rejects.toThrow(
      'stock flags failed',
    );
    expect(quantityOf(miA)).toBe(1);
    expect(rows('SELECT listing_id, version FROM device WHERE id = ?', deviceId)).toEqual([
      { listing_id: null, version: 1 },
    ]);
  });
});

describe('assignment with deviating variant data (CU-123, CU-119, REQ-018; Technical Specification 2.6)', () => {
  /** MI-A of a first device with `change`; returns its id. */
  async function createMiAWith(change: Parameters<typeof captureDevice>[1]): Promise<number> {
    const response = await createListing({
      fromDeviceId: await captureDevice('626198', change),
      deviceVersion: 1,
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: number }>().id;
  }

  const deviceOf = (deviceId: number) =>
    rows<{ listing_id: number | null; version: number }>(
      'SELECT listing_id, version FROM device WHERE id = ?',
      deviceId,
    );

  /** Expects `variant_deviation` with `deviations` and that nothing is stored. */
  function expectDeviation(response: Awaited<ReturnType<typeof assign>>, deviations: object[]) {
    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'confirmation_required',
      message: 'Das Gerät weicht vom Modell-Inserat ab.',
      details: { kind: 'variant_deviation', deviations },
    });
  }

  it('AC-REQ-018-01 answers a device that deviates only in the visual grade (4) from MI-A (2) with variant_deviation "Optik-Note: Gerät 4, Modell-Inserat 2"; nothing is stored', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199', { visualGrade: '4' });
    const auditEntries = count('audit_entry');

    const response = await assign(deviceId, { version: 1, listingId: miA });

    expectDeviation(response, [
      { key: 'visualGrade', label: 'Optik-Note', deviceValue: '4', listingValue: '2' },
    ]);
    expect(quantityOf(miA)).toBe(1);
    expect(deviceOf(deviceId)).toEqual([{ listing_id: null, version: 1 }]);
    expect(count('audit_entry')).toBe(auditEntries);
  });

  it('AC-REQ-018-01 answers confirmDeviation false like a request without it', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199', { visualGrade: '4' });

    const response = await assign(deviceId, {
      version: 1,
      listingId: miA,
      confirmDeviation: false,
    });

    expectDeviation(response, [
      { key: 'visualGrade', label: 'Optik-Note', deviceValue: '4', listingValue: '2' },
    ]);
  });

  it('AC-REQ-018-02 trotzdem zuordnen raises the quantity of MI-A by 1, keeps its visual grade 2 and writes the decision with time and deviation to the audit log', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199', { visualGrade: '4' });

    const response = await assign(deviceId, {
      version: 1,
      listingId: miA,
      confirmDeviation: true,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      device: { id: deviceId, listingId: miA, visualGrade: 4, version: 2 },
      listing: { id: miA, quantity: 2 },
    });
    expect(quantityOf(miA)).toBe(2);
    expect(rows('SELECT visual_grade, version FROM listing WHERE id = ?', miA)).toEqual([
      { visual_grade: 2, version: 1 },
    ]);
    const entries = rows<Record<string, unknown>>(
      `SELECT object_type, object_id, object_label, action, old_value, new_value,
              occurred_at IS NOT NULL AS timed
         FROM audit_entry WHERE object_id = ? AND object_type = 'device' AND action LIKE 'assigned%'`,
      deviceId,
    );
    expect(entries).toEqual([
      {
        object_type: 'device',
        object_id: deviceId,
        object_label: 'Gerät 626199',
        action: 'assigned_despite_deviation',
        old_value: null,
        new_value: JSON.stringify({
          'Modell-Inserat': 'MacBook Pro 13',
          Abweichungen: ['Optik-Note: Gerät 4, Modell-Inserat 2'],
        }),
        timed: 1,
      },
    ]);
  });

  it('AC-REQ-018-03 assigns without a question despite battery capacity 77 (85), operating system version "14.6" ("15.1") and the description " Leichte Gebrauchsspuren " in other case', async () => {
    const miA = await createMiAWith({
      conditionDescription: 'leichte Gebrauchsspuren',
      values: values({ [ids.osVersion]: '15.1' }),
    });
    const deviceId = await captureDevice('626199', {
      conditionDescription: ' Leichte Gebrauchsspuren ',
      values: values({ [ids.batteryCapacity]: { percent: 77 }, [ids.osVersion]: '14.6' }),
    });

    const response = await assign(deviceId, { version: 1, listingId: miA });

    expect(response.statusCode).toBe(200);
    expect(quantityOf(miA)).toBe(2);
    expect(
      rows(
        "SELECT action FROM audit_entry WHERE object_id = ? AND object_type = 'device'",
        deviceId,
      ),
    ).toContainEqual({ action: 'assigned' });
  });

  it('AC-REQ-018-04 answers RAM 8 GB against MI-A with 16 GB with "RAM: Gerät 8GB, Modell-Inserat 16GB"', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199', { values: values({ [ids.ram]: 8 }) });

    const response = await assign(deviceId, { version: 1, listingId: miA });

    expectDeviation(response, [
      { key: String(ids.ram), label: 'RAM', deviceValue: '8GB', listingValue: '16GB' },
    ]);
  });

  it('AC-REQ-018-05 answers both condition descriptions complete and assigns only after the choice', async () => {
    const miA = await createMiAWith({ conditionDescription: 'leichte Gebrauchsspuren' });
    const deviceId = await captureDevice('626199', {
      conditionDescription: 'Display- und Gehäuseschaden',
    });

    const response = await assign(deviceId, { version: 1, listingId: miA });

    expectDeviation(response, [
      {
        key: 'conditionDescription',
        label: 'Zustandsbeschreibung',
        deviceValue: 'Display- und Gehäuseschaden',
        listingValue: 'leichte Gebrauchsspuren',
      },
    ]);
    expect(deviceOf(deviceId)).toEqual([{ listing_id: null, version: 1 }]);

    const confirmed = await assign(deviceId, {
      version: 1,
      listingId: miA,
      confirmDeviation: true,
    });

    expect(confirmed.statusCode).toBe(200);
    expect(deviceOf(deviceId)).toEqual([{ listing_id: miA, version: 2 }]);
  });

  it('AC-REQ-018-06 answers the deviation of the keyboard layout "Ungarisch" from "Deutsch (QWERTZ)"', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199', {
      values: values({ [ids.keyboard]: ids.hungarian }),
    });

    const response = await assign(deviceId, { version: 1, listingId: miA });

    expectDeviation(response, [
      {
        key: String(ids.keyboard),
        label: 'Tastaturlayout',
        deviceValue: 'Ungarisch',
        listingValue: 'Deutsch (QWERTZ)',
      },
    ]);
  });

  it('DER-59-01 K-03 deactivating the variant attribute RAM with stored values gives 200; a device captured after it without RAM deviates from MI-A with "leer ≠ Wert"', async () => {
    const miA = await createMiA();
    const deactivated = await t.app.inject({
      method: 'PATCH',
      url: `/api/attributes/${ids.ram}`,
      headers: SAME_ORIGIN_WRITE,
      payload: { version: 1, active: false },
    });
    expect(deactivated.statusCode).toBe(200);
    const withoutRam: Record<string, unknown> = values();
    delete withoutRam[ids.ram];
    const deviceId = await captureDevice('626199', { values: withoutRam });

    const response = await assign(deviceId, { version: 1, listingId: miA });

    expectDeviation(response, [
      { key: String(ids.ram), label: 'RAM', deviceValue: '–', listingValue: '16GB' },
    ]);
  });

  it('checks the model template before the variant data (2.6)', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199', { modelTemplateId: ids.mvB, visualGrade: '4' });

    const response = await assign(deviceId, { version: 1, listingId: miA });

    expect(response.json().error.code).toBe('other_model_template');
  });

  it('checks the device version before the variant data, also when confirmed', async () => {
    const miA = await createMiA();
    const deviceId = await captureDevice('626199', { visualGrade: '4' });

    const response = await assign(deviceId, { version: 2, listingId: miA, confirmDeviation: true });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('version_conflict');
    expect(deviceOf(deviceId)).toEqual([{ listing_id: null, version: 1 }]);
  });

  describe('GET /api/model-templates/{id}/listings?deviceId= (CU-294)', () => {
    const choice = (query: string) =>
      t.app.inject({
        method: 'GET',
        url: `/api/model-templates/${ids.mvA}/listings?${query}`,
        headers: { host: HOST },
      });

    it('gives each model listing its deviations to the device, empty for a matching one', async () => {
      const miA = await createMiA();
      const miB = (
        await createListing({
          fromDeviceId: await captureDevice('626199', { visualGrade: '4' }),
          deviceVersion: 1,
        })
      ).json<{ id: number }>().id;
      const deviceId = await captureDevice('626200', { values: values({ [ids.ram]: 8 }) });

      const response = await choice(`deviceId=${deviceId}`);

      expect(response.statusCode).toBe(200);
      const ram = { key: String(ids.ram), label: 'RAM', deviceValue: '8GB', listingValue: '16GB' };
      expect(
        response
          .json<{ items: { id: number; deviations: unknown[] }[] }>()
          .items.map(({ id, deviations }) => ({ id, deviations })),
      ).toEqual([
        { id: miA, deviations: [ram] },
        {
          id: miB,
          deviations: [
            { key: 'visualGrade', label: 'Optik-Note', deviceValue: '2', listingValue: '4' },
            ram,
          ],
        },
      ]);
    });

    it('rejects an unknown device as a program error of the user interface (400)', async () => {
      await createMiA();

      const response = await choice('deviceId=999');

      expect(response.statusCode).toBe(400);
    });

    it('rejects a deviceId that is no id (400)', async () => {
      const response = await choice('deviceId=abc');

      expect(response.statusCode).toBe(400);
    });
  });
});
