import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';

// API and integration tests of a changed variant value of an assigned device (CU-121, CU-130;
// Technical Specification 2.5 "Variantenangabe eines zugeordneten Geräts ändern", 2.6
// Vergleichsregel; UI-005 Kontext B): `PATCH /api/devices/{id}` asks with
// `confirmation_required`/`variant_deviation` and stores nothing, `deviationDecision: keep`
// stores the values, leaves the model listing unchanged and writes the audit entry,
// `deviationDecision: new_listing` stores them and creates a model listing as 2.6 (CU-123, #201).

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

let value: (label: string) => number;
let attribute: (label: string) => number;
let template: number;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  const { sqlite } = t.database;
  const one = <T>(sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...params) as T;
  const notebook = one<{ id: number }>("SELECT id FROM device_type WHERE name = 'Notebook'").id;
  value = (label) =>
    one<{ id: number }>('SELECT id FROM pick_list_value WHERE label = ?', label).id;
  attribute = (label) =>
    one<{ id: number }>(
      'SELECT id FROM attribute WHERE device_type_id = ? AND label = ?',
      notebook,
      label,
    ).id;
  template = insertModelTemplate(sqlite, {
    deviceTypeId: notebook,
    manufacturerId: insertManufacturer(sqlite, 'Lenovo'),
    modelName: 'ThinkPad T14',
    mpn: '20W0',
  });
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const values = (change: Record<string, unknown> = {}) => ({
  [attribute('RAM')]: '16',
  [attribute('Speicherkapazität')]: '512',
  [attribute('Tastaturlayout')]: value('Deutsch (QWERTZ)'),
  [attribute('Betriebssystem')]: value('Windows 11 Pro'),
  [attribute('Netzteil')]: value('mit Netzteil (original)'),
  [attribute('Akku')]: value('mit Akku'),
  [attribute('Akkukapazität')]: { percent: '77' },
  ...change,
});

const write = (method: 'POST' | 'PATCH', url: string, payload: Record<string, unknown>) =>
  t.app.inject({ method, url, headers: SAME_ORIGIN_WRITE, payload });
const patch = (id: number, payload: Record<string, unknown>) =>
  write('PATCH', `/api/devices/${id}`, payload);

const rows = <T>(sql: string, ...params: unknown[]) =>
  t.database.sqlite.prepare(sql).all(...params) as T[];
const count = (table: 'device' | 'audit_entry') =>
  rows<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]?.n;
const deviceRow = (id: number) =>
  rows<Record<string, unknown>>('SELECT * FROM device WHERE id = ?', id)[0];
const listingRow = (id: number) =>
  rows<Record<string, unknown>>('SELECT * FROM listing WHERE id = ?', id)[0];

/** A checked notebook (no prefill, so no review flag); returns its id. */
async function captureDevice(wiNr: string, visualGrade: string): Promise<number> {
  const response = await write('POST', '/api/devices', {
    wiNr,
    supplierId: null,
    modelTemplateId: template,
    conditionValueId: value('gebraucht'),
    visualGrade,
    conditionDescription: '',
    values: values(),
    confirmedKeys: [],
  });
  expect(response.statusCode).toBe(201);
  return response.json().id as number;
}

/** A model listing created from a new device, which is assigned to it; returns both ids. */
async function listingFrom(wiNr: string, visualGrade: string) {
  const deviceId = await captureDevice(wiNr, visualGrade);
  const response = await write('POST', '/api/listings', {
    fromDeviceId: deviceId,
    deviceVersion: 1,
  });
  expect(response.statusCode).toBe(201);
  return { deviceId, listingId: response.json().id as number };
}

/** The device "626198" with visual grade 2 assigned to MI-A, and its current version. */
async function assignedToMiA() {
  const { deviceId, listingId } = await listingFrom('626198', '2');
  return { deviceId, miA: listingId, version: deviceRow(deviceId)?.version as number };
}

