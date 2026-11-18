import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';

// API tests of `POST /api/devices` and `GET /api/devices/{id}` (CU-130, CU-121, CU-122;
// Technical Specification 2.5, 2.0.11) on the initial settings of the seed migration.

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let ids: {
  mvA: number;
  used: number;
  ios: number;
  withBattery: number;
  battery: number;
  batteryCapacity: number;
  operatingSystem: number;
  west: number;
  ost: number;
};

const STAMP = '2026-11-16T08:00:00.000Z';

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  const { sqlite } = t.database;
  const one = <T>(sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...params) as T;
  const valueId = (label: string) =>
    one<{ id: number }>('SELECT id FROM pick_list_value WHERE label = ?', label).id;
  const smartphone = one<{ id: number }>("SELECT id FROM device_type WHERE name = 'Smartphone'").id;
  const attributeId = (label: string) =>
    one<{ id: number }>(
      'SELECT id FROM attribute WHERE device_type_id = ? AND label = ?',
      smartphone,
      label,
    ).id;
  const supplier = (name: string, active: boolean) =>
    Number(
      sqlite
        .prepare(
          'INSERT INTO supplier (name, name_key, active, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
        )
        .run(name, name.toLowerCase(), active ? 1 : 0, STAMP, STAMP).lastInsertRowid,
    );
  ids = {
    mvA: insertModelTemplate(sqlite, {
      deviceTypeId: smartphone,
      manufacturerId: insertManufacturer(sqlite, 'Apple'),
      modelName: 'iPhone 13',
      mpn: 'MLPF3ZD/A',
    }),
    used: valueId('gebraucht'),
    ios: valueId('iOS'),
    withBattery: valueId('mit Akku'),
    battery: attributeId('Akku'),
    batteryCapacity: attributeId('Akkukapazität'),
    operatingSystem: attributeId('Betriebssystem'),
    west: supplier('Lieferant West', false),
    ost: supplier('Lieferant Ost', true),
  };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const WI_NR_RULE = 'WI-Nr darf nur Buchstaben und Ziffern enthalten (1–20 Zeichen)';

/** A valid request for MV-A, an iPhone with operating system, battery and capacity. */
const body = (change: Record<string, unknown> = {}) => ({
  wiNr: '626198',
  supplierId: null,
  modelTemplateId: ids.mvA,
  conditionValueId: ids.used,
  visualGrade: '3',
  conditionDescription: '',
  values: {
    [ids.operatingSystem]: ids.ios,
    [ids.battery]: ids.withBattery,
    [ids.batteryCapacity]: { percent: 87 },
  },
  confirmedKeys: [],
  ...change,
});

const post = (payload: Record<string, unknown>) =>
  t.app.inject({ method: 'POST', url: '/api/devices', headers: SAME_ORIGIN_WRITE, payload });
const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });

