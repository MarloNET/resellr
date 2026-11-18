import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  // Schema and initial settings: the layout starts with the "Startbelegung" (#150, 2.2).
  await runMigrations(t.database, migrations, () => new Date());
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const read = () =>
  t.app.inject({ method: 'GET', url: '/api/datasheet-layout', headers: { host: HOST } });

const put = (body: Record<string, unknown>) =>
  t.app.inject({
    method: 'PUT',
    url: '/api/datasheet-layout',
    headers: SAME_ORIGIN_WRITE,
    payload: body,
  });

const storedRow = () =>
  t.database.sqlite
    .prepare('SELECT header_labels, block_order, attribute_order, version FROM datasheet_layout')
    .get();

const auditRows = () =>
  t.database.sqlite
    .prepare(
      "SELECT action, object_id, object_label, old_value, new_value FROM audit_entry WHERE object_type = 'datasheet_layout' ORDER BY id",
    )
    .all();

const notebookId = () =>
  t.database.sqlite
    .prepare("SELECT id FROM device_type WHERE name = 'Notebook'")
    .pluck()
    .get() as number;

const INITIAL_BLOCKS = [
  'identification',
  'condition',
  'delivery_scope',
  'technical',
  'ports',
  'software',
];

describe('datasheet layout API (CU-087, CU-085, Technical Specification 2.2)', () => {
  it('reads the initial layout with the header labels of the initial settings', async () => {
    const response = await read();

    expect(response.statusCode).toBe(200);
    const layout = response.json();
    expect(layout).toMatchObject({
      headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:'],
      blockOrder: INITIAL_BLOCKS,
      version: 1,
    });
    expect(Object.keys(layout.attributeOrder)).toContain(String(notebookId()));
  });

  it('DER-85-01 PUT stores header labels, block order and attribute order of a device type', async () => {
    const before = (await read()).json();
    const key = String(notebookId());
    const reversed = [...before.attributeOrder[key]].reverse();
    const blockOrder = [
      'identification',
      'condition',
      'delivery_scope',
      'ports',
      'technical',
      'software',
    ];

    const response = await put({
      version: 1,
      headerLabels: ['Shop:', 'Ebay-Nr.:', 'Kleinanzeigen:'],
      blockOrder,
      attributeOrder: { [key]: reversed },
    });

    expect(response.statusCode).toBe(200);
    const expected = {
      headerLabels: ['Shop:', 'Ebay-Nr.:', 'Kleinanzeigen:'],
      blockOrder,
      attributeOrder: { ...before.attributeOrder, [key]: reversed },
      version: 2,
    };
    expect(response.json()).toEqual(expected);
    expect((await read()).json()).toEqual(expected);
    expect(storedRow()).toMatchObject({
      header_labels: JSON.stringify(expected.headerLabels),
      block_order: JSON.stringify(blockOrder),
      version: 2,
    });

    const [entry, ...more] = auditRows() as Record<string, unknown>[];
    expect(more).toEqual([]);
    expect(entry).toMatchObject({
      action: 'updated',
      object_id: 1,
      object_label: 'Datenblatt-Layout',
    });
    const oldValue = JSON.parse(entry?.old_value as string);
    const newValue = JSON.parse(entry?.new_value as string);
    expect(oldValue.Kopfzeilentexte).toEqual(['Shop:', 'eBay:', 'Kleinanzeigen:']);
    expect(newValue.Kopfzeilentexte).toEqual(['Shop:', 'Ebay-Nr.:', 'Kleinanzeigen:']);
    expect(newValue.Blockreihenfolge).toEqual([
      'Identifikation',
      'Zustand',
      'Lieferumfang',
      'Anschlüsse',
      'Technik',
      'Software',
    ]);
    expect(newValue['Merkmalsreihenfolge Notebook']).toEqual(
      [...oldValue['Merkmalsreihenfolge Notebook']].reverse(),
    );
  });

  it('DER-85-02 a header label with 51 characters is rejected with 422 validation_failed and nothing is stored', async () => {
    const before = storedRow();

    const response = await put({
      version: 1,
      headerLabels: ['Shop:', 'a'.repeat(51), 'Kleinanzeigen:'],
      blockOrder: INITIAL_BLOCKS,
      attributeOrder: {},
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: {
        code: 'validation_failed',
        fields: [{ path: 'headerLabels.1', message: 'Kopfzeilentext: höchstens 50 Zeichen' }],
      },
    });
    expect(storedRow()).toEqual(before);
    expect(auditRows()).toEqual([]);
  });

  it('DER-85-09 PUT with an outdated version answers 409 version_conflict and stores nothing', async () => {
    expect(
      (
        await put({
          version: 1,
          headerLabels: ['Shop:', 'eBay:', 'Kasse:'],
          blockOrder: INITIAL_BLOCKS,
          attributeOrder: {},
        })
      ).statusCode,
    ).toBe(200);
    const before = storedRow();

    const response = await put({
      version: 1,
      headerLabels: ['Webshop:', 'eBay:', 'Kleinanzeigen:'],
      blockOrder: INITIAL_BLOCKS,
      attributeOrder: {},
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'version_conflict' } });
    expect(storedRow()).toEqual(before);
    expect(auditRows()).toHaveLength(1);
  });

  it('answers 409 version_conflict if an attribute order misses an attribute of its device type', async () => {
    const key = String(notebookId());
    const order: number[] = (await read()).json().attributeOrder[key];

    const response = await put({
      version: 1,
      headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:'],
      blockOrder: INITIAL_BLOCKS,
      attributeOrder: { [key]: order.slice(1) },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'version_conflict' } });
    expect(auditRows()).toEqual([]);
  });

  it.each([
    ['a block twice', { blockOrder: [...INITIAL_BLOCKS.slice(0, 5), 'identification'] }],
    ['five blocks', { blockOrder: INITIAL_BLOCKS.slice(0, 5) }],
    ['an unknown device type', { attributeOrder: { '9999': [] } }],
    ['two header labels', { headerLabels: ['Shop:', 'eBay:'] }],
    ['four header labels', { headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:', 'Kasse:'] }],
  ])('answers 400 bad_request for %s and stores nothing', async (_case, change) => {
    const before = storedRow();

    const response = await put({
      version: 1,
      headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:'],
      blockOrder: INITIAL_BLOCKS,
      attributeOrder: {},
      ...change,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'bad_request' } });
    expect(storedRow()).toEqual(before);
    expect(auditRows()).toEqual([]);
  });

  it('stores and logs nothing without a change', async () => {
    const layout = (await read()).json();

    const response = await put(layout);

    expect(response.statusCode).toBe(200);
    expect(response.json().version).toBe(1);
    expect(auditRows()).toEqual([]);
  });
});