describe('variant value of an assigned device changed (CU-121, Technical Specification 2.5)', () => {
  it('AC-REQ-014-07 asks with "Optik-Note: Gerät 4, Modell-Inserat 2" when the visual grade changes from 2 to 4, and MI-A and the device stay unchanged', async () => {
    const { deviceId, miA, version } = await assignedToMiA();
    const deviceBefore = deviceRow(deviceId);
    const listingBefore = listingRow(miA);
    const audits = count('audit_entry');

    const response = await patch(deviceId, { version, visualGrade: '4', confirmedKeys: [] });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'confirmation_required',
      message: 'Das Gerät weicht vom Modell-Inserat ab.',
      details: {
        kind: 'variant_deviation',
        deviations: [
          { key: 'visualGrade', label: 'Optik-Note', deviceValue: '4', listingValue: '2' },
        ],
        rebookTargets: [],
      },
    });
    expect(deviceRow(deviceId)).toEqual(deviceBefore);
    expect(listingRow(miA)).toEqual(listingBefore);
    expect(count('audit_entry')).toBe(audits);
  });

  it('DER-56-04 names the other model listings of the model template as rebook targets, each with its deviations to the changed device', async () => {
    const { deviceId, version } = await assignedToMiA();
    const miB = (await listingFrom('626199', '4')).listingId;
    const miC = (await listingFrom('626200', '5')).listingId;

    const response = await patch(deviceId, { version, visualGrade: '4', confirmedKeys: [] });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.details.rebookTargets).toEqual([
      { listingId: miB, title: 'ThinkPad T14', deviations: [] },
      {
        listingId: miC,
        title: 'ThinkPad T14',
        deviations: [
          { key: 'visualGrade', label: 'Optik-Note', deviceValue: '4', listingValue: '5' },
        ],
      },
    ]);
  });

  it('DER-56-05 "keep" stores the visual grade 4, leaves MI-A unchanged and writes the audit entry with time and deviations', async () => {
    const { deviceId, miA, version } = await assignedToMiA();
    const listingBefore = listingRow(miA);
    const lastAudit = rows<{ id: number }>('SELECT MAX(id) AS id FROM audit_entry')[0]?.id ?? 0;

    const response = await patch(deviceId, {
      version,
      visualGrade: '4',
      confirmedKeys: [],
      deviationDecision: 'keep',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: deviceId,
      listingId: miA,
      visualGrade: 4,
      version: version + 1,
    });
    expect(listingRow(miA)).toEqual(listingBefore);
    expect(
      rows(
        `SELECT object_type, object_id, object_label, action, old_value, new_value,
                occurred_at IS NOT NULL AS timed
           FROM audit_entry WHERE id > ? ORDER BY id`,
        lastAudit,
      ),
    ).toEqual([
      {
        object_type: 'device',
        object_id: deviceId,
        object_label: 'Gerät 626198',
        action: 'values_updated',
        old_value: JSON.stringify({ 'Optik-Note': 2 }),
        new_value: JSON.stringify({ 'Optik-Note': 4 }),
        timed: 1,
      },
      {
        object_type: 'device',
        object_id: deviceId,
        object_label: 'Gerät 626198',
        action: 'assigned_despite_deviation',
        old_value: null,
        new_value: JSON.stringify({
          'Modell-Inserat': 'ThinkPad T14',
          Abweichungen: ['Optik-Note: Gerät 4, Modell-Inserat 2'],
        }),
        timed: 1,
      },
    ]);
  });

  it('AC-REQ-019-05 "new_listing" stores RAM 8 GB of a device assigned to MI-A with RAM 16 GB and creates a second model listing with RAM 8 GB to which the device is assigned', async () => {
    // MI-A comes from another device, so the WI-Nr of this one is free as article number.
    const { listingId: miA } = await listingFrom('626199', '2');
    const deviceId = await captureDevice('626198', '2');
    const assigned = await write('POST', `/api/devices/${deviceId}/assignment`, {
      version: 1,
      listingId: miA,
      confirmDeviation: false,
    });
    expect(assigned.statusCode).toBe(200);
    const version = deviceRow(deviceId)?.version as number;
    const ram = String(attribute('RAM'));
    const listingBefore = listingRow(miA);
    const lastAudit = rows<{ id: number }>('SELECT MAX(id) AS id FROM audit_entry')[0]?.id ?? 0;

    const response = await patch(deviceId, {
      version,
      values: { [ram]: '8' },
      confirmedKeys: [],
      deviationDecision: 'new_listing',
    });

    expect(response.statusCode).toBe(200);
    const created = response.json().listingId as number;
    expect(created).not.toBe(miA);
    expect(response.json()).toMatchObject({ id: deviceId, values: { [ram]: 8 } });
    expect(listingRow(created)).toMatchObject({ model_template_id: template, quantity: 1 });
    expect(JSON.parse(listingRow(created)?.variant_values as string)[ram]).toBe(8);
    // MI-A keeps its values and loses the device (AC-REQ-019-07).
    expect(listingRow(miA)).toMatchObject({
      variant_values: listingBefore?.variant_values,
      quantity: 1,
    });
    expect(
      rows<{ object_type: string; action: string }>(
        'SELECT object_type, action FROM audit_entry WHERE id > ? ORDER BY id',
        lastAudit,
      ),
    ).toEqual([
      { object_type: 'device', action: 'values_updated' },
      { object_type: 'listing', action: 'created' },
      { object_type: 'device', action: 'assigned' },
    ]);
  });

  it('"new_listing" is rejected with variant_duplicate when the changed device matches another model listing, and nothing is stored', async () => {
    const { deviceId, miA, version } = await assignedToMiA();
    const miB = (await listingFrom('626199', '4')).listingId;
    const deviceBefore = deviceRow(deviceId);
    const audits = count('audit_entry');

    const response = await patch(deviceId, {
      version,
      visualGrade: '4',
      confirmedKeys: [],
      deviationDecision: 'new_listing',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'variant_duplicate',
      details: { listingId: miB },
    });
    expect(deviceRow(deviceId)).toEqual(deviceBefore);
    expect(rows('SELECT id FROM listing ORDER BY id')).toEqual([{ id: miA }, { id: miB }]);
    expect(count('audit_entry')).toBe(audits);
  });

  it('"new_listing" is rejected with article_number_taken as in UI-004 when the WI-Nr is the article number of MI-A, and nothing is stored', async () => {
    const { deviceId, version } = await assignedToMiA();
    const deviceBefore = deviceRow(deviceId);
    const audits = count('audit_entry');

    const response = await patch(deviceId, {
      version,
      values: { [attribute('RAM')]: '8' },
      confirmedKeys: [],
      deviationDecision: 'new_listing',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('article_number_taken');
    expect(deviceRow(deviceId)).toEqual(deviceBefore);
    expect(count('audit_entry')).toBe(audits);
  });

  it('checks the field rules before the question (validation_failed for visual grade 9)', async () => {
    const { deviceId, version } = await assignedToMiA();

    const response = await patch(deviceId, { version, visualGrade: '9', confirmedKeys: [] });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');
  });

  it('stores without a question when only values outside the variant data change (battery capacity)', async () => {
    const { deviceId, version } = await assignedToMiA();

    const response = await patch(deviceId, {
      version,
      values: { [attribute('Akkukapazität')]: { percent: '60' } },
      confirmedKeys: [],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().values[attribute('Akkukapazität')]).toEqual({ percent: 60 });
  });

  it('stores without a question when the changed variant data match the model listing again', async () => {
    const { deviceId, version } = await assignedToMiA();
    const kept = await patch(deviceId, {
      version,
      visualGrade: '4',
      confirmedKeys: [],
      deviationDecision: 'keep',
    });
    expect(kept.statusCode).toBe(200);

    const response = await patch(deviceId, {
      version: version + 1,
      visualGrade: '2',
      confirmedKeys: [],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().visualGrade).toBe(2);
  });

  it('stores the variant value of an unassigned device without a question', async () => {
    const deviceId = await captureDevice('626198', '2');

    const response = await patch(deviceId, { version: 1, visualGrade: '4', confirmedKeys: [] });

    expect(response.statusCode).toBe(200);
    expect(count('device')).toBe(1);
  });
});