const count = (table: 'device' | 'audit_entry') =>
  (t.database.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('POST /api/devices (CU-121, Technical Specification 2.5)', () => {
  it('AC-REQ-012-01 stores a device with WI-Nr "626198" and MV-A as available, unassigned, with its capture date and audit entry', async () => {
    const response = await post(body());

    expect(response.statusCode).toBe(201);
    const device = response.json();
    expect(device).toMatchObject({
      wiNr: '626198',
      modelTemplateId: ids.mvA,
      listingId: null,
      supplierId: null,
      conditionValueId: ids.used,
      visualGrade: 3,
      stockStatus: 'available',
      captureStatus: 'checked',
      reviewKeys: [],
      version: 1,
      values: {
        [ids.operatingSystem]: ids.ios,
        [ids.battery]: ids.withBattery,
        [ids.batteryCapacity]: { percent: 87 },
      },
    });
    expect(device.capturedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Date.parse(device.capturedAt)).not.toBeNaN();

    const entry = t.database.sqlite
      .prepare('SELECT * FROM audit_entry WHERE object_type = ?')
      .get('device') as Record<string, unknown>;
    expect(entry).toMatchObject({
      object_id: device.id,
      object_label: 'Gerät 626198',
      object_category: 'device',
      action: 'created',
      old_value: null,
    });
    expect(JSON.parse(String(entry.new_value))).toEqual({
      'WI-Nr': '626198',
      Modellvorlage: 'iPhone 13',
      Zustand: 'gebraucht',
      'Optik-Note': 3,
      Betriebssystem: 'iOS',
      Akku: 'mit Akku',
      Akkukapazität: '87 %',
    });
  });

  it('AC-REQ-012-02 rejects a second device with "626198" and names the existing device and that it is unassigned', async () => {
    const first = (await post(body())).json();

    const response = await post(body({ visualGrade: '4' }));

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'wi_nr_taken',
      message: 'WI-Nr bereits vergeben: Gerät 626198 (nicht zugeordnet)',
      details: { deviceId: first.id, listingId: null },
    });
    expect(count('device')).toBe(1);
    expect(count('audit_entry')).toBe(1);
  });

  it('AC-REQ-012-02 rejects the WI-Nr of a sold device and names it with its model listing, without regard to case', async () => {
    const first = (await post(body({ wiNr: 'A637607' }))).json();
    const { sqlite } = t.database;
    const listingId = Number(
      sqlite
        .prepare(
          `INSERT INTO listing (model_template_id, condition_value_id, visual_grade,
             condition_description, condition_description_key, variant_values, other_device_values,
             article_number, article_number_key, ean_mode, display_title, quantity, stock_json,
             stock_hash, version, created_at, updated_at)
           VALUES (?, ?, 3, '', '', '{}', '{}', 'MI-1', 'mi-1', 'original', 'iPhone 13, iOS', 0,
             '{}', '', 1, ?, ?)`,
        )
        .run(ids.mvA, ids.used, STAMP, STAMP).lastInsertRowid,
    );
    sqlite
      .prepare("UPDATE device SET listing_id = ?, stock_status = 'sold', sold_on = ? WHERE id = ?")
      .run(listingId, '2026-11-16', first.id);

    const response = await post(body({ wiNr: 'a637607' }));

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'wi_nr_taken',
      message: 'WI-Nr bereits vergeben: Gerät A637607 in iPhone 13, iOS',
      details: { deviceId: first.id, listingId },
    });
  });

  it('accepts the WI-Nr of a cancelled device again (REQ-093)', async () => {
    const first = (await post(body({ wiNr: '633641' }))).json();
    t.database.sqlite
      .prepare(
        "UPDATE device SET stock_status = 'cancelled', cancel_reason = 'falsch', cancelled_at = ? WHERE id = ?",
      )
      .run(STAMP, first.id);

    expect((await post(body({ wiNr: '633641' }))).statusCode).toBe(201);
  });

  it.each([
    ['empty', ''],
    ['with a space', '626 198'],
  ])('AC-REQ-012-03 rejects a WI-Nr %s naming the WI-Nr rule', async (_case, wiNr) => {
    const response = await post(body({ wiNr }));

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'validation_failed',
      message: '',
      fields: [{ path: 'wiNr', code: 'wi_nr_format', message: WI_NR_RULE }],
    });
    expect(count('device')).toBe(0);
  });

  it('AC-REQ-012-04 accepts the WI-Nr "A637607"', async () => {
    const response = await post(body({ wiNr: 'A637607' }));

    expect(response.statusCode).toBe(201);
    expect(response.json().wiNr).toBe('A637607');
  });

  it('DER-54-11 rejects a device without modelTemplateId with "Bitte eine Modellvorlage wählen" and stores nothing', async () => {
    const response = await post(body({ modelTemplateId: null }));

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'validation_failed',
      fields: [{ path: 'modelTemplateId', message: 'Bitte eine Modellvorlage wählen' }],
    });
    expect(count('device')).toBe(0);
    expect(count('audit_entry')).toBe(0);
  });

  it('DER-54-05 reports the WI-Nr "62-61" and the battery capacity 101 in one answer', async () => {
    const response = await post(
      body({
        wiNr: '62-61',
        values: {
          [ids.operatingSystem]: ids.ios,
          [ids.battery]: ids.withBattery,
          [ids.batteryCapacity]: { percent: 101 },
        },
      }),
    );

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      { path: 'wiNr', code: 'wi_nr_format', message: WI_NR_RULE },
      {
        path: `values.${ids.batteryCapacity}`,
        code: 'battery_capacity_format',
        message: 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“',
      },
    ]);
    expect(count('device')).toBe(0);
  });

  it('rejects missing required values of the level device, the battery capacity with "mit Akku" (2.5)', async () => {
    const response = await post(body({ values: { [ids.battery]: ids.withBattery } }));

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      {
        path: `values.${ids.operatingSystem}`,
        code: 'value_missing',
        message: 'Betriebssystem fehlt',
      },
      {
        path: `values.${ids.batteryCapacity}`,
        code: 'value_missing',
        message: 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“',
      },
    ]);
  });

  it('a battery value with "Akku vorhanden" requires the battery capacity (2.5, FIND-353, Nachtrag MAR-973 R2)', async () => {
    const response = await post(
      body({ values: { [ids.operatingSystem]: ids.ios, [ids.battery]: ids.withBattery } }),
    );

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      {
        path: `values.${ids.batteryCapacity}`,
        code: 'value_missing',
        message: 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“',
      },
    ]);
  });

  it('rejects an unknown model template and a request of another shape with 400 bad_request', async () => {
    expect((await post(body({ modelTemplateId: 999 }))).json().error.code).toBe('bad_request');
    expect((await post(body({ wiNr: 626198 }))).statusCode).toBe(400);
    expect((await post(body({ extra: true }))).statusCode).toBe(400);
    expect(count('device')).toBe(0);
  });

  it('stores the chosen active supplier', async () => {
    const response = await post(body({ supplierId: ids.ost }));

    expect(response.statusCode).toBe(201);
    expect(response.json().supplierId).toBe(ids.ost);
  });

  it('DER-54-15 (a) rejects a deactivated supplier with 422 supplier_deactivated at supplierId, storing nothing', async () => {
    const response = await post(body({ supplierId: ids.west }));

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toEqual({
      code: 'supplier_deactivated',
      message: 'Lieferant Lieferant West ist deaktiviert',
      fields: [],
      details: { path: 'supplierId', id: ids.west },
      referenceNumber: null,
    });
    expect(count('device')).toBe(0);
    expect(count('audit_entry')).toBe(0);
  });

  it('DER-54-15 (b) rejects an unknown supplier with 400 bad_request, storing nothing', async () => {
    const response = await post(body({ supplierId: 999 }));

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
    expect(count('device')).toBe(0);
    expect(count('audit_entry')).toBe(0);
  });

  it('DER-54-15 (c) a deactivated supplier and a taken WI-Nr give supplier_deactivated', async () => {
    await post(body());

    const response = await post(body({ supplierId: ids.west }));

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('supplier_deactivated');
    expect(count('device')).toBe(1);
  });
});

