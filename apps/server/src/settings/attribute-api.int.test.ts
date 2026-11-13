import { attributeValuesSchema } from '@resellr/domain/schemas/attribute-values.schema';
import { attributeListSchema } from '@resellr/domain/schemas/attribute.schema';
import { pickListValueListSchema } from '@resellr/domain/schemas/pick-list.schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertAttributeValueRecords } from '../../test/attribute-values.ts';
import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { runMigrations } from '../db/migrator.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  // Schema only: the tests write their own settings; the initial settings have their own
  // tests (CU-071).
  await runMigrations(t.database, [initialSchema], () => new Date());
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

  it('AC-REQ-005-01 "Bildschirmdiagonale" of "Monitor" is a required field of the values schema of the model template', async () => {
    const monitor = await createDeviceType('Monitor');
    await createAttribute(monitor.id, {
      label: 'Bildschirmdiagonale',
      dataType: 'decimal',
      unit: 'Zoll',
      minValue: '10',
      maxValue: '60',
      level: 'model',
      variantForming: false,
      required: true,
    });
    await createAttribute(monitor.id, { label: 'Panel', dataType: 'text', required: true });

    const { items } = attributeListSchema.parse(
      (await get(`/api/device-types/${monitor.id}/attributes`)).json(),
    );
    const modelTemplateValues = attributeValuesSchema(items, 'model');
    const [diagonal] = items;

    expect(modelTemplateValues.safeParse({}).error?.issues).toEqual([
      expect.objectContaining({
        path: [String(diagonal?.id)],
        message: 'Bildschirmdiagonale fehlt',
      }),
    ]);
    expect(modelTemplateValues.parse({ [String(diagonal?.id)]: '27' })).toEqual({
      [String(diagonal?.id)]: '27',
    });
  });

  it('AC-REQ-007-04 after renaming "mit Akku (defekt)" to "Akku defekt", a device with "Akku defekt" without battery capacity is rejected with the rule of the battery capacity', async () => {
    const notebook = await createDeviceType('Notebook');
    const batteryId = insertSystemRoleAttribute(notebook.id, 'battery', 'Akku');
    const capacityId = insertSystemRoleAttribute(notebook.id, 'battery_capacity', 'Akkukapazität');
    const batteryList = pickListId('battery');
    const created = await write('POST', `/api/pick-lists/${batteryList}/values`, {
      label: 'mit Akku (defekt)',
      active: true,
      batteryPresent: true,
    });

    const renamed = await write('PATCH', `/api/pick-list-values/${created.json().id}`, {
      version: 1,
      label: 'Akku defekt',
    });

    expect(renamed.json()).toMatchObject({ label: 'Akku defekt', batteryPresent: true });
    const { items: attributes } = attributeListSchema.parse(
      (await get(`/api/device-types/${notebook.id}/attributes`)).json(),
    );
    const { items: batteryValues } = pickListValueListSchema.parse(
      (await get(`/api/pick-lists/${batteryList}/values`)).json(),
    );
    const deviceValues = attributeValuesSchema(attributes, 'device', { batteryValues });
    const akkuDefekt = batteryValues.find((value) => value.label === 'Akku defekt');
    expect(
      deviceValues.safeParse({ [batteryId]: akkuDefekt?.id }).error?.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    ).toEqual([
      {
        path: String(capacityId),
        message: 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“',
      },
    ]);
    expect(
      deviceValues.safeParse({ [batteryId]: akkuDefekt?.id, [capacityId]: { percent: 85 } })
        .success,
    ).toBe(true);
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
    expect(toModel.statusCode).toBe(400);
    expect((await listAttributes(monitor.id)).items).toHaveLength(1);
  });

  it('AC-REQ-005-07 the attribute with the role battery_capacity rejects the flag "variantenbildend"', async () => {
    const notebook = await createDeviceType('Notebook');
    const id = insertSystemRoleAttribute(notebook.id, 'battery_capacity', 'Akkukapazität');

    const response = await patchAttribute(id, { version: 1, variantForming: true });

    expect(response.statusCode).toBe(400);
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

  it('DER-34-02 compares fixed placeholder names without regard to case, also "Baustein:…"', async () => {
    const notebook = await createDeviceType('Notebook');
    for (const [label, name] of [
      [' stückzahl', 'stückzahl'],
      ['Baustein:Abholung', 'Baustein:Abholung'],
    ]) {
      expect((await createAttribute(notebook.id, { label })).json()).toEqual(
        fieldError('label', `Bezeichnung ist für einen festen Platzhalter vergeben: ${name}`),
      );
    }
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
    const changed = await patchAttribute(ram.id, { version: 1, maxValue: '0' });
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
      expect((await patchAttribute(id, { version: 1, ...change })).statusCode).toBe(400);
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
  ])(
    'DER-34-06 answers 409 version_conflict to an order that %s and changes nothing',
    async (_case, change) => {
      const notebook = await createDeviceType('Notebook');
      const ids = [
        (await createAttribute(notebook.id, { label: 'Prozessor' })).json().id,
        (await createAttribute(notebook.id, { label: 'RAM' })).json().id,
      ];

      const response = await write('PUT', `/api/device-types/${notebook.id}/attribute-order`, {
        version: notebook.version,
        attributeIds: change(ids),
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('version_conflict');
      expect((await listAttributes(notebook.id)).items.map((item) => item.id)).toEqual(ids);
      expect((await get('/api/device-types')).json().items[0].version).toBe(notebook.version);
    },
  );

  it.each([
    ['"abc" for a decimal', { dataType: 'decimal', minValue: 'abc' }, 'Mindestwert: Zahl'],
    ['"1,5" for an integer', { dataType: 'integer', minValue: '1,5' }, 'Mindestwert: ganze Zahl'],
  ])('rejects the minimum %s at the field', async (_case, change, message) => {
    const notebook = await createDeviceType('Notebook');
    const response = await createAttribute(notebook.id, change);
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual(fieldError('minValue', message));
  });

  it('stores bounds entered with a comma in the canonical form', async () => {
    const notebook = await createDeviceType('Notebook');
    const response = await createAttribute(notebook.id, {
      dataType: 'decimal',
      minValue: '0,50',
      maxValue: ' 6 ',
    });
    expect(response.json()).toMatchObject({ minValue: '0.5', maxValue: '6' });
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

  it.each([
    ['bounds for data type text (POST)', 'post', { dataType: 'text', minValue: '1' }],
    ['a pick list for data type integer (POST)', 'post', { pickListId: 5 }],
    ['an unknown pick list (POST)', 'post', { dataType: 'pick', pickListId: 99, unit: null }],
    ['the flag at level model (POST)', 'post', { level: 'model', variantForming: true }],
    ['a system role in the request (POST)', 'post', { systemRole: 'battery' }],
    ['the flag after moving to level model (PATCH)', 'patch', { level: 'model' }],
    ['bounds after changing to data type text (PATCH)', 'patch', { dataType: 'text' }],
    ['a pick list after changing nothing else (PATCH)', 'patch', { pickListId: 5 }],
    [
      'an unknown pick list (PATCH)',
      'patch',
      { dataType: 'pick', pickListId: 99, minValue: null, maxValue: null },
    ],
  ] as const)(
    'answers 400 bad_request to %s and logs a warning without values',
    async (_case, method, change) => {
      const notebook = await createDeviceType('Notebook');
      const ram = (await createAttribute(notebook.id, { minValue: '1', maxValue: '256' })).json();

      const response =
        method === 'post'
          ? await createAttribute(notebook.id, { label: 'Neu', ...change })
          : await patchAttribute(ram.id, { version: 1, ...change });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: { code: 'bad_request', message: '', fields: [], details: {}, referenceNumber: null },
      });
      const warnings = t.readErrorLog().filter((entry) => entry.level === 'warn');
      expect(warnings).toHaveLength(1);
      // The timestamp may contain any digits; the function and the message must not.
      const logged = JSON.stringify(
        warnings.map(({ function: fn, message }) => ({ function: fn, message })),
      );
      for (const value of ['Neu', 'RAM', '256', '99']) expect(logged).not.toContain(value);
      expect((await listAttributes(notebook.id)).items).toEqual([
        expect.objectContaining({ id: ram.id, version: 1 }),
      ]);
    },
  );

  it('DER-34-08 answers 400 to a different data type, level or pick list of a system role and accepts the stored values', async () => {
    const notebook = await createDeviceType('Notebook');
    const id = insertSystemRoleAttribute(notebook.id, 'battery', 'Akku');

    for (const change of [
      { dataType: 'text', pickListId: null },
      { level: 'model' },
      { pickListId: pickListId('power_supply') },
    ]) {
      expect((await patchAttribute(id, { version: 1, ...change })).statusCode).toBe(400);
    }
    const same = await patchAttribute(id, {
      version: 1,
      dataType: 'pick',
      level: 'device',
      pickListId: pickListId('battery'),
      required: true,
    });
    expect(same.statusCode).toBe(200);
  });

  it('checks the version before every other rule (2.1)', async () => {
    const notebook = await createDeviceType('Notebook');
    const ram = (await createAttribute(notebook.id)).json();
    await createAttribute(notebook.id, { label: 'SSD' });
    await patchAttribute(ram.id, { version: 1, unit: 'GiB' });

    for (const change of [{ level: 'model' }, { label: '' }, { label: 'ssd' }]) {
      expect((await patchAttribute(ram.id, { version: 1, ...change })).statusCode).toBe(409);
    }
  });

  describe('data type and level locked by stored values (2.1, CU-074)', () => {
    const hasValuesError = (message: string) => ({
      error: {
        code: 'attribute_has_values',
        message,
        fields: [],
        details: {},
        referenceNumber: null,
      },
    });

    /** "RAM" of "Notebook" (level device, variant forming) with the value 16 of one device. */
    async function ramWithValues() {
      const notebook = await createDeviceType('Notebook');
      const ram = (await createAttribute(notebook.id)).json();
      const ssd = (await createAttribute(notebook.id, { label: 'SSD' })).json();
      insertAttributeValueRecords(
        t.database.sqlite,
        { deviceValues: { [String(ram.id)]: 16 } },
        notebook.id,
      );
      return { notebook, ram, ssd };
    }

    it('lists hasValues per attribute from the stored values', async () => {
      const { notebook, ram, ssd } = await ramWithValues();

      const list = await listAttributes(notebook.id);
      expect(list.items).toEqual([
        expect.objectContaining({ id: ram.id, hasValues: true }),
        expect.objectContaining({ id: ssd.id, hasValues: false }),
      ]);
    });

    it('AC-REQ-005-04 rejects changing the data type of an attribute with stored values with attribute_has_values', async () => {
      const { notebook, ram } = await ramWithValues();

      const response = await patchAttribute(ram.id, { version: 1, dataType: 'text' });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual(
        hasValuesError('Datentyp kann nicht geändert werden, weil bereits Werte gespeichert sind.'),
      );
      expect((await listAttributes(notebook.id)).items[0]).toMatchObject({
        dataType: 'integer',
        version: 1,
      });
    });

    it('AC-REQ-005-08 rejects changing the level of RAM with stored values from device to model', async () => {
      const { notebook, ram } = await ramWithValues();

      const response = await patchAttribute(ram.id, {
        version: 1,
        level: 'model',
        variantForming: false,
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual(
        hasValuesError('Ebene kann nicht geändert werden, weil bereits Werte gespeichert sind.'),
      );
      expect((await listAttributes(notebook.id)).items[0]).toMatchObject({
        level: 'device',
        variantForming: true,
        version: 1,
      });
    });

    it('keeps the other fields changeable and accepts the stored data type and level', async () => {
      const { ram } = await ramWithValues();

      const response = await patchAttribute(ram.id, {
        version: 1,
        dataType: 'integer',
        level: 'device',
        unit: 'GiB',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ unit: 'GiB', version: 2 });
    });

    it('allows changing data type and level of an attribute without stored values', async () => {
      const { ssd } = await ramWithValues();

      const response = await patchAttribute(ssd.id, {
        version: 1,
        dataType: 'text',
        unit: null,
        level: 'model',
        variantForming: false,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ dataType: 'text', level: 'model' });
    });
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
