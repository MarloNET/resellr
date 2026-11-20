import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of `UI-014.edit` (CU-139, CU-138, #206) with a mocked `fetch` (Technical
// Specification 6.1, 6.2, 10.2 T11, T5j): the fields of the listing values, saving with its
// states, the patterns P-05, P-07, P-08 and the choice after `pick_list_value_deactivated`
// (2.0.11, design v0.6.8).

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const PICK_LISTS = [
  { id: 1, key: 'condition', name: 'Zustand', isBatteryList: false, version: 1 },
  { id: 5, key: 'storage_type', name: 'Speichertyp', isBatteryList: false, version: 1 },
  { id: 8, key: 'port_type', name: 'Anschlusstyp', isBatteryList: false, version: 1 },
  { id: 9, key: 'port_position', name: 'Anschlussposition', isBatteryList: false, version: 1 },
  { id: 11, key: 'keyboard_layout', name: 'Tastaturlayout', isBatteryList: false, version: 1 },
  { id: 12, key: 'power_supply', name: 'Netzteil', isBatteryList: false, version: 1 },
];
const value = (id: number, label: string, active = true) => ({
  id,
  label,
  active,
  batteryPresent: null,
  sortOrder: id,
  version: 1,
});

const USED = 1;
const REFURBISHED = 2;
const DEFECT = 3;
const SSD = 51;
const HDD = 52;
const GERMAN = 111;
const HUNGARIAN = 112;
const ENGLISH = 113;
const ORIGINAL = 121;
const WITHOUT = 122;

const START_LISTS: Record<number, ReturnType<typeof value>[]> = {
  1: [value(USED, 'gebraucht'), value(REFURBISHED, 'refurbished'), value(DEFECT, 'defekt')],
  5: [value(SSD, 'SSD (NVMe)'), value(HDD, 'HDD')],
  8: [],
  9: [],
  11: [
    value(GERMAN, 'Deutsch (QWERTZ)'),
    value(HUNGARIAN, 'Ungarisch'),
    value(ENGLISH, 'Englisch (QWERTY, US)'),
  ],
  12: [value(ORIGINAL, 'mit Netzteil (original)'), value(WITHOUT, 'ohne Netzteil')],
};

const attribute = (change: Record<string, unknown>) => ({
  deviceTypeId: 1,
  systemRole: null,
  unit: null,
  unitSpacing: true,
  minValue: null,
  maxValue: null,
  pickListId: null,
  level: 'device',
  variantForming: false,
  required: false,
  datasheetBlock: 'technical',
  active: true,
  version: 1,
  hasValues: true,
  ...change,
});
const ATTRIBUTES = [
  attribute({ id: 10, label: 'Prozessor', dataType: 'text', level: 'model', sortOrder: 0 }),
  attribute({
    id: 15,
    label: 'Speichertyp',
    dataType: 'pick',
    pickListId: 5,
    variantForming: true,
    sortOrder: 1,
  }),
  attribute({
    id: 16,
    label: 'Tastaturlayout',
    dataType: 'pick',
    systemRole: 'keyboard_layout',
    pickListId: 11,
    required: true,
    variantForming: true,
    sortOrder: 2,
  }),
  attribute({
    id: 17,
    label: 'Netzteil',
    dataType: 'pick',
    systemRole: 'power_supply',
    pickListId: 12,
    required: true,
    sortOrder: 3,
  }),
  attribute({
    id: 19,
    label: 'Akkukapazität',
    dataType: 'battery_capacity',
    systemRole: 'battery_capacity',
    sortOrder: 4,
  }),
];

const TEXT_BLOCK = {
  kind: 'delivery_scope',
  body: '',
  active: true,
  legalStatus: null,
  legalCheckedOn: null,
  legalCheckedBy: null,
  allDeviceTypes: true,
  deviceTypeIds: [],
  allChannels: true,
  channelIds: [],
  version: 1,
};
const TEXT_BLOCKS = [
  { ...TEXT_BLOCK, id: 61, name: 'Netzkabel' },
  { ...TEXT_BLOCK, id: 62, name: 'Originalverpackung', allDeviceTypes: false, deviceTypeIds: [1] },
  { ...TEXT_BLOCK, id: 63, name: 'Dockingstation', allDeviceTypes: false, deviceTypeIds: [2] },
  { ...TEXT_BLOCK, id: 64, name: 'Altes Kabel', active: false },
  { ...TEXT_BLOCK, id: 65, name: 'Abholung', kind: 'pickup_contact' },
];

const LISTING = {
  id: 9,
  modelTemplateId: 7,
  conditionValueId: USED,
  visualGrade: 2,
  conditionDescription: 'Kratzer am Deckel',
  variantValues: { '15': SSD, '16': GERMAN },
  otherValues: { '17': ORIGINAL },
  deliveryScopeTextBlockIds: [61],
  articleNumber: '626198',
  eanMode: 'original',
  ownEan: null,
  displayTitle: 'ThinkPad T14 Gen 2',
  quantity: 1,
  version: 1,
  stock: { quantity: 1, wiNrs: [], batteryText: '', stockHash: 'ab12' },
  prices: [],
  devices: [],
  deliveryScope: [{ id: 61, name: 'Netzkabel' }],
};

const ARTICLE_NUMBER_RULE = 'Artikelnummer: 1 bis 30 Zeichen, nur Buchstaben, Ziffern und „-“';
const EAN_RULE = 'EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer';
const DEFECT_DEACTIVATED = 'Zustand defekt ist deaktiviert';

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});
const deactivated = (message: string, path: string, id: number) => () =>
  Response.json(errorBody('pick_list_value_deactivated', { message, details: { path, id } }), {
    status: 422,
  });
