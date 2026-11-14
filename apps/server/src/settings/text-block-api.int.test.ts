import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertPickLists } from '../../test/pick-lists.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { runMigrations } from '../db/migrator.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import { createClock } from '../shared/clock.ts';

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

const list = (query = '') =>
  t.app.inject({ method: 'GET', url: `/api/text-blocks${query}`, headers: { host: HOST } });

const write = (method: 'POST' | 'PATCH' | 'DELETE', url: string, body?: Record<string, unknown>) =>
  t.app.inject({ method, url, headers: SAME_ORIGIN_WRITE, payload: body });

const create = (change: Record<string, unknown> = {}) =>
  write('POST', '/api/text-blocks', {
    name: 'Abholung',
    kind: 'pickup_contact',
    body: 'Abholung in Hannover nach Absprache.',
    ...change,
  });

const patch = (id: number, body: Record<string, unknown>) =>
  write('PATCH', `/api/text-blocks/${id}`, body);

const createAbholung = async () => (await create()).json().textBlock;

const auditRows = () =>
  t.database.sqlite
    .prepare(
      "SELECT action, object_id, object_label, old_value, new_value FROM audit_entry WHERE object_type = 'text_block' ORDER BY id",
    )
    .all();

const countRows = () => t.database.sqlite.prepare('SELECT COUNT(*) FROM text_block').pluck().get();

const fieldError = (path: string, message: string) => ({
  code: 'validation_failed',
  message: '',
  fields: [{ path, code: expect.any(String), message }],
  details: {},
  referenceNumber: null,
});

const NO_IMPACT = { updated: 0, rerelease: 0, manualReview: 0 };
const NO_LEGAL_STATUS = { legalStatus: null, legalCheckedOn: null, legalCheckedBy: null };

