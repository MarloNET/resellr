import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
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
