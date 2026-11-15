import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  insertDeviceType,
  insertManufacturer,
  insertModelTemplate,
} from '../../test/model-templates.ts';
import { createTestApp, HOST } from '../../test/test-app.ts';
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