describe('text block API (CU-087, CU-082, Technical Specification 2.2)', () => {
  it('creates an active text block and answers 201 { textBlock, impact }', async () => {
    const response = await create({ name: ' Abholung ' });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      textBlock: {
        id: expect.any(Number),
        name: 'Abholung',
        kind: 'pickup_contact',
        body: 'Abholung in Hannover nach Absprache.',
        active: true,
        ...NO_LEGAL_STATUS,
        version: 1,
      },
      impact: NO_IMPACT,
    });
    expect((await list()).json()).toEqual({ items: [response.json().textBlock], total: 1 });
  });

  it('stores a new text block for all device types and all channels', async () => {
    await createAbholung();

    expect(
      t.database.sqlite.prepare('SELECT all_device_types, all_channels FROM text_block').get(),
    ).toEqual({ all_device_types: 1, all_channels: 1 });
  });

  it('lists the text blocks by name without regard to case, active and deactivated, paged', async () => {
    for (const name of ['b', 'C', 'a']) await create({ name });
    const [first] = (await list()).json().items;
    await patch(first.id, { version: 1, active: false });

    expect((await list()).json().items.map((item: { name: string }) => item.name)).toEqual([
      'a',
      'b',
      'C',
    ]);
    expect((await list('?limit=1&offset=1')).json()).toMatchObject({
      items: [{ name: 'b' }],
      total: 3,
    });
  });

  it('AC-REQ-026-02 a text with {Garantiezeit} is rejected and the unknown placeholder named', async () => {
    const response = await create({ body: 'Garantie: {Garantiezeit} ab Kaufdatum' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toEqual({
      code: 'placeholder_not_allowed',
      message: 'Unbekannter Platzhalter {Garantiezeit}',
      fields: [],
      details: { field: 'body', placeholder: '{Garantiezeit}' },
      referenceNumber: null,
    });
    expect(countRows()).toBe(0);
  });

  it('AC-REQ-026-02 a change of the text to an unknown placeholder is rejected as well', async () => {
    const abholung = await createAbholung();

    const response = await patch(abholung.id, { version: 1, body: 'Bis {Garantiezeit}' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.message).toBe('Unbekannter Platzhalter {Garantiezeit}');
    expect((await list()).json().items[0]).toEqual(abholung);
  });

  it('DER-39-05 {Baustein:Name} is rejected with "{Baustein:Name} ist im Textbaustein nicht zulässig"', async () => {
    const response = await create({ body: 'Siehe {Baustein:Rechtliches}' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'placeholder_not_allowed',
      message: '{Baustein:Name} ist im Textbaustein nicht zulässig',
      details: { field: 'body', placeholder: '{Baustein:Rechtliches}' },
    });
    expect(countRows()).toBe(0);
  });

  it('accepts fixed placeholders and the label of an attribute of any device type', async () => {
    const deviceType = (
      await write('POST', '/api/device-types', { name: 'Notebook', active: true })
    ).json();
    const attribute = await write('POST', `/api/device-types/${deviceType.id}/attributes`, {
      label: 'RAM',
      dataType: 'integer',
      unit: 'GB',
      unitSpacing: false,
      minValue: null,
      maxValue: null,
      pickListId: null,
      level: 'device',
      variantForming: false,
      required: false,
      datasheetBlock: 'technical',
      active: true,
    });
    expect(attribute.statusCode).toBe(201);

    const response = await create({
      kind: 'battery_notice',
      body: 'Akku {Akkukapazität}, {RAM} GB, {Hersteller} {Modellbezeichnung}, Stück {Stückzahl}',
    });

    expect(response.statusCode).toBe(201);
  });

  it('DER-39-05 a name already given, in any case, is rejected with name_taken "Name ist bereits vergeben"', async () => {
    const abholung = await createAbholung();
    const other = (await create({ name: 'Rechtliches', kind: 'legal' })).json().textBlock;

    const onCreate = await create({ name: 'ABHOLUNG' });
    const onRename = await patch(other.id, { version: 1, name: 'abholung' });

    for (const response of [onCreate, onRename]) {
      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'name_taken',
        message: 'Name ist bereits vergeben',
      });
    }
    expect((await list()).json().items).toEqual([abholung, other]);
  });

  it('DER-39-05 a name of a deactivated text block is taken as well', async () => {
    const abholung = await createAbholung();
    await patch(abholung.id, { version: 1, active: false });

    expect((await create({ name: 'Abholung' })).json().error.code).toBe('name_taken');
  });

  it.each([
    ['empty', ''],
    ['101 characters long', 'x'.repeat(101)],
  ])(
    'DER-39-05 a name that is %s is rejected with validation_failed at the field name (M-30)',
    async (_case, name) => {
      const response = await create({ name });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toEqual(fieldError('name', 'Name: 1 bis 100 Zeichen'));
      expect(countRows()).toBe(0);
    },
  );

  it('DER-39-05 a text of 5,001 characters is rejected with the field rule at the field body', async () => {
    const response = await create({ body: 'x'.repeat(5001) });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toEqual(fieldError('body', 'Text: 1 bis 5.000 Zeichen'));
  });

  it('DER-39-05 a name of 100 characters and a text of 5,000 characters are accepted', async () => {
    const response = await create({ name: 'n'.repeat(100), body: 'x'.repeat(5000) });

    expect(response.statusCode).toBe(201);
    expect(response.json().textBlock).toMatchObject({
      name: 'n'.repeat(100),
      body: 'x'.repeat(5000),
    });
  });

  it('rejects a kind outside the five kinds and stores nothing', async () => {
    expect((await create({ kind: 'warranty' })).statusCode).toBe(422);
    expect(countRows()).toBe(0);
  });

  it('changes name, kind and text with a new version and answers { textBlock, impact }', async () => {
    const abholung = await createAbholung();

    const response = await patch(abholung.id, {
      version: 1,
      name: 'Abholung Hannover',
      kind: 'other',
      body: 'Abholung {Händler-Kontakt}',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      textBlock: {
        id: abholung.id,
        name: 'Abholung Hannover',
        kind: 'other',
        body: 'Abholung {Händler-Kontakt}',
        active: true,
        ...NO_LEGAL_STATUS,
        version: 2,
      },
      impact: NO_IMPACT,
      legalStatusReset: false,
    });
  });

  it('DER-39-13 deactivates through PATCH; there is no DELETE route', async () => {
    const abholung = await createAbholung();

    const deleted = await write('DELETE', `/api/text-blocks/${abholung.id}`, {});
    const deactivated = await patch(abholung.id, { version: 1, active: false });

    expect(deleted.statusCode).toBe(404);
    expect(t.app.hasRoute({ method: 'DELETE', url: '/api/text-blocks/:id' })).toBe(false);
    expect(deactivated.json().textBlock).toMatchObject({ active: false, version: 2 });
    expect(countRows()).toBe(1);
  });

  it('writes one audit entry for the changed fields and one for the status (2.0.9, 3.6)', async () => {
    const abholung = await createAbholung();
    await patch(abholung.id, { version: 1, name: 'Abholung Hannover', body: 'Neu' });
    await patch(abholung.id, { version: 2, kind: 'other', active: false });

    expect(auditRows()).toEqual([
      {
        action: 'created',
        object_id: abholung.id,
        object_label: 'Textbaustein Abholung',
        old_value: null,
        new_value: JSON.stringify({
          Name: 'Abholung',
          Art: 'Abholung/Kontakt',
          Text: 'Abholung in Hannover nach Absprache.',
          Status: 'aktiv',
        }),
      },
      {
        action: 'updated',
        object_id: abholung.id,
        object_label: 'Textbaustein Abholung Hannover',
        old_value: JSON.stringify({
          Name: 'Abholung',
          Text: 'Abholung in Hannover nach Absprache.',
        }),
        new_value: JSON.stringify({ Name: 'Abholung Hannover', Text: 'Neu' }),
      },
      {
        action: 'updated',
        object_id: abholung.id,
        object_label: 'Textbaustein Abholung Hannover',
        old_value: JSON.stringify({ Art: 'Abholung/Kontakt' }),
        new_value: JSON.stringify({ Art: 'Sonstiges' }),
      },
      {
        action: 'deactivated',
        object_id: abholung.id,
        object_label: 'Textbaustein Abholung Hannover',
        old_value: JSON.stringify({ Status: 'aktiv' }),
        new_value: JSON.stringify({ Status: 'deaktiviert' }),
      },
    ]);
  });

  it('a change without a difference keeps the version and writes no audit entry', async () => {
    const abholung = await createAbholung();

    const response = await patch(abholung.id, {
      version: 1,
      name: abholung.name,
      kind: abholung.kind,
      body: abholung.body,
      active: true,
    });

    expect(response.json()).toEqual({
      textBlock: abholung,
      impact: NO_IMPACT,
      legalStatusReset: false,
    });
    expect(auditRows()).toHaveLength(1);
  });

  it('DER-39-07 (a) an outdated version is rejected with 409 version_conflict and changes nothing', async () => {
    const abholung = await createAbholung();
    await patch(abholung.id, { version: 1, body: 'Neu' });

    const response = await patch(abholung.id, { version: 1, body: 'Alt' });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('version_conflict');
    expect((await list()).json().items[0]).toMatchObject({ body: 'Neu', version: 2 });
  });

  it('answers 404 not_found with M-15 for an unknown text block', async () => {
    const response = await patch(99, { version: 1, name: 'X' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.message).toBe('Dieser Eintrag ist nicht mehr vorhanden.');
  });

  it('DER-39-04 a technical error answers 500 with the reference number of the error log and stores nothing', async () => {
    t.database.sqlite.exec(
      "CREATE TRIGGER fail_text_block BEFORE INSERT ON text_block BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );

    const response = await create();

    expect(response.statusCode).toBe(500);
    const { error } = response.json();
    expect(error.code).toBe('internal_error');
    expect(error.referenceNumber).toMatch(/^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(t.readErrorLog()).toEqual([expect.objectContaining({ refNo: error.referenceNumber })]);
    expect(countRows()).toBe(0);
    expect(auditRows()).toEqual([]);
  });

  it('stores no change without its audit entry (2.0.4)', async () => {
    const abholung = await createAbholung();
    t.database.sqlite.exec(
      "CREATE TRIGGER fail_audit BEFORE INSERT ON audit_entry BEGIN SELECT RAISE(ABORT, 'audit'); END",
    );

    expect((await patch(abholung.id, { version: 1, body: 'Neu' })).statusCode).toBe(500);

    expect((await list()).json().items[0]).toEqual(abholung);
  });

  it('DER-39-07 (c) a write while shutting down is rejected with 503 shutting_down and stores nothing', async () => {
    t.lifecycle.set('stopping');

    const response = await create();

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({ code: 'shutting_down', referenceNumber: null });
    expect(countRows()).toBe(0);
  });
});

describe('legal check status of text blocks (CU-082, REQ-054, Technical Specification 2.2)', () => {
  const LEGAL_REQUIRED = 'Prüfdatum und prüfende Stelle erforderlich';
  const CHECKED = {
    legalStatus: 'checked',
    legalCheckedOn: '2026-11-05',
    legalCheckedBy: 'Kanzlei Muster',
  } as const;

  const createLegal = async (kind = 'legal') =>
    (await create({ name: 'Widerruf', kind, body: 'Widerrufsbelehrung' })).json().textBlock;

  /** A text block of the kind "Rechtliches" in "rechtlich geprüft", version 2. */
  const createChecked = async () => {
    const legal = await createLegal();
    return (await patch(legal.id, { version: 1, ...CHECKED })).json().textBlock;
  };

  const storedLegal = (id: number) =>
    t.database.sqlite
      .prepare(
        'SELECT legal_status, legal_checked_on, legal_checked_by, version FROM text_block WHERE id = ?',
      )
      .get(id);

  it('AC-REQ-054-04 a new text block of the kind Akku-Hinweis is "rechtlich ungeprüft", one of the kind Abholung/Kontakt has no check status', async () => {
    const battery = await create({ name: 'Akku', kind: 'battery_notice', body: 'Akku-Hinweis' });
    const pickup = await create();

    expect(battery.statusCode).toBe(201);
    expect(battery.json().textBlock).toMatchObject({
      kind: 'battery_notice',
      legalStatus: 'unchecked',
      legalCheckedOn: null,
      legalCheckedBy: null,
    });
    expect(pickup.json().textBlock).toMatchObject({ kind: 'pickup_contact', ...NO_LEGAL_STATUS });
  });

  it('DER-40-05 a new text block of the kinds Lieferumfang and Sonstiges has no check status, one of the kind Rechtliches is "rechtlich ungeprüft"', async () => {
    const kinds = ['delivery_scope', 'other', 'legal'];
    const created = [];
    for (const kind of kinds) {
      created.push((await create({ name: kind, kind })).json().textBlock.legalStatus);
    }

    expect(created).toEqual([null, null, 'unchecked']);
  });

  it('sets "rechtlich geprüft" with check date and checking body', async () => {
    const legal = await createLegal();

    const response = await patch(legal.id, {
      version: 1,
      ...CHECKED,
      legalCheckedBy: ' Kanzlei Muster ',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      textBlock: { ...legal, ...CHECKED, version: 2 },
      impact: NO_IMPACT,
      legalStatusReset: false,
    });
    expect(storedLegal(legal.id)).toEqual({
      legal_status: 'checked',
      legal_checked_on: '2026-11-05',
      legal_checked_by: 'Kanzlei Muster',
      version: 2,
    });
  });

  it('AC-REQ-054-02 after a change of the text of a "rechtlich geprüft" text block it is "rechtlich ungeprüft" and the answer reports legalStatusReset: true', async () => {
    const checked = await createChecked();

    const response = await patch(checked.id, { version: 2, body: 'Neue Widerrufsbelehrung' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      textBlock: {
        ...checked,
        body: 'Neue Widerrufsbelehrung',
        legalStatus: 'unchecked',
        legalCheckedOn: null,
        legalCheckedBy: null,
        version: 3,
      },
      impact: NO_IMPACT,
      legalStatusReset: true,
    });
  });

  it('DER-40-03 a change of the text resets the status also if the request sends the check fields', async () => {
    const checked = await createChecked();

    const response = await patch(checked.id, { version: 2, body: 'Neu', ...CHECKED });

    expect(response.json()).toMatchObject({
      textBlock: { legalStatus: 'unchecked', legalCheckedOn: null, legalCheckedBy: null },
      legalStatusReset: true,
    });
  });

  it('DER-40-03 a change of name or kind only keeps "rechtlich geprüft" and reports no reset', async () => {
    const checked = await createChecked();

    const response = await patch(checked.id, {
      version: 2,
      name: 'Widerruf neu',
      kind: 'battery_notice',
    });

    expect(response.json()).toMatchObject({
      textBlock: { kind: 'battery_notice', ...CHECKED },
      legalStatusReset: false,
    });
  });

  it('DER-40-03 a change of the text of a "rechtlich ungeprüft" text block reports no reset', async () => {
    const legal = await createLegal();

    const response = await patch(legal.id, { version: 1, body: 'Neu' });

    expect(response.json()).toMatchObject({
      textBlock: { legalStatus: 'unchecked' },
      legalStatusReset: false,
    });
  });

  it('AC-REQ-054-03 "rechtlich geprüft" without check date is rejected with "Prüfdatum und prüfende Stelle erforderlich"', async () => {
    const legal = await createLegal();

    const response = await patch(legal.id, { version: 1, ...CHECKED, legalCheckedOn: '' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toEqual({
      code: 'validation_failed',
      message: '',
      fields: [{ path: 'legalCheckedOn', code: 'legal_check_required', message: LEGAL_REQUIRED }],
      details: {},
      referenceNumber: null,
    });
    expect(storedLegal(legal.id)).toMatchObject({ legal_status: 'unchecked', version: 1 });
  });

  it.each([
    ['the checking body', { legalCheckedBy: '' }, ['legalCheckedBy']],
    ['a checking body of only spaces', { legalCheckedBy: '   ' }, ['legalCheckedBy']],
    ['both', { legalCheckedOn: '', legalCheckedBy: '' }, ['legalCheckedOn', 'legalCheckedBy']],
    [
      'both, sending only the status',
      { legalCheckedOn: undefined, legalCheckedBy: undefined },
      ['legalCheckedOn', 'legalCheckedBy'],
    ],
  ])(
    'DER-40-01 "rechtlich geprüft" without %s gives one entry per missing field with M-24',
    async (_case, change, paths) => {
      const legal = await createLegal();

      const response = await patch(legal.id, { version: 1, ...CHECKED, ...change });

      expect(response.statusCode).toBe(422);
      expect(response.json().error.fields).toEqual(
        paths.map((path) => ({ path, code: 'legal_check_required', message: LEGAL_REQUIRED })),
      );
      expect(storedLegal(legal.id)).toMatchObject({ legal_status: 'unchecked', version: 1 });
    },
  );

  it('DER-40-02 a check date in the future is rejected at the field legalCheckedOn', async () => {
    const legal = await createLegal();

    const response = await patch(legal.id, {
      version: 1,
      ...CHECKED,
      legalCheckedOn: '2999-12-31',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toEqual(
      fieldError('legalCheckedOn', 'Prüfdatum darf nicht in der Zukunft liegen'),
    );
    expect(storedLegal(legal.id)).toMatchObject({ legal_status: 'unchecked', version: 1 });
  });

  it('DER-40-02 a check date of today is accepted', async () => {
    const legal = await createLegal();
    const today = createClock().today();

    const response = await patch(legal.id, { version: 1, ...CHECKED, legalCheckedOn: today });

    expect(response.json().textBlock).toMatchObject({ legalCheckedOn: today });
  });

  it('DER-40-06 a checking body of 100 characters is accepted', async () => {
    const legal = await createLegal();
    const legalCheckedBy = 'a'.repeat(100);

    const response = await patch(legal.id, { version: 1, ...CHECKED, legalCheckedBy });

    expect(response.statusCode).toBe(200);
    expect(storedLegal(legal.id)).toMatchObject({ legal_checked_by: legalCheckedBy });
  });

  it('DER-40-06 a checking body of 101 characters is rejected with validation_failed at legalCheckedBy and not stored', async () => {
    const legal = await createLegal();

    const response = await patch(legal.id, {
      version: 1,
      ...CHECKED,
      legalCheckedBy: 'a'.repeat(101),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toEqual(
      fieldError('legalCheckedBy', 'Prüfende Stelle: höchstens 100 Zeichen'),
    );
    expect(storedLegal(legal.id)).toMatchObject({ legal_status: 'unchecked', version: 1 });
  });

  it('sets "rechtlich ungeprüft" again without check date and checking body', async () => {
    const checked = await createChecked();

    const response = await patch(checked.id, {
      version: 2,
      legalStatus: 'unchecked',
      legalCheckedOn: '',
      legalCheckedBy: '',
    });

    expect(response.json()).toMatchObject({
      textBlock: { legalStatus: 'unchecked', legalCheckedOn: null, legalCheckedBy: null },
      legalStatusReset: false,
    });
  });

  it('DER-40-05 a change to a kind without check status empties the check fields, a change to Rechtliches makes it "rechtlich ungeprüft"', async () => {
    const checked = await createChecked();
    const abholung = await createAbholung();

    const toOther = await patch(checked.id, { version: 2, kind: 'other' });
    const toLegal = await patch(abholung.id, { version: 1, kind: 'legal' });

    expect(toOther.json().textBlock).toMatchObject({ kind: 'other', ...NO_LEGAL_STATUS });
    expect(toLegal.json().textBlock).toMatchObject({ kind: 'legal', legalStatus: 'unchecked' });
  });

  it('DER-40-05 check fields for a kind without check status are a structural error (400 bad_request)', async () => {
    const abholung = await createAbholung();

    const response = await patch(abholung.id, { version: 1, ...CHECKED });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ code: 'bad_request', referenceNumber: null });
    expect(storedLegal(abholung.id)).toMatchObject({ legal_status: null, version: 1 });
  });

  it('rejects a check date in another notation as a structural error (400 bad_request)', async () => {
    const legal = await createLegal();

    const response = await patch(legal.id, {
      version: 1,
      ...CHECKED,
      legalCheckedOn: '05.11.2026',
    });

    expect(response.statusCode).toBe(400);
    expect(storedLegal(legal.id)).toMatchObject({ version: 1 });
  });

  it('writes the audit entry legal_status_changed with the changed check fields (3.6)', async () => {
    const checked = await createChecked();
    await patch(checked.id, { version: 2, body: 'Neu' });

    const rows = auditRows();
    expect(rows[0]).toMatchObject({
      action: 'created',
      new_value: JSON.stringify({
        Name: 'Widerruf',
        Art: 'Rechtliches',
        Text: 'Widerrufsbelehrung',
        Status: 'aktiv',
        Prüfstatus: 'rechtlich ungeprüft',
      }),
    });
    expect(rows.slice(1)).toEqual([
      {
        action: 'legal_status_changed',
        object_id: checked.id,
        object_label: 'Textbaustein Widerruf',
        old_value: JSON.stringify({
          Prüfstatus: 'rechtlich ungeprüft',
          Prüfdatum: null,
          'Prüfende Stelle': null,
        }),
        new_value: JSON.stringify({
          Prüfstatus: 'rechtlich geprüft',
          Prüfdatum: '2026-11-05',
          'Prüfende Stelle': 'Kanzlei Muster',
        }),
      },
      {
        action: 'updated',
        object_id: checked.id,
        object_label: 'Textbaustein Widerruf',
        old_value: JSON.stringify({ Text: 'Widerrufsbelehrung' }),
        new_value: JSON.stringify({ Text: 'Neu' }),
      },
      {
        action: 'legal_status_changed',
        object_id: checked.id,
        object_label: 'Textbaustein Widerruf',
        old_value: JSON.stringify({
          Prüfstatus: 'rechtlich geprüft',
          Prüfdatum: '2026-11-05',
          'Prüfende Stelle': 'Kanzlei Muster',
        }),
        new_value: JSON.stringify({
          Prüfstatus: 'rechtlich ungeprüft',
          Prüfdatum: null,
          'Prüfende Stelle': null,
        }),
      },
    ]);
  });
});
