import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { logoUpload, multipart, sha256, testImages } from '../../test/images.ts';
import { insertPickLists, PICK_LISTS, pickListId } from '../../test/pick-lists.ts';
import { createTestApp, HOST, ORIGIN, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
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

const list = () =>
  t.app.inject({ method: 'GET', url: '/api/device-types', headers: { host: HOST } });

const create = (body: Record<string, unknown>) =>
  t.app.inject({
    method: 'POST',
    url: '/api/device-types',
    headers: SAME_ORIGIN_WRITE,
    payload: body,
  });

const patch = (id: number, body: Record<string, unknown>) =>
  t.app.inject({
    method: 'PATCH',
    url: `/api/device-types/${id}`,
    headers: SAME_ORIGIN_WRITE,
    payload: body,
  });

const auditRows = () =>
  t.database.sqlite
    .prepare(
      "SELECT action, object_label, old_value, new_value FROM audit_entry WHERE object_type = 'device_type' ORDER BY id",
    )
    .all();

const createNotebook = async () => (await create({ name: 'Notebook', active: true })).json();

describe('device type API (CU-087, Technical Specification 2.1)', () => {
  it('AC-REQ-004-01 a new device type "Monitor" is available as active through GET /api/device-types', async () => {
    const created = await create({ name: 'Monitor', active: true });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({
      id: expect.any(Number),
      name: 'Monitor',
      active: true,
      version: 1,
      attributeCount: 0,
    });
    const response = await list();
    expect(response.statusCode).toBe(200);
    const available = response.json().items.filter((item: { active: boolean }) => item.active);
    expect(available.map((item: { name: string }) => item.name)).toEqual(['Monitor']);
  });

  it('AC-REQ-004-02 a second device type "notebook" is rejected with name_taken "Name ist bereits vergeben"', async () => {
    await createNotebook();

    const response = await create({ name: 'notebook', active: true });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'name_taken',
        message: 'Name ist bereits vergeben',
        fields: [],
        details: {},
        referenceNumber: null,
      },
    });
    expect((await list()).json().total).toBe(1);
  });

  it('AC-REQ-004-03 a deactivated device type is no longer in the choice for new model templates', async () => {
    const notebook = await createNotebook();
    await create({ name: 'Monitor', active: true });

    const response = await patch(notebook.id, { version: 1, active: false });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: notebook.id, active: false, version: 2 });
    const items: { name: string; active: boolean }[] = (await list()).json().items;
    // The choice of UI-007 offers the active device types (#50); the deactivated one stays listed.
    expect(items.filter((item) => item.active).map((item) => item.name)).toEqual(['Monitor']);
    expect(items.map((item) => item.name)).toEqual(['Notebook', 'Monitor']);
  });

  it('AC-REQ-004-04 DER-33-09 there is no DELETE route for device types, deactivating is possible', async () => {
    const notebook = await createNotebook();

    const response = await t.app.inject({
      method: 'DELETE',
      url: `/api/device-types/${notebook.id}`,
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });

    expect(response.statusCode).toBe(404);
    expect(t.app.hasRoute({ method: 'DELETE', url: '/api/device-types/:id' })).toBe(false);
    expect((await list()).json().items).toEqual([notebook]);
    expect((await patch(notebook.id, { version: 1, active: false })).statusCode).toBe(200);
  });

  it('trims the name and keeps the order of creation', async () => {
    await create({ name: '  Tablet ', active: false });
    await create({ name: 'PC/Mini-PC', active: true });

    expect((await list()).json()).toEqual({
      items: [
        { id: 1, name: 'Tablet', active: false, version: 1, attributeCount: 0 },
        { id: 2, name: 'PC/Mini-PC', active: true, version: 1, attributeCount: 0 },
      ],
      total: 2,
    });
  });

  it('pages the list with limit and offset (2.0.1)', async () => {
    for (const name of ['A', 'B', 'C']) await create({ name, active: true });

    const response = await t.app.inject({
      method: 'GET',
      url: '/api/device-types?limit=1&offset=1',
      headers: { host: HOST },
    });

    expect(response.json()).toMatchObject({ items: [{ name: 'B' }], total: 3 });
  });

  it.each([
    ['empty', ''],
    ['51 characters', 'x'.repeat(51)],
  ])(
    'DER-33-06 rejects a name that is %s with validation_failed at the field "name"',
    async (_case, name) => {
      const response = await create({ name, active: true });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toEqual({
        code: 'validation_failed',
        message: '',
        fields: [{ path: 'name', code: expect.any(String), message: 'Name: 1 bis 50 Zeichen' }],
        details: {},
        referenceNumber: null,
      });
    },
  );

  it('renames a device type with a new version and an audit entry', async () => {
    const notebook = await createNotebook();

    const response = await patch(notebook.id, { version: 1, name: 'Laptop' });

    expect(response.json()).toEqual({ ...notebook, name: 'Laptop', version: 2 });
    expect(auditRows()).toEqual([
      {
        action: 'created',
        object_label: 'Geräteart Notebook',
        old_value: null,
        new_value: JSON.stringify({ Name: 'Notebook', Status: 'aktiv' }),
      },
      {
        action: 'updated',
        object_label: 'Geräteart Laptop',
        old_value: JSON.stringify({ Name: 'Notebook' }),
        new_value: JSON.stringify({ Name: 'Laptop' }),
      },
    ]);
  });

  it('DER-33-12 the answer to a rename holds no counts', async () => {
    const notebook = await createNotebook();

    const response = await patch(notebook.id, { version: 1, name: 'Laptop' });

    expect(Object.keys(response.json()).sort()).toEqual([
      'active',
      'attributeCount',
      'id',
      'name',
      'version',
    ]);
  });

  it('allows renaming to another spelling of the own name', async () => {
    const notebook = await createNotebook();

    const response = await patch(notebook.id, { version: 1, name: 'NoteBook' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: 'NoteBook', version: 2 });
  });

  it('rejects renaming to the name of another device type with name_taken', async () => {
    await createNotebook();
    const monitor = (await create({ name: 'Monitor', active: true })).json();

    const response = await patch(monitor.id, { version: 1, name: ' NOTEBOOK ' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'name_taken',
      message: 'Name ist bereits vergeben',
    });
    expect((await list()).json().items[1]).toEqual(monitor);
  });

  it('DER-33-08 rejects an outdated version with 409 version_conflict and changes nothing', async () => {
    const notebook = await createNotebook();
    await patch(notebook.id, { version: 1, name: 'Laptop' });

    const response = await patch(notebook.id, { version: 1, active: false });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('version_conflict');
    expect((await list()).json().items[0]).toMatchObject({
      name: 'Laptop',
      active: true,
      version: 2,
    });
  });

  it('answers 404 not_found for a device type that does not exist', async () => {
    const response = await patch(99, { version: 1, active: false });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: 'not_found',
      message: 'Dieser Eintrag ist nicht mehr vorhanden.',
    });
  });

  it('writes activated and deactivated to the audit log', async () => {
    const notebook = await createNotebook();
    await patch(notebook.id, { version: 1, active: false });
    await patch(notebook.id, { version: 2, active: true });

    expect(auditRows().slice(1)).toEqual([
      {
        action: 'deactivated',
        object_label: 'Geräteart Notebook',
        old_value: JSON.stringify({ Status: 'aktiv' }),
        new_value: JSON.stringify({ Status: 'deaktiviert' }),
      },
      {
        action: 'activated',
        object_label: 'Geräteart Notebook',
        old_value: JSON.stringify({ Status: 'deaktiviert' }),
        new_value: JSON.stringify({ Status: 'aktiv' }),
      },
    ]);
  });

  it('keeps the version and writes nothing when nothing changes', async () => {
    const notebook = await createNotebook();

    const response = await patch(notebook.id, { version: 1, name: 'Notebook', active: true });

    expect(response.json()).toEqual(notebook);
    expect(auditRows()).toHaveLength(1);
  });

  it('DER-33-10 a technical error answers 500 with a reference number that is in the error log and stores nothing', async () => {
    // Without the audit table the audit entry fails: nothing may be stored (2.0.4).
    t.database.sqlite.exec('DROP TABLE audit_entry');

    const response = await create({ name: 'Monitor', active: true });

    expect(response.statusCode).toBe(500);
    const { referenceNumber } = response.json().error;
    expect(referenceNumber).toMatch(/^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(t.readErrorLog()).toEqual([
      expect.objectContaining({ refNo: referenceNumber, function: 'http POST /api/device-types' }),
    ]);
    expect((await list()).json().total).toBe(0);
  });

  it.each([
    ['a missing field', { name: 'Monitor' }],
    ['an unknown field', { name: 'Monitor', active: true, sortOrder: 3 }],
    ['a wrong type', { name: 'Monitor', active: 'ja' }],
  ])('answers 400 bad_request for %s (program error of the UI)', async (_case, body) => {
    const response = await create(body);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
  });

  it('answers 400 bad_request for an id that is not a number', async () => {
    const response = await patch(Number.NaN, { version: 1 });

    expect(response.statusCode).toBe(400);
  });
});

const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });

const write = (method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, body: unknown) =>
  t.app.inject({ method, url, headers: SAME_ORIGIN_WRITE, payload: body as object });

const values = (listId: number) => get(`/api/pick-lists/${listId}/values`);
const createValue = (listId: number, body: Record<string, unknown>) =>
  write('POST', `/api/pick-lists/${listId}/values`, body);
const patchValue = (id: number, body: Record<string, unknown>) =>
  write('PATCH', `/api/pick-list-values/${id}`, body);
const putOrder = (listId: number, body: Record<string, unknown>) =>
  write('PUT', `/api/pick-lists/${listId}/value-order`, body);

