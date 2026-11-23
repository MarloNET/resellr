import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  insertDeviceType,
  insertManufacturer,
  insertModelTemplate,
} from '../../test/model-templates.ts';
import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { syncStockColumns } from '../../test/stock.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import { runMigrations } from '../db/migrator.ts';

// The use of a model template and the lock of its device type (#182; CU-290, CU-295, CU-105,
// CU-130; Technical Specification 2.4 "Ändern", 2.0.4, 2.0.6).

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let ids: { notebook: number; tablet: number; monitor: number; mvA: number; ram: number };

const STAMP = '2026-11-20T09:00:00.000Z';
const USED = 1;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, [initialSchema], () => new Date());
  const { sqlite } = t.database;
  insertPickLists(sqlite);
  sqlite
    .prepare(
      "INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version) VALUES (?, ?, 'gebraucht', 'gebraucht', 1, 1, 1)",
    )
    .run(USED, pickListId('condition'));
  const notebook = insertDeviceType(sqlite, 'Notebook');
  const tablet = insertDeviceType(sqlite, 'Tablet');
  const monitor = insertDeviceType(sqlite, 'Monitor');
  // RAM in GB at level device, as in the initial settings (variant forming, not required).
  const ram = Number(
    sqlite
      .prepare(
        `INSERT INTO attribute (device_type_id, label, label_key, data_type, system_role, unit,
           unit_spacing, min_value, max_value, pick_list_id, level, variant_forming, required,
           datasheet_block, sort_order, active, version, created_at, updated_at)
         VALUES (?, 'RAM', 'ram', 'integer', NULL, 'GB', 0, NULL, NULL, NULL, 'device', 1, 0,
           'technical', 1, 1, 1, ?, ?)`,
      )
      .run(notebook, STAMP, STAMP).lastInsertRowid,
  );
  const mvA = insertModelTemplate(sqlite, {
    deviceTypeId: notebook,
    manufacturerId: insertManufacturer(sqlite, 'Apple'),
    modelName: 'MacBook Air M2',
    mpn: 'MLY33D/A',
    defaultDeviceValues: { [ram]: 16 },
  });
  ids = { notebook, tablet, monitor, mvA, ram };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });
const patch = (body: Record<string, unknown>, id = ids.mvA) =>
  t.app.inject({
    method: 'PATCH',
    url: `/api/model-templates/${id}`,
    headers: SAME_ORIGIN_WRITE,
    payload: body,
  });

/** A model listing of MV-A (model listings get their own service with #197). */
function insertListing(articleNumber: string, variantValues: Record<string, unknown>): number {
  const { lastInsertRowid } = t.database.sqlite
    .prepare(
      `INSERT INTO listing (model_template_id, condition_value_id, visual_grade,
         condition_description, condition_description_key, variant_values, other_device_values,
         article_number, article_number_key, ean_mode, display_title, quantity, stock_json,
         stock_hash, version, created_at, updated_at)
       VALUES (?, ?, 2, '', '', ?, '{}', ?, ?, 'original', ?, 1, '{}', '', 1, ?, ?)`,
    )
    .run(
      ids.mvA,
      USED,
      JSON.stringify(variantValues),
      articleNumber,
      articleNumber,
      `MacBook Air ${articleNumber}`,
      STAMP,
      STAMP,
    );
  return Number(lastInsertRowid);
}

/** A captured device of MV-A in the given stock status. */
function insertDevice(
  wiNr: string,
  values: Record<string, unknown>,
  {
    listingId = null,
    stockStatus = 'available',
  }: { listingId?: number | null; stockStatus?: string } = {},
) {
  t.database.sqlite
    .prepare(
      `INSERT INTO device (wi_nr, wi_nr_key, model_template_id, listing_id, condition_value_id,
         visual_grade, condition_description, device_values, review_keys, capture_status,
         stock_status, captured_at, captured_on, version, updated_at)
       VALUES (?, ?, ?, ?, ?, 2, '', ?, '[]', 'checked', ?, ?, '2026-11-20', 1, ?)`,
    )
    .run(wiNr, wiNr, ids.mvA, listingId, USED, JSON.stringify(values), stockStatus, STAMP, STAMP);
}

const storedTemplate = () =>
  t.database.sqlite
    .prepare(
      'SELECT device_type_id, default_device_values, version FROM model_template WHERE id = ?',
    )
    .get(ids.mvA) as { device_type_id: number; default_device_values: string; version: number };

const auditCount = () =>
  t.database.sqlite
    .prepare("SELECT COUNT(*) FROM audit_entry WHERE object_type = 'model_template'")
    .pluck()
    .get() as number;

const inventoryRows = () => ({
  listings: t.database.sqlite.prepare('SELECT * FROM listing ORDER BY id').all(),
  devices: t.database.sqlite.prepare('SELECT * FROM device ORDER BY id').all(),
});

const DEVICE_TYPE_IN_USE = 'Geräteart kann nicht geändert werden, weil Geräte erfasst sind';

