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
