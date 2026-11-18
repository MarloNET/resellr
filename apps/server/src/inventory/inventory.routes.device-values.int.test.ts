import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';

// API tests of the device values (CU-121, CU-130; Technical Specification 2.5, 2.0.11):
// the field rules of `POST /api/devices` and `PATCH /api/devices/{id}`, the active entries and
// the read only sold or cancelled device, on a notebook of the initial settings.

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

const STAMP = '2026-11-18T08:00:00.000Z';
const CAPACITY_RULE = 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“';

/** Ids of the pick list values and attributes of the notebook by their label. */
let value: (label: string) => number;
let attribute: (label: string) => number;
let template: number;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  const { sqlite } = t.database;
  const one = <T>(sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...params) as T;
  const notebook = one<{ id: number }>("SELECT id FROM device_type WHERE name = 'Notebook'").id;
  value = (label) =>
    one<{ id: number }>('SELECT id FROM pick_list_value WHERE label = ?', label).id;
  attribute = (label) =>
    one<{ id: number }>(
      'SELECT id FROM attribute WHERE device_type_id = ? AND label = ?',
      notebook,
      label,
    ).id;
  template = insertModelTemplate(sqlite, {
    deviceTypeId: notebook,
    manufacturerId: insertManufacturer(sqlite, 'Lenovo'),
    modelName: 'ThinkPad T14',
    mpn: '20W0',
  });
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

/** The values of AC-REQ-014-01 with the other required values of the notebook. */
const values = (change: Record<string, unknown> = {}) => ({
  [attribute('RAM')]: '16',
  [attribute('Speicherkapazität')]: '512',
  [attribute('Tastaturlayout')]: value('Deutsch (QWERTZ)'),
  [attribute('Betriebssystem')]: value('Windows 11 Pro'),
  [attribute('Netzteil')]: value('mit Netzteil (original)'),
  [attribute('Akku')]: value('mit Akku'),
  [attribute('Akkukapazität')]: { percent: '77' },
  ...change,
});

const body = (change: Record<string, unknown> = {}) => ({
  wiNr: '626198',
  supplierId: null,
  modelTemplateId: template,
  conditionValueId: value('gebraucht'),
  visualGrade: '3',
  conditionDescription: '',
  values: values(),
  confirmedKeys: [],
  ...change,
});

const post = (payload: Record<string, unknown>) =>
  t.app.inject({ method: 'POST', url: '/api/devices', headers: SAME_ORIGIN_WRITE, payload });
const patch = (id: number, payload: Record<string, unknown>) =>
  t.app.inject({
    method: 'PATCH',
    url: `/api/devices/${id}`,
    headers: SAME_ORIGIN_WRITE,
    payload,
  });
const get = (id: number) =>
  t.app.inject({ method: 'GET', url: `/api/devices/${id}`, headers: { host: HOST } });

