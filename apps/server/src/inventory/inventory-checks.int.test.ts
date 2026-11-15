import { variantDifferences } from '@resellr/domain/inventory/compare-variants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { runMigrations } from '../db/migrator.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

const STAMP = '2026-11-15T09:00:00.000Z';
const USED = 1;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, [initialSchema], () => new Date());
  insertPickLists(t.database.sqlite);
  t.database.sqlite
    .prepare(
      "INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version) VALUES (?, ?, 'gebraucht', 'gebraucht', 1, 1, 1)",
    )
    .run(USED, pickListId('condition'));
  t.database.sqlite
    .prepare(
      "INSERT INTO manufacturer (id, name, name_key, active, gpsr_complete, version, created_at, updated_at) VALUES (1, 'Apple', 'apple', 1, 0, 1, ?, ?)",
    )
    .run(STAMP, STAMP);
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const write = (method: 'POST' | 'PATCH', url: string, body: Record<string, unknown>) =>
  t.app.inject({ method, url, headers: SAME_ORIGIN_WRITE, payload: body });

const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });

async function createDeviceType(name: string): Promise<number> {
  return (
    (await write('POST', '/api/device-types', { name, active: true })).json() as { id: number }
  ).id;
}

/** A variant attribute at level device (2.1). */
async function createVariantAttribute(deviceTypeId: number, label: string, dataType = 'integer') {
  const response = await write('POST', `/api/device-types/${deviceTypeId}/attributes`, {
    label,
    dataType,
    unit: '',
    unitSpacing: true,
    minValue: null,
    maxValue: null,
    pickListId: null,
    level: 'device',
    variantForming: true,
    required: false,
    datasheetBlock: 'technical',
    active: true,
  });
  return response.json() as { id: number; version: number };
}

const patchAttribute = (id: number, body: Record<string, unknown>) =>
  write('PATCH', `/api/attributes/${id}`, body);

const attributeOf = async (deviceTypeId: number, id: number) =>
  (
    (await get(`/api/device-types/${deviceTypeId}/attributes`)).json() as {
      items: { id: number; variantForming: boolean; version: number }[];
    }
  ).items.find((item) => item.id === id);

/**
 * A model template of `deviceTypeId`. Model templates and model listings get their services in
 * later build steps (Technical Specification 4.4, S3 and S4); until then tests insert them.
 */
function insertModelTemplate(deviceTypeId: number, modelName: string): number {
  const { lastInsertRowid } = t.database.sqlite
    .prepare(
      `INSERT INTO model_template (device_type_id, manufacturer_id, model_name, model_name_key,
         mpn_unknown, model_values, default_device_values, search_key, import_review_pending,
         import_review_keys, version, created_at, updated_at)
       VALUES (?, 1, ?, ?, 1, '{}', '{}', ?, 0, '[]', 1, ?, ?)`,
    )
    .run(deviceTypeId, modelName, modelName.toLowerCase(), modelName.toLowerCase(), STAMP, STAMP);
  return Number(lastInsertRowid);
}

function insertListing(
  modelTemplateId: number,
  articleNumber: string,
  variantValues: Record<string, unknown>,
): number {
  const { lastInsertRowid } = t.database.sqlite
    .prepare(
      `INSERT INTO listing (model_template_id, condition_value_id, visual_grade,
         condition_description, condition_description_key, variant_values, other_device_values,
         article_number, article_number_key, ean_mode, display_title, quantity, stock_json,
         stock_hash, version, created_at, updated_at)
       VALUES (?, ?, 2, '', '', ?, '{}', ?, ?, 'original', ?, 1, '{}', '', 1, ?, ?)`,
    )
    .run(
      modelTemplateId,
      USED,
      JSON.stringify(variantValues),
      articleNumber,
      articleNumber.toLowerCase(),
      `MacBook Air ${articleNumber}`,
      STAMP,
      STAMP,
    );
  return Number(lastInsertRowid);
}

