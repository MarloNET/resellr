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

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let ids: { notebook: number; monitor: number; apple: number; lenovo: number; mvA: number };

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, [initialSchema], () => new Date());
  const { sqlite } = t.database;
  const notebook = insertDeviceType(sqlite, 'Notebook');
  const monitor = insertDeviceType(sqlite, 'Monitor');
  const apple = insertManufacturer(sqlite, 'Apple');
  const lenovo = insertManufacturer(sqlite, 'Lenovo');
  const mvA = insertModelTemplate(sqlite, {
    deviceTypeId: notebook,
    manufacturerId: apple,
    modelName: 'MacBook Pro 13',
    typeDesignation: 'A1708',
    mpn: 'MHGT3D/A',
    createdAt: '2026-11-10T08:00:00.000Z',
  });
  ids = { notebook, monitor, apple, lenovo, mvA };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });
const search = (query: string) => get(`/api/model-templates?${query}`);

const MV_A = () => ({
  id: ids.mvA,
  deviceType: { id: ids.notebook, name: 'Notebook' },
  manufacturer: { id: ids.apple, name: 'Apple' },
  modelName: 'MacBook Pro 13',
  typeDesignation: 'A1708',
  mpn: 'MHGT3D/A',
  mpnUnknown: false,
});

describe('GET /api/model-templates (CU-109, Technical Specification 2.4)', () => {
  it('AC-REQ-009-01 the search "macbook pro" returns MV-A with device type, manufacturer, model name, type designation and MPN', async () => {
    const response = await search('q=macbook%20pro');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [MV_A()], total: 1 });
  });

  it('AC-REQ-009-02 the search "MHGT3" returns MV-A', async () => {
    const response = await search('q=MHGT3');

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([MV_A()]);
  });

  it('AC-REQ-009-03 the search "Zenbook" returns no hit', async () => {
    const response = await search('q=Zenbook');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], total: 0 });
  });

  it('AC-REQ-009-04 a search term with 1 character is rejected with 422 validation_failed "Mindestens 2 Zeichen"', async () => {
    const response = await search('q=m');

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'validation_failed',
      fields: [{ path: 'q', code: 'too_small', message: 'Mindestens 2 Zeichen' }],
    });
  });

  it('DER-51-05 the device type filter restricts the hits', async () => {
    insertModelTemplate(t.database.sqlite, {
      deviceTypeId: ids.monitor,
      manufacturerId: ids.lenovo,
      modelName: 'ThinkVision Pro',
      mpn: null,
    });

    const all = await search('q=pro');
    const monitors = await search(`q=pro&deviceTypeId=${ids.monitor}`);
    const notebooks = await search(`deviceTypeId=${ids.notebook}`);

    expect(all.json().total).toBe(2);
    expect(monitors.json()).toEqual({
      items: [
        {
          id: expect.any(Number),
          deviceType: { id: ids.monitor, name: 'Monitor' },
          manufacturer: { id: ids.lenovo, name: 'Lenovo' },
          modelName: 'ThinkVision Pro',
          typeDesignation: null,
          mpn: null,
          mpnUnknown: true,
        },
      ],
      total: 1,
    });
    expect(notebooks.json()).toEqual({ items: [MV_A()], total: 1 });
  });

  it('DER-51-01 without a search term returns the 50 latest created, newest first, with the total', async () => {
    for (let index = 1; index <= 50; index++) {
      insertModelTemplate(t.database.sqlite, {
        deviceTypeId: ids.notebook,
        manufacturerId: ids.lenovo,
        modelName: `ThinkPad ${index}`,
        mpn: null,
        createdAt: `2026-11-11T08:00:${String(index).padStart(2, '0')}.000Z`,
      });
    }

    const response = await get('/api/model-templates');

    expect(response.statusCode).toBe(200);
    const { items, total } = response.json();
    expect(total).toBe(51);
    expect(items).toHaveLength(50);
    expect(items[0].modelName).toBe('ThinkPad 50');
    expect(items[49].modelName).toBe('ThinkPad 1');
  });

  it('treats an empty or blank search term like no search term', async () => {
    expect((await search('q=')).json()).toEqual({ items: [MV_A()], total: 1 });
    expect((await search('q=%20%20')).json()).toEqual({ items: [MV_A()], total: 1 });
  });

  it('pages with limit and offset (2.0.1)', async () => {
    expect((await search('limit=1&offset=1')).json()).toEqual({ items: [], total: 1 });
  });

  it.each(['limit=201', 'limit=0', 'offset=-1', 'deviceTypeId=0', 'deviceTypeId=x', 'other=1'])(
    'answers 400 bad_request for the query %s',
    async (query) => {
      const response = await search(query);

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('bad_request');
    },
  );
});