const count = (table: 'device' | 'audit_entry') =>
  (t.database.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
const deactivate = (id: number) =>
  t.database.sqlite.prepare('UPDATE pick_list_value SET active = 0 WHERE id = ?').run(id);
const deviceRow = (id: number) =>
  t.database.sqlite.prepare('SELECT * FROM device WHERE id = ?').get(id) as Record<string, unknown>;

/** A stored device of the notebook; returns its id. */
async function storedDevice(change: Record<string, unknown> = {}): Promise<number> {
  const response = await post(body(change));
  expect(response.statusCode).toBe(201);
  return response.json().id as number;
}

describe('field rules of the device values (CU-116, CU-067, Technical Specification 2.5)', () => {
  it('AC-REQ-014-01 stores condition "gebraucht", visual grade 3, keyboard layout "Deutsch (QWERTZ)", power supply "mit Netzteil (original)", battery "mit Akku" and capacity 77', async () => {
    const id = await storedDevice();

    const device = (await get(id)).json();
    expect(device).toMatchObject({
      conditionValueId: value('gebraucht'),
      visualGrade: 3,
      values: {
        [attribute('Tastaturlayout')]: value('Deutsch (QWERTZ)'),
        [attribute('Netzteil')]: value('mit Netzteil (original)'),
        [attribute('Akku')]: value('mit Akku'),
        [attribute('Akkukapazität')]: { percent: 77 },
      },
    });
  });

  it('AC-REQ-014-02 rejects the battery capacity 101 with "Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“"', async () => {
    const response = await post(
      body({ values: values({ [attribute('Akkukapazität')]: { percent: '101' } }) }),
    );

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      {
        path: `values.${attribute('Akkukapazität')}`,
        code: 'battery_capacity_format',
        message: CAPACITY_RULE,
      },
    ]);
    expect(count('device')).toBe(0);
  });

  it('AC-REQ-014-03 stores the battery capacity "nicht ermittelbar"', async () => {
    const id = await storedDevice({
      values: values({ [attribute('Akkukapazität')]: { notDeterminable: true } }),
    });

    expect((await get(id)).json().values[attribute('Akkukapazität')]).toEqual({
      notDeterminable: true,
    });
  });

  it('AC-REQ-014-04 rejects an empty visual grade with "Optik-Note: ganze Zahl von 1 bis 5"', async () => {
    const response = await post(body({ visualGrade: '' }));

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      { path: 'visualGrade', code: 'custom', message: 'Optik-Note: ganze Zahl von 1 bis 5' },
    ]);
    expect(count('device')).toBe(0);
  });

  it('AC-REQ-014-05 needs no battery capacity with the battery "ohne Akku"', async () => {
    const id = await storedDevice({
      values: values({ [attribute('Akku')]: value('ohne Akku'), [attribute('Akkukapazität')]: null }),
    });

    expect((await get(id)).json().values).not.toHaveProperty(String(attribute('Akkukapazität')));
  });

  it('AC-REQ-014-06 rejects the battery "mit Akku (defekt)" without battery capacity with "Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“"', async () => {
    const response = await post(
      body({
        values: values({
          [attribute('Akku')]: value('mit Akku (defekt)'),
          [attribute('Akkukapazität')]: null,
        }),
      }),
    );

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      {
        path: `values.${attribute('Akkukapazität')}`,
        code: 'value_missing',
        message: CAPACITY_RULE,
      },
    ]);
  });

  it('DER-56-06 names a missing condition, a visual grade outside 1 to 5, a long condition description and a missing keyboard layout at their fields, storing nothing', async () => {
    const response = await post(
      body({
        conditionValueId: null,
        visualGrade: '6',
        conditionDescription: 'x'.repeat(1001),
        values: values({ [attribute('Tastaturlayout')]: null }),
      }),
    );

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      { path: 'conditionValueId', code: 'custom', message: 'Zustand fehlt' },
      { path: 'visualGrade', code: 'custom', message: 'Optik-Note: ganze Zahl von 1 bis 5' },
      {
        path: 'conditionDescription',
        code: 'too_big',
        message: 'Zustandsbeschreibung: höchstens 1.000 Zeichen',
      },
      {
        path: `values.${attribute('Tastaturlayout')}`,
        code: 'value_missing',
        message: 'Tastaturlayout fehlt',
      },
    ]);
    expect(count('device')).toBe(0);
  });

  it('DER-56-06 applies the same rules to the state after PATCH /api/devices/{id}', async () => {
    const id = await storedDevice();

    const response = await patch(id, {
      version: 1,
      conditionValueId: null,
      visualGrade: '0',
      values: { [attribute('Netzteil')]: null },
      confirmedKeys: [],
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      { path: 'conditionValueId', code: 'custom', message: 'Zustand fehlt' },
      { path: 'visualGrade', code: 'custom', message: 'Optik-Note: ganze Zahl von 1 bis 5' },
      {
        path: `values.${attribute('Netzteil')}`,
        code: 'value_missing',
        message: 'Netzteil fehlt',
      },
    ]);
    expect(deviceRow(id).version).toBe(1);
  });

  it('AC-REQ-014-06 PATCH to "mit Akku (defekt)" without battery capacity is rejected, as the values of the list battery are passed (FIND-362)', async () => {
    const id = await storedDevice();

    const response = await patch(id, {
      version: 1,
      values: { [attribute('Akku')]: value('mit Akku (defekt)'), [attribute('Akkukapazität')]: null },
      confirmedKeys: [],
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      { path: `values.${attribute('Akkukapazität')}`, code: 'value_missing', message: CAPACITY_RULE },
    ]);
  });
});