const list = (items: unknown[]) => Response.json({ items, total: items.length });
const failed = () =>
  Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), { status: 500 });

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

/** The answer of a saved `PATCH` as the server gives it: the model listing with version 2. */
function savedAnswer(init: RequestInit | undefined) {
  const { variantValues, otherValues, confirmDeviatingDevices, ...fields } = JSON.parse(
    String(init?.body),
  ) as Record<string, unknown>;
  void confirmDeviatingDevices;
  return Response.json({
    ...LISTING,
    ...fields,
    variantValues: { ...LISTING.variantValues, ...(variantValues as object) },
    otherValues: { ...LISTING.otherValues, ...(otherValues as object) },
    version: 2,
  });
}

/**
 * The next read of list `delayedListId` after a save, answered when the test calls `answer` (open
 * promise), so a choice fits in between; later reads answer as usual.
 */
function delayedReload(delayedListId: number) {
  let answer: (response: Response) => void = () => {};
  const delayed = new Promise<Response>((resolve) => {
    answer = resolve;
  });
  let given = false;
  const reload = (listId: number) => {
    if (listId !== delayedListId || given) return undefined;
    given = true;
    return delayed;
  };
  return { reload, answer };
}

/**
 * `fetch` of UI-014 with lists the test can change in "another window": `listing` answers
 * `GET /api/listings/9`, `update` the `PATCH`, `reload` the reads of a list after the first save.
 * Records the bodies of the `PATCH` and the number of reads per list.
 */
