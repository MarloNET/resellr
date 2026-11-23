import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { type ChangeReport, createUnitOfWork, emptyChangeReport } from '../db/unit-of-work.ts';
import { createClock } from '../shared/clock.ts';
import type { ChangeEvent } from '../shared/events.ts';
import { createListingService } from './listing-service.ts';

// API and integration tests of `PATCH /api/listings/{id}` (CU-124, CU-125, CU-130, CU-116;
// Technical Specification 2.7, 2.0.11) on the initial settings of the seed migration: MV-A is an
// Apple MacBook Pro 13, a notebook with RAM, storage, storage type, keyboard layout, operating
// system, power supply and battery as variant attributes and the operating system version as
// other value (Requirements 9.3). The model listings are created through the API (#197).

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let ids: Record<
  | 'mvA'
  | 'notebook'
  | 'used'
  | 'likeNew'
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
  | 'sata'
  | 'german'
  | 'macos'
  | 'originalPowerSupply'
  | 'withoutPowerSupply'
  | 'withBattery',
  number
>;

const STAMP = '2026-11-16T08:00:00.000Z';
const ARTICLE_NUMBER_RULE = 'Artikelnummer: 1 bis 30 Zeichen, nur Buchstaben, Ziffern und „-“';
const EAN_RULE = 'EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer';

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
    notebook,
    used: valueId('gebraucht'),
    likeNew: valueId('refurbished'),
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
    sata: valueId('SSD (SATA)'),
    german: valueId('Deutsch (QWERTZ)'),
    macos: valueId('macOS'),
    originalPowerSupply: valueId('mit Netzteil (original)'),
    withoutPowerSupply: valueId('ohne Netzteil'),
    withBattery: valueId('mit Akku'),
  };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const run = (sql: string, ...params: unknown[]) => t.database.sqlite.prepare(sql).run(...params);
const rows = (sql: string, ...params: unknown[]) =>
  t.database.sqlite.prepare(sql).all(...params) as Record<string, unknown>[];

/** Captures a checked device of MV-A through the API; returns its id. */
async function captureDevice(wiNr: string, visualGrade = '2'): Promise<number> {
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/devices',
    headers: SAME_ORIGIN_WRITE,
    payload: {
      wiNr,
      supplierId: null,
      modelTemplateId: ids.mvA,
      conditionValueId: ids.used,
      visualGrade,
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
        [ids.batteryCapacity]: { percent: 85 },
      },
      confirmedKeys: [],
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: number }>().id;
}

/** Creates a model listing of MV-A from a new device; returns its id. */
async function createListing(wiNr: string, visualGrade = '2'): Promise<number> {
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/listings',
    headers: SAME_ORIGIN_WRITE,
    payload: { fromDeviceId: await captureDevice(wiNr, visualGrade), deviceVersion: 1 },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: number }>().id;
}

const patch = (listingId: number, payload: Record<string, unknown>) =>
  t.app.inject({
    method: 'PATCH',
    url: `/api/listings/${listingId}`,
    headers: SAME_ORIGIN_WRITE,
    payload,
  });

/** A text block of the given kind, active and for all device types; returns its id. */
const insertTextBlock = (name: string, kind = 'delivery_scope') =>
  Number(
    run(
      `INSERT INTO text_block (name, name_key, kind, body, active, all_device_types, all_channels,
         version, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, 1, 1, 1, ?, ?)`,
      name,
      name.toLowerCase(),
      kind,
      name,
      STAMP,
      STAMP,
    ).lastInsertRowid,
  );

const deactivate = (valueId: number) =>
  run('UPDATE pick_list_value SET active = 0 WHERE id = ?', valueId);

const listingRow = (listingId: number) =>
  rows(
    `SELECT condition_value_id, visual_grade, variant_values, other_device_values, article_number,
       article_number_key, ean_mode, own_ean, version FROM listing WHERE id = ?`,
    listingId,
  )[0];

const auditEntries = (listingId: number) =>
  rows(
    "SELECT action, old_value, new_value FROM audit_entry WHERE object_type = 'listing' AND object_id = ? ORDER BY id",
    listingId,
  );