describe('GET /api/model-templates/{id}/usage (CU-295, Technical Specification 2.4)', () => {
  it('DER-52-04 counts the devices and model listings of the model template', async () => {
    const listing = insertListing('626198', { [ids.ram]: 16 });
    insertDevice('626198', { [ids.ram]: 16 }, { listingId: listing });
    insertDevice('626199', { [ids.ram]: 16 });
    await syncStockColumns(t.database.db);

    const response = await get(`/api/model-templates/${ids.mvA}/usage`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      deviceCount: 2,
      listingCount: 1,
      deleteBlockedReason: 'listings_reference',
    });
  });

  it('counts devices of every stock status, sold and cancelled too', async () => {
    insertDevice('626198', {}, { stockStatus: 'sold' });
    insertDevice('626199', {}, { stockStatus: 'cancelled' });

    const response = await get(`/api/model-templates/${ids.mvA}/usage`);

    expect(response.json()).toEqual({
      deviceCount: 2,
      listingCount: 0,
      deleteBlockedReason: 'devices_reference',
    });
  });

  it('answers zero counts and no reason for an unused model template', async () => {
    const response = await get(`/api/model-templates/${ids.mvA}/usage`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deviceCount: 0, listingCount: 0, deleteBlockedReason: null });
  });

  it('answers 404 not_found for a model template that does not exist', async () => {
    const response = await get('/api/model-templates/999/usage');

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({ code: 'not_found' });
  });
});

describe('device type of a model template with devices (CU-290 ModelTemplateDeviceTypeChanging, REQ-010)', () => {
  it('AC-REQ-010-02 rejects a new device type of MV-A with devices with 422 device_type_in_use and stores nothing', async () => {
    insertDevice('626198', { [ids.ram]: 16 });

    const response = await patch({ version: 1, deviceTypeId: ids.tablet, defaultDeviceValues: {} });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'device_type_in_use',
        message: DEVICE_TYPE_IN_USE,
        details: {},
        fields: [],
        referenceNumber: null,
      },
    });
    expect(storedTemplate()).toMatchObject({ device_type_id: ids.notebook, version: 1 });
    expect(auditCount()).toBe(0);
  });

  it('AC-REQ-010-02 also rejects the change while only a sold or cancelled device refers to MV-A', async () => {
    insertDevice('626198', {}, { stockStatus: 'cancelled' });

    const response = await patch({ version: 1, deviceTypeId: ids.tablet, defaultDeviceValues: {} });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('device_type_in_use');
  });

  it('stores another change of MV-A with devices when the device type stays', async () => {
    insertDevice('626198', { [ids.ram]: 16 });

    const response = await patch({
      version: 1,
      deviceTypeId: ids.notebook,
      typeDesignation: 'M2 2022',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ deviceTypeId: ids.notebook, version: 2 });
  });

  it('stores a new device type of a model template without devices', async () => {
    const response = await patch({ version: 1, deviceTypeId: ids.tablet, defaultDeviceValues: {} });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ deviceTypeId: ids.tablet, version: 2 });
  });

  it('checks the active device type before the devices: device_type_deactivated comes first (2.0.11)', async () => {
    insertDevice('626198', { [ids.ram]: 16 });
    t.database.sqlite.prepare('UPDATE device_type SET active = 0 WHERE id = ?').run(ids.monitor);

    const response = await patch({
      version: 1,
      deviceTypeId: ids.monitor,
      defaultDeviceValues: {},
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('device_type_deactivated');
  });
});

describe('device defaults changed after devices were captured (REQ-010)', () => {
  it('AC-REQ-010-05 after RAM 16 GB → 8 GB in MV-A the captured device keeps 16 GB, MI-A stays unchanged and a device captured afterwards is prefilled with 8 GB', async () => {
    const miA = insertListing('626198', { [ids.ram]: 16 });
    insertDevice('626198', { [ids.ram]: 16 }, { listingId: miA });
    await syncStockColumns(t.database.db);
    const before = inventoryRows();
    const prefillBefore = (await get(`/api/model-templates/${ids.mvA}/device-prefill`)).json();
    expect(prefillBefore.values).toEqual({ [ids.ram]: 16 });

    const response = await patch({ version: 1, defaultDeviceValues: { [ids.ram]: 8 } });

    expect(response.statusCode).toBe(200);
    expect(response.json().defaultDeviceValues).toEqual({ [ids.ram]: 8 });
    expect(JSON.parse(storedTemplate().default_device_values)).toEqual({ [ids.ram]: 8 });
    // The captured device and MI-A are not touched (no recalculation, 2.4 "Ändern").
    expect(inventoryRows()).toEqual(before);
    const prefill = await get(`/api/model-templates/${ids.mvA}/device-prefill`);
    expect(prefill.statusCode).toBe(200);
    expect(prefill.json().values).toEqual({ [ids.ram]: 8 });
    expect(prefill.json().reviewKeys).toEqual([String(ids.ram)]);
  });
});