describe('GET /api/model-templates/{id} (CU-109, Technical Specification 2.4)', () => {
  it('returns the model template with the fields of 3.3', async () => {
    const response = await get(`/api/model-templates/${ids.mvA}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: ids.mvA,
      deviceTypeId: ids.notebook,
      manufacturerId: ids.apple,
      modelName: 'MacBook Pro 13',
      typeDesignation: 'A1708',
      mpn: 'MHGT3D/A',
      mpnUnknown: false,
      originalEan: null,
      modelValues: {},
      defaultDeviceValues: {},
      version: 1,
      createdAt: '2026-11-10T08:00:00.000Z',
      updatedAt: '2026-11-10T08:00:00.000Z',
    });
  });

  it('answers 404 not_found for a model template that does not exist', async () => {
    const response = await get('/api/model-templates/999');

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: 'not_found',
      message: 'Dieser Eintrag ist nicht mehr vorhanden.',
    });
  });
});

describe('POST /api/model-templates (CU-109, CU-105, Technical Specification 2.4)', () => {
  const NEW = () => ({
    deviceTypeId: ids.notebook,
    manufacturerId: ids.lenovo,
    modelName: 'ThinkPad E15 Gen 2',
    typeDesignation: '20TD',
    mpn: '20TD002MGE',
    mpnUnknown: false,
    originalEan: '',
    modelValues: {},
    defaultDeviceValues: {},
  });

  const post = (body: unknown) =>
    t.app.inject({
      method: 'POST',
      url: '/api/model-templates',
      headers: SAME_ORIGIN_WRITE,
      payload: JSON.stringify(body),
    });

  const count = () =>
    t.database.sqlite.prepare('SELECT COUNT(*) FROM model_template').pluck().get() as number;

  /** The `fields[]` of a `422 validation_failed` answer, after checking status and format. */
  const fieldsOf = (response: Awaited<ReturnType<typeof post>>) => {
    expect(response.statusCode).toBe(422);
    const { error } = response.json();
    expect(error).toMatchObject({ code: 'validation_failed', message: '', referenceNumber: null });
    return error.fields as { path: string; code: string; message: string }[];
  };

  const MPN_TOO_LONG = 'Herstellernummer: höchstens 40 Zeichen';
  const MPN_INVALID = 'Herstellernummer: nur Buchstaben, Ziffern und die Zeichen - / . erlaubt';

  it('AC-REQ-008-01 stores a model template with all required data, findable through GET /api/model-templates', async () => {
    const response = await post(NEW());

    expect(response.statusCode).toBe(201);
    const created = response.json();
    expect(created).toMatchObject({
      deviceTypeId: ids.notebook,
      manufacturerId: ids.lenovo,
      modelName: 'ThinkPad E15 Gen 2',
      typeDesignation: '20TD',
      mpn: '20TD002MGE',
      mpnUnknown: false,
      originalEan: null,
      modelValues: {},
      defaultDeviceValues: {},
      version: 1,
    });
    const hits = (await search('q=e15%20gen')).json();
    expect(hits.items).toEqual([
      {
        id: created.id,
        deviceType: { id: ids.notebook, name: 'Notebook' },
        manufacturer: { id: ids.lenovo, name: 'Lenovo' },
        modelName: 'ThinkPad E15 Gen 2',
        typeDesignation: '20TD',
        mpn: '20TD002MGE',
        mpnUnknown: false,
      },
    ]);
    expect((await get(`/api/model-templates/${created.id}`)).json()).toEqual(created);
  });

  it('AC-REQ-008-01 writes the audit entry "created" in the same transaction', async () => {
    const created = (await post({ ...NEW(), originalEan: '4006381333931' })).json();

    const entries = t.database.sqlite
      .prepare(
        "SELECT object_category, object_id, object_label, action, old_value, new_value FROM audit_entry WHERE object_type = 'model_template'",
      )
      .all();
    expect(entries).toEqual([
      {
        object_category: 'model_template',
        object_id: created.id,
        object_label: 'Modellvorlage ThinkPad E15 Gen 2',
        action: 'created',
        old_value: null,
        new_value: JSON.stringify({
          Geräteart: 'Notebook',
          Hersteller: 'Lenovo',
          Modellbezeichnung: 'ThinkPad E15 Gen 2',
          Typbezeichnung: '20TD',
          Herstellernummer: '20TD002MGE',
          'Original-EAN': '4006381333931',
        }),
      },
    ]);
  });

  it('stores nothing when the audit entry fails (2.0.4)', async () => {
    t.database.sqlite.exec(
      "CREATE TRIGGER fail_audit BEFORE INSERT ON audit_entry BEGIN SELECT RAISE(ABORT, 'audit'); END",
    );
    const before = count();

    const response = await post(NEW());

    expect(response.statusCode).toBe(500);
    expect(count()).toBe(before);
  });

  it('builds model_name_key and search_key when creating (3.3, 2.4)', async () => {
    const { id } = (await post({ ...NEW(), modelName: 'ThinkPad  E15 Gen 2' })).json();

    expect(
      t.database.sqlite
        .prepare('SELECT model_name_key, search_key FROM model_template WHERE id = ?')
        .get(id),
    ).toEqual({
      model_name_key: 'thinkpade15gen2',
      search_key: 'thinkpad  e15 gen 2\n20td\n20td002mge',
    });
  });

  it('AC-REQ-008-02 rejects an empty MPN without "unbekannt" with "Herstellernummer: Wert eingeben oder ‚unbekannt‘ wählen"', async () => {
    const before = count();

    const fields = fieldsOf(await post({ ...NEW(), mpn: '' }));

    expect(fields).toEqual([
      {
        path: 'mpn',
        code: 'mpn_required',
        message: 'Herstellernummer: Wert eingeben oder ‚unbekannt‘ wählen',
      },
    ]);
    expect(count()).toBe(before);
  });

  it('AC-REQ-008-03 stores a model template with MPN "unbekannt" and returns it as "unbekannt"', async () => {
    const response = await post({ ...NEW(), mpn: null, mpnUnknown: true });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ mpn: null, mpnUnknown: true });
    const hits = (await search('q=e15')).json();
    expect(hits.items[0]).toMatchObject({ mpn: null, mpnUnknown: true });
  });

  it('AC-REQ-008-04 rejects the original EAN "0194252146836" at the field with "EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer"', async () => {
    const fields = fieldsOf(await post({ ...NEW(), originalEan: '0194252146836' }));

    expect(fields).toEqual([
      expect.objectContaining({
        path: 'originalEan',
        message: 'EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer',
      }),
    ]);
  });

  it('DER-50-17 rejects 41 characters with mpn_too_long (M-25)', async () => {
    expect(fieldsOf(await post({ ...NEW(), mpn: 'A'.repeat(41) }))).toEqual([
      { path: 'mpn', code: 'mpn_too_long', message: MPN_TOO_LONG },
    ]);
  });

  it.each(['ABC#123', '6FY52AV#ABD', 'ÄB-12', '20TD 002MGE'])(
    'DER-50-17 rejects "%s" with mpn_invalid_chars (M-26)',
    async (mpn) => {
      expect(fieldsOf(await post({ ...NEW(), mpn }))).toEqual([
        { path: 'mpn', code: 'mpn_invalid_chars', message: MPN_INVALID },
      ]);
    },
  );

  it('DER-50-17 gives only mpn_too_long for 45 characters with "#", and mpn_invalid_chars once cut to 40', async () => {
    const value = `${'A'.repeat(20)}#${'B'.repeat(24)}`;

    expect(fieldsOf(await post({ ...NEW(), mpn: value }))).toEqual([
      { path: 'mpn', code: 'mpn_too_long', message: MPN_TOO_LONG },
    ]);
    expect(fieldsOf(await post({ ...NEW(), mpn: value.slice(0, 40) }))).toEqual([
      { path: 'mpn', code: 'mpn_invalid_chars', message: MPN_INVALID },
    ]);
  });

  it('DER-50-17 stores 40 allowed characters and " 20TD002MGE " as "20TD002MGE"', async () => {
    const forty = await post({ ...NEW(), mpn: 'A'.repeat(40) });
    expect(forty.statusCode).toBe(201);

    const trimmed = await post({ ...NEW(), modelName: 'ThinkPad V15', mpn: ' 20TD002MGE ' });
    expect(trimmed.statusCode).toBe(201);
    expect(trimmed.json().mpn).toBe('20TD002MGE');
  });

  it('rejects "unbekannt" together with a value in mpn with 400 bad_request', async () => {
    const before = count();

    const response = await post({ ...NEW(), mpnUnknown: true });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ code: 'bad_request', referenceNumber: null });
    expect(response.json().error.fields).toEqual([]);
    expect(count()).toBe(before);
  });

  it('rejects "unbekannt" with a value as bad_request even if another field fails as well', async () => {
    const response = await post({ ...NEW(), modelName: '', mpnUnknown: true });

    expect(response.statusCode).toBe(400);
  });

  it('DER-50-04 DER-50-05 DER-50-13 reports every faulty field with one message each', async () => {
    const fields = fieldsOf(
      await post({
        ...NEW(),
        deviceTypeId: null,
        manufacturerId: null,
        modelName: ' ',
        typeDesignation: 'T'.repeat(51),
        mpn: 'A'.repeat(45),
        originalEan: '1234567',
      }),
    );

    expect(fields.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: 'deviceTypeId', message: 'Geräteart fehlt' },
      { path: 'manufacturerId', message: 'Hersteller fehlt' },
      { path: 'modelName', message: 'Modellbezeichnung: 1 bis 100 Zeichen' },
      { path: 'typeDesignation', message: 'Typbezeichnung: höchstens 50 Zeichen' },
      { path: 'mpn', message: MPN_TOO_LONG },
      { path: 'originalEan', message: 'EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer' },
    ]);
  });

  it('T8 rejects deviceTypeId null with 422 validation_failed "Geräteart fehlt", not 400 (Nachtrag MAR-925)', async () => {
    const before = count();

    const fields = fieldsOf(await post({ ...NEW(), deviceTypeId: null }));

    expect(fields).toEqual([
      expect.objectContaining({ path: 'deviceTypeId', message: 'Geräteart fehlt' }),
    ]);
    expect(count()).toBe(before);
  });

  it('T8 rejects a request without deviceTypeId as bad_request (2.0.5)', async () => {
    const withoutDeviceType: Partial<ReturnType<typeof NEW>> = NEW();
    delete withoutDeviceType.deviceTypeId;

    const response = await post(withoutDeviceType);

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ code: 'bad_request', referenceNumber: null });
  });

  it('rejects an id in the request as bad_request (2.4: without id)', async () => {
    expect((await post({ ...NEW(), id: 99 })).statusCode).toBe(400);
  });

  describe('active device type and manufacturer (2.4, 2.0.11, Nachtrag MAR-904)', () => {
    const deactivate = (table: 'device_type' | 'manufacturer', id: number) =>
      t.database.sqlite.prepare(`UPDATE ${table} SET active = 0 WHERE id = ?`).run(id);

    const auditCount = () =>
      t.database.sqlite
        .prepare("SELECT COUNT(*) FROM audit_entry WHERE object_type = 'model_template'")
        .pluck()
        .get() as number;

    it('AC-REQ-004-03 DER-50-18 T1 rejects a deactivated device type with 422 device_type_deactivated at deviceTypeId, stores and logs nothing', async () => {
      deactivate('device_type', ids.monitor);

      const response = await post({ ...NEW(), deviceTypeId: ids.monitor });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toEqual({
        code: 'device_type_deactivated',
        message: 'Geräteart Monitor ist deaktiviert',
        fields: [],
        details: { path: 'deviceTypeId', id: ids.monitor },
        referenceNumber: null,
      });
      expect(count()).toBe(1);
      expect(auditCount()).toBe(0);
    });

    it('AC-REQ-101-02 DER-50-18 T1 rejects a deactivated manufacturer with 422 manufacturer_deactivated at manufacturerId, stores and logs nothing', async () => {
      deactivate('manufacturer', ids.lenovo);

      const response = await post(NEW());

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toEqual({
        code: 'manufacturer_deactivated',
        message: 'Hersteller Lenovo ist deaktiviert',
        fields: [],
        details: { path: 'manufacturerId', id: ids.lenovo },
        referenceNumber: null,
      });
      expect(count()).toBe(1);
      expect(auditCount()).toBe(0);
    });

    it('DER-50-18 T1 reports only device_type_deactivated if device type and manufacturer are deactivated', async () => {
      deactivate('device_type', ids.notebook);
      deactivate('manufacturer', ids.lenovo);

      const response = await post(NEW());

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'device_type_deactivated',
        details: { path: 'deviceTypeId', id: ids.notebook },
      });
      expect(count()).toBe(1);
      expect(auditCount()).toBe(0);
    });

    it.each([
      ['deviceTypeId', { deviceTypeId: 999 }],
      ['manufacturerId', { manufacturerId: 999 }],
    ])(
      'DER-50-19 T2 rejects an unknown %s with 400 bad_request, never 500',
      async (_field, change) => {
        const response = await post({ ...NEW(), ...change });

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toMatchObject({ code: 'bad_request', referenceNumber: null });
        expect(count()).toBe(1);
      },
    );

    it('DER-50-19 T2 rejects an unknown device type before a deactivated manufacturer (existing ids before active entries)', async () => {
      deactivate('manufacturer', ids.lenovo);

      const response = await post({ ...NEW(), deviceTypeId: 999 });

      expect(response.statusCode).toBe(400);
    });

    it('DER-50-19 T3 a field rule wins over a deactivated manufacturer: wrong EAN check digit gives validation_failed', async () => {
      deactivate('manufacturer', ids.lenovo);

      const fields = fieldsOf(await post({ ...NEW(), originalEan: '4006381333932' }));

      expect(fields.map(({ path }) => path)).toEqual(['originalEan']);
      expect(count()).toBe(1);
    });
  });

  describe('attribute values and their pick list values (2.4, 2.5, 2.0.11, Nachtrag MAR-904)', () => {
    /** Attribute ids of the notebook; the order of the attributes differs from their ids. */
    const A = {
      processor: 11,
      display: 12,
      surface: 13,
      ports: 14,
      keyboard: 15,
      ram: 21,
      os: 22,
      deviceKeyboard: 23,
    };
    /** Pick list value ids. */
    const V = { matt: 61, glossy: 62, german: 31, hungarian: 32, win11: 71, usbC: 81, back: 91 };

    beforeEach(() => {
      const { sqlite } = t.database;
      insertPickLists(sqlite);
      const value = sqlite.prepare(
        'INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version) VALUES (?, ?, ?, ?, ?, 1, 1)',
      );
      value.run(V.matt, pickListId('display_surface'), 'matt', 'matt', 1);
      value.run(V.glossy, pickListId('display_surface'), 'glänzend', 'glänzend', 2);
      value.run(V.german, pickListId('keyboard_layout'), 'Deutsch', 'deutsch', 1);
      value.run(V.hungarian, pickListId('keyboard_layout'), 'Ungarisch', 'ungarisch', 2);
      value.run(V.win11, pickListId('operating_system'), 'Windows 11 Pro', 'windows 11 pro', 1);
      value.run(V.usbC, pickListId('port_type'), 'USB-C', 'usb-c', 1);
      value.run(V.back, pickListId('port_position'), 'hinten', 'hinten', 1);
      const attribute = sqlite.prepare(
        `INSERT INTO attribute (id, device_type_id, label, label_key, data_type, system_role, unit,
           unit_spacing, min_value, max_value, pick_list_id, level, variant_forming, required,
           datasheet_block, sort_order, active, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?, ?, 0, ?, 'technical', ?, 1, 1, '', '')`,
      );
      const add = (
        id: number,
        label: string,
        dataType: string,
        level: 'model' | 'device',
        sortOrder: number,
        rule: {
          required?: boolean;
          pickList?: number;
          min?: string;
          max?: string;
          role?: string;
        } = {},
      ) =>
        attribute.run(
          id,
          ids.notebook,
          label,
          label.toLowerCase(),
          dataType,
          rule.role ?? null,
          rule.min ?? null,
          rule.max ?? null,
          rule.pickList ?? null,
          level,
          rule.required ? 1 : 0,
          sortOrder,
        );
      // Keyboard layout comes first in the order of the attributes, though its id is the highest.
      add(A.keyboard, 'Tastaturlayout', 'pick', 'model', 1, {
        pickList: pickListId('keyboard_layout'),
        role: 'keyboard_layout',
      });
      add(A.processor, 'Prozessor', 'text', 'model', 2, { required: true });
      add(A.display, 'Displaygröße', 'decimal', 'model', 3, { min: '10', max: '20' });
      add(A.surface, 'Display-Oberfläche', 'pick', 'model', 4, {
        pickList: pickListId('display_surface'),
      });
      add(A.ports, 'Anschlüsse', 'ports', 'model', 5);
      add(A.ram, 'RAM', 'integer', 'device', 6, { required: true, min: '1', max: '1024' });
      add(A.os, 'Betriebssystem', 'pick', 'device', 7, {
        required: true,
        pickList: pickListId('operating_system'),
      });
      add(A.deviceKeyboard, 'Tastatur Gerät', 'pick', 'device', 8, {
        pickList: pickListId('keyboard_layout'),
      });
    });

    const deactivateValue = (id: number) =>
      t.database.sqlite.prepare('UPDATE pick_list_value SET active = 0 WHERE id = ?').run(id);

    const WITH_VALUES = () => ({
      ...NEW(),
      modelValues: {
        [A.keyboard]: V.german,
        [A.processor]: 'Intel Core i5-1135G7',
        [A.display]: '14,01',
        [A.surface]: V.matt,
        [A.ports]: [{ count: '2', typeId: V.usbC, positionId: V.back }],
      },
      defaultDeviceValues: { [A.ram]: '16', [A.os]: V.win11, [A.deviceKeyboard]: V.german },
    });

    it('stores the attribute values of the level model and the device defaults in their stored form', async () => {
      const response = await post(WITH_VALUES());

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        modelValues: {
          [A.keyboard]: V.german,
          [A.processor]: 'Intel Core i5-1135G7',
          [A.display]: '14.01',
          [A.surface]: V.matt,
          [A.ports]: [{ count: 2, typeId: V.usbC, positionId: V.back }],
        },
        defaultDeviceValues: { [A.ram]: 16, [A.os]: V.win11, [A.deviceKeyboard]: V.german },
      });
      expect(count()).toBe(2);
    });

    it('AC-REQ-008-05 rejects a missing required attribute of the level model and names it, stores nothing', async () => {
      const body = WITH_VALUES();
      body.modelValues[A.processor] = '  ';

      const fields = fieldsOf(await post(body));

      expect(fields).toEqual([
        { path: `modelValues.${A.processor}`, code: 'value_missing', message: 'Prozessor fehlt' },
      ]);
      expect(count()).toBe(1);
    });

    it('DER-50-10 takes the device defaults as optional, so required attributes of the level device may stay empty', async () => {
      const response = await post({ ...WITH_VALUES(), defaultDeviceValues: { [A.ram]: null } });

      expect(response.statusCode).toBe(201);
      expect(response.json().defaultDeviceValues).toEqual({});
    });

    it('DER-50-10 checks the type of a device default and reports it at its field', async () => {
      const fields = fieldsOf(
        await post({ ...WITH_VALUES(), defaultDeviceValues: { [A.ram]: '3 bis 4' } }),
      );

      expect(fields).toEqual([
        {
          path: `defaultDeviceValues.${A.ram}`,
          code: 'value_integer',
          message: 'RAM: ganze Zahl von 1 bis 1024',
        },
      ]);
      expect(count()).toBe(1);
    });

    it('rejects a value of an attribute the device type does not have as bad_request', async () => {
      const response = await post({ ...WITH_VALUES(), defaultDeviceValues: { 999: 'x' } });

      expect(response.statusCode).toBe(400);
    });

    it('DER-50-20 T6 rejects a deactivated pick list value in modelValues with 422 pick_list_value_deactivated at the attribute, stores and logs nothing', async () => {
      deactivateValue(V.matt);

      const response = await post(WITH_VALUES());

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toEqual({
        code: 'pick_list_value_deactivated',
        message: 'Display-Oberfläche: matt ist deaktiviert',
        fields: [],
        details: { path: `modelValues.${A.surface}`, id: V.matt },
        referenceNumber: null,
      });
      expect(count()).toBe(1);
    });

    it('DER-50-20 T6 rejects a deactivated pick list value in defaultDeviceValues with its path', async () => {
      deactivateValue(V.win11);

      const response = await post(WITH_VALUES());

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'pick_list_value_deactivated',
        message: 'Betriebssystem: Windows 11 Pro ist deaktiviert',
        details: { path: `defaultDeviceValues.${A.os}`, id: V.win11 },
      });
      expect(count()).toBe(1);
    });

    it('DER-50-20 T6 rejects a deactivated port type in a value of data type ports', async () => {
      deactivateValue(V.usbC);

      const response = await post(WITH_VALUES());

      expect(response.json().error).toMatchObject({
        code: 'pick_list_value_deactivated',
        message: 'Anschlüsse: USB-C ist deaktiviert',
        details: { path: `modelValues.${A.ports}`, id: V.usbC },
      });
    });

    it('DER-50-20 T6 reports only the hit in modelValues if the same value is deactivated in both objects', async () => {
      deactivateValue(V.german);

      const response = await post(WITH_VALUES());

      expect(response.json().error).toMatchObject({
        code: 'pick_list_value_deactivated',
        message: 'Tastaturlayout: Deutsch ist deaktiviert',
        details: { path: `modelValues.${A.keyboard}`, id: V.german },
      });
    });

    it('DER-50-20 T6 reports of two deactivated values in modelValues the one of the first attribute in their order', async () => {
      deactivateValue(V.matt);
      deactivateValue(V.german);

      const response = await post(WITH_VALUES());

      // Tastaturlayout comes before Display-Oberfläche, though its id is higher.
      expect(response.json().error.details).toEqual({
        path: `modelValues.${A.keyboard}`,
        id: V.german,
      });
    });

    it('DER-50-20 T6 reports only device_type_deactivated if the device type and a pick list value are deactivated', async () => {
      deactivateValue(V.matt);
      t.database.sqlite.prepare('UPDATE device_type SET active = 0 WHERE id = ?').run(ids.notebook);

      const response = await post(WITH_VALUES());

      expect(response.json().error).toMatchObject({
        code: 'device_type_deactivated',
        details: { path: 'deviceTypeId', id: ids.notebook },
      });
      expect(count()).toBe(1);
    });

    it.each([
      ['an unknown pick list value', { [A.surface]: 999 }],
      ['a value of the list of another attribute', { [A.surface]: V.german }],
      [
        'a port type from the list of positions',
        { [A.ports]: [{ count: 1, typeId: V.back, positionId: null }] },
      ],
      [
        'a port position from the list of types',
        { [A.ports]: [{ count: 1, typeId: V.usbC, positionId: V.usbC }] },
      ],
    ])('DER-50-20 T6 rejects %s with 400 bad_request, never 500', async (_case, change) => {
      const body = WITH_VALUES();
      const response = await post({ ...body, modelValues: { ...body.modelValues, ...change } });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatchObject({ code: 'bad_request', referenceNumber: null });
      expect(count()).toBe(1);
    });

    it('DER-50-20 T6 checks existing ids before active entries: an unknown id wins over a deactivated value before it', async () => {
      deactivateValue(V.german);
      const body = WITH_VALUES();

      const response = await post({
        ...body,
        defaultDeviceValues: { ...body.defaultDeviceValues, [A.os]: 999 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('checks the active pick list values before the other attribute rules', async () => {
      deactivateValue(V.matt);
      const body = WITH_VALUES();
      body.modelValues[A.processor] = '';

      const response = await post(body);

      expect(response.json().error.code).toBe('pick_list_value_deactivated');
    });

    it('checks the attribute values before the question about a possible duplicate (2.4 "Prüfreihenfolge")', async () => {
      const likeMvA = { ...WITH_VALUES(), manufacturerId: ids.apple, modelName: 'MacBook Pro 13' };
      deactivateValue(V.matt);
      const deactivated = await post(likeMvA);
      likeMvA.modelValues = { ...likeMvA.modelValues, [A.surface]: V.glossy, [A.processor]: '' };
      const missing = fieldsOf(await post(likeMvA));

      expect(deactivated.json().error.code).toBe('pick_list_value_deactivated');
      expect(missing).toEqual([
        { path: `modelValues.${A.processor}`, code: 'value_missing', message: 'Prozessor fehlt' },
      ]);
      expect(count()).toBe(1);
    });
  });

  describe('possible duplicate (CU-107, 2.4 "Mögliche Dublette", REQ-011)', () => {
    /** MV-A's manufacturer and model name with other spaces and case (AC-REQ-011-01). */
    const LIKE_MV_A = () => ({
      ...NEW(),
      manufacturerId: ids.apple,
      modelName: 'MacBook  pro 13',
      typeDesignation: '',
      mpn: 'MNEH3D/A',
    });

    const MV_A_MATCH = () => ({
      id: ids.mvA,
      manufacturer: { id: ids.apple, name: 'Apple' },
      modelName: 'MacBook Pro 13',
      mpn: 'MHGT3D/A',
    });

    const deactivate = (table: 'device_type' | 'manufacturer', id: number) =>
      t.database.sqlite.prepare(`UPDATE ${table} SET active = 0 WHERE id = ?`).run(id);

    it('AC-REQ-011-01 DER-53-01 answers 422 confirmation_required possible_duplicate with MV-A in details.matches and stores nothing', async () => {
      const response = await post(LIKE_MV_A());

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toEqual({
        code: 'confirmation_required',
        message:
          'Es gibt bereits eine Modellvorlage mit gleichem Hersteller und gleicher Modellbezeichnung.',
        fields: [],
        details: { kind: 'possible_duplicate', matches: [MV_A_MATCH()] },
        referenceNumber: null,
      });
      expect(count()).toBe(1);
    });

    it('AC-REQ-011-01 lists every model template of the same manufacturer and model name key, MPN "unbekannt" as null', async () => {
      const second = insertModelTemplate(t.database.sqlite, {
        deviceTypeId: ids.monitor,
        manufacturerId: ids.apple,
        modelName: 'macbook pro13',
        mpn: null,
      });

      const response = await post(LIKE_MV_A());

      expect(response.json().error.details.matches).toEqual([
        MV_A_MATCH(),
        {
          id: second,
          manufacturer: { id: ids.apple, name: 'Apple' },
          modelName: 'macbook pro13',
          mpn: null,
        },
      ]);
    });

    it('AC-REQ-011-02 stores without a hint when no model template has the same manufacturer and model name', async () => {
      const otherManufacturer = await post({ ...LIKE_MV_A(), manufacturerId: ids.lenovo });
      const otherModelName = await post({ ...LIKE_MV_A(), modelName: 'MacBook Pro 14' });

      expect(otherManufacturer.statusCode).toBe(201);
      expect(otherModelName.statusCode).toBe(201);
      expect(count()).toBe(3);
    });

    it('DER-53-03 stores the model template with confirmDuplicate: true', async () => {
      const response = await post({ ...LIKE_MV_A(), confirmDuplicate: true });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        manufacturerId: ids.apple,
        modelName: 'MacBook  pro 13',
      });
      expect(count()).toBe(2);
    });

    it('still asks with confirmDuplicate: false', async () => {
      const response = await post({ ...LIKE_MV_A(), confirmDuplicate: false });

      expect(response.json().error).toMatchObject({ code: 'confirmation_required' });
      expect(count()).toBe(1);
    });

    it('DER-53-01 a field rule comes before the question: a duplicate with the MPN "ABC#123" gives validation_failed (2.4 "Prüfreihenfolge")', async () => {
      const fields = fieldsOf(await post({ ...LIKE_MV_A(), mpn: 'ABC#123' }));

      expect(fields).toEqual([{ path: 'mpn', code: 'mpn_invalid_chars', message: MPN_INVALID }]);
      expect(count()).toBe(1);
    });

    it('DER-53-04 T3 a deactivated manufacturer comes before the question: manufacturer_deactivated, nothing stored', async () => {
      deactivate('manufacturer', ids.apple);

      const response = await post(LIKE_MV_A());

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'manufacturer_deactivated',
        details: { path: 'manufacturerId', id: ids.apple },
      });
      expect(count()).toBe(1);
    });

    it('DER-53-04 T3 a deactivated device type comes before the question: device_type_deactivated, nothing stored', async () => {
      deactivate('device_type', ids.notebook);

      const response = await post(LIKE_MV_A());

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'device_type_deactivated',
        details: { path: 'deviceTypeId', id: ids.notebook },
      });
      expect(count()).toBe(1);
    });

    it('rejects confirmDuplicate that is not a boolean as bad_request', async () => {
      expect((await post({ ...LIKE_MV_A(), confirmDuplicate: 'yes' })).statusCode).toBe(400);
    });
  });
});