describe('PATCH /api/listings/{id} (CU-124, Technical Specification 2.7)', () => {
  it('stores delivery scope, article number and own EAN with a new version and answers with the model listing', async () => {
    const listingId = await createListing('626198');
    const cable = insertTextBlock('Netzkabel');
    const box = insertTextBlock('Originalverpackung');

    const response = await patch(listingId, {
      version: 1,
      deliveryScopeTextBlockIds: [box, cable],
      articleNumber: 'MBP13-A',
      eanMode: 'own',
      ownEan: '4255867000014',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: listingId,
      deliveryScopeTextBlockIds: [box, cable],
      articleNumber: 'MBP13-A',
      eanMode: 'own',
      ownEan: '4255867000014',
      visualGrade: 2,
      version: 2,
    });
    expect(
      rows(
        'SELECT text_block_id, position FROM listing_delivery_scope WHERE listing_id = ? ORDER BY position',
        listingId,
      ),
    ).toEqual([
      { text_block_id: box, position: 0 },
      { text_block_id: cable, position: 1 },
    ]);
    expect(listingRow(listingId)).toMatchObject({ article_number_key: 'mbp13-a', version: 2 });
  });

  it('writes the audit entry values_updated with the changed fields only', async () => {
    const listingId = await createListing('626198');
    const cable = insertTextBlock('Netzkabel');

    await patch(listingId, {
      version: 1,
      deliveryScopeTextBlockIds: [cable],
      articleNumber: 'MBP13-A',
      eanMode: 'own',
      ownEan: '4255867000014',
    });

    const [entry] = auditEntries(listingId).filter(({ action }) => action === 'values_updated');
    expect(JSON.parse(entry?.old_value as string)).toEqual({
      Lieferumfang: null,
      Artikelnummer: '626198',
      'EAN-Kennzeichnung': 'Original',
      'eigene EAN': null,
    });
    expect(JSON.parse(entry?.new_value as string)).toEqual({
      Lieferumfang: 'Netzkabel',
      Artikelnummer: 'MBP13-A',
      'EAN-Kennzeichnung': 'eigene',
      'eigene EAN': '4255867000014',
    });
  });

  it('keeps the version and writes no audit entry for an unchanged request', async () => {
    const listingId = await createListing('626198');

    const response = await patch(listingId, {
      version: 1,
      visualGrade: 2,
      articleNumber: '626198',
      eanMode: 'original',
      ownEan: null,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().version).toBe(1);
    expect(auditEntries(listingId).map(({ action }) => action)).toEqual(['created']);
  });

  it('sets the own EAN to null with the marking "Original"', async () => {
    const listingId = await createListing('626198');
    await patch(listingId, { version: 1, eanMode: 'own', ownEan: '4255867000014' });

    const response = await patch(listingId, { version: 2, eanMode: 'original' });

    expect(response.json()).toMatchObject({ eanMode: 'original', ownEan: null, version: 3 });
  });

  it('AC-REQ-088-02 rejects the visual grade 4 that a second model listing of MV-A has, with a reference to it; nothing is stored', async () => {
    const miA = await createListing('626198', '2');
    const second = await createListing('626199', '4');

    const response = await patch(miA, { version: 1, visualGrade: '4' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'variant_duplicate',
      message: 'Variantenangaben stimmen mit Modell-Inserat MacBook Pro 13 überein',
      details: { listingId: second },
    });
    expect(listingRow(miA)).toMatchObject({ visual_grade: 2, version: 1 });
  });

  it('compares the variant data with the other model listings only, not with itself', async () => {
    const miA = await createListing('626198', '2');
    await createListing('626199', '4');

    const response = await patch(miA, { version: 1, visualGrade: '2', articleNumber: 'MI-A' });

    expect(response.statusCode).toBe(200);
  });

  it('AC-REQ-088-04 rejects the own EAN 4255867000015 at the field EAN and stores 4255867000014', async () => {
    const listingId = await createListing('626198');

    const rejected = await patch(listingId, {
      version: 1,
      eanMode: 'own',
      ownEan: '4255867000015',
    });

    expect(rejected.statusCode).toBe(422);
    expect(rejected.json().error).toMatchObject({
      code: 'validation_failed',
      fields: [{ path: 'ownEan', message: EAN_RULE }],
    });
    expect(listingRow(listingId)).toMatchObject({ ean_mode: 'original', own_ean: null });

    const stored = await patch(listingId, { version: 1, eanMode: 'own', ownEan: '4255867000014' });

    expect(stored.statusCode).toBe(200);
    expect(listingRow(listingId)).toMatchObject({ ean_mode: 'own', own_ean: '4255867000014' });
  });

  it('requires the own EAN with the marking "eigene"', async () => {
    const listingId = await createListing('626198');

    const response = await patch(listingId, { version: 1, eanMode: 'own' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      expect.objectContaining({ path: 'ownEan', message: EAN_RULE }),
    ]);
  });

  it('AC-REQ-088-06 has no model data: a processor or a model value is not part of the request and nothing is stored', async () => {
    const listingId = await createListing('626198');
    const processor = rows(
      "SELECT id FROM attribute WHERE device_type_id = ? AND label = 'Prozessor'",
      ids.notebook,
    )[0]?.id as number;

    for (const payload of [
      { version: 1, processor: 'Intel Core i7' },
      { version: 1, modelValues: { [processor]: 'Intel Core i7' } },
      { version: 1, variantValues: { [processor]: 'Intel Core i7' } },
      { version: 1, otherValues: { [processor]: 'Intel Core i7' } },
    ]) {
      const response = await patch(listingId, payload);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('bad_request');
    }
    expect(listingRow(listingId)).toMatchObject({ version: 1 });
  });

  it.each([
    ['empty', ''],
    ['31 characters', 'A'.repeat(31)],
    ['an underscore', 'MI_A'],
    ['a space', 'MI A'],
  ])(
    'DER-64-04 rejects an article number with %s at articleNumber with the text of POST /api/listings; nothing is stored',
    async (_case, articleNumber) => {
      const listingId = await createListing('626198');

      const response = await patch(listingId, { version: 1, articleNumber });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'validation_failed',
        fields: [{ path: 'articleNumber', message: ARTICLE_NUMBER_RULE }],
      });
      expect(listingRow(listingId)).toMatchObject({ article_number: '626198', version: 1 });
    },
  );

  it('checks the values on the complete state: without the stored RAM only the article number cannot be changed', async () => {
    const listingId = await createListing('626198');
    const variantValues = JSON.parse(listingRow(listingId)?.variant_values as string);
    delete variantValues[ids.ram];
    run(
      'UPDATE listing SET variant_values = ? WHERE id = ?',
      JSON.stringify(variantValues),
      listingId,
    );

    const response = await patch(listingId, { version: 1, articleNumber: 'MI-B' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      expect.objectContaining({ path: `variantValues.${ids.ram}`, message: 'RAM fehlt' }),
    ]);
  });

  it('answers not_found for an unknown model listing and version_conflict for an old version', async () => {
    const listingId = await createListing('626198');

    expect((await patch(999, { version: 1 })).statusCode).toBe(404);
    await patch(listingId, { version: 1, visualGrade: '3', confirmDeviatingDevices: true });
    const stale = await patch(listingId, { version: 1, visualGrade: '4' });

    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('version_conflict');
    expect(listingRow(listingId)).toMatchObject({ visual_grade: 3, version: 2 });
  });

  it('answers bad_request for an unknown text block of the delivery scope', async () => {
    const listingId = await createListing('626198');

    const response = await patch(listingId, { version: 1, deliveryScopeTextBlockIds: [999] });

    expect(response.statusCode).toBe(400);
  });

  it('answers bad_request for a text block chosen twice (2.0.5 structure error)', async () => {
    const listingId = await createListing('626198');
    const cable = insertTextBlock('Netzkabel');

    const response = await patch(listingId, {
      version: 1,
      deliveryScopeTextBlockIds: [cable, cable],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
    expect(listingRow(listingId)).toMatchObject({ version: 1 });
  });

  it('moves the stored values when the flag "variantenbildend" was set after the creation (2.1)', async () => {
    const listingId = await createListing('626198');
    run('UPDATE attribute SET variant_forming = 1 WHERE id = ?', ids.osVersion);

    const response = await patch(listingId, { version: 1, articleNumber: 'MBP13-A' });

    expect(response.statusCode).toBe(200);
    const row = listingRow(listingId);
    expect(JSON.parse(row?.variant_values as string)).toMatchObject({
      [ids.osVersion]: 'macOS 14',
    });
    expect(JSON.parse(row?.other_device_values as string)).toEqual({});
  });

  it('moves the stored values when the flag "variantenbildend" was removed after the creation (2.1)', async () => {
    const listingId = await createListing('626198');
    run('UPDATE attribute SET variant_forming = 0 WHERE id = ?', ids.storageType);

    const response = await patch(listingId, { version: 1, articleNumber: 'MBP13-A' });

    expect(response.statusCode).toBe(200);
    const row = listingRow(listingId);
    expect(JSON.parse(row?.variant_values as string)).not.toHaveProperty(String(ids.storageType));
    expect(JSON.parse(row?.other_device_values as string)).toEqual({
      [ids.osVersion]: 'macOS 14',
      [ids.storageType]: ids.nvme,
    });
  });
});

describe('PATCH /api/listings/{id} article number taken (CU-124, Technical Specification 2.7, #200)', () => {
  it('AC-REQ-019-04 rejects changing the article number of a second model listing to the taken "626198" with "Artikelnummer bereits vergeben"; nothing is stored', async () => {
    await createListing('626198', '2');
    const second = await createListing('626199', '4');
    const entries = auditEntries(second).length;

    const response = await patch(second, { version: 1, articleNumber: '626198' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'article_number_taken',
      message: 'Artikelnummer bereits vergeben',
      details: { path: 'articleNumber' },
    });
    expect(listingRow(second)).toMatchObject({
      article_number: '626199',
      article_number_key: '626199',
      version: 1,
    });
    expect(auditEntries(second)).toHaveLength(entries);
  });

  it('rejects an article number that differs only in case from another one (2.7)', async () => {
    const miA = await createListing('626198', '2');
    const second = await createListing('626199', '4');
    expect((await patch(miA, { version: 1, articleNumber: 'MI-A' })).statusCode).toBe(200);

    const response = await patch(second, { version: 1, articleNumber: 'mi-a' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('article_number_taken');
    expect(listingRow(second)).toMatchObject({ article_number: '626199', version: 1 });
  });

  it('stores the own article number in another case and a free one', async () => {
    const listingId = await createListing('626198');
    expect((await patch(listingId, { version: 1, articleNumber: 'MI-A' })).statusCode).toBe(200);

    const response = await patch(listingId, { version: 2, articleNumber: 'mi-a' });

    expect(response.statusCode).toBe(200);
    expect(listingRow(listingId)).toMatchObject({
      article_number: 'mi-a',
      article_number_key: 'mi-a',
      version: 3,
    });
  });

  it('reports a variant duplicate before a taken article number (2.0.11)', async () => {
    const miA = await createListing('626198', '2');
    const second = await createListing('626199', '4');

    const response = await patch(second, { version: 1, visualGrade: '2', articleNumber: '626198' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('variant_duplicate');
    expect(response.json().error.details).toEqual({ listingId: miA });
  });

  it('reports a taken article number before the question about deviating devices (2.5)', async () => {
    const miA = await createListing('626198', '2');
    await assign(await captureDevice('626200', '2'), miA);
    await createListing('626199', '4');

    const response = await patch(miA, { version: 1, visualGrade: '3', articleNumber: '626199' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('article_number_taken');
    expect(listingRow(miA)).toMatchObject({ visual_grade: 2, version: 1 });
  });
});

/** Assigns a captured device to a model listing through the API (#194, #196). */
async function assign(deviceId: number, listingId: number, confirmDeviation = false) {
  const response = await t.app.inject({
    method: 'POST',
    url: `/api/devices/${deviceId}/assignment`,
    headers: SAME_ORIGIN_WRITE,
    payload: { version: 1, listingId, confirmDeviation },
  });
  expect(response.statusCode).toBe(200);
}

/** MI-A of AC-REQ-088-03: two assigned, available devices with visual grade 2. */
async function listingWithTwoDevices(): Promise<number> {
  const miA = await createListing('626198', '2');
  await assign(await captureDevice('626199', '2'), miA);
  return miA;
}

const OPTIK_NOTE_2_TO_3 = {
  key: 'visualGrade',
  label: 'Optik-Note',
  deviceValue: '2',
  listingValue: '3',
};

describe('PATCH /api/listings/{id} deviating assigned devices (CU-124, Technical Specification 2.7, #207)', () => {
  it('answers confirmation_required with assigned_devices_deviate and details.devices[] without confirmDeviatingDevices; nothing is stored', async () => {
    const miA = await listingWithTwoDevices();

    const response = await patch(miA, { version: 1, visualGrade: '3' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'confirmation_required',
      message: 'Nach dieser Änderung weichen 2 zugeordnete Geräte vom Modell-Inserat ab:',
      details: {
        kind: 'assigned_devices_deviate',
        devices: [
          { wiNr: '626198', deviations: [OPTIK_NOTE_2_TO_3] },
          { wiNr: '626199', deviations: [OPTIK_NOTE_2_TO_3] },
        ],
      },
    });
    expect(listingRow(miA)).toMatchObject({ visual_grade: 2, version: 1 });
    expect(auditEntries(miA).map(({ action }) => action)).toEqual(['created']);
  });

  it('AC-REQ-088-03 names both devices with "Optik-Note: Gerät 2, Modell-Inserat 3", stores only after the confirmation and logs it', async () => {
    const miA = await listingWithTwoDevices();

    const asked = await patch(miA, { version: 1, visualGrade: '3' });
    expect(asked.statusCode).toBe(422);
    expect(
      asked
        .json<{ error: { details: { devices: { wiNr: string; deviations: unknown[] }[] } } }>()
        .error.details.devices.map(({ wiNr }) => wiNr),
    ).toEqual(['626198', '626199']);
    expect(listingRow(miA)).toMatchObject({ visual_grade: 2, version: 1 });

    const confirmed = await patch(miA, {
      version: 1,
      visualGrade: '3',
      confirmDeviatingDevices: true,
    });

    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({ visualGrade: 3, version: 2 });
    const entries = auditEntries(miA);
    expect(entries.map(({ action }) => action)).toEqual(['created', 'deviation_confirmed']);
    expect(JSON.parse(entries[1]?.old_value as string)).toEqual({ 'Optik-Note': 2 });
    expect(JSON.parse(entries[1]?.new_value as string)).toEqual({
      'Optik-Note': 3,
      Abweichungen: {
        'Gerät 626198': ['Optik-Note: Gerät 2, Modell-Inserat 3'],
        'Gerät 626199': ['Optik-Note: Gerät 2, Modell-Inserat 3'],
      },
    });
    expect(
      rows("SELECT object_category FROM audit_entry WHERE action = 'deviation_confirmed'"),
    ).toEqual([{ object_category: 'listing' }]);
  });

  it('names only the available devices that deviate afterwards, with all their deviations', async () => {
    const miA = await createListing('626198', '2');
    const matching = await captureDevice('626199', '3');
    await assign(matching, miA, true);
    const sold = await captureDevice('626200', '2');
    await assign(sold, miA);
    run("UPDATE device SET stock_status = 'sold', sold_on = '2026-11-17' WHERE id = ?", sold);

    const response = await patch(miA, {
      version: 1,
      visualGrade: '3',
      conditionDescription: 'Kratzer am Deckel',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.details.devices).toEqual([
      {
        wiNr: '626198',
        deviations: [
          OPTIK_NOTE_2_TO_3,
          {
            key: 'conditionDescription',
            label: 'Zustandsbeschreibung',
            deviceValue: '–',
            listingValue: 'Kratzer am Deckel',
          },
        ],
      },
      {
        wiNr: '626199',
        deviations: [
          {
            key: 'conditionDescription',
            label: 'Zustandsbeschreibung',
            deviceValue: '–',
            listingValue: 'Kratzer am Deckel',
          },
        ],
      },
    ]);
  });

  it('asks nothing when the variant data stay, even with a device that already deviates', async () => {
    const miA = await createListing('626198', '2');
    await assign(await captureDevice('626199', '4'), miA, true);

    const response = await patch(miA, { version: 1, articleNumber: 'MI-A' });

    expect(response.statusCode).toBe(200);
    expect(auditEntries(miA).map(({ action }) => action)).toEqual(['created', 'values_updated']);
  });

  it('asks nothing when no assigned device deviates after the change', async () => {
    const miA = await createListing('626198', '2');
    run("UPDATE device SET stock_status = 'sold', sold_on = '2026-11-17' WHERE wi_nr = '626198'");

    const response = await patch(miA, { version: 1, visualGrade: '3' });

    expect(response.statusCode).toBe(200);
    expect(auditEntries(miA).map(({ action }) => action)).toEqual(['created', 'values_updated']);
  });

  it('reports a variant duplicate before the question (2.5)', async () => {
    const miA = await listingWithTwoDevices();
    await createListing('626300', '4');

    const response = await patch(miA, { version: 1, visualGrade: '4' });

    expect(response.json().error.code).toBe('variant_duplicate');
  });

  it('reports a field error before the question (2.5)', async () => {
    const miA = await listingWithTwoDevices();

    const response = await patch(miA, { version: 1, visualGrade: '3', articleNumber: 'MI A' });

    expect(response.json().error.code).toBe('validation_failed');
  });
});

describe('AC-REQ-005-12 listing values checked on the state after the change (CU-124, Technical Specification 2.5, 2.7)', () => {
  const patchAttribute = async (id: number, payload: Record<string, unknown>) => {
    const response = await t.app.inject({
      method: 'PATCH',
      url: `/api/attributes/${id}`,
      headers: SAME_ORIGIN_WRITE,
      payload,
    });
    expect(response.statusCode).toBe(200);
    return response.json<{ version: number }>().version;
  };
  const shopChannel = () => rows("SELECT id FROM channel WHERE code = 'shop'")[0]?.id as number;
  const storedValues = (listingId: number) => {
    const row = listingRow(listingId);
    return {
      ...JSON.parse(row?.other_device_values as string),
      ...JSON.parse(row?.variant_values as string),
    };
  };

  /** "MI-B": a model listing of MV-A created without RAM while RAM was deactivated. */
  async function miBWithoutRamAfterReactivation(): Promise<number> {
    const version = await patchAttribute(ids.ram, { version: 1, active: false });
    const listingId = await createListing('626198');
    const variantValues = JSON.parse(listingRow(listingId)?.variant_values as string);
    delete variantValues[ids.ram];
    // The device of the listing carries RAM 16; the listing values of MI-B have none, as in the
    // example of AC-REQ-005-12. The other values come through the API.
    run(
      'UPDATE listing SET variant_values = ? WHERE id = ?',
      JSON.stringify(variantValues),
      listingId,
    );
    await patchAttribute(ids.ram, { version, active: true });
    return listingId;
  }

  it('AC-REQ-005-12 saves the Shop price 499,00 € of "MI-B" without RAM value, asking for no RAM value', async () => {
    const listingId = await miBWithoutRamAfterReactivation();

    const response = await t.app.inject({
      method: 'PUT',
      url: `/api/listings/${listingId}/prices/${shopChannel()}`,
      headers: SAME_ORIGIN_WRITE,
      payload: { version: 1, amountCents: 49900, vb: false },
    });

    expect(response.statusCode).toBe(200);
    expect(
      rows('SELECT channel_id, amount_cents FROM listing_price WHERE listing_id = ?', listingId),
    ).toEqual([{ channel_id: shopChannel(), amount_cents: 49900 }]);
    expect(storedValues(listingId)).not.toHaveProperty(String(ids.ram));
  });

  it('AC-REQ-005-12 rejects a change of the article number only of "MI-B" with "RAM fehlt" at variantValues.<id>, stores nothing', async () => {
    const listingId = await miBWithoutRamAfterReactivation();
    const audits = auditEntries(listingId).length;

    const response = await patch(listingId, { version: 1, articleNumber: 'MI-B' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'validation_failed',
      fields: [{ path: `variantValues.${ids.ram}`, code: 'value_missing', message: 'RAM fehlt' }],
    });
    expect(listingRow(listingId)).toMatchObject({ article_number: '626198', version: 1 });
    expect(auditEntries(listingId)).toHaveLength(audits);

    const saved = await patch(listingId, {
      version: 1,
      articleNumber: 'MI-B',
      variantValues: { [ids.ram]: 16 },
    });
    expect(saved.statusCode).toBe(200);
  });

  it('AC-REQ-005-12 activating RAM writes no RAM value to "MI-B"', async () => {
    const listingId = await miBWithoutRamAfterReactivation();

    expect(storedValues(listingId)).not.toHaveProperty(String(ids.ram));
    expect(listingRow(listingId)?.version).toBe(1);
  });

  it('AC-REQ-005-12 names a missing required value at otherValues.<id> together with the other field errors of the request', async () => {
    const listingId = await createListing('626198');
    const version = await patchAttribute(ids.osVersion, { version: 1, required: true });
    expect(version).toBe(2);
    const otherValues = JSON.parse(listingRow(listingId)?.other_device_values as string);
    delete otherValues[ids.osVersion];
    run(
      'UPDATE listing SET other_device_values = ? WHERE id = ?',
      JSON.stringify(otherValues),
      listingId,
    );

    const response = await patch(listingId, { version: 1, articleNumber: '' });

    expect(response.statusCode).toBe(422);
    expect(
      response
        .json()
        .error.fields.map(({ path, message }: { path: string; message: string }) => [
          path,
          message,
        ]),
    ).toEqual(
      expect.arrayContaining([
        [`otherValues.${ids.osVersion}`, 'Betriebssystem-Version fehlt'],
        ['articleNumber', ARTICLE_NUMBER_RULE],
      ]),
    );
  });

  it('AC-REQ-005-12 keeps the stored value of a deactivated attribute the request does not name', async () => {
    const listingId = await createListing('626198');
    await patchAttribute(ids.ram, { version: 1, active: false });

    const response = await patch(listingId, { version: 1, articleNumber: 'MI-B' });

    expect(response.statusCode).toBe(200);
    expect(storedValues(listingId)[ids.ram]).toBe(16);
  });
});

describe('PATCH /api/listings/{id} active entries (CU-124, Technical Specification 2.0.11, T6)', () => {
  it('DER-64-10 rejects a condition changed to a deactivated one with pick_list_value_deactivated at conditionValueId', async () => {
    const listingId = await createListing('626198');
    deactivate(ids.likeNew);

    const response = await patch(listingId, { version: 1, conditionValueId: ids.likeNew });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'pick_list_value_deactivated',
      message: 'Zustand refurbished ist deaktiviert',
      details: { path: 'conditionValueId', id: ids.likeNew },
    });
    expect(listingRow(listingId)).toMatchObject({ condition_value_id: ids.used, version: 1 });
  });

  it('DER-64-10 rejects a variant value changed to a deactivated one with "<Merkmal>: <Wert> ist deaktiviert"', async () => {
    const listingId = await createListing('626198');
    deactivate(ids.sata);

    const response = await patch(listingId, {
      version: 1,
      variantValues: { [ids.storageType]: ids.sata },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'pick_list_value_deactivated',
      message: 'Speichertyp: SSD (SATA) ist deaktiviert',
      details: { path: `variantValues.${ids.storageType}`, id: ids.sata },
    });
  });

  it('DER-64-10 rejects another value changed to a deactivated one at otherValues', async () => {
    // The power supply as other value of the model listing: not variant forming at its creation.
    run('UPDATE attribute SET variant_forming = 0 WHERE id = ?', ids.powerSupply);
    const listingId = await createListing('626198');
    deactivate(ids.withoutPowerSupply);

    const response = await patch(listingId, {
      version: 1,
      otherValues: { [ids.powerSupply]: ids.withoutPowerSupply },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'pick_list_value_deactivated',
      message: 'Netzteil: ohne Netzteil ist deaktiviert',
      details: { path: `otherValues.${ids.powerSupply}`, id: ids.withoutPowerSupply },
    });
  });

  it('DER-64-10 stores a change of the article number or the delivery scope with a stored, deactivated condition and value', async () => {
    const listingId = await createListing('626198');
    deactivate(ids.used);
    deactivate(ids.nvme);
    const cable = insertTextBlock('Netzkabel');

    const response = await patch(listingId, {
      version: 1,
      conditionValueId: ids.used,
      variantValues: { [ids.storageType]: ids.nvme },
      articleNumber: 'MI-A',
      deliveryScopeTextBlockIds: [cable],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      conditionValueId: ids.used,
      articleNumber: 'MI-A',
      deliveryScopeTextBlockIds: [cable],
      version: 2,
    });
  });

  it('DER-64-10 answers bad_request for an unknown condition and for a value of another list', async () => {
    const listingId = await createListing('626198');

    const unknown = await patch(listingId, { version: 1, conditionValueId: 9999 });
    const otherList = await patch(listingId, {
      version: 1,
      variantValues: { [ids.storageType]: ids.german },
    });
    const conditionOfOtherList = await patch(listingId, {
      version: 1,
      conditionValueId: ids.nvme,
    });

    expect(unknown.statusCode).toBe(400);
    expect(otherList.statusCode).toBe(400);
    expect(conditionOfOtherList.statusCode).toBe(400);
    expect(listingRow(listingId)).toMatchObject({ version: 1 });
  });

  it('DER-64-10 reports pick_list_value_deactivated before a variant duplicate', async () => {
    const miA = await createListing('626198', '2');
    await createListing('626199', '4');
    deactivate(ids.likeNew);

    const response = await patch(miA, {
      version: 1,
      conditionValueId: ids.likeNew,
      visualGrade: '4',
    });

    expect(response.json().error.code).toBe('pick_list_value_deactivated');
  });

  it('reports a deactivated value before a field error of the other rules', async () => {
    const listingId = await createListing('626198');
    deactivate(ids.likeNew);

    const response = await patch(listingId, {
      version: 1,
      conditionValueId: ids.likeNew,
      articleNumber: 'MI_A',
    });

    expect(response.json().error.code).toBe('pick_list_value_deactivated');
  });
});

describe('PATCH /api/listings/{id} events (CU-124; Technical Specification 2.0.4, 2.7)', () => {
  it('reports ContentInputsChanged of the model listing in the transaction of the audit entry', async () => {
    const listingId = await createListing('626198');
    const cable = insertTextBlock('Netzkabel');
    const seen: { event: ChangeEvent; audited: number }[] = [];
    const uow = createUnitOfWork<DB>(t.database.db, {
      change: {
        ContentInputsChanged: vi.fn(async (event: ChangeEvent): Promise<ChangeReport> => {
          seen.push({ event, audited: auditEntries(listingId).length });
          return emptyChangeReport();
        }),
      },
    });
    const service = createListingService({ uow, clock: createClock() });

    await service.update(listingId, {
      version: 1,
      deliveryScopeTextBlockIds: [cable],
      articleNumber: 'MI-A',
      eanMode: 'own',
      ownEan: '4255867000014',
    });

    // The handler runs before the commit and sees the audit entry of the change (2.0.4).
    expect(seen).toEqual([
      { event: { type: 'ContentInputsChanged', listingIds: [listingId] }, audited: 2 },
    ]);
  });

  it('stores nothing, no audit entry either, when a handler of ContentInputsChanged fails', async () => {
    const listingId = await createListing('626198');
    const uow = createUnitOfWork<DB>(t.database.db, {
      change: {
        ContentInputsChanged: async () => {
          throw new Error('channel contents failed');
        },
      },
    });
    const service = createListingService({ uow, clock: createClock() });

    await expect(service.update(listingId, { version: 1, articleNumber: 'MI-A' })).rejects.toThrow(
      'channel contents failed',
    );
    expect(listingRow(listingId)).toMatchObject({ article_number: '626198', version: 1 });
    expect(auditEntries(listingId).map(({ action }) => action)).toEqual(['created']);
  });
});
