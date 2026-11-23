import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  insertDeviceType,
  insertManufacturer,
  insertModelTemplate,
} from '../../test/model-templates.ts';
import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import { runMigrations } from '../db/migrator.ts';

// `PATCH /api/model-templates/{id}` (CU-109, CU-105; Technical Specification 2.4, 2.0.11, 2.5).

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let ids: {
  notebook: number;
  tablet: number;
  monitor: number;
  lenovo: number;
  fujitsu: number;
  apple: number;
  mv: number;
};

/** Attribute ids of the notebook and the tablet. */
const A = { keyboard: 11, processor: 12, ports: 13, os: 21, deviceKeyboard: 22, tabletColor: 31 };
/** Pick list value ids. */
const V = {
  german: 41,
  hungarian: 42,
  swiss: 43,
  win11: 51,
  win10: 52,
  usbC: 61,
  hdmi: 62,
  back: 71,
};

const STORED_VALUES = () => ({
  modelValues: {
    [A.keyboard]: V.german,
    [A.processor]: 'Intel Core i5-1135G7',
    [A.ports]: [{ count: 2, typeId: V.usbC, positionId: V.back }],
  },
  defaultDeviceValues: { [A.os]: V.win11, [A.deviceKeyboard]: V.german },
});

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, [initialSchema], () => new Date());
  const { sqlite } = t.database;
  const notebook = insertDeviceType(sqlite, 'Notebook');
  const tablet = insertDeviceType(sqlite, 'Tablet');
  const monitor = insertDeviceType(sqlite, 'Monitor');
  const lenovo = insertManufacturer(sqlite, 'Lenovo');
  const fujitsu = insertManufacturer(sqlite, 'Fujitsu');
  const apple = insertManufacturer(sqlite, 'Apple');
  insertPickLists(sqlite);
  const value = sqlite.prepare(
    'INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version) VALUES (?, ?, ?, ?, ?, 1, 1)',
  );
  value.run(V.german, pickListId('keyboard_layout'), 'Deutsch', 'deutsch', 1);
  value.run(V.hungarian, pickListId('keyboard_layout'), 'Ungarisch', 'ungarisch', 2);
  value.run(V.swiss, pickListId('keyboard_layout'), 'Schweiz', 'schweiz', 3);
  value.run(V.win11, pickListId('operating_system'), 'Windows 11 Pro', 'windows 11 pro', 1);
  value.run(V.win10, pickListId('operating_system'), 'Windows 10 Pro', 'windows 10 pro', 2);
  value.run(V.usbC, pickListId('port_type'), 'USB-C', 'usb-c', 1);
  value.run(V.hdmi, pickListId('port_type'), 'HDMI', 'hdmi', 2);
  value.run(V.back, pickListId('port_position'), 'hinten', 'hinten', 1);
  const attribute = sqlite.prepare(
    `INSERT INTO attribute (id, device_type_id, label, label_key, data_type, system_role, unit,
       unit_spacing, min_value, max_value, pick_list_id, level, variant_forming, required,
       datasheet_block, sort_order, active, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 1, NULL, NULL, ?, ?, 0, ?, 'technical', ?, 1, 1, '', '')`,
  );
  attribute.run(
    A.keyboard,
    notebook,
    'Tastaturlayout',
    'tastaturlayout',
    'pick',
    'keyboard_layout',
    pickListId('keyboard_layout'),
    'model',
    0,
    1,
  );
  attribute.run(A.processor, notebook, 'Prozessor', 'prozessor', 'text', null, null, 'model', 1, 2);
  attribute.run(A.ports, notebook, 'Anschlüsse', 'anschlüsse', 'ports', null, null, 'model', 0, 3);
  attribute.run(
    A.os,
    notebook,
    'Betriebssystem',
    'betriebssystem',
    'pick',
    null,
    pickListId('operating_system'),
    'device',
    1,
    4,
  );
  attribute.run(
    A.deviceKeyboard,
    notebook,
    'Tastatur Gerät',
    'tastatur gerät',
    'pick',
    null,
    pickListId('keyboard_layout'),
    'device',
    0,
    5,
  );
  attribute.run(A.tabletColor, tablet, 'Farbe', 'farbe', 'text', null, null, 'model', 0, 1);
  const mv = insertModelTemplate(sqlite, {
    deviceTypeId: notebook,
    manufacturerId: lenovo,
    modelName: 'ThinkPad T14',
    typeDesignation: '20W1',
    mpn: '20W1S0F300',
    ...STORED_VALUES(),
  });
  ids = { notebook, tablet, monitor, lenovo, fujitsu, apple, mv };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const patch = (body: unknown, id = ids.mv) =>
  t.app.inject({
    method: 'PATCH',
    url: `/api/model-templates/${id}`,
    headers: SAME_ORIGIN_WRITE,
    payload: JSON.stringify(body),
  });

