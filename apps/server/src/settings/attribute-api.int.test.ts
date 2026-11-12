import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  insertPickLists(t.database.sqlite);
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const write = (method: 'POST' | 'PATCH' | 'PUT', url: string, body: Record<string, unknown>) =>
  t.app.inject({ method, url, headers: SAME_ORIGIN_WRITE, payload: body });

const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });

async function createDeviceType(name: string): Promise<{ id: number; version: number }> {
  return (await write('POST', '/api/device-types', { name, active: true })).json();
}

const attributeInput = (change: Record<string, unknown> = {}) => ({
  label: 'RAM',
  dataType: 'integer',
  unit: 'GB',
  unitSpacing: false,
  minValue: null,
  maxValue: null,
  pickListId: null,
  level: 'device',
  variantForming: true,
  required: true,
  datasheetBlock: 'technical',
  active: true,
  ...change,
});

const createAttribute = (deviceTypeId: number, change: Record<string, unknown> = {}) =>
  write('POST', `/api/device-types/${deviceTypeId}/attributes`, attributeInput(change));

const patchAttribute = (id: number, body: Record<string, unknown>) =>
  write('PATCH', `/api/attributes/${id}`, body);

const listAttributes = async (deviceTypeId: number) =>
  (await get(`/api/device-types/${deviceTypeId}/attributes`)).json() as {
    items: { id: number; label: string; active: boolean; variantForming: boolean }[];
    total: number;
  };

/** An attribute of the initial settings with a system role (2.1.1); there is no API for it. */
function insertSystemRoleAttribute(deviceTypeId: number, role: string, label: string) {
  const now = new Date().toISOString();
  const { lastInsertRowid } = t.database.sqlite
    .prepare(
      `INSERT INTO attribute (device_type_id, label, label_key, data_type, system_role, unit,
        unit_spacing, min_value, max_value, pick_list_id, level, variant_forming, required,
        datasheet_block, sort_order, active, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 1, NULL, NULL, ?, 'device', 0, 0, ?, 99, 1, 1, ?, ?)`,
    )
    .run(
      deviceTypeId,
      label,
      label.toLowerCase(),
      role === 'battery_capacity' ? 'integer' : 'pick',
      role,
      role === 'battery_capacity' ? null : pickListId('battery'),
      'condition',
      now,
      now,
    );
  return Number(lastInsertRowid);
}

const fieldError = (path: string, message: string) => ({
  error: {
    code: 'validation_failed',
    message: '',
    fields: [{ path, code: expect.any(String), message }],
    details: {},
    referenceNumber: null,
  },
});