function mockApi({
  listing = LISTING,
  update = savedAnswer,
  reload,
}: {
  listing?: Record<string, unknown>;
  update?: Route;
  reload?: (listId: number) => Response | Promise<Response> | undefined;
} = {}) {
  const lists = structuredClone(START_LISTS);
  const sent: Record<string, unknown>[] = [];
  const reads: Record<number, number> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://127.0.0.1');
      const route = `${init?.method ?? 'GET'} ${url.pathname}`;
      const values = /^GET \/api\/pick-lists\/(\d+)\/values$/.exec(route);
      if (values) {
        const listId = Number(values[1]);
        reads[listId] = (reads[listId] ?? 0) + 1;
        const answer = sent.length > 0 ? reload?.(listId) : undefined;
        return answer ?? list(lists[listId] ?? []);
      }
      if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (route === 'GET /api/listings/9') return Response.json(listing);
      if (route === 'GET /api/pick-lists') return list(PICK_LISTS);
      if (route === 'GET /api/text-blocks') return list(TEXT_BLOCKS);
      if (route === 'GET /api/channels') return list([]);
      if (route === 'GET /api/device-types') {
        return list([{ id: 1, name: 'Notebook', active: true, version: 1, attributeCount: 5 }]);
      }
      if (route === 'GET /api/model-templates/7') {
        return Response.json({
          id: 7,
          deviceTypeId: 1,
          originalEan: '0194252146835',
          modelValues: {},
          defaultDeviceValues: {},
        });
      }
      if (route === 'GET /api/device-types/1/attributes') return list(ATTRIBUTES);
      if (route === 'PATCH /api/listings/9') {
        sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return update(init);
      }
      throw new Error(`unexpected request ${route}`);
    }),
  );
  const deactivate = (listId: number, id: number) => {
    const entry = lists[listId]?.find((candidate) => candidate.id === id);
    if (entry !== undefined) entry.active = false;
  };
  return { sent, reads, deactivate };
}

const form = () => screen.getByRole('form', { name: 'Inseratswerte bearbeiten' });
const select = (name: string) =>
  within(form()).getByRole<HTMLSelectElement>('combobox', { name: new RegExp(`^${name}`) });
const textbox = (name: string) =>
  within(form()).getByRole<HTMLInputElement>('textbox', { name: new RegExp(`^${name}`) });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Speichern|Speichern …)$/ });
const optionTexts = (control: HTMLSelectElement) => Array.from(control.options, ({ text }) => text);
const shownText = (control: HTMLSelectElement) => control.selectedOptions[0]?.text;

function errorOf(control: HTMLElement): string | null {
  const id = control.getAttribute('aria-describedby');
  return id === null ? null : (document.getElementById(id)?.textContent ?? null);
}

async function choose(name: string, valueId: number) {
  await vi.waitFor(() =>
    expect(Array.from(select(name).options, (option) => option.value)).toContain(String(valueId)),
  );
  fireEvent.change(select(name), { target: { value: String(valueId) } });
}

/** UI-014 of model listing 9 with "Bearbeiten" chosen and every list of the form read. */
async function openEdit() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/inserate/9'] })} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
  await screen.findByRole('form', { name: 'Inseratswerte bearbeiten' });
  await vi.waitFor(() => expect(optionTexts(select('Netzteil'))).toContain('ohne Netzteil'));
  await vi.waitFor(() => expect(optionTexts(select('Zustand')).length).toBeGreaterThan(1));
  await vi.waitFor(() => expect(optionTexts(select('Tastaturlayout')).length).toBeGreaterThan(1));
  await vi.waitFor(() => expect(optionTexts(select('Speichertyp')).length).toBeGreaterThan(1));
  await within(form()).findByRole('checkbox', { name: 'Netzkabel' });
}