const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });

const stored = () =>
  t.database.sqlite
    .prepare(
      'SELECT manufacturer_id, device_type_id, type_designation, model_values, default_device_values, version FROM model_template WHERE id = ?',
    )
    .get(ids.mv) as {
    manufacturer_id: number;
    device_type_id: number;
    type_designation: string | null;
    model_values: string;
    default_device_values: string;
    version: number;
  };

const auditCount = () =>
  t.database.sqlite.prepare('SELECT COUNT(*) FROM audit_entry').pluck().get() as number;

const deactivate = (table: 'device_type' | 'manufacturer' | 'pick_list_value', id: number) =>
  t.database.sqlite.prepare(`UPDATE ${table} SET active = 0 WHERE id = ?`).run(id);

/** The `fields[]` of a `422 validation_failed` answer, after checking status and format. */
const fieldsOf = (response: Awaited<ReturnType<typeof patch>>) => {
  expect(response.statusCode).toBe(422);
  const { error } = response.json();
  expect(error).toMatchObject({ code: 'validation_failed', referenceNumber: null });
  return error.fields as { path: string; code: string; message: string }[];
};

describe('PATCH /api/model-templates/{id} (CU-109, CU-105, Technical Specification 2.4)', () => {
  it('stores a changed type designation with the next version and finds it by the new search key', async () => {
    const response = await patch({ version: 1, typeDesignation: ' 20W2 ' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: ids.mv,
      modelName: 'ThinkPad T14',
      typeDesignation: '20W2',
      mpn: '20W1S0F300',
      ...STORED_VALUES(),
      version: 2,
    });
    const hits = (await get('/api/model-templates?q=20w2')).json();
    expect(hits.items.map(({ id }: { id: number }) => id)).toEqual([ids.mv]);
    expect(auditCount()).toBe(1);
  });

  it('keeps every field the request leaves out and changes attribute values key by key (2.5)', async () => {
    const response = await patch({
      version: 1,
      modelValues: { [A.processor]: 'Intel Core i7-1165G7', [A.keyboard]: null },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().modelValues).toEqual({
      [A.processor]: 'Intel Core i7-1165G7',
      [A.ports]: [{ count: 2, typeId: V.usbC, positionId: V.back }],
    });
    expect(response.json().defaultDeviceValues).toEqual(STORED_VALUES().defaultDeviceValues);
  });

  it('keeps the version and writes no audit entry for a request without a change', async () => {
    const response = await patch({ version: 1, modelName: 'ThinkPad T14', ...STORED_VALUES() });

    expect(response.statusCode).toBe(200);
    expect(response.json().version).toBe(1);
    expect(auditCount()).toBe(0);
  });

  it('drops the values of the old device type when the device type changes', async () => {
    const response = await patch({
      version: 1,
      deviceTypeId: ids.tablet,
      modelValues: { [A.tabletColor]: 'schwarz' },
      defaultDeviceValues: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      deviceTypeId: ids.tablet,
      modelValues: { [A.tabletColor]: 'schwarz' },
      defaultDeviceValues: {},
    });
  });

  it('records the dropped values of the old device type in the audit entry `updated` (2.0.9)', async () => {
    await patch({
      version: 1,
      deviceTypeId: ids.tablet,
      modelValues: { [A.tabletColor]: 'schwarz' },
      defaultDeviceValues: {},
    });

    const entry = t.database.sqlite
      .prepare("SELECT old_value, new_value FROM audit_entry WHERE action = 'updated'")
      .get() as { old_value: string; new_value: string };
    expect(JSON.parse(entry.old_value)).toEqual({
      Geräteart: 'Notebook',
      Farbe: null,
      Tastaturlayout: 'Deutsch',
      Prozessor: 'Intel Core i5-1135G7',
      Anschlüsse: '2 × USB-C hinten',
      'Vorbelegungswert Betriebssystem': 'Windows 11 Pro',
      'Vorbelegungswert Tastatur Gerät': 'Deutsch',
    });
    expect(JSON.parse(entry.new_value)).toEqual({
      Geräteart: 'Tablet',
      Farbe: 'schwarz',
      Tastaturlayout: null,
      Prozessor: null,
      Anschlüsse: null,
      'Vorbelegungswert Betriebssystem': null,
      'Vorbelegungswert Tastatur Gerät': null,
    });
  });

  describe('AC-REQ-010-03 required data emptied by a change', () => {
    it.each([
      ['modelName', { modelName: '  ' }, 'Modellbezeichnung: 1 bis 100 Zeichen'],
      [
        'mpn',
        { mpn: '', mpnUnknown: false },
        'Herstellernummer: Wert eingeben oder ‚unbekannt‘ wählen',
      ],
      ['deviceTypeId', { deviceTypeId: null }, 'Geräteart fehlt'],
      ['manufacturerId', { manufacturerId: null }, 'Hersteller fehlt'],
    ])(
      'AC-REQ-010-03 rejects an emptied %s and names the field, stores nothing',
      async (path, change, message) => {
        const fields = fieldsOf(await patch({ version: 1, ...change }));

        expect(fields).toEqual([expect.objectContaining({ path, message })]);
        expect(stored().version).toBe(1);
        expect(auditCount()).toBe(0);
      },
    );

    it('AC-REQ-010-03 rejects an emptied required attribute and names it, stores nothing', async () => {
      const fields = fieldsOf(await patch({ version: 1, modelValues: { [A.processor]: null } }));

      expect(fields).toEqual([
        { path: `modelValues.${A.processor}`, code: 'value_missing', message: 'Prozessor fehlt' },
      ]);
      expect(JSON.parse(stored().model_values)).toEqual(STORED_VALUES().modelValues);
    });
  });

  describe('AC-REQ-005-12 values checked on the state after the change (2.5)', () => {
    const patchAttribute = (id: number, body: Record<string, unknown>) =>
      t.app.inject({
        method: 'PATCH',
        url: `/api/attributes/${id}`,
        headers: SAME_ORIGIN_WRITE,
        payload: body,
      });

    /** "ThinkPad T14" saved without processor while the processor was deactivated. */
    async function withoutProcessorAfterReactivation() {
      expect((await patchAttribute(A.processor, { version: 1, active: false })).statusCode).toBe(
        200,
      );
      const saved = await patch({ version: 1, modelValues: { [A.processor]: null } });
      expect(saved.statusCode).toBe(200);
      expect((await patchAttribute(A.processor, { version: 2, active: true })).statusCode).toBe(
        200,
      );
    }

    it('AC-REQ-005-12 rejects a change of the type designation only with "Prozessor fehlt" at modelValues.<id>, stores nothing, and stores it with the processor', async () => {
      await withoutProcessorAfterReactivation();
      const auditBefore = auditCount();

      const fields = fieldsOf(await patch({ version: 2, typeDesignation: '20W2' }));

      expect(fields).toEqual([
        { path: `modelValues.${A.processor}`, code: 'value_missing', message: 'Prozessor fehlt' },
      ]);
      expect(stored()).toMatchObject({ type_designation: '20W1', version: 2 });
      expect(auditCount()).toBe(auditBefore);

      const response = await patch({
        version: 2,
        typeDesignation: '20W2',
        modelValues: { [A.processor]: 'Intel Core i5-1135G7' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        typeDesignation: '20W2',
        modelValues: { [A.processor]: 'Intel Core i5-1135G7' },
        version: 3,
      });
    });

    it('AC-REQ-005-12 activating the processor writes no value to "ThinkPad T14"', async () => {
      await withoutProcessorAfterReactivation();

      const { model_values, version } = stored();
      expect(JSON.parse(model_values)).not.toHaveProperty(String(A.processor));
      expect(version).toBe(2);
    });

    it('AC-REQ-005-12 names the missing processor together with the other field errors of the attribute values', async () => {
      await withoutProcessorAfterReactivation();

      const fields = fieldsOf(
        await patch({
          version: 2,
          modelValues: { [A.ports]: [{ count: 0, typeId: V.usbC, positionId: V.back }] },
        }),
      );

      expect(fields.map(({ path, message }) => [path, message])).toEqual([
        [`modelValues.${A.processor}`, 'Prozessor fehlt'],
        [`modelValues.${A.ports}`, expect.stringContaining('Anschlüsse')],
      ]);
      expect(stored().version).toBe(2);
    });

    it('AC-REQ-005-12 keeps the stored value of a deactivated attribute the request does not name', async () => {
      expect((await patchAttribute(A.ports, { version: 1, active: false })).statusCode).toBe(200);

      const response = await patch({ version: 1, typeDesignation: '20W2' });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(stored().model_values)).toEqual(STORED_VALUES().modelValues);
    });
  });

  it('DER-52-05 answers 409 version_conflict for an outdated version and stores nothing', async () => {
    await patch({ version: 1, typeDesignation: '20W2' });

    const response = await patch({ version: 1, typeDesignation: '20W3' });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('version_conflict');
    expect(stored()).toMatchObject({ type_designation: '20W2', version: 2 });
  });

  it('DER-52-06 answers 404 not_found with M-15 for a model template that does not exist', async () => {
    const response = await patch({ version: 1, typeDesignation: '20W2' }, 999);

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: 'not_found',
      message: 'Dieser Eintrag ist nicht mehr vorhanden.',
      referenceNumber: null,
    });
  });

  it.each([
    ['"unbekannt" with an MPN', { mpnUnknown: true }],
    ['no MPN without "unbekannt"', { mpn: null }],
  ])('rejects %s on the state after the change as bad_request', async (_case, change) => {
    const response = await patch({ version: 1, ...change });

    expect(response.statusCode).toBe(400);
    expect(stored().version).toBe(1);
  });

  it('stores "unbekannt" sent together with mpn: null', async () => {
    const response = await patch({ version: 1, mpn: null, mpnUnknown: true });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ mpn: null, mpnUnknown: true });
  });

  describe('DER-52-08 active entries only for a changed value (2.0.11, Nachtrag MAR-904, T4)', () => {
    it('DER-52-08 stores a change of the type designation although the stored manufacturer is deactivated', async () => {
      deactivate('manufacturer', ids.lenovo);

      const response = await patch({
        version: 1,
        deviceTypeId: ids.notebook,
        manufacturerId: ids.lenovo,
        typeDesignation: '20W2',
      });

      expect(response.statusCode).toBe(200);
      expect(stored()).toMatchObject({ manufacturer_id: ids.lenovo, type_designation: '20W2' });
    });

    it('DER-52-08 stores a change of another field although the stored device type is deactivated', async () => {
      deactivate('device_type', ids.notebook);

      const response = await patch({
        version: 1,
        deviceTypeId: ids.notebook,
        typeDesignation: '20W2',
      });

      expect(response.statusCode).toBe(200);
    });

    it('DER-52-08 rejects a change to a deactivated manufacturer with 422 manufacturer_deactivated, stores nothing', async () => {
      deactivate('manufacturer', ids.fujitsu);

      const response = await patch({ version: 1, manufacturerId: ids.fujitsu });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toEqual({
        code: 'manufacturer_deactivated',
        message: 'Hersteller Fujitsu ist deaktiviert',
        fields: [],
        details: { path: 'manufacturerId', id: ids.fujitsu },
        referenceNumber: null,
      });
      expect(stored()).toMatchObject({ manufacturer_id: ids.lenovo, version: 1 });
    });

    it('DER-52-08 rejects a change to a deactivated device type with 422 device_type_deactivated, stores nothing', async () => {
      deactivate('device_type', ids.monitor);

      const response = await patch({ version: 1, deviceTypeId: ids.monitor, modelValues: {} });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'device_type_deactivated',
        message: 'Geräteart Monitor ist deaktiviert',
        details: { path: 'deviceTypeId', id: ids.monitor },
      });
      expect(stored()).toMatchObject({ device_type_id: ids.notebook, version: 1 });
    });

    it('DER-52-08 an unchanged, deactivated pick list value does not prevent saving other fields', async () => {
      deactivate('pick_list_value', V.german);
      deactivate('pick_list_value', V.usbC);
      deactivate('pick_list_value', V.win11);

      const response = await patch({ version: 1, typeDesignation: '20W2', ...STORED_VALUES() });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject(STORED_VALUES());
    });

    it('DER-52-08 rejects a value in modelValues changed to a deactivated pick list value', async () => {
      deactivate('pick_list_value', V.hungarian);

      const response = await patch({ version: 1, modelValues: { [A.keyboard]: V.hungarian } });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'pick_list_value_deactivated',
        message: 'Tastaturlayout: Ungarisch ist deaktiviert',
        details: { path: `modelValues.${A.keyboard}`, id: V.hungarian },
      });
      expect(stored().version).toBe(1);
    });

    it('DER-52-08 rejects a value in defaultDeviceValues changed to a deactivated pick list value', async () => {
      deactivate('pick_list_value', V.win10);

      const response = await patch({ version: 1, defaultDeviceValues: { [A.os]: V.win10 } });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'pick_list_value_deactivated',
        message: 'Betriebssystem: Windows 10 Pro ist deaktiviert',
        details: { path: `defaultDeviceValues.${A.os}`, id: V.win10 },
      });
    });

    it('DER-52-08 rejects a port type the stored value does not hold, but keeps a stored, deactivated one', async () => {
      deactivate('pick_list_value', V.usbC);
      deactivate('pick_list_value', V.hdmi);
      const ports = [
        { count: 2, typeId: V.usbC, positionId: V.back },
        { count: 1, typeId: V.hdmi, positionId: null },
      ];

      const response = await patch({ version: 1, modelValues: { [A.ports]: ports } });

      expect(response.json().error).toMatchObject({
        code: 'pick_list_value_deactivated',
        details: { path: `modelValues.${A.ports}`, id: V.hdmi },
      });
    });

    it('DER-52-08 checks a value as changed again after the device type changed', async () => {
      deactivate('pick_list_value', V.german);
      t.database.sqlite
        .prepare('UPDATE attribute SET device_type_id = ? WHERE id = ?')
        .run(ids.tablet, A.deviceKeyboard);

      const response = await patch({
        version: 1,
        deviceTypeId: ids.tablet,
        defaultDeviceValues: { [A.deviceKeyboard]: V.german },
      });

      expect(response.json().error).toMatchObject({ code: 'pick_list_value_deactivated' });
    });

    it.each([
      ['an unknown manufacturer', { manufacturerId: 999 }],
      ['an unknown device type', { deviceTypeId: 999 }],
      ['an unknown pick list value', { modelValues: { [A.keyboard]: 999 } }],
      ['a value of the list of another attribute', { modelValues: { [A.keyboard]: V.win11 } }],
      [
        'a port position from the list of types',
        { modelValues: { [A.ports]: [{ count: 1, typeId: V.usbC, positionId: V.hdmi }] } },
      ],
    ])('DER-52-08 rejects %s with 400 bad_request, stores nothing', async (_case, change) => {
      const response = await patch({ version: 1, ...change });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatchObject({ code: 'bad_request', referenceNumber: null });
      expect(stored().version).toBe(1);
    });

    it('DER-52-08 an outdated version wins over a deactivated manufacturer: 409 version_conflict', async () => {
      deactivate('manufacturer', ids.fujitsu);

      const response = await patch({ version: 2, manufacturerId: ids.fujitsu });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('version_conflict');
    });

    it('checks the active entries before the other attribute rules', async () => {
      deactivate('manufacturer', ids.apple);

      const response = await patch({
        version: 1,
        manufacturerId: ids.apple,
        modelValues: { [A.processor]: null },
      });

      expect(response.json().error.code).toBe('manufacturer_deactivated');
    });
  });
});