describe('attribute API (CU-087, Technical Specification 2.1)', () => {
  it('AC-REQ-005-01 creates "Bildschirmdiagonale" of "Monitor" and lists it with hasValues', async () => {
    const monitor = await createDeviceType('Monitor');

    const response = await createAttribute(monitor.id, {
      label: 'Bildschirmdiagonale',
      dataType: 'decimal',
      unit: 'Zoll',
      unitSpacing: true,
      minValue: '10',
      maxValue: '60',
      level: 'model',
      variantForming: false,
      required: true,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(Number),
      deviceTypeId: monitor.id,
      label: 'Bildschirmdiagonale',
      dataType: 'decimal',
      systemRole: null,
      unit: 'Zoll',
      unitSpacing: true,
      minValue: '10',
      maxValue: '60',
      pickListId: null,
      level: 'model',
      variantForming: false,
      required: true,
      datasheetBlock: 'technical',
      sortOrder: 1,
      active: true,
      version: 1,
    });
    const list = await listAttributes(monitor.id);
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({ label: 'Bildschirmdiagonale', hasValues: false });
    const deviceTypes = (await get('/api/device-types')).json();
    expect(deviceTypes.items[0]).toMatchObject({ name: 'Monitor', attributeCount: 1 });
  });

  it('AC-REQ-005-06 an attribute of level device can be variant forming, at level model the flag is rejected', async () => {
    const monitor = await createDeviceType('Monitor');

    const panel = await createAttribute(monitor.id, {
      label: 'Panel',
      dataType: 'text',
      unit: null,
      level: 'device',
      variantForming: true,
    });
    expect(panel.statusCode).toBe(201);
    expect(panel.json()).toMatchObject({ level: 'device', variantForming: true });

    const atModel = await createAttribute(monitor.id, {
      label: 'Paneltyp',
      dataType: 'text',
      level: 'model',
      variantForming: true,
    });
    expect(atModel.statusCode).toBe(400);
    expect(atModel.json().error.code).toBe('bad_request');

    // Moving a variant attribute to level model keeps no flag either.
    const toModel = await patchAttribute(panel.json().id, { version: 1, level: 'model' });
    expect(toModel.statusCode).not.toBe(200);
    expect((await listAttributes(monitor.id)).items).toHaveLength(1);
  });

  it('AC-REQ-005-07 the attribute with the role battery_capacity rejects the flag "variantenbildend"', async () => {
    const notebook = await createDeviceType('Notebook');
    const id = insertSystemRoleAttribute(notebook.id, 'battery_capacity', 'Akkukapazität');

    const response = await patchAttribute(id, { version: 1, variantForming: true });

    expect(response.statusCode).not.toBe(200);
    const [stored] = (await listAttributes(notebook.id)).items;
    expect(stored).toMatchObject({ variantForming: false });
  });

  it('DER-34-05 rejects "ram" beside "RAM" with name_taken on create and on rename', async () => {
    const notebook = await createDeviceType('Notebook');
    await createAttribute(notebook.id);
    const ssd = (await createAttribute(notebook.id, { label: 'SSD' })).json();

    const nameTaken = {
      error: {
        code: 'name_taken',
        message: 'Bezeichnung ist bei dieser Geräteart bereits vergeben',
        fields: [],
        details: {},
        referenceNumber: null,
      },
    };
    const created = await createAttribute(notebook.id, { label: 'ram' });
    expect(created.statusCode).toBe(422);
    expect(created.json()).toEqual(nameTaken);

    const renamed = await patchAttribute(ssd.id, { version: 1, label: 'RAM' });
    expect(renamed.statusCode).toBe(422);
    expect(renamed.json()).toEqual(nameTaken);

    // The same label in another device type and a change of case of the own label are fine.
    const tablet = await createDeviceType('Tablet');
    expect((await createAttribute(tablet.id)).statusCode).toBe(201);
    expect((await patchAttribute(ssd.id, { version: 1, label: 'ssd' })).statusCode).toBe(200);
  });

  it.each([
    ['empty', '', 'Bezeichnung: 1 bis 100 Zeichen'],
    ['101 characters long', 'a'.repeat(101), 'Bezeichnung: 1 bis 100 Zeichen'],
    ['with braces', 'RAM {GB}', 'Bezeichnung darf { und } nicht enthalten'],
    [
      'a fixed placeholder name',
      'Hersteller',
      'Bezeichnung ist für einen festen Platzhalter vergeben: Hersteller',
    ],
  ])('DER-34-02 rejects a label that is %s with validation_failed', async (_case, label, text) => {
    const notebook = await createDeviceType('Notebook');
    const created = await createAttribute(notebook.id, { label });
    expect(created.statusCode).toBe(422);
    expect(created.json()).toEqual(fieldError('label', text));

    const ram = (await createAttribute(notebook.id)).json();
    const renamed = await patchAttribute(ram.id, { version: 1, label });
    expect(renamed.statusCode).toBe(422);
    expect(renamed.json()).toEqual(fieldError('label', text));
  });

  it('DER-34-02 allows "Akkukapazität" for the attribute with the role battery_capacity only', async () => {
    const notebook = await createDeviceType('Notebook');
    const id = insertSystemRoleAttribute(notebook.id, 'battery_capacity', 'Akku-Kapazität');

    const response = await patchAttribute(id, { version: 1, label: 'Akkukapazität' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ label: 'Akkukapazität', version: 2 });

    const tablet = await createDeviceType('Tablet');
    expect((await createAttribute(tablet.id, { label: 'Akkukapazität' })).json()).toEqual(
      fieldError('label', 'Bezeichnung ist für einen festen Platzhalter vergeben: Akkukapazität'),
    );
  });

  it('DER-34-03 rejects a minimum above the maximum at "Mindestwert", also on a change', async () => {
    const notebook = await createDeviceType('Notebook');
    const message = 'Mindestwert darf nicht größer als Höchstwert sein';
    const created = await createAttribute(notebook.id, { minValue: '257', maxValue: '256' });
    expect(created.statusCode).toBe(422);
    expect(created.json()).toEqual(fieldError('minValue', message));

    const ram = (await createAttribute(notebook.id, { minValue: '1', maxValue: '256' })).json();
    const changed = await patchAttribute(ram.id, { version: 1, maxValue: '0,5' });
    expect(changed.json()).toEqual(fieldError('minValue', message));
  });

  it('DER-34-04 rejects data type pick without a pick list and accepts it with one', async () => {
    const notebook = await createDeviceType('Notebook');
    const pick = { label: 'Speichertyp', dataType: 'pick', unit: null, variantForming: false };

    const missing = await createAttribute(notebook.id, { ...pick, pickListId: null });
    expect(missing.statusCode).toBe(422);
    expect(missing.json()).toEqual(fieldError('pickListId', 'Auswahlliste fehlt'));

    const created = await createAttribute(notebook.id, {
      ...pick,
      pickListId: pickListId('storage_type'),
    });
    expect(created.statusCode).toBe(201);
  });

  it('rejects a unit over 20 characters with the text of 8.2', async () => {
    const notebook = await createDeviceType('Notebook');
    const response = await createAttribute(notebook.id, { unit: 'a'.repeat(21) });
    expect(response.json()).toEqual(fieldError('unit', 'Einheit: höchstens 20 Zeichen'));
  });

  it('DER-34-08 keeps data type, level and pick list of a system role, other fields change', async () => {
    const notebook = await createDeviceType('Notebook');
    const id = insertSystemRoleAttribute(notebook.id, 'battery', 'Akku');

    for (const change of [
      { dataType: 'text', pickListId: null },
      { level: 'model' },
      { pickListId: pickListId('power_supply') },
    ]) {
      expect((await patchAttribute(id, { version: 1, ...change })).statusCode).not.toBe(200);
    }
    const response = await patchAttribute(id, {
      version: 1,
      label: 'Akku (Zustand)',
      required: true,
      datasheetBlock: 'delivery_scope',
      active: false,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      dataType: 'pick',
      level: 'device',
      pickListId: pickListId('battery'),
      systemRole: 'battery',
      label: 'Akku (Zustand)',
      required: true,
      datasheetBlock: 'delivery_scope',
      active: false,
    });
  });

  it('DER-34-07 deactivating a variant attribute answers 200 and keeps it in the variant set', async () => {
    const notebook = await createDeviceType('Notebook');
    const ram = (await createAttribute(notebook.id)).json();

    const response = await patchAttribute(ram.id, { version: 1, active: false });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ active: false, variantForming: true, version: 2 });
    expect(JSON.stringify(response.json())).not.toContain('variant_flag_would_merge_listings');
    expect((await listAttributes(notebook.id)).items[0]).toMatchObject({
      active: false,
      variantForming: true,
    });
  });

  it('DER-34-06 PUT attribute-order stores the order and answers with the device type in its new version', async () => {
    const notebook = await createDeviceType('Notebook');
    const a = (await createAttribute(notebook.id, { label: 'Prozessor' })).json();
    const b = (await createAttribute(notebook.id, { label: 'RAM' })).json();
    const c = (await createAttribute(notebook.id, { label: 'SSD' })).json();

    const response = await write('PUT', `/api/device-types/${notebook.id}/attribute-order`, {
      version: notebook.version,
      attributeIds: [c.id, a.id, b.id],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: notebook.id, version: notebook.version + 1 });
    expect((await listAttributes(notebook.id)).items.map((item) => item.label)).toEqual([
      'SSD',
      'Prozessor',
      'RAM',
    ]);
  });

  it.each([
    ['misses an attribute', (ids: number[]) => ids.slice(1)],
    ['repeats an attribute', (ids: number[]) => [ids[0], ...ids.slice(0, -1)]],
    ['holds a foreign id', (ids: number[]) => [...ids.slice(1), 999]],
  ])('DER-34-06 rejects an order that %s with validation_failed', async (_case, change) => {
    const notebook = await createDeviceType('Notebook');
    const ids = [
      (await createAttribute(notebook.id, { label: 'Prozessor' })).json().id,
      (await createAttribute(notebook.id, { label: 'RAM' })).json().id,
    ];

    const response = await write('PUT', `/api/device-types/${notebook.id}/attribute-order`, {
      version: notebook.version,
      attributeIds: change(ids),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');
    expect((await listAttributes(notebook.id)).items.map((item) => item.id)).toEqual(ids);
  });

  it('answers 409 version_conflict to an outdated version of an attribute or of the order', async () => {
    const notebook = await createDeviceType('Notebook');
    const ram = (await createAttribute(notebook.id)).json();
    await patchAttribute(ram.id, { version: 1, unit: 'GiB' });

    expect((await patchAttribute(ram.id, { version: 1, unit: 'MB' })).statusCode).toBe(409);
    const renamedType = await write('PATCH', `/api/device-types/${notebook.id}`, {
      version: 1,
      name: 'Laptop',
    });
    expect(renamedType.statusCode).toBe(200);
    const order = await write('PUT', `/api/device-types/${notebook.id}/attribute-order`, {
      version: 1,
      attributeIds: [ram.id],
    });
    expect(order.statusCode).toBe(409);
  });

  it('answers 404 not_found for an unknown device type or attribute', async () => {
    expect((await get('/api/device-types/99/attributes')).statusCode).toBe(404);
    expect((await createAttribute(99)).statusCode).toBe(404);
    expect((await patchAttribute(99, { version: 1, active: false })).statusCode).toBe(404);
  });

  it('has no route to delete an attribute (REQ-005)', async () => {
    const notebook = await createDeviceType('Notebook');
    const ram = (await createAttribute(notebook.id)).json();
    const response = await t.app.inject({
      method: 'DELETE',
      url: `/api/attributes/${ram.id}`,
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });
    expect(response.statusCode).toBe(404);
    expect(t.app.hasRoute({ method: 'DELETE', url: '/api/attributes/:id' })).toBe(false);
    expect((await listAttributes(notebook.id)).total).toBe(1);
  });

  it('writes created, updated, deactivated and reordered to the audit log with readable values', async () => {
    const notebook = await createDeviceType('Notebook');
    const ram = (await createAttribute(notebook.id)).json();
    const ssd = (await createAttribute(notebook.id, { label: 'SSD' })).json();
    await patchAttribute(ram.id, {
      version: 1,
      dataType: 'pick',
      pickListId: pickListId('storage_type'),
      unit: null,
    });
    await patchAttribute(ssd.id, { version: 1, active: false });
    await write('PUT', `/api/device-types/${notebook.id}/attribute-order`, {
      version: notebook.version,
      attributeIds: [ssd.id, ram.id],
    });

    const rows = t.database.sqlite
      .prepare(
        "SELECT action, object_label, old_value, new_value FROM audit_entry WHERE object_type = 'attribute' ORDER BY id",
      )
      .all() as { action: string; object_label: string; old_value: string; new_value: string }[];
    expect(rows.map((row) => [row.action, row.object_label])).toEqual([
      ['created', 'Merkmal RAM (Notebook)'],
      ['created', 'Merkmal SSD (Notebook)'],
      ['updated', 'Merkmal RAM (Notebook)'],
      ['deactivated', 'Merkmal SSD (Notebook)'],
      ['reordered', 'Geräteart Notebook'],
    ]);
    expect(JSON.parse(rows[0]?.new_value ?? '')).toMatchObject({
      Bezeichnung: 'RAM',
      Datentyp: 'Ganzzahl',
      Ebene: 'Gerät',
      Variantenbildend: 'Ja',
      Status: 'aktiv',
    });
    expect(JSON.parse(rows[2]?.old_value ?? '')).toEqual({
      Datentyp: 'Ganzzahl',
      Einheit: 'GB',
      Auswahlliste: null,
    });
    expect(JSON.parse(rows[2]?.new_value ?? '')).toEqual({
      Datentyp: 'Auswahl aus Liste',
      Einheit: null,
      Auswahlliste: 'Speichertyp',
    });
    expect(JSON.parse(rows[4]?.new_value ?? '')).toEqual({ Reihenfolge: ['SSD', 'RAM'] });
  });
});