/** Accessibility assertion: named controls with labels, linked field errors, named buttons. */
function expectAccessibleForm() {
  for (const control of [
    ...within(form()).queryAllByRole('combobox'),
    ...within(form()).queryAllByRole('textbox'),
  ]) {
    expect(document.querySelector(`label[for="${control.id}"]`)?.textContent).toBeTruthy();
    if (control.getAttribute('aria-invalid') === 'true') expect(errorOf(control)).toBeTruthy();
  }
  for (const checkbox of within(form()).queryAllByRole('checkbox')) {
    expect(checkbox.closest('label')?.textContent).toBeTruthy();
  }
  for (const button of screen.queryAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UI-014.edit Inseratswerte bearbeiten (CU-139, Story #64)', () => {
  it('UI-014.edit DER-64-01 shows the fields of UI-003 with delivery scope, article number, EAN marking and own EAN; no model data, no battery capacity', async () => {
    mockApi();
    await openEdit();

    expect(select('Zustand').value).toBe(String(USED));
    expect(textbox('Optik-Note').value).toBe('2');
    expect(select('Speichertyp').value).toBe(String(SSD));
    expect(select('Tastaturlayout').value).toBe(String(GERMAN));
    expect(select('Netzteil').value).toBe(String(ORIGINAL));
    expect(textbox('Zustandsbeschreibung').value).toBe('Kratzer am Deckel');
    expect(
      within(form()).getByRole<HTMLInputElement>('checkbox', { name: 'Netzkabel' }).checked,
    ).toBe(true);
    expect(textbox('Artikelnummer').value).toBe('626198');
    expect(shownText(select('EAN-Kennzeichnung'))).toBe('Original');
    expect(within(form()).queryByRole('textbox', { name: /^Eigene EAN/ })).toBeNull();
    expect(within(form()).queryByRole('textbox', { name: /^Prozessor/ })).toBeNull();
    expect(within(form()).queryByText('Akkukapazität')).toBeNull();
    expect(screen.getByText('Modelldaten werden in der Modellvorlage gepflegt.')).toBeTruthy();

    fireEvent.change(select('EAN-Kennzeichnung'), { target: { value: 'own' } });

    expect(textbox('Eigene EAN').value).toBe('');
    expectAccessibleForm();
  });

  it('UI-014.speichert UI-014.success DER-64-02 locks the button and every input with "Speichern …" until the answer, then shows "Inseratswerte gespeichert"', async () => {
    let respond: (response: Response) => void = () => {};
    const { sent } = mockApi({
      update: (init) =>
        new Promise<Response>((resolve) => {
          respond = (response) => resolve(response);
          void init;
        }),
    });
    await openEdit();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(saveButton().textContent).toBe('Speichern …');
    expect(saveButton().disabled).toBe(true);
    for (const control of [
      ...within(form()).getAllByRole('combobox'),
      ...within(form()).getAllByRole('textbox'),
      ...within(form()).getAllByRole('checkbox'),
    ]) {
      // Locked by the disabled fieldset of the form.
      expect(control.matches(':disabled')).toBe(true);
    }
    expect(sent[0]).toEqual({
      version: 1,
      conditionValueId: USED,
      visualGrade: '4',
      conditionDescription: 'Kratzer am Deckel',
      variantValues: { 15: SSD, 16: GERMAN },
      otherValues: { 17: ORIGINAL },
      deliveryScopeTextBlockIds: [61],
      articleNumber: '626198',
      eanMode: 'original',
      ownEan: null,
    });

    respond(savedAnswer({ body: JSON.stringify(sent[0]) }));

    expect(await screen.findByText('Inseratswerte gespeichert')).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Inseratswerte bearbeiten' })).toBeNull();
  });

  it('DER-64-05 offers only the active text blocks of the kind "Lieferumfang" whose scope includes the device type; both chosen are sent in their order', async () => {
    const { sent } = mockApi();
    await openEdit();

    const offered = within(form())
      .getAllByRole('checkbox')
      .map((checkbox) => checkbox.closest('label')?.textContent);
    expect(offered).toEqual(['Netzkabel', 'Originalverpackung']);

    fireEvent.click(within(form()).getByRole('checkbox', { name: 'Originalverpackung' }));
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.deliveryScopeTextBlockIds).toEqual([61, 62]);
  });

  it('UI-014.validation DER-64-04 shows "Artikelnummer: 1 bis 30 Zeichen, …" at an article number with a wrong character, focus there, nothing sent', async () => {
    const { sent } = mockApi();
    await openEdit();
    fireEvent.change(textbox('Artikelnummer'), { target: { value: 'MI_A' } });

    fireEvent.click(saveButton());

    expect(errorOf(textbox('Artikelnummer'))).toBe(ARTICLE_NUMBER_RULE);
    expect(document.activeElement).toBe(textbox('Artikelnummer'));
    expect(sent).toEqual([]);
    expectAccessibleForm();
  });

  it('UI-014.validation DER-64-04 shows the article number rule of 422 validation_failed at the field', async () => {
    mockApi({
      update: () =>
        Response.json(
          errorBody('validation_failed', {
            fields: [
              { path: 'articleNumber', code: 'invalid_format', message: ARTICLE_NUMBER_RULE },
            ],
          }),
          { status: 422 },
        ),
    });
    await openEdit();
    fireEvent.change(textbox('Artikelnummer'), { target: { value: 'A'.repeat(30) } });

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(textbox('Artikelnummer'))).toBe(ARTICLE_NUMBER_RULE));
    expect(document.activeElement).toBe(textbox('Artikelnummer'));
  });

  it('UI-014.validation AC-REQ-088-04 rejects the own EAN 4255867000015 at the field EAN and sends 4255867000014', async () => {
    const { sent } = mockApi();
    await openEdit();
    fireEvent.change(select('EAN-Kennzeichnung'), { target: { value: 'own' } });
    fireEvent.change(textbox('Eigene EAN'), { target: { value: '4255867000015' } });

    fireEvent.click(saveButton());

    expect(errorOf(textbox('Eigene EAN'))).toBe(EAN_RULE);
    expect(sent).toEqual([]);

    fireEvent.change(textbox('Eigene EAN'), { target: { value: '4255867000014' } });
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ eanMode: 'own', ownEan: '4255867000014' });
  });

  it('UI-014.validation AC-REQ-088-02 shows "Variantenangaben stimmen mit Modell-Inserat <Titel> überein" and keeps the inputs', async () => {
    const message = 'Variantenangaben stimmen mit Modell-Inserat ThinkPad T14 Gen 2 (B) überein';
    mockApi({
      update: () =>
        Response.json(errorBody('variant_duplicate', { message, details: { listingId: 10 } }), {
          status: 422,
        }),
    });
    await openEdit();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(textbox('Optik-Note').value).toBe('4');
  });

  it('UI-014.conflict DER-64-06 (a) shows P-05 with "Neu laden" on 409 version_conflict and keeps the inputs', async () => {
    mockApi({ update: () => Response.json(errorBody('version_conflict'), { status: 409 }) });
    await openEdit();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster',
    );
    expect(within(banner).getByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(textbox('Optik-Note').value).toBe('4');
    expectAccessibleForm();
  });

  it('UI-014.wird-beendet DER-64-06 (b) shows P-07 without reference number on 503 shutting_down and keeps the inputs', async () => {
    mockApi({ update: () => Response.json(errorBody('shutting_down'), { status: 503 }) });
    await openEdit();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert.',
    );
    expect(banner.textContent).not.toContain('Referenz');
    expect(textbox('Optik-Note').value).toBe('4');
  });

  it('UI-014.error DER-64-08 shows "Das Modell-Inserat konnte nicht gespeichert werden. Referenz: <Nr>" on 500 and keeps the inputs', async () => {
    mockApi({ update: failed });
    await openEdit();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    expect(
      await screen.findByText(
        'Das Modell-Inserat konnte nicht gespeichert werden. Referenz: R-7K2M-9QX4',
      ),
    ).toBeTruthy();
    expect(textbox('Optik-Note').value).toBe('4');
    expect(form()).toBeTruthy();
  });

  it('"Abbrechen" leaves the edit view without a request', async () => {
    const { sent } = mockApi();
    await openEdit();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('form', { name: 'Inseratswerte bearbeiten' })).toBeNull();
    expect(sent).toEqual([]);
  });
});

