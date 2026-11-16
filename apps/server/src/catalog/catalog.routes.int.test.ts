import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  insertDeviceType,
  insertManufacturer,
  insertModelTemplate,
} from '../../test/model-templates.ts';
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
        manufacturerId: null,
        modelName: ' ',
        typeDesignation: 'T'.repeat(51),
        mpn: 'A'.repeat(45),
        originalEan: '1234567',
      }),
    );

    expect(fields.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: 'manufacturerId', message: 'Hersteller fehlt' },
      { path: 'modelName', message: 'Modellbezeichnung: 1 bis 100 Zeichen' },
      { path: 'typeDesignation', message: 'Typbezeichnung: höchstens 50 Zeichen' },
      { path: 'mpn', message: MPN_TOO_LONG },
      { path: 'originalEan', message: 'EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer' },
    ]);
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

    it('T1 AC-REQ-004-03 rejects a deactivated device type with 422 device_type_deactivated at deviceTypeId, stores and logs nothing', async () => {
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

    it('T1 AC-REQ-101-02 rejects a deactivated manufacturer with 422 manufacturer_deactivated at manufacturerId, stores and logs nothing', async () => {
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

    it('T1 reports only device_type_deactivated if device type and manufacturer are deactivated', async () => {
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
    ])('T2 rejects an unknown %s with 400 bad_request, never 500', async (_field, change) => {
      const response = await post({ ...NEW(), ...change });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatchObject({ code: 'bad_request', referenceNumber: null });
      expect(count()).toBe(1);
    });

    it('T2 rejects an unknown device type before a deactivated manufacturer (existing ids before active entries)', async () => {
      deactivate('manufacturer', ids.lenovo);

      const response = await post({ ...NEW(), deviceTypeId: 999 });

      expect(response.statusCode).toBe(400);
    });

    it('T3 a field rule wins over a deactivated manufacturer: wrong EAN check digit gives validation_failed', async () => {
      deactivate('manufacturer', ids.lenovo);

      const fields = fieldsOf(await post({ ...NEW(), originalEan: '4006381333932' }));

      expect(fields.map(({ path }) => path)).toEqual(['originalEan']);
      expect(count()).toBe(1);
    });
  });
});