const labelsOf = (response: { json: () => { items: { label: string }[] } }) =>
  response.json().items.map((item) => item.label);

const errorOf = (code: string, message: string, fields: unknown[] = []) => ({
  error: { code, message, fields, details: {}, referenceNumber: null },
});

const KEYBOARD = pickListId('keyboard_layout');
const CONDITION = pickListId('condition');
const BATTERY = pickListId('battery');

describe('pick list API (CU-087, Technical Specification 2.1)', () => {
  it('AC-REQ-007-01 the value "Ungarisch (QWERTZ)" of the list Tastaturlayout is then available as an active value', async () => {
    await createValue(KEYBOARD, { label: 'Deutsch (QWERTZ)', active: true });

    const created = await createValue(KEYBOARD, { label: 'Ungarisch (QWERTZ)', active: true });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({
      id: expect.any(Number),
      label: 'Ungarisch (QWERTZ)',
      active: true,
      batteryPresent: null,
      sortOrder: 2,
      version: 1,
    });
    const response = await values(KEYBOARD);
    expect(response.statusCode).toBe(200);
    const active = response.json().items.filter((item: { active: boolean }) => item.active);
    expect(active.map((item: { label: string }) => item.label)).toEqual([
      'Deutsch (QWERTZ)',
      'Ungarisch (QWERTZ)',
    ]);
  });

  it('AC-REQ-007-02 "GEBRAUCHT" beside "gebraucht" is rejected with "Wert gibt es in dieser Liste bereits"', async () => {
    await createValue(CONDITION, { label: 'gebraucht', active: true });

    const response = await createValue(CONDITION, { label: 'GEBRAUCHT', active: true });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual(errorOf('name_taken', 'Wert gibt es in dieser Liste bereits'));
    expect(labelsOf(await values(CONDITION))).toEqual(['gebraucht']);
  });

  it('AC-REQ-007-02 renaming to a value of the list in another case is rejected as well', async () => {
    await createValue(CONDITION, { label: 'gebraucht', active: true });
    const other = (await createValue(CONDITION, { label: 'neu', active: true })).json();

    const response = await patchValue(other.id, { version: 1, label: ' Gebraucht ' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.message).toBe('Wert gibt es in dieser Liste bereits');
  });

  it('allows the same value in another list and a change of case of the own value', async () => {
    const own = (await createValue(CONDITION, { label: 'neu', active: true })).json();

    expect((await createValue(KEYBOARD, { label: 'neu', active: true })).statusCode).toBe(201);
    const renamed = await patchValue(own.id, { version: 1, label: 'Neu' });

    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toMatchObject({ label: 'Neu', version: 2 });
  });

  it('DER-35-09 lists exactly the nine pick lists and has no route to create or delete a list or a value', async () => {
    const response = await get('/api/pick-lists');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: PICK_LISTS.map(({ key, name }, index) => ({
        id: index + 1,
        key,
        name,
        isBatteryList: key === 'battery',
        version: 1,
      })),
      total: 9,
    });
    for (const [method, url] of [
      ['POST', '/api/pick-lists'],
      ['DELETE', '/api/pick-lists/:id'],
      ['PATCH', '/api/pick-lists/:id'],
      ['DELETE', '/api/pick-list-values/:id'],
    ] as const) {
      expect(t.app.hasRoute({ method, url }), `${method} ${url}`).toBe(false);
    }
    const created = await write('POST', '/api/pick-lists', { key: 'color', name: 'Farbe' });
    expect(created.statusCode).toBe(404);
    expect((await get('/api/pick-lists')).json().total).toBe(9);
  });

  it('DER-35-10 a value of the list Akku without "Akku vorhanden" is rejected at the field', async () => {
    for (const body of [
      { label: 'mit Akku', active: true },
      { label: 'mit Akku', active: true, batteryPresent: null },
    ]) {
      const response = await createValue(BATTERY, body);

      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual(
        errorOf('validation_failed', '', [
          {
            path: 'batteryPresent',
            code: 'battery_present_missing',
            message: 'Kennzeichen ‚Akku vorhanden‘ fehlt',
          },
        ]),
      );
    }
    expect((await values(BATTERY)).json().items).toEqual([]);
  });

  it('DER-35-10 stores "Akku vorhanden" in the list Akku and keeps batteryPresent empty in every other list', async () => {
    const battery = await createValue(BATTERY, {
      label: 'mit Akku (defekt)',
      active: true,
      batteryPresent: true,
    });
    const other = await createValue(KEYBOARD, {
      label: 'Englisch (QWERTY)',
      active: true,
      batteryPresent: true,
    });

    expect(battery.json()).toMatchObject({ batteryPresent: true });
    expect(other.json()).toMatchObject({ batteryPresent: null });
    const cleared = await patchValue(battery.json().id, { version: 1, batteryPresent: null });
    expect(cleared.statusCode).toBe(422);
    expect(cleared.json().error.fields[0].message).toBe('Kennzeichen ‚Akku vorhanden‘ fehlt');
    const changed = await patchValue(battery.json().id, { version: 1, batteryPresent: false });
    expect(changed.json()).toMatchObject({ batteryPresent: false, version: 2 });
  });

  it('rejects an empty value with the field text and trims the value', async () => {
    const empty = await createValue(CONDITION, { label: '   ', active: true });

    expect(empty.statusCode).toBe(422);
    expect(empty.json()).toEqual(
      errorOf('validation_failed', '', [
        { path: 'label', code: 'too_small', message: 'Wert: 1 bis 100 Zeichen' },
      ]),
    );
    const trimmed = await createValue(CONDITION, { label: '  gebraucht ', active: true });
    expect(trimmed.json().label).toBe('gebraucht');
  });

  it('DER-35-08 PUT value-order stores the new order and answers with the list in its new version', async () => {
    const ids = [];
    for (const label of ['Deutsch (QWERTZ)', 'Englisch (QWERTY)', 'Ungarisch (QWERTZ)']) {
      ids.push((await createValue(KEYBOARD, { label, active: true })).json().id);
    }

    const response = await putOrder(KEYBOARD, { version: 1, valueIds: [ids[2], ids[0], ids[1]] });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: KEYBOARD,
      key: 'keyboard_layout',
      name: 'Tastaturlayout',
      isBatteryList: false,
      version: 2,
    });
    const stored = (await values(KEYBOARD)).json().items;
    expect(
      stored.map((item: { label: string; sortOrder: number }) => [item.label, item.sortOrder]),
    ).toEqual([
      ['Ungarisch (QWERTZ)', 1],
      ['Deutsch (QWERTZ)', 2],
      ['Englisch (QWERTY)', 3],
    ]);
  });

  it('DER-35-06 (a) answers 409 version_conflict to an outdated version and changes nothing', async () => {
    const value = (await createValue(CONDITION, { label: 'gebraucht', active: true })).json();
    const other = (await createValue(CONDITION, { label: 'neu', active: true })).json();
    await patchValue(value.id, { version: 1, label: 'benutzt' });

    const stalePatch = await patchValue(value.id, { version: 1, active: false });
    await putOrder(CONDITION, { version: 1, valueIds: [other.id, value.id] });
    const staleOrder = await putOrder(CONDITION, { version: 1, valueIds: [value.id, other.id] });

    expect(stalePatch.statusCode).toBe(409);
    expect(stalePatch.json().error.code).toBe('version_conflict');
    expect(staleOrder.statusCode).toBe(409);
    expect(labelsOf(await values(CONDITION))).toEqual(['neu', 'benutzt']);
    expect((await values(CONDITION)).json().items[1]).toMatchObject({ active: true, version: 2 });
  });

  it('answers 409 to an order that misses a value another window has added meanwhile', async () => {
    const first = (await createValue(CONDITION, { label: 'gebraucht', active: true })).json();
    const second = (await createValue(CONDITION, { label: 'neu', active: true })).json();
    await createValue(CONDITION, { label: 'defekt', active: true });

    const response = await putOrder(CONDITION, { version: 1, valueIds: [second.id, first.id] });

    expect(response.statusCode).toBe(409);
    expect(labelsOf(await values(CONDITION))).toEqual(['gebraucht', 'neu', 'defekt']);
  });

  it('answers 404 not_found for an unknown list or value', async () => {
    expect((await values(99)).statusCode).toBe(404);
    expect((await createValue(99, { label: 'x', active: true })).statusCode).toBe(404);
    const missing = await patchValue(99, { version: 1, active: false });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.message).toBe('Dieser Eintrag ist nicht mehr vorhanden.');
  });

  it('writes an audit entry for each stored change', async () => {
    const value = (await createValue(CONDITION, { label: 'gebraucht', active: true })).json();
    await patchValue(value.id, { version: 1, active: false });

    const actions = t.database.sqlite
      .prepare("SELECT action FROM audit_entry WHERE object_type = 'pick_list_value' ORDER BY id")
      .pluck()
      .all();
    expect(actions).toEqual(['created', 'deactivated']);
  });
});