describe('PATCH /api/devices/{id} (CU-121, CU-130, Technical Specification 2.5)', () => {
  it('DER-56-01 stores a changed visual grade with a new version and the audit entry "values_updated" of the changed field', async () => {
    const id = await storedDevice();

    const response = await patch(id, {
      version: 1,
      conditionValueId: value('gebraucht'),
      visualGrade: '4',
      conditionDescription: '',
      values: values(),
      confirmedKeys: [],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id, visualGrade: 4, version: 2 });
    const entry = t.database.sqlite
      .prepare("SELECT * FROM audit_entry WHERE action = 'values_updated'")
      .get() as Record<string, unknown>;
    expect(entry).toMatchObject({
      object_type: 'device',
      object_id: id,
      object_label: 'Gerät 626198',
      object_category: 'device',
    });
    expect(JSON.parse(String(entry.old_value))).toEqual({ 'Optik-Note': 3 });
    expect(JSON.parse(String(entry.new_value))).toEqual({ 'Optik-Note': 4 });
  });

  it('keeps a missing field and a missing key, removes a value with null (2.5 "Merkmalswerte bei PATCH sind Änderungen")', async () => {
    const id = await storedDevice({ conditionDescription: 'Kratzer am Deckel' });

    const response = await patch(id, {
      version: 1,
      values: { [attribute('Akku')]: value('ohne Akku'), [attribute('Akkukapazität')]: null },
      confirmedKeys: [],
    });

    expect(response.statusCode).toBe(200);
    const device = response.json();
    expect(device).toMatchObject({ visualGrade: 3, conditionDescription: 'Kratzer am Deckel' });
    expect(device.values).toEqual({
      [attribute('RAM')]: 16,
      [attribute('Speicherkapazität')]: 512,
      [attribute('Tastaturlayout')]: value('Deutsch (QWERTZ)'),
      [attribute('Betriebssystem')]: value('Windows 11 Pro'),
      [attribute('Netzteil')]: value('mit Netzteil (original)'),
      [attribute('Akku')]: value('ohne Akku'),
    });
  });

  it('answers an unchanged request with the stored device and the same version, without audit entry', async () => {
    const id = await storedDevice();

    const response = await patch(id, { version: 1, values: values(), confirmedKeys: [] });

    expect(response.statusCode).toBe(200);
    expect(response.json().version).toBe(1);
    expect(count('audit_entry')).toBe(1);
  });

  it.each([
    ['sold', "stock_status = 'sold', sold_on = '2026-11-17'"],
    ['cancelled', "stock_status = 'cancelled', cancel_reason = 'falsch', cancelled_at = '2026-11-17T08:00:00.000Z'"],
  ])('DER-56-02 rejects a change of a %s device with 422 device_not_available, storing nothing', async (_status, columns) => {
    const id = await storedDevice();
    t.database.sqlite.prepare(`UPDATE device SET ${columns} WHERE id = ?`).run(id);

    const response = await patch(id, { version: 1, visualGrade: '4', confirmedKeys: [] });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'device_not_available',
      message: 'Werte schreibgeschützt',
    });
    expect(deviceRow(id)).toMatchObject({ visual_grade: 3, version: 1 });
    expect(count('audit_entry')).toBe(1);
  });

  it('DER-56-07 answers an outdated version with 409 version_conflict, storing nothing', async () => {
    const id = await storedDevice();
    await patch(id, { version: 1, visualGrade: '4', confirmedKeys: [] });

    const response = await patch(id, { version: 1, visualGrade: '5', confirmedKeys: [] });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('version_conflict');
    expect(deviceRow(id).visual_grade).toBe(4);
  });

  it('answers 404 not_found for an unknown device and 400 for a request of another shape', async () => {
    expect((await patch(999, { version: 1, confirmedKeys: [] })).statusCode).toBe(404);
    const id = await storedDevice();
    expect((await patch(id, { version: 1, wiNr: 'X1', confirmedKeys: [] })).statusCode).toBe(400);
    expect((await patch(id, { visualGrade: '4', confirmedKeys: [] })).statusCode).toBe(400);
  });

  it('lifts a stored review flag confirmed or changed, and the capture status becomes "checked" (2.5, CU-118)', async () => {
    const id = await storedDevice();
    t.database.sqlite
      .prepare(
        `UPDATE device SET review_keys = ?, capture_status = 'review_pending' WHERE id = ?`,
      )
      .run(JSON.stringify(['visualGrade', String(attribute('Akkukapazität'))]), id);

    const confirmed = await patch(id, { version: 1, confirmedKeys: ['visualGrade'] });
    expect(confirmed.json()).toMatchObject({
      reviewKeys: [String(attribute('Akkukapazität'))],
      captureStatus: 'review_pending',
      version: 2,
    });

    const changed = await patch(id, {
      version: 2,
      values: { [attribute('Akkukapazität')]: { percent: '80' } },
      confirmedKeys: [],
    });
    expect(changed.json()).toMatchObject({ reviewKeys: [], captureStatus: 'checked', version: 3 });
  });
});