describe('GET /api/devices/{id} (CU-130, Technical Specification 2.5)', () => {
  it('returns the device with its model listing, null while unassigned', async () => {
    const created = (await post(body())).json();

    const response = await get(`/api/devices/${created.id}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...created, listing: null });
  });

  it('answers 404 not_found for an unknown device', async () => {
    const response = await get('/api/devices/999');

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('not_found');
  });
});

/**
 * MV-B: an iPhone with processor at the level model and the defaults of AC-REQ-013-01 for
 * operating system, battery and battery capacity at the level device.
 */
function insertMvB(): number {
  const { sqlite } = t.database;
  const smartphone = (
    sqlite.prepare("SELECT id FROM device_type WHERE name = 'Smartphone'").get() as { id: number }
  ).id;
  const processor = (
    sqlite
      .prepare("SELECT id FROM attribute WHERE device_type_id = ? AND label = 'Prozessor'")
      .get(smartphone) as { id: number }
  ).id;
  return insertModelTemplate(sqlite, {
    deviceTypeId: smartphone,
    manufacturerId: insertManufacturer(sqlite, 'Apple Inc.'),
    modelName: 'iPhone 14',
    mpn: 'MPUF3ZD/A',
    modelValues: { [processor]: 'A15 Bionic' },
    defaultDeviceValues: {
      [ids.operatingSystem]: ids.ios,
      [ids.battery]: ids.withBattery,
      [ids.batteryCapacity]: { percent: 85 },
    },
  });
}

const setActive = (valueId: number, active: boolean) =>
  t.database.sqlite
    .prepare('UPDATE pick_list_value SET active = ? WHERE id = ?')
    .run(active ? 1 : 0, valueId);

/** The values of MV-B unchanged, as UI-003 sends them after the prefill. */
const prefilledBody = (mvB: number, change: Record<string, unknown> = {}) =>
  body({
    modelTemplateId: mvB,
    values: {
      [ids.operatingSystem]: ids.ios,
      [ids.battery]: ids.withBattery,
      [ids.batteryCapacity]: { percent: 85 },
    },
    ...change,
  });

describe('GET /api/model-templates/{id}/device-prefill (CU-293, Technical Specification 2.5)', () => {
  it('AC-REQ-013-01 prefills battery and battery capacity of MV-A with review flags, the processor of the level model without', async () => {
    const mvB = insertMvB();

    const response = await get(`/api/model-templates/${mvB}/device-prefill`);

    expect(response.statusCode).toBe(200);
    const prefill = response.json();
    expect(prefill).toEqual({
      conditionValueId: null,
      visualGrade: null,
      conditionDescription: '',
      values: {
        [ids.operatingSystem]: ids.ios,
        [ids.battery]: ids.withBattery,
        [ids.batteryCapacity]: { percent: 85 },
      },
      reviewKeys: expect.any(Array),
      codeResult: { found: false, plainText: null },
    });
    expect([...prefill.reviewKeys].sort()).toEqual(
      [ids.operatingSystem, ids.battery, ids.batteryCapacity].map(String).sort(),
    );
  });

  it('DER-55-06 leaves out a deactivated pick list value, which stays stored at the model template', async () => {
    const mvB = insertMvB();
    setActive(ids.ios, false);

    const prefill = (await get(`/api/model-templates/${mvB}/device-prefill`)).json();

    expect(prefill.values).not.toHaveProperty(String(ids.operatingSystem));
    expect(prefill.reviewKeys).not.toContain(String(ids.operatingSystem));
    const stored = t.database.sqlite
      .prepare('SELECT default_device_values FROM model_template WHERE id = ?')
      .get(mvB) as { default_device_values: string };
    expect(JSON.parse(stored.default_device_values)).toHaveProperty(
      String(ids.operatingSystem),
      ids.ios,
    );

    setActive(ids.ios, true);
    const again = (await get(`/api/model-templates/${mvB}/device-prefill`)).json();
    expect(again.values).toHaveProperty(String(ids.operatingSystem), ids.ios);
    expect(again.reviewKeys).toContain(String(ids.operatingSystem));
  });

  it('answers 404 not_found for an unknown model template', async () => {
    const response = await get('/api/model-templates/999/device-prefill');

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('not_found');
  });
});

describe('review flags of POST /api/devices (CU-121, CU-118, Technical Specification 2.5)', () => {
  it('AC-REQ-013-04 stores a device with open review flags as "review_pending", without one as "checked"', async () => {
    const mvB = insertMvB();

    const pending = await post(prefilledBody(mvB));
    expect(pending.statusCode).toBe(201);
    expect(pending.json().captureStatus).toBe('review_pending');
    expect([...pending.json().reviewKeys].sort()).toEqual(
      [ids.operatingSystem, ids.battery, ids.batteryCapacity].map(String).sort(),
    );

    const checked = await post(
      prefilledBody(mvB, {
        wiNr: '626199',
        confirmedKeys: [ids.operatingSystem, ids.battery, ids.batteryCapacity].map(String),
      }),
    );
    expect(checked.json()).toMatchObject({ captureStatus: 'checked', reviewKeys: [] });
    const stored = t.database.sqlite
      .prepare('SELECT capture_status, review_keys FROM device WHERE wi_nr = ?')
      .get('626199');
    expect(stored).toEqual({ capture_status: 'checked', review_keys: '[]' });
  });

  it('AC-REQ-013-02 lifts the flag of the battery capacity confirmed unchanged', async () => {
    const mvB = insertMvB();

    const response = await post(
      prefilledBody(mvB, { confirmedKeys: [String(ids.batteryCapacity)] }),
    );

    expect(response.json().reviewKeys).not.toContain(String(ids.batteryCapacity));
    expect(response.json().reviewKeys).toContain(String(ids.battery));
    expect(response.json().captureStatus).toBe('review_pending');
  });

  it('lifts the flag of a value changed from the prefilled one', async () => {
    const mvB = insertMvB();

    const response = await post(
      prefilledBody(mvB, {
        values: {
          [ids.operatingSystem]: ids.ios,
          [ids.battery]: ids.withBattery,
          [ids.batteryCapacity]: { percent: 87 },
        },
        confirmedKeys: [String(ids.operatingSystem), String(ids.battery)],
      }),
    );

    expect(response.json()).toMatchObject({ captureStatus: 'checked', reviewKeys: [] });
  });

  it('DER-55-06 forms no flag for a deactivated default, so an active value chosen instead saves', async () => {
    const mvB = insertMvB();
    setActive(ids.ios, false);
    const android = (
      t.database.sqlite.prepare("SELECT id FROM pick_list_value WHERE label = 'Android'").get() as {
        id: number;
      }
    ).id;

    const response = await post(
      prefilledBody(mvB, {
        values: {
          [ids.operatingSystem]: android,
          [ids.battery]: ids.withBattery,
          [ids.batteryCapacity]: { percent: 85 },
        },
        confirmedKeys: [String(ids.battery), String(ids.batteryCapacity)],
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ captureStatus: 'checked', reviewKeys: [] });
  });
});

/** An entry of the code translation; `supplierId` `null` = for all suppliers (2.2). */
function insertConditionCode(entry: {
  code: string;
  supplierId?: number | null;
  plainText: string;
  conditionValueId?: number | null;
  visualGrade?: number | null;
}) {
  t.database.sqlite
    .prepare(
      `INSERT INTO condition_code (code, code_key, supplier_id, plain_text,
         suggested_condition_value_id, suggested_visual_grade, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      entry.code,
      entry.code.toLowerCase(),
      entry.supplierId ?? null,
      entry.plainText,
      entry.conditionValueId ?? null,
      entry.visualGrade ?? null,
      STAMP,
      STAMP,
    );
}

const conditionValue = (label: string) =>
  (
    t.database.sqlite.prepare('SELECT id FROM pick_list_value WHERE label = ?').get(label) as {
      id: number;
    }
  ).id;

describe('condition code in the prefill and POST /api/devices (CU-293, CU-121; Technical Specification 2.5, 2.2)', () => {
  const DGS_TEXT = 'Display- und Gehäuseschaden';

  it('AC-REQ-015-01 code "dgs" puts "Display- und Gehäuseschaden" into the condition description and stores "DGS" as condition code', async () => {
    insertConditionCode({ code: 'DGS', plainText: DGS_TEXT });

    const prefill = (
      await get(`/api/model-templates/${ids.mvA}/device-prefill?conditionCode=dgs`)
    ).json();
    expect(prefill).toMatchObject({
      conditionDescription: DGS_TEXT,
      codeResult: { found: true, plainText: DGS_TEXT },
      reviewKeys: [],
    });

    const response = await post(
      body({ conditionCode: 'dgs', conditionDescription: prefill.conditionDescription }),
    );
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      conditionCode: 'DGS',
      conditionDescription: DGS_TEXT,
      captureStatus: 'checked',
    });
    const stored = t.database.sqlite
      .prepare('SELECT condition_code, condition_description FROM device WHERE wi_nr = ?')
      .get('626198');
    expect(stored).toEqual({ condition_code: 'DGS', condition_description: DGS_TEXT });
    const entry = t.database.sqlite
      .prepare('SELECT new_value FROM audit_entry WHERE object_type = ?')
      .get('device') as { new_value: string };
    expect(JSON.parse(entry.new_value)).toMatchObject({
      Zustandscode: 'DGS',
      Zustandsbeschreibung: DGS_TEXT,
    });
  });

  it('AC-REQ-015-02 with supplier "L1" takes the plain text of its own entry', async () => {
    insertConditionCode({ code: 'DGS', plainText: DGS_TEXT });
    insertConditionCode({ code: 'DGS', supplierId: ids.ost, plainText: 'Display gebrochen (L1)' });

    const withSupplier = (
      await get(
        `/api/model-templates/${ids.mvA}/device-prefill?conditionCode=DGS&supplierId=${ids.ost}`,
      )
    ).json();
    expect(withSupplier).toMatchObject({
      conditionDescription: 'Display gebrochen (L1)',
      codeResult: { found: true, plainText: 'Display gebrochen (L1)' },
    });
    const withoutSupplier = (
      await get(`/api/model-templates/${ids.mvA}/device-prefill?conditionCode=DGS&supplierId=`)
    ).json();
    expect(withoutSupplier.conditionDescription).toBe(DGS_TEXT);
  });

  it('AC-REQ-015-03 an unknown code "XYZ" takes no text, and a device with it and a manual description saves', async () => {
    const prefill = (
      await get(`/api/model-templates/${ids.mvA}/device-prefill?conditionCode=XYZ`)
    ).json();
    expect(prefill).toMatchObject({
      conditionDescription: '',
      codeResult: { found: false, plainText: null },
    });

    const response = await post(
      body({ conditionCode: 'XYZ', conditionDescription: 'Kratzer am Rahmen' }),
    );
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      conditionCode: 'XYZ',
      conditionDescription: 'Kratzer am Rahmen',
    });
  });

  it('AC-REQ-015-04 the suggested visual grade 4 is prefilled and flagged for review until confirmed or changed', async () => {
    insertConditionCode({ code: 'DGS', plainText: DGS_TEXT, visualGrade: 4 });

    const prefill = (
      await get(`/api/model-templates/${ids.mvA}/device-prefill?conditionCode=DGS`)
    ).json();
    expect(prefill).toMatchObject({ visualGrade: 4, reviewKeys: ['visualGrade'] });

    const pending = await post(
      body({ conditionCode: 'DGS', visualGrade: '4', conditionDescription: DGS_TEXT }),
    );
    expect(pending.json()).toMatchObject({
      reviewKeys: ['visualGrade'],
      captureStatus: 'review_pending',
    });
    const confirmed = await post(
      body({
        wiNr: '626199',
        conditionCode: 'DGS',
        visualGrade: '4',
        confirmedKeys: ['visualGrade'],
      }),
    );
    expect(confirmed.json()).toMatchObject({ reviewKeys: [], captureStatus: 'checked' });
    const changed = await post(body({ wiNr: '626200', conditionCode: 'DGS', visualGrade: '2' }));
    expect(changed.json()).toMatchObject({ reviewKeys: [], captureStatus: 'checked' });
  });

  it('DER-57-02 flags the suggested condition and visual grade, never the plain text', async () => {
    insertConditionCode({
      code: 'DGS',
      plainText: DGS_TEXT,
      conditionValueId: ids.used,
      visualGrade: 3,
    });

    const prefill = (
      await get(`/api/model-templates/${ids.mvA}/device-prefill?conditionCode=DGS`)
    ).json();

    expect(prefill).toMatchObject({
      conditionValueId: ids.used,
      visualGrade: 3,
      conditionDescription: DGS_TEXT,
    });
    expect([...prefill.reviewKeys].sort()).toEqual(['condition', 'visualGrade']);
    const response = await post(
      body({
        conditionCode: 'DGS',
        conditionDescription: 'eigener Text',
        confirmedKeys: ['condition', 'visualGrade'],
      }),
    );
    expect(response.json()).toMatchObject({ reviewKeys: [], captureStatus: 'checked' });
  });

  it('DER-57-03 code "DGS" with the deactivated suggestion "refurbished" keeps the condition empty without flag, prefills the visual grade, and the condition again once active', async () => {
    const refurbished = conditionValue('refurbished');
    insertConditionCode({
      code: 'DGS',
      plainText: DGS_TEXT,
      conditionValueId: refurbished,
      visualGrade: 4,
    });
    setActive(refurbished, false);

    const prefill = (
      await get(`/api/model-templates/${ids.mvA}/device-prefill?conditionCode=DGS`)
    ).json();
    expect(prefill).toMatchObject({
      conditionValueId: null,
      visualGrade: 4,
      conditionDescription: DGS_TEXT,
      reviewKeys: ['visualGrade'],
    });
    const response = await post(
      body({ conditionCode: 'DGS', visualGrade: '4', confirmedKeys: ['visualGrade'] }),
    );
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ reviewKeys: [], captureStatus: 'checked' });

    setActive(refurbished, true);
    const again = (
      await get(`/api/model-templates/${ids.mvA}/device-prefill?conditionCode=DGS`)
    ).json();
    expect(again.conditionValueId).toBe(refurbished);
    expect([...again.reviewKeys].sort()).toEqual(['condition', 'visualGrade']);
  });

  it('DER-57-04 forms the flags on saving from the condition code and the supplier sent', async () => {
    insertConditionCode({
      code: 'DGS',
      supplierId: ids.ost,
      plainText: 'Display gebrochen (Ost)',
      visualGrade: 4,
    });

    const withSupplier = await post(
      body({ supplierId: ids.ost, conditionCode: 'DGS', visualGrade: '4' }),
    );
    expect(withSupplier.json()).toMatchObject({
      conditionCode: 'DGS',
      reviewKeys: ['visualGrade'],
      captureStatus: 'review_pending',
    });
    const withoutSupplier = await post(
      body({ wiNr: '626199', conditionCode: 'DGS', visualGrade: '4' }),
    );
    expect(withoutSupplier.json()).toMatchObject({
      conditionCode: 'DGS',
      reviewKeys: [],
      captureStatus: 'checked',
    });
  });

  it('stores no condition code without one or for an empty one, and rejects one longer than 20 characters', async () => {
    const without = await post(body());
    expect(without.json().conditionCode).toBeNull();
    const empty = await post(body({ wiNr: '626199', conditionCode: '  ' }));
    expect(empty.json().conditionCode).toBeNull();

    const tooLong = await post(body({ wiNr: '626200', conditionCode: 'X'.repeat(21) }));
    expect(tooLong.statusCode).toBe(422);
    expect(tooLong.json().error).toMatchObject({
      code: 'validation_failed',
      fields: [{ path: 'conditionCode', message: 'Zustandscode: 1 bis 20 Zeichen' }],
    });
    expect(count('device')).toBe(2);
  });

  it('rejects an unknown query parameter of the prefill with 400', async () => {
    const response = await get(`/api/model-templates/${ids.mvA}/device-prefill?code=DGS`);

    expect(response.statusCode).toBe(400);
  });
});