describe('supplier API (CU-087, Technical Specification 2.2)', () => {
  const list = (query = '') =>
    t.app.inject({ method: 'GET', url: `/api/suppliers${query}`, headers: { host: HOST } });

  const listAll = () => list('?includeInactive=true');

  const create = (body: Record<string, unknown>) =>
    t.app.inject({
      method: 'POST',
      url: '/api/suppliers',
      headers: SAME_ORIGIN_WRITE,
      payload: body,
    });

  const patch = (id: number, body: Record<string, unknown>) =>
    t.app.inject({
      method: 'PATCH',
      url: `/api/suppliers/${id}`,
      headers: SAME_ORIGIN_WRITE,
      payload: body,
    });

  const auditRows = () =>
    t.database.sqlite
      .prepare(
        "SELECT action, object_id, object_label, old_value, new_value FROM audit_entry WHERE object_type = 'supplier' ORDER BY id",
      )
      .all();

  const names = (items: { name: string }[]) => items.map((item) => item.name);

  const createL1 = async () => (await create({ name: 'L1', active: true })).json();

  /**
   * A device of supplier `supplierId` with the rows it refers to. Devices are captured from S4 on
   * (#54); until then the test writes the rows directly, as the schema of S1 allows.
   */
  function insertDevice(supplierId: number) {
    const at = '2026-11-11T08:00:00.000Z';
    t.database.sqlite.exec(`
      INSERT INTO device_type (id, name, name_key, active, sort_order, version, created_at, updated_at)
        VALUES (1, 'Notebook', 'notebook', 1, 1, 1, '${at}', '${at}');
      INSERT INTO manufacturer (id, name, name_key, active, gpsr_complete, version, created_at, updated_at)
        VALUES (1, 'Lenovo', 'lenovo', 1, 0, 1, '${at}', '${at}');
      INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version)
        VALUES (1, ${CONDITION}, 'Gebraucht', 'gebraucht', 1, 1, 1);
      INSERT INTO model_template (id, device_type_id, manufacturer_id, model_name, model_name_key,
          mpn_unknown, model_values, default_device_values, search_key, import_review_pending,
          import_review_keys, version, created_at, updated_at)
        VALUES (1, 1, 1, 'T14', 't14', 1, '{}', '{}', 'lenovo t14', 0, '[]', 1, '${at}', '${at}');
    `);
    t.database.sqlite
      .prepare(
        `INSERT INTO device (wi_nr, wi_nr_key, model_template_id, supplier_id, condition_value_id,
           visual_grade, condition_description, device_values, review_keys, capture_status,
           stock_status, captured_at, captured_on, version, updated_at)
         VALUES ('626198', '626198', 1, ?, 1, 2, '', '{}', '[]', 'checked', 'available', ?,
           '2026-11-11', 1, ?)`,
      )
      .run(supplierId, at, at);
  }

  it('AC-REQ-099-01 a new supplier "L1" is available as active through GET /api/suppliers', async () => {
    const created = await create({ name: 'L1', active: true });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({
      id: expect.any(Number),
      name: 'L1',
      active: true,
      version: 1,
    });
    const response = await list();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [created.json()], total: 1 });
  });

  it('AC-REQ-099-02 a second supplier "l1" is rejected with name_taken "Name ist bereits vergeben"', async () => {
    await createL1();

    const response = await create({ name: 'l1', active: true });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'name_taken',
        message: 'Name ist bereits vergeben',
        fields: [],
        details: {},
        referenceNumber: null,
      },
    });
    expect((await listAll()).json().total).toBe(1);
  });

  it('AC-REQ-099-02 renaming to the name of another supplier in other case is rejected as well', async () => {
    await createL1();
    const l2 = (await create({ name: 'L2', active: false })).json();

    const response = await patch(l2.id, { version: 1, name: ' l1 ' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('name_taken');
    expect(names((await listAll()).json().items)).toEqual(['L1', 'L2']);
  });

  it('AC-REQ-099-03 a deactivated supplier stays at its devices and is no longer in the choice for new entries', async () => {
    const l1 = await createL1();
    await create({ name: 'L2', active: true });
    insertDevice(l1.id);

    const response = await patch(l1.id, { version: 1, active: false });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: l1.id, name: 'L1', active: false, version: 2 });
    expect(t.database.sqlite.prepare('SELECT supplier_id FROM device').pluck().all()).toEqual([
      l1.id,
    ]);
    // The choice for new devices and condition codes (#54, #160) reads the active suppliers.
    expect(names((await list()).json().items)).toEqual(['L2']);
    // UI-032 keeps listing it with its status.
    expect((await listAll()).json().items).toEqual([
      { id: l1.id, name: 'L1', active: false, version: 2 },
      expect.objectContaining({ name: 'L2', active: true }),
    ]);
  });

  it('DER-36-08 there is no DELETE route for suppliers, deactivating is possible', async () => {
    const l1 = await createL1();

    const response = await t.app.inject({
      method: 'DELETE',
      url: `/api/suppliers/${l1.id}`,
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });

    expect(response.statusCode).toBe(404);
    expect(t.app.hasRoute({ method: 'DELETE', url: '/api/suppliers/:id' })).toBe(false);
    expect((await listAll()).json().items).toEqual([l1]);
    expect((await patch(l1.id, { version: 1, active: false })).statusCode).toBe(200);
  });

  it('trims the name and lists the suppliers by name without regard to case', async () => {
    await create({ name: '  zeta ', active: true });
    await create({ name: 'Alpha', active: false });
    await create({ name: 'beta', active: true });

    expect((await listAll()).json()).toEqual({
      items: [
        { id: 2, name: 'Alpha', active: false, version: 1 },
        { id: 3, name: 'beta', active: true, version: 1 },
        { id: 1, name: 'zeta', active: true, version: 1 },
      ],
      total: 3,
    });
    expect((await list()).json().total).toBe(2);
  });

  it('pages the list with limit and offset (2.0.1)', async () => {
    for (const name of ['A', 'B', 'C']) await create({ name, active: true });

    const response = await list('?limit=1&offset=1');

    expect(response.json()).toMatchObject({ items: [{ name: 'B' }], total: 3 });
  });

  it('rejects an unknown value of includeInactive as bad_request', async () => {
    expect((await list('?includeInactive=yes')).statusCode).toBe(400);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['101 characters', 'x'.repeat(101)],
  ])(
    'DER-36-05 rejects a name that is %s with validation_failed "Name: 1 bis 100 Zeichen" at the field',
    async (_case, name) => {
      const response = await create({ name, active: true });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toEqual({
        code: 'validation_failed',
        message: '',
        fields: [{ path: 'name', code: expect.any(String), message: 'Name: 1 bis 100 Zeichen' }],
        details: {},
        referenceNumber: null,
      });
      expect((await listAll()).json().total).toBe(0);
    },
  );

  it('DER-36-05 accepts a name of 100 characters', async () => {
    expect((await create({ name: 'x'.repeat(100), active: true })).statusCode).toBe(201);
  });

  it('DER-36-05 rejects an empty name on rename with validation_failed', async () => {
    const l1 = await createL1();

    const response = await patch(l1.id, { version: 1, name: '' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      { path: 'name', code: expect.any(String), message: 'Name: 1 bis 100 Zeichen' },
    ]);
  });

  it('DER-36-06 (a) rejects a change with an outdated version with 409 version_conflict and changes nothing', async () => {
    const l1 = await createL1();
    await patch(l1.id, { version: 1, name: 'L1 neu' });

    const response = await patch(l1.id, { version: 1, name: 'L1 alt' });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('version_conflict');
    expect((await listAll()).json().items).toEqual([
      { id: l1.id, name: 'L1 neu', active: true, version: 2 },
    ]);
  });

  it('answers 404 not_found with M-15 for an unknown supplier', async () => {
    const response = await patch(99, { version: 1, name: 'L9' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: 'not_found',
      message: 'Dieser Eintrag ist nicht mehr vorhanden.',
    });
  });

  it('writes one audit entry per change: created, updated, deactivated, activated (2.0.9, 3.6)', async () => {
    const l1 = await createL1();
    await patch(l1.id, { version: 1, name: 'Lieferant Eins', active: false });
    await patch(l1.id, { version: 2, active: true });

    expect(auditRows()).toEqual([
      {
        action: 'created',
        object_id: l1.id,
        object_label: 'Lieferant L1',
        old_value: null,
        new_value: JSON.stringify({ Name: 'L1', Status: 'aktiv' }),
      },
      {
        action: 'updated',
        object_id: l1.id,
        object_label: 'Lieferant Lieferant Eins',
        old_value: JSON.stringify({ Name: 'L1' }),
        new_value: JSON.stringify({ Name: 'Lieferant Eins' }),
      },
      {
        action: 'deactivated',
        object_id: l1.id,
        object_label: 'Lieferant Lieferant Eins',
        old_value: JSON.stringify({ Status: 'aktiv' }),
        new_value: JSON.stringify({ Status: 'deaktiviert' }),
      },
      {
        action: 'activated',
        object_id: l1.id,
        object_label: 'Lieferant Lieferant Eins',
        old_value: JSON.stringify({ Status: 'deaktiviert' }),
        new_value: JSON.stringify({ Status: 'aktiv' }),
      },
    ]);
  });

  it('a change without a difference keeps the version and writes no audit entry', async () => {
    const l1 = await createL1();

    const response = await patch(l1.id, { version: 1, name: 'L1', active: true });

    expect(response.json()).toEqual(l1);
    expect(auditRows()).toHaveLength(1);
  });

  it('a rename to the same name in other case is allowed', async () => {
    const l1 = await createL1();

    const response = await patch(l1.id, { version: 1, name: 'l1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: 'l1', version: 2 });
  });

  it('DER-36-04 a technical error answers 500 internal_error with the reference number of the error log and stores nothing', async () => {
    t.database.sqlite.exec(
      "CREATE TRIGGER fail_supplier BEFORE INSERT ON supplier BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );

    const response = await create({ name: 'L1', active: true });

    expect(response.statusCode).toBe(500);
    const { error } = response.json();
    expect(error.code).toBe('internal_error');
    expect(error.referenceNumber).toMatch(/^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(t.readErrorLog()).toEqual([expect.objectContaining({ refNo: error.referenceNumber })]);
    expect(t.database.sqlite.prepare('SELECT COUNT(*) FROM supplier').pluck().get()).toBe(0);
    expect(auditRows()).toEqual([]);
  });

  it('DER-36-06 (c) rejects a write while shutting down with 503 shutting_down and stores nothing', async () => {
    t.lifecycle.set('stopping');

    const response = await create({ name: 'L1', active: true });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({ code: 'shutting_down', referenceNumber: null });
    expect(t.database.sqlite.prepare('SELECT COUNT(*) FROM supplier').pluck().get()).toBe(0);
  });
});

describe('manufacturer API (CU-087, Technical Specification 2.2)', () => {
  const list = (query = '') =>
    t.app.inject({ method: 'GET', url: `/api/manufacturers${query}`, headers: { host: HOST } });

  const listAll = () => list('?includeInactive=true');

  const create = (body: Record<string, unknown>) =>
    t.app.inject({
      method: 'POST',
      url: '/api/manufacturers',
      headers: SAME_ORIGIN_WRITE,
      payload: body,
    });

  const patch = (id: number, body: Record<string, unknown>) =>
    t.app.inject({
      method: 'PATCH',
      url: `/api/manufacturers/${id}`,
      headers: SAME_ORIGIN_WRITE,
      payload: body,
    });

  const auditRows = () =>
    t.database.sqlite
      .prepare(
        "SELECT action, object_id, object_label, old_value, new_value FROM audit_entry WHERE object_type = 'manufacturer' ORDER BY id",
      )
      .all();

  const names = (items: { name: string }[]) => items.map((item) => item.name);

  const NO_IMPACT = { updated: 0, rerelease: 0, manualReview: 0 };

  /** GPSR part of a manufacturer without details, as created (2.2). */
  const NO_GPSR = {
    gpsrMissing: ['legalName', 'street', 'postalCode', 'city', 'country', 'contact'],
    gpsr: {
      legalName: '',
      street: '',
      postalCode: '',
      city: '',
      country: '',
      contact: '',
      euRpName: '',
      euRpAddress: '',
      euRpContact: '',
    },
  };

  const createLenovo = async () => (await create({ name: 'Lenovo' })).json();

  const manufacturerCount = () =>
    t.database.sqlite.prepare('SELECT COUNT(*) FROM manufacturer').pluck().get();

  /**
   * A model template of manufacturer `manufacturerId`. Model templates are created from S3 on
   * (#50); until then the test writes the rows directly, as the schema of S1 allows.
   */
  function insertModelTemplate(manufacturerId: number) {
    const at = '2026-11-11T08:00:00.000Z';
    t.database.sqlite.exec(`
      INSERT INTO device_type (id, name, name_key, active, sort_order, version, created_at, updated_at)
        VALUES (1, 'Notebook', 'notebook', 1, 1, 1, '${at}', '${at}');
      INSERT INTO model_template (id, device_type_id, manufacturer_id, model_name, model_name_key,
          mpn_unknown, model_values, default_device_values, search_key, import_review_pending,
          import_review_keys, version, created_at, updated_at)
        VALUES (1, 1, ${manufacturerId}, 'T14', 't14', 1, '{}', '{}', 't14', 0, '[]', 1, '${at}', '${at}');
    `);
  }

  it('AC-REQ-100-01 POST " Fujitsu " creates the active manufacturer "Fujitsu" with gpsrComplete false', async () => {
    const created = await create({ name: ' Fujitsu ' });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({
      id: expect.any(Number),
      name: 'Fujitsu',
      active: true,
      gpsrComplete: false,
      ...NO_GPSR,
      version: 1,
      existing: false,
    });
    expect((await list()).json()).toEqual({
      items: [
        {
          id: created.json().id,
          name: 'Fujitsu',
          active: true,
          gpsrComplete: false,
          ...NO_GPSR,
          version: 1,
        },
      ],
      total: 1,
    });
  });

  it('AC-REQ-100-02 DER-37-12 "lenovo" creates no second manufacturer and answers 200 with "Lenovo" and existing true', async () => {
    const lenovo = await createLenovo();

    const response = await create({ name: 'lenovo' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...lenovo, existing: true });
    expect(names((await listAll()).json().items)).toEqual(['Lenovo']);
    expect(auditRows()).toHaveLength(1);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['51 characters', 'x'.repeat(51)],
  ])(
    'AC-REQ-100-03 rejects a name that is %s with validation_failed "Name: 1 bis 50 Zeichen" at the field',
    async (_case, name) => {
      const response = await create({ name });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toEqual({
        code: 'validation_failed',
        message: '',
        fields: [{ path: 'name', code: expect.any(String), message: 'Name: 1 bis 50 Zeichen' }],
        details: {},
        referenceNumber: null,
      });
      expect(manufacturerCount()).toBe(0);
    },
  );

  it('AC-REQ-100-03 accepts a name of 50 characters', async () => {
    expect((await create({ name: 'x'.repeat(50) })).statusCode).toBe(201);
  });

  it('AC-REQ-101-02 a deactivated manufacturer is not in the choice for new model templates, its model templates stay usable', async () => {
    const lenovo = await createLenovo();
    await create({ name: 'HP' });
    insertModelTemplate(lenovo.id);

    const response = await patch(lenovo.id, { version: 1, active: false });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      manufacturer: { ...lenovo, existing: undefined, active: false, version: 2 },
      impact: NO_IMPACT,
    });
    // The choice of UI-007 for new model templates (#50) reads the active manufacturers.
    expect(names((await list()).json().items)).toEqual(['HP']);
    // The existing model template keeps its manufacturer, which UI-031 still lists.
    expect(
      t.database.sqlite.prepare('SELECT manufacturer_id FROM model_template').pluck().all(),
    ).toEqual([lenovo.id]);
    expect((await listAll()).json().items).toEqual([
      expect.objectContaining({ name: 'HP', active: true }),
      {
        id: lenovo.id,
        name: 'Lenovo',
        active: false,
        gpsrComplete: false,
        ...NO_GPSR,
        version: 2,
      },
    ]);
  });

  it('DER-37-09 "lenovo" with a deactivated "Lenovo" is rejected with manufacturer_deactivated and creates nothing', async () => {
    const lenovo = await createLenovo();
    await patch(lenovo.id, { version: 1, active: false });

    const response = await create({ name: 'lenovo' });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'manufacturer_deactivated',
        message: 'Hersteller Lenovo ist deaktiviert',
        fields: [],
        details: {},
        referenceNumber: null,
      },
    });
    expect(manufacturerCount()).toBe(1);
  });

  it('DER-37-04 renaming to the name of another manufacturer is rejected with name_taken "Name ist bereits vergeben"', async () => {
    await createLenovo();
    const hp = (await create({ name: 'HP' })).json();

    const response = await patch(hp.id, { version: 1, name: ' LENOVO ' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toEqual({
      code: 'name_taken',
      message: 'Name ist bereits vergeben',
      fields: [],
      details: {},
      referenceNumber: null,
    });
    expect(names((await listAll()).json().items)).toEqual(['HP', 'Lenovo']);
  });

  it('DER-37-04 renaming to the name of a deactivated manufacturer is rejected with name_taken as well', async () => {
    const lenovo = await createLenovo();
    await patch(lenovo.id, { version: 1, active: false });
    const hp = (await create({ name: 'HP' })).json();

    expect((await patch(hp.id, { version: 1, name: 'lenovo' })).json().error.code).toBe(
      'name_taken',
    );
  });

  it('DER-37-04 creating with a name already given answers no name_taken (AC-REQ-100-02 instead)', async () => {
    await createLenovo();

    const response = await create({ name: 'LENOVO' });

    expect(response.statusCode).toBe(200);
    expect(response.json().existing).toBe(true);
  });

  it('DER-37-04 rejects an empty or 51 characters long name on rename with validation_failed', async () => {
    const lenovo = await createLenovo();

    for (const name of ['', 'x'.repeat(51)]) {
      const response = await patch(lenovo.id, { version: 1, name });
      expect(response.statusCode).toBe(422);
      expect(response.json().error.fields).toEqual([
        { path: 'name', code: expect.any(String), message: 'Name: 1 bis 50 Zeichen' },
      ]);
    }
  });

  it('renames a manufacturer to "Lenovo" with a new version and answers { manufacturer, impact }', async () => {
    const lenvo = (await create({ name: 'Lenvo' })).json();

    const response = await patch(lenvo.id, { version: 1, name: 'Lenovo' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      manufacturer: {
        id: lenvo.id,
        name: 'Lenovo',
        active: true,
        gpsrComplete: false,
        ...NO_GPSR,
        version: 2,
      },
      impact: NO_IMPACT,
    });
  });

  it('a rename to the same name in other case is allowed', async () => {
    const lenovo = await createLenovo();

    const response = await patch(lenovo.id, { version: 1, name: 'LENOVO' });

    expect(response.statusCode).toBe(200);
    expect(response.json().manufacturer).toMatchObject({ name: 'LENOVO', version: 2 });
  });

  it('lists the manufacturers by name without regard to case, the active ones without includeInactive', async () => {
    await create({ name: 'zeta' });
    const alpha = (await create({ name: 'Alpha' })).json();
    await create({ name: 'beta' });
    await patch(alpha.id, { version: 1, active: false });

    expect(names((await listAll()).json().items)).toEqual(['Alpha', 'beta', 'zeta']);
    expect((await list()).json()).toMatchObject({
      items: [{ name: 'beta' }, { name: 'zeta' }],
      total: 2,
    });
  });

  it('DER-37-08 reports gpsrComplete from the stored manufacturer', async () => {
    const lenovo = await createLenovo();
    t.database.sqlite
      .prepare('UPDATE manufacturer SET gpsr_complete = 1 WHERE id = ?')
      .run(lenovo.id);
    await create({ name: 'Fujitsu' });

    expect((await listAll()).json().items).toEqual([
      expect.objectContaining({ name: 'Fujitsu', gpsrComplete: false }),
      expect.objectContaining({ name: 'Lenovo', gpsrComplete: true }),
    ]);
  });

  it('pages the list with limit and offset (2.0.1)', async () => {
    for (const name of ['A', 'B', 'C']) await create({ name });

    expect((await list('?limit=1&offset=1')).json()).toMatchObject({
      items: [{ name: 'B' }],
      total: 3,
    });
  });

  const LENOVO_GPSR = {
    ...NO_GPSR.gpsr,
    legalName: 'Lenovo PC HK Limited',
    street: 'Meitnerstraße 9',
    postalCode: '70563',
    city: 'Stuttgart',
    country: 'Deutschland',
    contact: 'info@lenovo.com',
  };

  it('AC-REQ-027-01 Lenovo without GPSR details is "GPSR vollständig" after saving legal name, full postal address and e-mail address', async () => {
    const lenovo = await createLenovo();

    const response = await patch(lenovo.id, { version: 1, gpsr: LENOVO_GPSR });

    expect(response.statusCode).toBe(200);
    expect(response.json().manufacturer).toEqual({
      id: lenovo.id,
      name: 'Lenovo',
      active: true,
      gpsrComplete: true,
      gpsrMissing: [],
      gpsr: LENOVO_GPSR,
      version: 2,
    });
    expect((await listAll()).json().items).toEqual([response.json().manufacturer]);
  });

  it('AC-REQ-027-02 a postal address without postal code is saved, gpsrComplete stays false and gpsrMissing names the postal code', async () => {
    const lenovo = await createLenovo();

    const response = await patch(lenovo.id, {
      version: 1,
      gpsr: { ...LENOVO_GPSR, postalCode: '' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().manufacturer).toMatchObject({
      gpsrComplete: false,
      gpsrMissing: ['postalCode'],
      gpsr: { ...LENOVO_GPSR, postalCode: '' },
      version: 2,
    });
  });

  it('DER-41-03 a save with only some parts names every missing one in gpsrMissing', async () => {
    const lenovo = await createLenovo();

    const response = await patch(lenovo.id, {
      version: 1,
      gpsr: { ...NO_GPSR.gpsr, legalName: 'Lenovo PC HK Limited', city: 'Stuttgart' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().manufacturer).toMatchObject({
      gpsrComplete: false,
      gpsrMissing: ['street', 'postalCode', 'country', 'contact'],
    });
  });

  it.each([
    ['legalName', 201, 'Herstellername: höchstens 200 Zeichen'],
    ['postalCode', 21, 'Postleitzahl: höchstens 20 Zeichen'],
    ['contact', 255, 'Elektronische Kontaktadresse: höchstens 254 Zeichen'],
    ['euRpAddress', 501, 'Postanschrift der verantwortlichen Person: höchstens 500 Zeichen'],
  ])(
    'DER-41-01 rejects %s of %i characters with validation_failed and the text at the field',
    async (field, length, message) => {
      const lenovo = await createLenovo();

      const response = await patch(lenovo.id, {
        version: 1,
        gpsr: { ...LENOVO_GPSR, [field]: 'x'.repeat(length) },
      });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'validation_failed',
        fields: [{ path: `gpsr.${field}`, message }],
      });
      expect((await listAll()).json().items[0]).toMatchObject({ ...NO_GPSR, version: 1 });
    },
  );

  it('DER-41-02 rejects a contact that is neither an e-mail nor an http(s) address with "E-Mail-Adresse oder Internetadresse ungültig"', async () => {
    const lenovo = await createLenovo();

    const response = await patch(lenovo.id, {
      version: 1,
      gpsr: { ...LENOVO_GPSR, contact: 'www.lenovo.com' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      {
        path: 'gpsr.contact',
        code: expect.any(String),
        message: 'E-Mail-Adresse oder Internetadresse ungültig',
      },
    ]);
    expect((await listAll()).json().items[0]).toMatchObject({ version: 1 });
  });

  it('DER-41-02 accepts an https address as contact', async () => {
    const lenovo = await createLenovo();

    const response = await patch(lenovo.id, {
      version: 1,
      gpsr: { ...LENOVO_GPSR, contact: 'https://www.lenovo.com/de/kontakt' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().manufacturer.gpsrComplete).toBe(true);
  });

  it('DER-41-05 saving the GPSR details answers impact 0, 0, 0 while there is no channel content', async () => {
    const lenovo = await createLenovo();
    insertModelTemplate(lenovo.id);

    const response = await patch(lenovo.id, { version: 1, gpsr: LENOVO_GPSR });

    expect(response.statusCode).toBe(200);
    expect(response.json().impact).toEqual(NO_IMPACT);
  });

  it('DER-37-06 (a) rejects a GPSR change with an outdated version with 409 version_conflict', async () => {
    const lenovo = await createLenovo();
    await patch(lenovo.id, { version: 1, name: 'Lenovo neu' });

    const response = await patch(lenovo.id, { version: 1, gpsr: LENOVO_GPSR });

    expect(response.statusCode).toBe(409);
    expect((await listAll()).json().items[0]).toMatchObject({ ...NO_GPSR, version: 2 });
  });

  it('there is no DELETE route for manufacturers (2.2, REQ-101)', () => {
    expect(t.app.hasRoute({ method: 'DELETE', url: '/api/manufacturers/:id' })).toBe(false);
  });

  it('DER-37-06 (a) rejects a change with an outdated version with 409 version_conflict and changes nothing', async () => {
    const lenovo = await createLenovo();
    await patch(lenovo.id, { version: 1, name: 'Lenovo neu' });

    const response = await patch(lenovo.id, { version: 1, active: false });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('version_conflict');
    expect((await listAll()).json().items).toEqual([
      expect.objectContaining({ name: 'Lenovo neu', active: true, version: 2 }),
    ]);
  });

  it('answers 404 not_found with M-15 for an unknown manufacturer', async () => {
    const response = await patch(99, { version: 1, name: 'HP' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: 'not_found',
      message: 'Dieser Eintrag ist nicht mehr vorhanden.',
    });
  });

  it('writes one audit entry per change: created, updated, deactivated, activated (2.0.9, 3.6)', async () => {
    const lenvo = (await create({ name: 'Lenvo' })).json();
    await patch(lenvo.id, { version: 1, name: 'Lenovo', active: false });
    await patch(lenvo.id, { version: 2, active: true });

    expect(auditRows()).toEqual([
      {
        action: 'created',
        object_id: lenvo.id,
        object_label: 'Hersteller Lenvo',
        old_value: null,
        new_value: JSON.stringify({ Name: 'Lenvo', Status: 'aktiv' }),
      },
      {
        action: 'updated',
        object_id: lenvo.id,
        object_label: 'Hersteller Lenovo',
        old_value: JSON.stringify({ Name: 'Lenvo' }),
        new_value: JSON.stringify({ Name: 'Lenovo' }),
      },
      {
        action: 'deactivated',
        object_id: lenvo.id,
        object_label: 'Hersteller Lenovo',
        old_value: JSON.stringify({ Status: 'aktiv' }),
        new_value: JSON.stringify({ Status: 'deaktiviert' }),
      },
      {
        action: 'activated',
        object_id: lenvo.id,
        object_label: 'Hersteller Lenovo',
        old_value: JSON.stringify({ Status: 'deaktiviert' }),
        new_value: JSON.stringify({ Status: 'aktiv' }),
      },
    ]);
  });

  it('a change without a difference keeps the version and writes no audit entry', async () => {
    const lenovo = await createLenovo();

    const response = await patch(lenovo.id, { version: 1, name: 'Lenovo', active: true });

    expect(response.json().manufacturer).toMatchObject({ version: 1 });
    expect(auditRows()).toHaveLength(1);
  });

  it('DER-37-10 a technical error answers 500 internal_error with the reference number of the error log and stores nothing', async () => {
    t.database.sqlite.exec(
      "CREATE TRIGGER fail_manufacturer BEFORE INSERT ON manufacturer BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );

    const response = await create({ name: 'Lenovo' });

    expect(response.statusCode).toBe(500);
    const { error } = response.json();
    expect(error.code).toBe('internal_error');
    expect(error.referenceNumber).toMatch(/^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(t.readErrorLog()).toEqual([expect.objectContaining({ refNo: error.referenceNumber })]);
    expect(manufacturerCount()).toBe(0);
    expect(auditRows()).toEqual([]);
  });

  it('DER-37-06 (c) rejects a write while shutting down with 503 shutting_down and stores nothing', async () => {
    t.lifecycle.set('stopping');

    const response = await create({ name: 'Lenovo' });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({ code: 'shutting_down', referenceNumber: null });
    expect(manufacturerCount()).toBe(0);
  });
});

describe('merchant profile API (CU-087, Technical Specification 2.2)', () => {
  const get = () =>
    t.app.inject({ method: 'GET', url: '/api/merchant-profile', headers: { host: HOST } });

  const put = (body: Record<string, unknown>) =>
    t.app.inject({
      method: 'PUT',
      url: '/api/merchant-profile',
      headers: SAME_ORIGIN_WRITE,
      payload: body,
    });

  const auditRows = () =>
    t.database.sqlite
      .prepare(
        "SELECT action, object_id, object_label, old_value, new_value FROM audit_entry WHERE object_type = 'merchant_profile' ORDER BY id",
      )
      .all();

  it('answers the empty profile without logo before anything was saved', async () => {
    const response = await get();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ brandName: '', contactText: '', logo: null, version: 1 });
  });

  it('DER-42-11 saves name and contact details; the answer is the profile without counts', async () => {
    const response = await put({
      version: 1,
      brandName: ' Muster-Händler ',
      contactText: 'Tel. 0761 1234\ninfo@example.org',
    });

    expect(response.statusCode).toBe(200);
    const profile = {
      brandName: 'Muster-Händler',
      contactText: 'Tel. 0761 1234\ninfo@example.org',
      logo: null,
      version: 2,
    };
    expect(response.json()).toEqual(profile);
    expect(response.json()).not.toHaveProperty('impact');
    expect((await get()).json()).toEqual(profile);
    expect(auditRows()).toEqual([
      {
        action: 'updated',
        object_id: 1,
        object_label: 'Händlermarke',
        old_value: JSON.stringify({ Name: '', Kontaktangaben: '' }),
        new_value: JSON.stringify({
          Name: 'Muster-Händler',
          Kontaktangaben: 'Tel. 0761 1234\ninfo@example.org',
        }),
      },
    ]);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['101 characters', 'x'.repeat(101)],
  ])(
    'DER-42-05 rejects a name that is %s with validation_failed "Name: 1 bis 100 Zeichen" at the field',
    async (_case, brandName) => {
      const response = await put({ version: 1, brandName, contactText: '' });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toEqual({
        code: 'validation_failed',
        message: '',
        fields: [
          { path: 'brandName', code: expect.any(String), message: 'Name: 1 bis 100 Zeichen' },
        ],
        details: {},
        referenceNumber: null,
      });
      expect(auditRows()).toEqual([]);
    },
  );

  it('DER-42-05 rejects contact details over 500 characters with validation_failed at the field', async () => {
    const response = await put({ version: 1, brandName: 'B', contactText: 'x'.repeat(501) });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      {
        path: 'contactText',
        code: expect.any(String),
        message: 'Kontaktangaben: höchstens 500 Zeichen',
      },
    ]);
    expect((await get()).json().version).toBe(1);
  });

  it('accepts a name of 100 and contact details of 500 characters', async () => {
    const response = await put({
      version: 1,
      brandName: 'x'.repeat(100),
      contactText: 'y'.repeat(500),
    });

    expect(response.statusCode).toBe(200);
  });

  it('DER-42-07 (a) rejects an outdated version with 409 version_conflict', async () => {
    await put({ version: 1, brandName: 'B1', contactText: '' });

    const response = await put({ version: 1, brandName: 'B2', contactText: '' });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({ code: 'version_conflict' });
    expect((await get()).json()).toMatchObject({ brandName: 'B1', version: 2 });
  });

  it('DER-42-04 a technical error answers 500 internal_error with the reference number and stores nothing', async () => {
    t.database.sqlite.exec(
      "CREATE TRIGGER fail_profile BEFORE INSERT ON merchant_profile BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );

    const response = await put({ version: 1, brandName: 'B', contactText: '' });

    expect(response.statusCode).toBe(500);
    const { error } = response.json();
    expect(error.code).toBe('internal_error');
    expect(error.referenceNumber).toMatch(/^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(auditRows()).toEqual([]);
  });

  it('DER-42-07 (c) rejects a save while shutting down with 503 shutting_down and stores nothing', async () => {
    t.lifecycle.set('stopping');

    const response = await put({ version: 1, brandName: 'B', contactText: '' });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({ code: 'shutting_down', referenceNumber: null });
    expect(t.database.sqlite.prepare('SELECT COUNT(*) FROM merchant_profile').pluck().get()).toBe(
      0,
    );
  });
});

describe('merchant logo API (CU-087, CU-091, Technical Specification 2.2)', () => {
  const LOGO_RULE = 'Logo: nur PNG oder JPEG bis 5 MB';

  const get = () =>
    t.app.inject({ method: 'GET', url: '/api/merchant-profile', headers: { host: HOST } });

  const putProfile = (body: Record<string, unknown>) =>
    t.app.inject({
      method: 'PUT',
      url: '/api/merchant-profile',
      headers: SAME_ORIGIN_WRITE,
      payload: body,
    });

  const putLogo = ({ payload, contentType }: { payload: Buffer; contentType: string }) =>
    t.app.inject({
      method: 'PUT',
      url: '/api/merchant-profile/logo',
      headers: {
        host: HOST,
        origin: ORIGIN,
        'sec-fetch-site': 'same-origin',
        'content-type': contentType,
      },
      payload,
    });

  // `DELETE` needs `content-type: application/json` as every write (G-4), so the body is `{}`.
  const deleteLogo = (version: number | string) =>
    t.app.inject({
      method: 'DELETE',
      url: `/api/merchant-profile/logo?version=${version}`,
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });

  const getMedia = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });

  const mediaRows = () =>
    t.database.sqlite
      .prepare(
        'SELECT hash, kind, ext, mime, byte_size, width, height, unreferenced_since FROM media_file',
      )
      .all();

  const storedFiles = () => {
    const folder = join(t.dataDir, 'media', 'logo');
    return existsSync(folder) ? readdirSync(folder) : [];
  };

  const incomingFiles = () => {
    const folder = join(t.dataDir, 'media', '.incoming');
    return existsSync(folder) ? readdirSync(folder) : [];
  };

  const auditRows = () =>
    t.database.sqlite
      .prepare(
        "SELECT action, old_value, new_value FROM audit_entry WHERE object_type = 'merchant_profile' ORDER BY id",
      )
      .all();

  it('AC-REQ-028-01 after saving brand "notebookers.de" and a logo, the profile has name and logo hash and the file is served under /media/logo/{hash}', async () => {
    await putProfile({ version: 1, brandName: 'notebookers.de', contactText: '' });
    const png = await testImages.png();
    const hash = sha256(png);

    const upload = await putLogo(logoUpload(2, png));

    expect(upload.statusCode).toBe(200);
    const profile = {
      brandName: 'notebookers.de',
      contactText: '',
      logo: { hash, url: `/media/logo/${hash}` },
      version: 3,
    };
    expect(upload.json()).toEqual(profile);
    expect((await get()).json()).toEqual(profile);

    const media = await getMedia(profile.logo.url);
    expect(media.statusCode).toBe(200);
    expect(media.headers['content-type']).toBe('image/png');
    expect(media.rawPayload.equals(png)).toBe(true);
  });

  it('stores the file once under its hash with its row in media_file and logs the change', async () => {
    const jpeg = await testImages.jpeg();
    const hash = sha256(jpeg);

    const response = await putLogo(logoUpload(1, jpeg, 'logo.jpg'));

    expect(response.statusCode).toBe(200);
    expect(storedFiles()).toEqual([`${hash}.jpg`]);
    expect(incomingFiles()).toEqual([]);
    expect(mediaRows()).toEqual([
      {
        hash,
        kind: 'logo',
        ext: 'jpg',
        mime: 'image/jpeg',
        byte_size: jpeg.length,
        width: 120,
        height: 40,
        unreferenced_since: null,
      },
    ]);
    expect(auditRows()).toEqual([
      {
        action: 'updated',
        old_value: JSON.stringify({ Logo: null }),
        new_value: JSON.stringify({ Logo: hash }),
      },
    ]);
  });

  it('DER-42-09 replacing the logo shows the new one; removing it leaves the profile without logo', async () => {
    const first = await testImages.png('#000000');
    const second = await testImages.png('#ffffff');
    await putLogo(logoUpload(1, first));

    const replaced = await putLogo(logoUpload(2, second));

    expect(replaced.statusCode).toBe(200);
    expect(replaced.json().logo).toEqual({
      hash: sha256(second),
      url: `/media/logo/${sha256(second)}`,
    });

    const removed = await deleteLogo(3);

    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ brandName: '', contactText: '', logo: null, version: 4 });
    expect((await get()).json().logo).toBeNull();
    // The files stay for the housekeeping (2.19).
    expect(storedFiles()).toHaveLength(2);
    expect(auditRows()).toEqual([
      {
        action: 'updated',
        old_value: JSON.stringify({ Logo: null }),
        new_value: JSON.stringify({ Logo: sha256(first) }),
      },
      {
        action: 'updated',
        old_value: JSON.stringify({ Logo: sha256(first) }),
        new_value: JSON.stringify({ Logo: sha256(second) }),
      },
      {
        action: 'updated',
        old_value: JSON.stringify({ Logo: sha256(second) }),
        new_value: JSON.stringify({ Logo: null }),
      },
    ]);
  });

  it('keeps name and contact details when the logo changes', async () => {
    await putProfile({ version: 1, brandName: 'notebookers.de', contactText: 'Tel. 0761 1234' });

    await putLogo(logoUpload(2, await testImages.png()));
    const removed = await deleteLogo(3);

    expect(removed.json()).toMatchObject({
      brandName: 'notebookers.de',
      contactText: 'Tel. 0761 1234',
    });
  });

  it.each([
    ['a GIF file', 415, 'unsupported_media_type', () => testImages.gif()],
    ['a PNG file of 6 MB', 413, 'file_too_large', () => testImages.pngOfSize(6)],
  ])(
    'AC-REQ-028-02 rejects %s with "Logo: nur PNG oder JPEG bis 5 MB" and stores no file',
    async (_case, status, code, file) => {
      const response = await putLogo(logoUpload(1, await file()));

      expect(response.statusCode).toBe(status);
      expect(response.json().error).toEqual({
        code,
        message: LOGO_RULE,
        fields: [],
        details: {},
        referenceNumber: null,
      });
      expect(storedFiles()).toEqual([]);
      expect(incomingFiles()).toEqual([]);
      expect(mediaRows()).toEqual([]);
      expect((await get()).json()).toMatchObject({ logo: null, version: 1 });
      expect(auditRows()).toEqual([]);
    },
  );

  it('accepts a PNG of exactly 5 MB', async () => {
    const response = await putLogo(logoUpload(1, await testImages.pngOfSize(5)));

    expect(response.statusCode).toBe(200);
  });

  it.each([
    ['a text file named logo.png', Buffer.from('not an image')],
    [
      'a file with the PNG signature that is no image',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
    ],
  ])('rejects %s with 415 unsupported_media_type', async (_case, file) => {
    const response = await putLogo(logoUpload(1, file));

    expect(response.statusCode).toBe(415);
    expect(response.json().error.message).toBe(LOGO_RULE);
    expect(storedFiles()).toEqual([]);
  });

  it('rejects an outdated version with 409 version_conflict and keeps the logo', async () => {
    const first = await testImages.png('#000000');
    await putLogo(logoUpload(1, first));

    const upload = await putLogo(logoUpload(1, await testImages.png('#ffffff')));
    const removal = await deleteLogo(1);

    expect(upload.statusCode).toBe(409);
    expect(upload.json().error.code).toBe('version_conflict');
    expect(removal.statusCode).toBe(409);
    expect((await get()).json()).toMatchObject({ logo: { hash: sha256(first) }, version: 2 });
  });

  it('stores and logs nothing when the same logo is uploaded again or no logo is removed', async () => {
    const png = await testImages.png();
    await putLogo(logoUpload(1, png));

    const again = await putLogo(logoUpload(2, png));
    await deleteLogo(2);
    const removedTwice = await deleteLogo(3);

    expect(again.json().version).toBe(2);
    expect(removedTwice.json()).toMatchObject({ logo: null, version: 3 });
    expect(auditRows()).toHaveLength(2);
  });

  it.each([
    [
      'without the field version',
      () => [{ name: 'file', value: Buffer.from('x'), filename: 'logo.png' }],
    ],
    [
      'with the file under another name',
      () => [
        { name: 'version', value: '1' },
        { name: 'logo', value: Buffer.from('x'), filename: 'logo.png' },
      ],
    ],
    ['without a file', () => [{ name: 'version', value: '1' }]],
  ])('rejects an upload %s as 400 bad_request', async (_case, parts) => {
    const response = await putLogo(multipart(parts()));

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
  });

  it('takes exactly one file per upload and skips a second one (2.0.1)', async () => {
    const [first, second] = [await testImages.png(), await testImages.png('#000000')];

    const response = await putLogo(
      multipart([
        { name: 'version', value: '1' },
        { name: 'file', value: first, filename: 'logo.png', contentType: 'image/png' },
        { name: 'file', value: second, filename: 'other.png', contentType: 'image/png' },
      ]),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().logo.hash).toBe(sha256(first));
    expect(storedFiles()).toEqual([`${sha256(first)}.png`]);
    expect(mediaRows()).toHaveLength(1);
  });

  it('rejects an upload as JSON with 415 unsupported_media_type (G-4)', async () => {
    const response = await t.app.inject({
      method: 'PUT',
      url: '/api/merchant-profile/logo',
      headers: SAME_ORIGIN_WRITE,
      payload: { version: 1 },
    });

    expect(response.statusCode).toBe(415);
  });

  it('rejects an upload while shutting down with 503 shutting_down and stores nothing', async () => {
    t.lifecycle.set('stopping');

    const response = await putLogo(logoUpload(1, await testImages.png()));

    expect(response.statusCode).toBe(503);
    expect(storedFiles()).toEqual([]);
  });
});

describe('condition code API (CU-087, Technical Specification 2.2)', () => {
  const BASE = '/api/condition-codes';

  const listCodes = () => get(BASE);
  const createCode = (body: Record<string, unknown>) => write('POST', BASE, body);
  const patchCode = (id: number, body: Record<string, unknown>) =>
    write('PATCH', `${BASE}/${id}`, body);
  // `DELETE` needs `content-type: application/json` as every write (G-4), so the body is `{}`.
  const deleteCode = (id: number, version: number | string) =>
    write('DELETE', `${BASE}/${id}?version=${version}`, {});
  const resolve = (query: string) => get(`${BASE}/resolve?${query}`);

  const auditRows = () =>
    t.database.sqlite
      .prepare(
        "SELECT action, object_category, object_id, object_label, old_value, new_value FROM audit_entry WHERE object_type = 'condition_code' ORDER BY id",
      )
      .all();

  const countCodes = () =>
    t.database.sqlite.prepare('SELECT COUNT(*) FROM condition_code').pluck().get();

  const createSupplier = async (name: string) =>
    (await write('POST', '/api/suppliers', { name, active: true })).json() as { id: number };

  const createCondition = async (label: string) =>
    (await createValue(CONDITION, { label, active: true })).json() as { id: number };

  const DGS = { code: 'DGS', plainText: 'Gebrauchsspuren am Gehäuse' };

  it('AC-REQ-022-01 after creating "DGS" with plain text, resolve returns this plain text', async () => {
    const created = await createCode(DGS);

    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({
      id: expect.any(Number),
      code: 'DGS',
      supplierId: null,
      plainText: 'Gebrauchsspuren am Gehäuse',
      suggestedConditionValueId: null,
      suggestedVisualGrade: null,
      version: 1,
    });
    const response = await resolve('code=DGS');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      found: true,
      plainText: 'Gebrauchsspuren am Gehäuse',
      suggestedConditionValueId: null,
      suggestedVisualGrade: null,
    });
    expect((await listCodes()).json()).toEqual({ items: [created.json()], total: 1 });
  });

  it('AC-REQ-022-02 a second entry "dgs" without supplier is rejected with "Diesen Code gibt es für diesen Lieferanten bereits"', async () => {
    await createCode(DGS);

    const response = await createCode({ code: 'dgs', plainText: 'anderer Text' });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual(
      errorOf('name_taken', 'Diesen Code gibt es für diesen Lieferanten bereits'),
    );
    expect(countCodes()).toBe(1);
  });

  it('AC-REQ-022-02 the same code is allowed once per supplier and once without supplier', async () => {
    const l1 = await createSupplier('L1');
    const l2 = await createSupplier('L2');
    await createCode(DGS);

    expect((await createCode({ ...DGS, supplierId: l1.id })).statusCode).toBe(201);
    expect((await createCode({ ...DGS, code: 'dgs', supplierId: l2.id })).statusCode).toBe(201);
    const twice = await createCode({ ...DGS, code: ' Dgs ', supplierId: l1.id });
    expect(twice.statusCode).toBe(422);
    expect(twice.json().error.code).toBe('name_taken');
    expect(countCodes()).toBe(3);
  });

  it('AC-REQ-022-02 a change to the code and supplier of another entry is rejected as well', async () => {
    await createCode(DGS);
    const other = (await createCode({ code: 'B1', plainText: 'Kratzer' })).json();

    const response = await patchCode(other.id, { version: 1, code: 'dgs' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('name_taken');
  });

  it('AC-REQ-022-04 an entry without plain text is rejected with validation_failed "Klartext: 1 bis 500 Zeichen"', async () => {
    const response = await createCode({ code: 'DGS', plainText: '' });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual(
      errorOf('validation_failed', '', [
        { path: 'plainText', code: expect.any(String), message: 'Klartext: 1 bis 500 Zeichen' },
      ]),
    );
    expect(countCodes()).toBe(0);
  });

  it.each([
    ['a code of 21 characters', { code: 'x'.repeat(21) }, 'code', 'Zustandscode: 1 bis 20 Zeichen'],
    ['an empty code', { code: '  ' }, 'code', 'Zustandscode: 1 bis 20 Zeichen'],
    ['an empty plain text', { plainText: '   ' }, 'plainText', 'Klartext: 1 bis 500 Zeichen'],
    [
      'a plain text of 501 characters',
      { plainText: 'x'.repeat(501) },
      'plainText',
      'Klartext: 1 bis 500 Zeichen',
    ],
    [
      'a visual grade of 0',
      { suggestedVisualGrade: 0 },
      'suggestedVisualGrade',
      'Optik-Note: ganze Zahl von 1 bis 5',
    ],
    [
      'a visual grade of 6',
      { suggestedVisualGrade: 6 },
      'suggestedVisualGrade',
      'Optik-Note: ganze Zahl von 1 bis 5',
    ],
    [
      'a visual grade of 2.5',
      { suggestedVisualGrade: 2.5 },
      'suggestedVisualGrade',
      'Optik-Note: ganze Zahl von 1 bis 5',
    ],
  ])(
    'DER-38-05 rejects %s with validation_failed and the text of UI-033 at the field',
    async (_case, change, path, message) => {
      const response = await createCode({ ...DGS, ...change });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'validation_failed',
        fields: [{ path, message }],
      });
      expect(countCodes()).toBe(0);
    },
  );

  it('DER-38-05 accepts a code of 20 characters, a plain text of 500 characters and grades 1 and 5', async () => {
    expect(
      (await createCode({ code: 'x'.repeat(20), plainText: 'y'.repeat(500) })).statusCode,
    ).toBe(201);
    expect((await createCode({ ...DGS, suggestedVisualGrade: 1 })).statusCode).toBe(201);
    expect((await createCode({ ...DGS, code: 'A5', suggestedVisualGrade: 5 })).statusCode).toBe(
      201,
    );
  });

  it('trims code and plain text', async () => {
    const response = await createCode({ code: ' DGS ', plainText: '  Kratzer ' });

    expect(response.json()).toMatchObject({ code: 'DGS', plainText: 'Kratzer' });
  });

  it('DER-38-10 resolve prefers the entry of the supplier to the one without supplier, without regard to case', async () => {
    const l1 = await createSupplier('L1');
    const l2 = await createSupplier('L2');
    const good = await createCondition('Gebraucht');
    await createCode({ ...DGS, plainText: 'Text für alle' });
    await createCode({
      code: 'DGS',
      supplierId: l1.id,
      plainText: 'Text von L1',
      suggestedConditionValueId: good.id,
      suggestedVisualGrade: 2,
    });

    expect((await resolve(`code=dgs&supplierId=${l1.id}`)).json()).toEqual({
      found: true,
      plainText: 'Text von L1',
      suggestedConditionValueId: good.id,
      suggestedVisualGrade: 2,
    });
    expect((await resolve('code=dgs')).json()).toMatchObject({ plainText: 'Text für alle' });
    expect((await resolve('code=DGS&supplierId=')).json()).toMatchObject({
      plainText: 'Text für alle',
    });
    expect((await resolve(`code=Dgs&supplierId=${l2.id}`)).json()).toMatchObject({
      plainText: 'Text für alle',
    });
  });

  it('DER-38-10 resolve finds the entry of the supplier without an entry for all suppliers, but not for another supplier', async () => {
    const l1 = await createSupplier('L1');
    const l2 = await createSupplier('L2');
    await createCode({ ...DGS, supplierId: l1.id });

    expect((await resolve(`code=DGS&supplierId=${l1.id}`)).json().found).toBe(true);
    expect((await resolve(`code=DGS&supplierId=${l2.id}`)).json().found).toBe(false);
    expect((await resolve('code=DGS')).json().found).toBe(false);
  });

  it('resolve answers found: false for an unknown or empty code', async () => {
    await createCode(DGS);

    const unknown = {
      found: false,
      plainText: null,
      suggestedConditionValueId: null,
      suggestedVisualGrade: null,
    };
    expect((await resolve('code=XYZ')).json()).toEqual(unknown);
    expect((await resolve('code=')).json()).toEqual(unknown);
  });

  it('resolve rejects a supplierId that is not an id as bad_request', async () => {
    expect((await resolve('code=DGS&supplierId=abc')).statusCode).toBe(400);
    expect((await resolve('supplierId=1')).statusCode).toBe(400);
  });

  it('stores supplier and suggestions and lists the entries by code, the entry without supplier first', async () => {
    const l1 = await createSupplier('L1');
    const good = await createCondition('Gebraucht');
    const withSupplier = (
      await createCode({
        code: 'dgs',
        supplierId: l1.id,
        plainText: 'Text von L1',
        suggestedConditionValueId: good.id,
        suggestedVisualGrade: 3,
      })
    ).json();
    const a1 = (await createCode({ code: 'A1', plainText: 'neuwertig' })).json();
    const all = (await createCode(DGS)).json();

    expect(withSupplier).toMatchObject({
      supplierId: l1.id,
      suggestedConditionValueId: good.id,
      suggestedVisualGrade: 3,
    });
    expect((await listCodes()).json().items.map((item: { id: number }) => item.id)).toEqual([
      a1.id,
      all.id,
      withSupplier.id,
    ]);
  });

  it('answers 404 not_found for an unknown supplier or a suggestion that is not a value of the list Zustand', async () => {
    const keyboard = (await createValue(KEYBOARD, { label: 'DE', active: true })).json();

    const unknownSupplier = await createCode({ ...DGS, supplierId: 99 });
    const otherList = await createCode({ ...DGS, suggestedConditionValueId: keyboard.id });

    for (const response of [unknownSupplier, otherList]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(
        errorOf('not_found', 'Dieser Eintrag ist nicht mehr vorhanden.'),
      );
    }
    expect(countCodes()).toBe(0);
  });

  it('changes an entry, keeps the omitted fields and removes a suggestion with null', async () => {
    const l1 = await createSupplier('L1');
    const good = await createCondition('Gebraucht');
    const entry = (
      await createCode({ ...DGS, suggestedConditionValueId: good.id, suggestedVisualGrade: 2 })
    ).json();

    const response = await patchCode(entry.id, {
      version: 1,
      plainText: 'Neuer Text',
      supplierId: l1.id,
      suggestedVisualGrade: null,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...entry,
      plainText: 'Neuer Text',
      supplierId: l1.id,
      suggestedVisualGrade: null,
      version: 2,
    });
  });

  it('DER-38-05 rejects an empty plain text on change with validation_failed', async () => {
    const entry = (await createCode(DGS)).json();

    const response = await patchCode(entry.id, { version: 1, plainText: '' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.fields).toEqual([
      { path: 'plainText', code: expect.any(String), message: 'Klartext: 1 bis 500 Zeichen' },
    ]);
  });

  it('a change without a difference keeps the version and writes no audit entry', async () => {
    const entry = (await createCode(DGS)).json();

    const response = await patchCode(entry.id, {
      version: 1,
      code: 'DGS',
      plainText: DGS.plainText,
    });

    expect(response.json()).toEqual(entry);
    expect(auditRows()).toHaveLength(1);
  });

  it('DER-38-08 DELETE with the version read deletes the entry with 204', async () => {
    const entry = (await createCode(DGS)).json();

    const response = await deleteCode(entry.id, 1);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect((await listCodes()).json()).toEqual({ items: [], total: 0 });
    expect((await resolve('code=DGS')).json().found).toBe(false);
  });

  it('DER-38-06 (a) rejects a change or a deletion with an outdated version with 409 version_conflict and changes nothing', async () => {
    const entry = (await createCode(DGS)).json();
    await patchCode(entry.id, { version: 1, plainText: 'Neu' });

    const changed = await patchCode(entry.id, { version: 1, plainText: 'Alt' });
    const deleted = await deleteCode(entry.id, 1);

    for (const response of [changed, deleted]) {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('version_conflict');
    }
    expect((await listCodes()).json().items).toEqual([{ ...entry, plainText: 'Neu', version: 2 }]);
  });

  it('answers 404 not_found with M-15 for an unknown entry', async () => {
    for (const response of [
      await patchCode(99, { version: 1, plainText: 'x' }),
      await deleteCode(99, 1),
    ]) {
      expect(response.statusCode).toBe(404);
      expect(response.json().error).toMatchObject({
        code: 'not_found',
        message: 'Dieser Eintrag ist nicht mehr vorhanden.',
      });
    }
  });

  it('rejects a DELETE without a version as bad_request', async () => {
    const entry = (await createCode(DGS)).json();

    expect((await deleteCode(entry.id, '')).statusCode).toBe(400);
    expect(countCodes()).toBe(1);
  });

  it('writes one audit entry per change with readable values: created, updated, deleted (2.0.9, 3.6)', async () => {
    const l1 = await createSupplier('L1');
    const good = await createCondition('Gebraucht');
    const entry = (await createCode({ ...DGS, suggestedVisualGrade: 2 })).json();
    await patchCode(entry.id, {
      version: 1,
      supplierId: l1.id,
      suggestedConditionValueId: good.id,
    });
    await deleteCode(entry.id, 2);

    expect(auditRows()).toEqual([
      {
        action: 'created',
        object_category: 'settings',
        object_id: entry.id,
        object_label: 'Code-Übersetzung DGS',
        old_value: null,
        new_value: JSON.stringify({
          Zustandscode: 'DGS',
          Lieferant: 'alle',
          Klartext: 'Gebrauchsspuren am Gehäuse',
          'Vorschlag Zustand': null,
          'Vorschlag Optik-Note': 2,
        }),
      },
      {
        action: 'updated',
        object_category: 'settings',
        object_id: entry.id,
        object_label: 'Code-Übersetzung DGS (L1)',
        old_value: JSON.stringify({ Lieferant: 'alle', 'Vorschlag Zustand': null }),
        new_value: JSON.stringify({ Lieferant: 'L1', 'Vorschlag Zustand': 'Gebraucht' }),
      },
      {
        action: 'deleted',
        object_category: 'other',
        object_id: entry.id,
        object_label: 'Code-Übersetzung DGS (L1)',
        old_value: JSON.stringify({
          Zustandscode: 'DGS',
          Lieferant: 'L1',
          Klartext: 'Gebrauchsspuren am Gehäuse',
          'Vorschlag Zustand': 'Gebraucht',
          'Vorschlag Optik-Note': 2,
        }),
        new_value: null,
      },
    ]);
  });

  it('DER-38-04 a technical error answers 500 internal_error with the reference number of the error log and stores nothing', async () => {
    t.database.sqlite.exec(
      "CREATE TRIGGER fail_condition_code BEFORE INSERT ON condition_code BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );

    const response = await createCode(DGS);

    expect(response.statusCode).toBe(500);
    const { error } = response.json();
    expect(error.code).toBe('internal_error');
    expect(error.referenceNumber).toMatch(/^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(t.readErrorLog()).toEqual([expect.objectContaining({ refNo: error.referenceNumber })]);
    expect(countCodes()).toBe(0);
    expect(auditRows()).toEqual([]);
  });

  it('DER-38-06 (c) rejects a write while shutting down with 503 shutting_down and stores nothing', async () => {
    const entry = (await createCode(DGS)).json();
    t.lifecycle.set('stopping');

    for (const response of [
      await createCode({ ...DGS, code: 'A1' }),
      await patchCode(entry.id, { version: 1, plainText: 'Neu' }),
      await deleteCode(entry.id, 1),
    ]) {
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toMatchObject({ code: 'shutting_down', referenceNumber: null });
    }
    expect((await listCodes()).json().items).toEqual([entry]);
  });
});