describe('active entries of the device values (CU-121, Technical Specification 2.0.11, Test T6)', () => {
  const insertSupplier = (name: string, active: boolean) =>
    Number(
      t.database.sqlite
        .prepare(
          'INSERT INTO supplier (name, name_key, active, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
        )
        .run(name, name.toLowerCase(), active ? 1 : 0, STAMP, STAMP).lastInsertRowid,
    );

  it('DER-56-09 rejects a deactivated condition of a new device with pick_list_value_deactivated at conditionValueId, storing nothing', async () => {
    deactivate(value('refurbished'));

    const response = await post(body({ conditionValueId: value('refurbished') }));

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toEqual({
      code: 'pick_list_value_deactivated',
      message: 'Zustand refurbished ist deaktiviert',
      fields: [],
      details: { path: 'conditionValueId', id: value('refurbished') },
      referenceNumber: null,
    });
    expect(count('device')).toBe(0);
    expect(count('audit_entry')).toBe(0);
  });

  it('DER-56-09 rejects a deactivated keyboard layout in values with "Tastaturlayout: Ungarisch ist deaktiviert"', async () => {
    deactivate(value('Ungarisch'));

    const response = await post(
      body({ values: values({ [attribute('Tastaturlayout')]: value('Ungarisch') }) }),
    );

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'pick_list_value_deactivated',
      message: 'Tastaturlayout: Ungarisch ist deaktiviert',
      details: { path: `values.${attribute('Tastaturlayout')}`, id: value('Ungarisch') },
    });
    expect(count('device')).toBe(0);
  });

  it('DER-56-09 a deactivated supplier and a deactivated condition give only supplier_deactivated', async () => {
    deactivate(value('refurbished'));

    const response = await post(
      body({
        supplierId: insertSupplier('Lieferant West', false),
        conditionValueId: value('refurbished'),
      }),
    );

    expect(response.json().error.code).toBe('supplier_deactivated');
  });

  it.each([
    ['an unknown condition', () => ({ conditionValueId: 9999 })],
    ['a condition of another list', () => ({ conditionValueId: value('Ungarisch') })],
    [
      'an unknown pick list value',
      () => ({ values: values({ [attribute('Tastaturlayout')]: 9999 }) }),
    ],
    [
      'a pick list value of another list',
      () => ({ values: values({ [attribute('Tastaturlayout')]: value('gebraucht') }) }),
    ],
  ])('DER-56-09 rejects %s with 400 bad_request, storing nothing', async (_case, change) => {
    const response = await post(body(change()));

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
    expect(count('device')).toBe(0);
    expect(count('audit_entry')).toBe(0);
  });

  it('DER-56-09 a deactivated condition and a taken WI-Nr give pick_list_value_deactivated', async () => {
    await storedDevice();
    deactivate(value('refurbished'));

    const response = await post(body({ conditionValueId: value('refurbished') }));

    expect(response.json().error.code).toBe('pick_list_value_deactivated');
  });

  it('DER-56-09 a deactivated condition and a deactivated pick list value give only the condition', async () => {
    deactivate(value('refurbished'));
    deactivate(value('Ungarisch'));

    const response = await post(
      body({
        conditionValueId: value('refurbished'),
        values: values({ [attribute('Tastaturlayout')]: value('Ungarisch') }),
      }),
    );

    expect(response.json().error.details).toEqual({
      path: 'conditionValueId',
      id: value('refurbished'),
    });
  });

  it('DER-56-09 two deactivated pick list values give only the one of the first attribute', async () => {
    deactivate(value('Ungarisch'));
    deactivate(value('ohne Netzteil'));

    const response = await post(
      body({
        values: values({
          [attribute('Netzteil')]: value('ohne Netzteil'),
          [attribute('Tastaturlayout')]: value('Ungarisch'),
        }),
      }),
    );

    expect(response.json().error).toMatchObject({
      message: 'Tastaturlayout: Ungarisch ist deaktiviert',
      details: { path: `values.${attribute('Tastaturlayout')}` },
    });
  });

  it('DER-56-08 PATCH to a deactivated condition is rejected with pick_list_value_deactivated at conditionValueId', async () => {
    const id = await storedDevice();
    deactivate(value('refurbished'));

    const response = await patch(id, {
      version: 1,
      conditionValueId: value('refurbished'),
      confirmedKeys: [],
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'pick_list_value_deactivated',
      message: 'Zustand refurbished ist deaktiviert',
      details: { path: 'conditionValueId', id: value('refurbished') },
    });
    expect(deviceRow(id).version).toBe(1);
  });

  it('DER-56-08 PATCH of the keyboard layout to "Ungarisch", deactivated, is rejected with "Tastaturlayout: Ungarisch ist deaktiviert"', async () => {
    const id = await storedDevice();
    deactivate(value('Ungarisch'));

    const response = await patch(id, {
      version: 1,
      values: values({ [attribute('Tastaturlayout')]: value('Ungarisch') }),
      confirmedKeys: [],
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'pick_list_value_deactivated',
      message: 'Tastaturlayout: Ungarisch ist deaktiviert',
      details: { path: `values.${attribute('Tastaturlayout')}`, id: value('Ungarisch') },
    });
  });

  it('DER-56-08 a device with a stored, deactivated condition and keyboard layout saves a changed condition description (200)', async () => {
    const id = await storedDevice({
      conditionValueId: value('refurbished'),
      values: values({ [attribute('Tastaturlayout')]: value('Ungarisch') }),
    });
    deactivate(value('refurbished'));
    deactivate(value('Ungarisch'));

    const response = await patch(id, {
      version: 1,
      conditionValueId: value('refurbished'),
      visualGrade: '3',
      conditionDescription: 'Kratzer am Deckel',
      values: values({ [attribute('Tastaturlayout')]: value('Ungarisch') }),
      confirmedKeys: [],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      conditionValueId: value('refurbished'),
      conditionDescription: 'Kratzer am Deckel',
      version: 2,
    });
  });

  it.each([
    ['an unknown condition', () => ({ conditionValueId: 9999 })],
    ['a condition of another list', () => ({ conditionValueId: value('Ungarisch') })],
    ['an unknown pick list value', () => ({ values: { [attribute('Tastaturlayout')]: 9999 } })],
    [
      'a pick list value of another list',
      () => ({ values: { [attribute('Tastaturlayout')]: value('gebraucht') } }),
    ],
  ])('DER-56-08 PATCH with %s is rejected with 400 bad_request', async (_case, change) => {
    const id = await storedDevice();

    const response = await patch(id, { version: 1, confirmedKeys: [], ...change() });

    expect(response.statusCode).toBe(400);
    expect(deviceRow(id).version).toBe(1);
  });

  it('DER-56-08 a sold device with a deactivated condition gives device_not_available', async () => {
    const id = await storedDevice();
    t.database.sqlite
      .prepare("UPDATE device SET stock_status = 'sold', sold_on = '2026-11-17' WHERE id = ?")
      .run(id);
    deactivate(value('refurbished'));

    const response = await patch(id, {
      version: 1,
      conditionValueId: value('refurbished'),
      confirmedKeys: [],
    });

    expect(response.json().error.code).toBe('device_not_available');
  });

  it('checks a port type or position only if the stored value of the attribute does not hold it (2.0.11)', async () => {
    const ports = attribute('Anschlüsse');
    t.database.sqlite.prepare("UPDATE attribute SET level = 'device' WHERE id = ?").run(ports);
    const id = await storedDevice({
      values: values({ [ports]: [{ count: '2', typeId: value('USB-C'), positionId: value('vorn') }] }),
    });
    deactivate(value('USB-C'));
    deactivate(value('vorn'));
    deactivate(value('HDMI'));

    const kept = await patch(id, {
      version: 1,
      values: { [ports]: [{ count: '1', typeId: value('USB-C'), positionId: value('vorn') }] },
      confirmedKeys: [],
    });
    expect(kept.statusCode).toBe(200);

    const added = await patch(id, {
      version: 2,
      values: {
        [ports]: [
          { count: '1', typeId: value('USB-C'), positionId: value('vorn') },
          { count: '1', typeId: value('HDMI'), positionId: null },
        ],
      },
      confirmedKeys: [],
    });
    expect(added.json().error).toMatchObject({
      code: 'pick_list_value_deactivated',
      message: 'Anschlüsse: HDMI ist deaktiviert',
      details: { path: `values.${ports}`, id: value('HDMI') },
    });
  });
});
