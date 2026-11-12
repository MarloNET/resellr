import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertPickLists, PICK_LISTS, pickListId } from '../../test/pick-lists.ts';
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