describe('UI-014.edit choice after pick_list_value_deactivated (2.0.11, design v0.6.8, T11)', () => {
  /** A model listing whose condition "refurbished" and keyboard layout "Ungarisch" are deactivated. */
  const WITH_DEACTIVATED = {
    ...LISTING,
    conditionValueId: REFURBISHED,
    variantValues: { ...LISTING.variantValues, '16': HUNGARIAN },
  };

  it('UI-014.edit DER-64-10 DER-64-11 (a) shows the stored, deactivated condition and keyboard layout as chosen with "(deaktiviert)" beside the active ones; another change does not send them as change (200)', async () => {
    const api = mockApi({ listing: WITH_DEACTIVATED });
    api.deactivate(1, REFURBISHED);
    api.deactivate(11, HUNGARIAN);
    await openEdit();

    expect(shownText(select('Zustand'))).toBe('refurbished (deaktiviert)');
    expect(optionTexts(select('Zustand'))).toEqual([
      'Bitte wählen',
      'gebraucht',
      'refurbished (deaktiviert)',
      'defekt',
    ]);
    expect(shownText(select('Tastaturlayout'))).toBe('Ungarisch (deaktiviert)');

    fireEvent.change(textbox('Artikelnummer'), { target: { value: 'MI-A' } });
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(api.sent).toHaveLength(1));
    // The stored values go out unchanged, so the server does not check them (2.0.11).
    expect(api.sent[0]).toMatchObject({
      conditionValueId: REFURBISHED,
      variantValues: { 16: HUNGARIAN },
      articleNumber: 'MI-A',
    });
    expect(await screen.findByText('Inseratswerte gespeichert')).toBeTruthy();
  });

  it('UI-014.validation DER-64-10 DER-64-11 (a) (b) (c) a change to a value deactivated meanwhile shows "Bitte wählen" with the text, focus there, reloads the lists, keeps the inputs, no fallback; without a choice "Zustand fehlt" and nothing sent; the stored entry stays choosable', async () => {
    const api = mockApi({
      listing: WITH_DEACTIVATED,
      update: deactivated(DEFECT_DEACTIVATED, 'conditionValueId', DEFECT),
    });
    api.deactivate(1, REFURBISHED);
    await openEdit();
    await choose('Zustand', DEFECT);
    fireEvent.change(textbox('Optik-Note'), { target: { value: '3' } });
    api.deactivate(1, DEFECT);
    const readsBefore = api.reads[1] ?? 0;

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(select('Zustand').value).toBe(''));
    expect(shownText(select('Zustand'))).toBe('Bitte wählen');
    expect(errorOf(select('Zustand'))).toBe(DEFECT_DEACTIVATED);
    expect(document.activeElement).toBe(select('Zustand'));
    expect(api.reads[1]).toBeGreaterThan(readsBefore);
    expect(optionTexts(select('Zustand'))).toEqual([
      'Bitte wählen',
      'gebraucht',
      'refurbished (deaktiviert)',
    ]);
    expect(textbox('Optik-Note').value).toBe('3');
    expectAccessibleForm();

    // (b) (c): the text stays until the next choice; without a choice nothing is sent.
    fireEvent.blur(select('Zustand'));
    expect(errorOf(select('Zustand'))).toBe(DEFECT_DEACTIVATED);
    await vi.waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());
    expect(errorOf(select('Zustand'))).toBe('Zustand fehlt');
    expect(api.sent).toHaveLength(1);

    // (a): the stored, deactivated entry is chosen again and goes out unchanged.
    await choose('Zustand', REFURBISHED);
    expect(errorOf(select('Zustand'))).toBeNull();
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(api.sent).toHaveLength(2));
    expect(api.sent[1]).toMatchObject({ conditionValueId: REFURBISHED });
    expect(api.sent.filter((body) => body.conditionValueId === DEFECT)).toHaveLength(1);
  });

  it('DER-64-11 (b) (c) an optional attribute shows the empty choice after the rejection and saves without a value and without an error', async () => {
    let patches = 0;
    const api = mockApi({
      update: (init) => {
        patches += 1;
        return patches === 1
          ? deactivated('Speichertyp: HDD ist deaktiviert', 'variantValues.15', HDD)()
          : savedAnswer(init);
      },
    });
    await openEdit();
    await choose('Speichertyp', HDD);
    api.deactivate(5, HDD);

    fireEvent.click(saveButton());

    await vi.waitFor(() =>
      expect(errorOf(select('Speichertyp'))).toBe('Speichertyp: HDD ist deaktiviert'),
    );
    expect(select('Speichertyp').value).toBe('');
    expect(shownText(select('Speichertyp'))).toBe('');
    expect(document.activeElement).toBe(select('Speichertyp'));

    await vi.waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(api.sent).toHaveLength(2));
    expect(api.sent[1]?.variantValues).toMatchObject({ 15: null });
    expect(await screen.findByText('Inseratswerte gespeichert')).toBeTruthy();
  });

  it('DER-64-11 (d) marks every field with a new value missing after the reload, focus on the first in form order, but not a stored, unchanged, deactivated value', async () => {
    const api = mockApi({
      listing: { ...LISTING, variantValues: { ...LISTING.variantValues, '15': HDD } },
      update: deactivated(DEFECT_DEACTIVATED, 'conditionValueId', DEFECT),
    });
    await openEdit();
    await choose('Zustand', DEFECT);
    await choose('Netzteil', WITHOUT);
    api.deactivate(1, DEFECT);
    api.deactivate(12, WITHOUT);
    api.deactivate(5, HDD);

    fireEvent.click(saveButton());

    await vi.waitFor(() =>
      expect(errorOf(select('Netzteil'))).toBe('Netzteil: ohne Netzteil ist deaktiviert'),
    );
    expect(errorOf(select('Zustand'))).toBe(DEFECT_DEACTIVATED);
    expect(shownText(select('Netzteil'))).toBe('Bitte wählen');
    expect(shownText(select('Speichertyp'))).toBe('HDD (deaktiviert)');
    expect(errorOf(select('Speichertyp'))).toBeNull();
    expect(document.activeElement).toBe(select('Zustand'));
  });

  it('DER-64-11 (d) when reloading the lists fails, only the rejected id is missing', async () => {
    const api = mockApi({
      update: deactivated(DEFECT_DEACTIVATED, 'conditionValueId', DEFECT),
      reload: () => failed(),
    });
    await openEdit();
    await choose('Zustand', DEFECT);
    await choose('Tastaturlayout', HUNGARIAN);
    api.deactivate(11, HUNGARIAN);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(select('Zustand').value).toBe(''));
    expect(errorOf(select('Zustand'))).toBe(DEFECT_DEACTIVATED);
    expect(optionTexts(select('Zustand'))).toEqual(['Bitte wählen', 'gebraucht', 'refurbished']);
    expect(select('Tastaturlayout').value).toBe(String(HUNGARIAN));
    expect(errorOf(select('Tastaturlayout'))).toBeNull();
  });

  it('T5j a choice while the lists are read again is checked like any other: missing → emptied with its text, focus only after the reload, the text stays on leaving, a new save does not send it; an active one stays chosen', async () => {
    const { reload, answer } = delayedReload(11);
    const api = mockApi({
      update: deactivated(DEFECT_DEACTIVATED, 'conditionValueId', DEFECT),
      reload,
    });
    await openEdit();
    await choose('Zustand', DEFECT);
    api.deactivate(1, DEFECT);
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(errorOf(select('Zustand'))).toBe(DEFECT_DEACTIVATED));

    // During the reload: "Englisch" chosen, deactivated in the other window meanwhile, and the
    // active "HDD".
    await choose('Tastaturlayout', ENGLISH);
    await choose('Speichertyp', HDD);
    textbox('Optik-Note').focus();
    answer(
      list([
        value(GERMAN, 'Deutsch (QWERTZ)'),
        value(HUNGARIAN, 'Ungarisch'),
        value(ENGLISH, 'Englisch (QWERTY, US)', false),
      ]),
    );

    await vi.waitFor(() =>
      expect(errorOf(select('Tastaturlayout'))).toBe(
        'Tastaturlayout: Englisch (QWERTY, US) ist deaktiviert',
      ),
    );
    expect(select('Tastaturlayout').value).toBe('');
    expect(document.activeElement).toBe(select('Zustand'));
    expect(shownText(select('Speichertyp'))).toBe('HDD');
    expect(errorOf(select('Speichertyp'))).toBeNull();
    fireEvent.blur(select('Tastaturlayout'));
    expect(errorOf(select('Tastaturlayout'))).toBe(
      'Tastaturlayout: Englisch (QWERTY, US) ist deaktiviert',
    );

    // A new save with a condition chosen stops at the empty keyboard layout and sends nothing.
    await choose('Zustand', USED);
    fireEvent.click(saveButton());
    expect(errorOf(select('Tastaturlayout'))).toBe('Tastaturlayout fehlt');
    expect(api.sent).toHaveLength(1);
    expect(api.sent.filter((body) => JSON.stringify(body).includes(`"16":${ENGLISH}`))).toEqual([]);
  });

  it('T5l the rejected id chosen again in the field of details.path while the lists are read again is emptied with its text and never sent', async () => {
    const { reload, answer } = delayedReload(1);
    const api = mockApi({
      update: deactivated(DEFECT_DEACTIVATED, 'conditionValueId', DEFECT),
      reload,
    });
    await openEdit();
    await choose('Zustand', DEFECT);
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(errorOf(select('Zustand'))).toBe(DEFECT_DEACTIVATED));

    await choose('Zustand', REFURBISHED);
    await choose('Zustand', DEFECT);
    answer(
      list([
        value(USED, 'gebraucht'),
        value(REFURBISHED, 'refurbished'),
        value(DEFECT, 'defekt', false),
      ]),
    );

    await vi.waitFor(() =>
      expect(optionTexts(select('Zustand'))).toEqual(['Bitte wählen', 'gebraucht', 'refurbished']),
    );
    expect(select('Zustand').value).toBe('');
    expect(errorOf(select('Zustand'))).toBe(DEFECT_DEACTIVATED);
    fireEvent.click(saveButton());
    expect(errorOf(select('Zustand'))).toBe('Zustand fehlt');
    expect(api.sent).toHaveLength(1);
  });

  it('T5m when reading the lists again fails, another choice in the field of details.path made meanwhile stays, and the rejected id is no longer offered', async () => {
    const { reload, answer } = delayedReload(1);
    mockApi({
      update: deactivated(DEFECT_DEACTIVATED, 'conditionValueId', DEFECT),
      reload,
    });
    await openEdit();
    await choose('Zustand', DEFECT);
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(errorOf(select('Zustand'))).toBe(DEFECT_DEACTIVATED));
    await choose('Zustand', REFURBISHED);

    answer(failed());

    await vi.waitFor(() =>
      expect(optionTexts(select('Zustand'))).toEqual(['Bitte wählen', 'gebraucht', 'refurbished']),
    );
    expect(select('Zustand').value).toBe(String(REFURBISHED));
    expect(errorOf(select('Zustand'))).toBeNull();
  });
});

// Last in this file: P-08 locks the writes of the page until it is loaded again (CU-049).
describe('UI-014.edit ausgang-unbekannt (P-08)', () => {
  it('UI-014.ausgang-unbekannt DER-64-06 (c) shows the permanent P-08 without button, keeps the inputs and locks the save', async () => {
    mockApi({
      update: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await openEdit();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    const banner = await screen.findByText(/Ausgang unbekannt, bitte neu laden\./);
    expect(within(banner.closest('[role="alert"]') ?? banner).queryByRole('button')).toBeNull();
    expect(textbox('Optik-Note').value).toBe('4');
    await vi.waitFor(() => expect(saveButton().disabled).toBe(true));
  });
});