function insertDevice(
  modelTemplateId: number,
  listingId: number | null,
  wiNr: string,
  values: Record<string, unknown>,
) {
  t.database.sqlite
    .prepare(
      `INSERT INTO device (wi_nr, wi_nr_key, model_template_id, listing_id, condition_value_id,
         visual_grade, condition_description, device_values, review_keys, capture_status,
         stock_status, captured_at, captured_on, version, updated_at)
       VALUES (?, ?, ?, ?, ?, 2, '', ?, '[]', 'checked', 'available', ?, '2026-11-15', 1, ?)`,
    )
    .run(wiNr, wiNr, modelTemplateId, listingId, USED, JSON.stringify(values), STAMP, STAMP);
}

const inventoryRows = () => ({
  listings: t.database.sqlite.prepare('SELECT * FROM listing ORDER BY id').all(),
  devices: t.database.sqlite.prepare('SELECT * FROM device ORDER BY id').all(),
});

const auditActions = (attributeId: number) =>
  (
    t.database.sqlite
      .prepare("SELECT action FROM audit_entry WHERE object_type = 'attribute' AND object_id = ?")
      .all(attributeId) as { action: string }[]
  ).map((row) => row.action);

describe('check of the variant set in inventory (CU-290, REQ-005)', () => {
  it('AC-REQ-005-09 removing the flag at RAM is rejected when two model listings of MV-A would then match, names MV-A with both and RAM stays a variant attribute', async () => {
    const notebook = await createDeviceType('Notebook');
    const ram = await createVariantAttribute(notebook, 'RAM');
    const mvA = insertModelTemplate(notebook, 'MacBook Air M2');
    const miA = insertListing(mvA, '626198', { [ram.id]: 16 });
    const miB = insertListing(mvA, '626199', { [ram.id]: 8 });
    const before = inventoryRows();

    const response = await patchAttribute(ram.id, { version: ram.version, variantForming: false });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'variant_flag_would_merge_listings',
        message:
          'Änderung nicht möglich: Modell-Inserate MacBook Air M2: „MacBook Air 626198“ (626198), ' +
          '„MacBook Air 626199“ (626199) würden gleiche Variantenangaben haben',
        details: { groups: [{ modelTemplateId: mvA, listingIds: [miA, miB] }] },
        fields: [],
        referenceNumber: null,
      },
    });
    expect(await attributeOf(notebook, ram.id)).toMatchObject({
      variantForming: true,
      version: ram.version,
    });
    expect(auditActions(ram.id)).toEqual(['created']);
    expect(inventoryRows()).toEqual(before);
  });

  it('AC-REQ-005-10 removing the flag at Betriebssystem is stored, assignments and listing values of MI-A stay unchanged and a device differing only in Betriebssystem matches MI-A', async () => {
    const notebook = await createDeviceType('Notebook');
    const ram = await createVariantAttribute(notebook, 'RAM');
    const os = await createVariantAttribute(notebook, 'Betriebssystem', 'text');
    const mvA = insertModelTemplate(notebook, 'MacBook Air M2');
    const miA = insertListing(mvA, '626198', { [ram.id]: 16, [os.id]: 'macOS' });
    insertListing(mvA, '626199', { [ram.id]: 8, [os.id]: 'macOS' });
    insertDevice(mvA, miA, '626198', { [ram.id]: 16, [os.id]: 'macOS' });
    const before = inventoryRows();

    const response = await patchAttribute(os.id, { version: os.version, variantForming: false });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ variantForming: false, version: os.version + 1 });
    expect(inventoryRows()).toEqual(before);

    // The assignment itself comes with #59; here the comparison rule with the new variant set.
    const listing = t.database.sqlite
      .prepare(
        'SELECT condition_value_id, visual_grade, condition_description, variant_values FROM listing WHERE id = ?',
      )
      .get(miA) as {
      condition_value_id: number;
      visual_grade: number;
      condition_description: string;
      variant_values: string;
    };
    const variantSet = [ram.id];
    expect(
      variantDifferences(
        {
          conditionValueId: USED,
          visualGrade: 2,
          conditionDescription: '',
          values: { [ram.id]: 16, [os.id]: 'Windows 11 Pro' },
        },
        {
          conditionValueId: listing.condition_value_id,
          visualGrade: listing.visual_grade,
          conditionDescription: listing.condition_description,
          values: JSON.parse(listing.variant_values) as Record<string, number | string>,
        },
        variantSet,
      ),
    ).toEqual([]);
  });

  it('K-03 a deactivated variant attribute stays compared: deactivating is stored, removing its flag is still rejected', async () => {
    const notebook = await createDeviceType('Notebook');
    const ram = await createVariantAttribute(notebook, 'RAM');
    const os = await createVariantAttribute(notebook, 'Betriebssystem', 'text');
    const mvA = insertModelTemplate(notebook, 'MacBook Air M2');
    insertListing(mvA, '626198', { [ram.id]: 16, [os.id]: 'macOS' });
    insertListing(mvA, '626199', { [ram.id]: 8, [os.id]: 'macOS' });

    const deactivated = await patchAttribute(ram.id, { version: ram.version, active: false });
    expect(deactivated.statusCode).toBe(200);

    // RAM still tells the listings apart, so Betriebssystem may lose the flag.
    expect(
      (await patchAttribute(os.id, { version: os.version, variantForming: false })).statusCode,
    ).toBe(200);
    const removed = await patchAttribute(ram.id, {
      version: ram.version + 1,
      variantForming: false,
    });
    expect(removed.statusCode).toBe(422);
    expect(removed.json()).toMatchObject({ error: { code: 'variant_flag_would_merge_listings' } });
  });

  it('only compares model listings of the same model template and reports each matching group', async () => {
    const notebook = await createDeviceType('Notebook');
    const ram = await createVariantAttribute(notebook, 'RAM');
    const ssd = await createVariantAttribute(notebook, 'SSD');
    const mvA = insertModelTemplate(notebook, 'MacBook Air M2');
    const mvB = insertModelTemplate(notebook, 'MacBook Pro M3');
    const a1 = insertListing(mvA, 'A-1', { [ram.id]: 16, [ssd.id]: 256 });
    const a2 = insertListing(mvA, 'A-2', { [ram.id]: 8, [ssd.id]: 256 });
    const a3 = insertListing(mvA, 'A-3', { [ram.id]: 16, [ssd.id]: 512 });
    const a4 = insertListing(mvA, 'A-4', { [ram.id]: 8, [ssd.id]: 512 });
    // Different model templates never merge.
    insertListing(mvB, 'B-1', { [ram.id]: 16, [ssd.id]: 256 });

    const response = await patchAttribute(ram.id, { version: ram.version, variantForming: false });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: {
        details: {
          groups: [
            { modelTemplateId: mvA, listingIds: [a1, a2] },
            { modelTemplateId: mvA, listingIds: [a3, a4] },
          ],
        },
      },
    });
  });

  it('allows removing the flag when no model template has two model listings left that match', async () => {
    const notebook = await createDeviceType('Notebook');
    const tablet = await createDeviceType('Tablet');
    const ram = await createVariantAttribute(notebook, 'RAM');
    const tabletRam = await createVariantAttribute(tablet, 'RAM');
    const mvA = insertModelTemplate(notebook, 'MacBook Air M2');
    const mvT = insertModelTemplate(tablet, 'iPad Air');
    insertListing(mvA, 'A-1', { [ram.id]: 16 });
    // Listings of another device type are not compared.
    insertListing(mvT, 'T-1', { [tabletRam.id]: 8 });
    insertListing(mvT, 'T-2', { [tabletRam.id]: 16 });

    const response = await patchAttribute(ram.id, { version: ram.version, variantForming: false });

    expect(response.statusCode).toBe(200);
    expect(auditActions(ram.id)).toEqual(['created', 'updated']);
  });
});
