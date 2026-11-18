import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of the device values in UI-003 "Gerät einbuchen" (CU-132, #190) with a mocked
// `fetch` (Technical Specification 6.1, 6.2, 10.2 T10, T5j): the field rules of Story #56 and the
// choice after `pick_list_value_deactivated` (2.0.11, design v0.6.8).

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const supplier = (id: number, name: string, active = true) => ({ id, name, active, version: 1 });
const OST = supplier(4, 'Lieferant Ost');
const WEST = supplier(5, 'Lieferant West');

const PICK_LISTS = [
  { id: 1, key: 'condition', name: 'Zustand', isBatteryList: false, version: 1 },
  { id: 5, key: 'storage_type', name: 'Speichertyp', isBatteryList: false, version: 1 },
  { id: 8, key: 'port_type', name: 'Anschlusstyp', isBatteryList: false, version: 1 },
  { id: 9, key: 'port_position', name: 'Anschlussposition', isBatteryList: false, version: 1 },
  { id: 10, key: 'battery', name: 'Akku', isBatteryList: true, version: 1 },
  { id: 11, key: 'keyboard_layout', name: 'Tastaturlayout', isBatteryList: false, version: 1 },
  { id: 12, key: 'power_supply', name: 'Netzteil', isBatteryList: false, version: 1 },
];
const value = (
  id: number,
  label: string,
  active = true,
  batteryPresent: boolean | null = null,
) => ({ id, label, active, batteryPresent, sortOrder: id, version: 1 });

const USED = 1;
const REFURBISHED = 2;
const DEFECT = 3;
const SSD = 51;
const HDD = 52;
const WITH_BATTERY = 101;
const BROKEN_BATTERY = 102;
const WITHOUT_BATTERY = 103;
const GERMAN = 111;
const HUNGARIAN = 112;
const ORIGINAL = 121;

/** The lists as the start data hold them; a test deactivates entries "in another window". */
const START_LISTS: Record<number, ReturnType<typeof value>[]> = {
  1: [value(USED, 'gebraucht'), value(REFURBISHED, 'refurbished'), value(DEFECT, 'defekt')],
  5: [value(SSD, 'SSD (NVMe)'), value(HDD, 'HDD')],
  8: [value(81, 'USB-C')],
  9: [value(91, 'links')],
  10: [
    value(WITH_BATTERY, 'mit Akku', true, true),
    value(BROKEN_BATTERY, 'mit Akku (defekt)', true, true),
    value(WITHOUT_BATTERY, 'ohne Akku', true, false),
  ],
  11: [value(GERMAN, 'Deutsch (QWERTZ)'), value(HUNGARIAN, 'Ungarisch')],
  12: [value(ORIGINAL, 'mit Netzteil (original)')],
};

const MV_A = {
  id: 7,
  deviceType: { id: 1, name: 'Notebook' },
  manufacturer: { id: 11, name: 'Lenovo' },
  modelName: 'ThinkPad T14 Gen 2',
  typeDesignation: null,
  mpn: '20W1S0F300',
  mpnUnknown: false,
};
const MV_A_LINE = 'Lenovo ThinkPad T14 Gen 2 · Notebook · Herstellernummer 20W1S0F300';

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
/** The attributes of the level device of a notebook, in their order (Requirements 9.3). */
const ATTRIBUTES = [
  attribute({ id: 15, label: 'Speichertyp', dataType: 'pick', pickListId: 5, sortOrder: 1 }),
  attribute({
    id: 16,
    label: 'Tastaturlayout',
    dataType: 'pick',
    systemRole: 'keyboard_layout',
    pickListId: 11,
    required: true,
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
    id: 18,
    label: 'Akku',
    dataType: 'pick',
    systemRole: 'battery',
    pickListId: 10,
    required: true,
    sortOrder: 4,
  }),
  attribute({
    id: 19,
    label: 'Akkukapazität',
    dataType: 'integer',
    systemRole: 'battery_capacity',
    unit: '%',
    minValue: '0',
    maxValue: '100',
    sortOrder: 5,
  }),
];
const MODEL_TEMPLATE = {
  id: 7,
  deviceTypeId: 1,
  manufacturerId: 11,
  modelName: 'ThinkPad T14 Gen 2',
  typeDesignation: null,
  mpn: '20W1S0F300',
  mpnUnknown: false,
  originalEan: null,
  modelValues: {},
  defaultDeviceValues: {},
  version: 1,
  createdAt: '2026-11-15T10:00:00.000Z',
  updatedAt: '2026-11-15T10:00:00.000Z',
};
const NO_PREFILL = {
  conditionValueId: null,
  visualGrade: null,
  conditionDescription: '',
  values: {},
  reviewKeys: [],
  codeResult: { found: false, plainText: null },
};
const CREATED = {
  id: 31,
  wiNr: '626198',
  modelTemplateId: 7,
  listingId: null,
  supplierId: null,
  conditionValueId: USED,
  visualGrade: 3,
  conditionDescription: '',
  values: {},
  reviewKeys: [],
  captureStatus: 'checked',
  stockStatus: 'available',
  capturedAt: '2026-11-18T10:00:00.000Z',
  capturedOn: '2026-11-18',
  version: 1,
  updatedAt: '2026-11-18T10:00:00.000Z',
};

const CAPACITY_RULE = 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“';
const REFURBISHED_DEACTIVATED = 'Zustand refurbished ist deaktiviert';
const HUNGARIAN_DEACTIVATED = 'Tastaturlayout: Ungarisch ist deaktiviert';
const HDD_DEACTIVATED = 'Speichertyp: HDD ist deaktiviert';

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

/**
 * `fetch` of the page with lists the test can change in "another window": `lists` answers the
 * reads, `reload` answers the reads after the first one of a list (e.g. a failing or delayed
 * reload). Records the bodies of `POST /api/devices` and the number of reads per list.
 */
function mockApi({
  create = () => Response.json(CREATED, { status: 201 }),
  suppliers = () => list([OST, WEST]),
  reload,
}: {
  create?: Route;
  suppliers?: Route;
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
        const answer = reads[listId] > 1 ? reload?.(listId) : undefined;
        return answer ?? list(lists[listId] ?? []);
      }
      if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (route === 'GET /api/suppliers') return suppliers(init);
      if (route === 'GET /api/pick-lists') return list(PICK_LISTS);
      if (route === 'GET /api/model-templates') return list([MV_A]);
      if (route === 'GET /api/model-templates/7') return Response.json(MODEL_TEMPLATE);
      if (route === 'GET /api/model-templates/7/device-prefill') return Response.json(NO_PREFILL);
      if (route === 'GET /api/device-types/1/attributes') return list(ATTRIBUTES);
      if (route === 'POST /api/devices') {
        sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return create(init);
      }
      throw new Error(`unexpected request ${route}`);
    }),
  );
  /** Deactivates an entry in "another window": the next read of its list shows it so. */
  const deactivate = (listId: number, id: number) => {
    const entry = lists[listId]?.find((candidate) => candidate.id === id);
    if (entry !== undefined) entry.active = false;
  };
  return { sent, reads, deactivate };
}

function renderPage() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/geraete/neu'] })} />
    </QueryClientProvider>,
  );
}

const form = () => screen.getByRole('form', { name: 'Gerät einbuchen' });
const select = (name: string) =>
  within(form()).getByRole<HTMLSelectElement>('combobox', { name: new RegExp(`^${name}`) });
const textbox = (name: string) =>
  within(form()).getByRole<HTMLInputElement>('textbox', { name: new RegExp(`^${name}`) });
const queryTextbox = (name: string) =>
  within(form()).queryByRole<HTMLInputElement>('textbox', { name: new RegExp(`^${name}`) });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Gerät speichern|Speichern …)$/ });
const optionTexts = (control: HTMLSelectElement) => Array.from(control.options, ({ text }) => text);
const shownText = (control: HTMLSelectElement) => control.selectedOptions[0]?.text;

function errorOf(control: HTMLElement): string | null {
  const id = control.getAttribute('aria-describedby');
  return id === null ? null : (document.getElementById(id)?.textContent ?? null);
}

const summaryItems = () =>
  screen
    .queryAllByRole('alert')
    .flatMap((alert) => within(alert).queryAllByRole('listitem'))
    .map((item) => item.textContent);

/** Chooses a value of a choice once its list has arrived. */
async function choose(name: string, valueId: number | '') {
  if (valueId !== '') {
    await vi.waitFor(() =>
      expect(Array.from(select(name).options, (option) => option.value)).toContain(String(valueId)),
    );
  }
  fireEvent.change(select(name), { target: { value: String(valueId) } });
}

/** The page with WI-Nr, supplier and MV-A chosen. */
async function openWithTemplate({ supplierId = '' } = {}) {
  renderPage();
  await screen.findByRole('form', { name: 'Gerät einbuchen' });
  await vi.waitFor(() => expect(optionTexts(select('Lieferant'))).toContain('Lieferant Ost'));
  fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
  fireEvent.change(select('Lieferant'), { target: { value: supplierId } });
  fireEvent.change(within(form()).getByRole('searchbox'), { target: { value: 'T14' } });
  fireEvent.click(await screen.findByRole('button', { name: MV_A_LINE }));
  await vi.waitFor(() => expect(select('Zustand').options.length).toBeGreaterThan(1));
}

/** A valid notebook: condition "refurbished", Ungarisch, HDD, "mit Akku" with 87 %. */
async function fillValid({ supplierId = '' } = {}) {
  await openWithTemplate({ supplierId });
  await choose('Zustand', REFURBISHED);
  fireEvent.change(textbox('Optik-Note'), { target: { value: '3' } });
  await choose('Speichertyp', HDD);
  await choose('Tastaturlayout', HUNGARIAN);
  await choose('Netzteil', ORIGINAL);
  await choose('Akku', WITH_BATTERY);
  fireEvent.change(textbox('Akkukapazität'), { target: { value: '87' } });
}

/** Accessibility assertion: named controls, linked field errors. */
function expectAccessibleForm() {
  for (const control of [
    ...within(form()).queryAllByRole('combobox'),
    ...within(form()).queryAllByRole('textbox'),
  ]) {
    expect(document.querySelector(`label[for="${control.id}"]`)?.textContent).toBeTruthy();
    if (control.getAttribute('aria-invalid') === 'true') expect(errorOf(control)).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UI-003 field rules of the device values (CU-132, Story #56)', () => {
  it('UI-003.validation DER-56-06 names a missing condition, a visual grade outside 1 to 5, a long condition description and a missing keyboard layout at their fields, nothing sent', async () => {
    const { sent } = mockApi();
    await openWithTemplate();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '6' } });
    fireEvent.change(textbox('Zustandsbeschreibung'), { target: { value: 'x'.repeat(1001) } });
    await choose('Netzteil', ORIGINAL);
    await choose('Akku', WITHOUT_BATTERY);

    fireEvent.click(saveButton());

    expect(errorOf(select('Zustand'))).toBe('Zustand fehlt');
    expect(errorOf(textbox('Optik-Note'))).toBe('Optik-Note: ganze Zahl von 1 bis 5');
    expect(errorOf(textbox('Zustandsbeschreibung'))).toBe(
      'Zustandsbeschreibung: höchstens 1.000 Zeichen',
    );
    expect(errorOf(select('Tastaturlayout'))).toBe('Tastaturlayout fehlt');
    expect(document.activeElement).toBe(select('Zustand'));
    expect(sent).toEqual([]);
    expectAccessibleForm();
  });

  it('UI-003.validation AC-REQ-014-04 an empty visual grade is named "Optik-Note: ganze Zahl von 1 bis 5"', async () => {
    const { sent } = mockApi();
    await fillValid();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '' } });

    fireEvent.click(saveButton());

    expect(errorOf(textbox('Optik-Note'))).toBe('Optik-Note: ganze Zahl von 1 bis 5');
    expect(sent).toEqual([]);
  });

  it('UI-003.validation AC-REQ-014-02 the battery capacity 101 is named with the rule of the battery capacity', async () => {
    const { sent } = mockApi();
    await fillValid();
    fireEvent.change(textbox('Akkukapazität'), { target: { value: '101' } });

    fireEvent.click(saveButton());

    expect(errorOf(textbox('Akkukapazität'))).toBe(CAPACITY_RULE);
    expect(sent).toEqual([]);
  });

  it('UI-003.default DER-56-03 shows "Akkukapazität" exactly with a battery value with "Akku vorhanden"; AC-REQ-014-05 "ohne Akku" saves without it', async () => {
    const { sent } = mockApi();
    await fillValid();
    expect(queryTextbox('Akkukapazität')).not.toBeNull();
    await choose('Akku', BROKEN_BATTERY);
    expect(textbox('Akkukapazität').value).toBe('87');

    await choose('Akku', WITHOUT_BATTERY);
    expect(queryTextbox('Akkukapazität')).toBeNull();
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.values).toEqual({ 15: HDD, 16: HUNGARIAN, 17: ORIGINAL, 18: WITHOUT_BATTERY });
  });

  it('UI-003.default AC-REQ-014-03 sends the battery capacity "nicht ermittelbar"', async () => {
    const { sent } = mockApi();
    await fillValid();
    fireEvent.click(within(form()).getByRole('checkbox', { name: 'nicht ermittelbar' }));

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.values).toMatchObject({ 19: { notDeterminable: true } });
  });
});

describe('UI-003 choice after pick_list_value_deactivated (2.0.11, design v0.6.8, T10)', () => {
  it('UI-003.default DER-56-09 offers only the active conditions and pick list values', async () => {
    const api = mockApi();
    api.deactivate(1, DEFECT);
    api.deactivate(11, HUNGARIAN);
    await openWithTemplate();
    await vi.waitFor(() => expect(optionTexts(select('Tastaturlayout')).length).toBeGreaterThan(1));

    expect(optionTexts(select('Zustand'))).toEqual(['Bitte wählen', 'gebraucht', 'refurbished']);
    expect(optionTexts(select('Tastaturlayout'))).toEqual(['Bitte wählen', 'Deutsch (QWERTZ)']);
  });

  it('UI-003.validation DER-56-09 DER-56-10 (a) (b) (f) shows the text at "Zustand" with "Bitte wählen", focus there, reloads the lists and keeps the other inputs', async () => {
    const api = mockApi({
      create: deactivated(REFURBISHED_DEACTIVATED, 'conditionValueId', REFURBISHED),
    });
    await fillValid();
    fireEvent.change(textbox('Zustandsbeschreibung'), { target: { value: 'Kratzer' } });
    api.deactivate(1, REFURBISHED);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(select('Zustand').value).toBe(''));
    expect(shownText(select('Zustand'))).toBe('Bitte wählen');
    expect(errorOf(select('Zustand'))).toBe(REFURBISHED_DEACTIVATED);
    expect(summaryItems()).toEqual([REFURBISHED_DEACTIVATED]);
    expect(document.activeElement).toBe(select('Zustand'));
    expect(api.reads[1]).toBe(2);
    expect(optionTexts(select('Zustand'))).toEqual(['Bitte wählen', 'gebraucht', 'defekt']);
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(textbox('Optik-Note').value).toBe('3');
    expect(textbox('Zustandsbeschreibung').value).toBe('Kratzer');
    expect(select('Tastaturlayout').value).toBe(String(HUNGARIAN));
    expect(textbox('Akkukapazität').value).toBe('87');
    expectAccessibleForm();
  });

  it('DER-56-10 (b) (c) the text stays until the next choice; saving without a choice shows "Zustand fehlt" and sends nothing; after a choice the request goes out without the rejected id', async () => {
    let posts = 0;
    const api = mockApi({
      create: () => {
        posts += 1;
        return posts === 1
          ? deactivated(REFURBISHED_DEACTIVATED, 'conditionValueId', REFURBISHED)()
          : Response.json(CREATED, { status: 201 });
      },
    });
    await fillValid();
    api.deactivate(1, REFURBISHED);
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(errorOf(select('Zustand'))).toBe(REFURBISHED_DEACTIVATED));
    await vi.waitFor(() => expect(saveButton().disabled).toBe(false));

    fireEvent.blur(select('Zustand'));
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });
    expect(errorOf(select('Zustand'))).toBe(REFURBISHED_DEACTIVATED);

    fireEvent.click(saveButton());
    expect(errorOf(select('Zustand'))).toBe('Zustand fehlt');
    expect(api.sent).toHaveLength(1);

    await choose('Zustand', USED);
    expect(errorOf(select('Zustand'))).toBeNull();
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(api.sent).toHaveLength(2));
    expect(api.sent[1]).toMatchObject({ conditionValueId: USED });
    expect(api.sent.filter((body) => body.conditionValueId === REFURBISHED)).toHaveLength(1);
  });

  it('DER-56-10 (b) an optional pick list attribute shows the empty choice, saving without it gives no error', async () => {
    const api = mockApi({ create: deactivated(HDD_DEACTIVATED, 'values.15', HDD) });
    await fillValid();
    api.deactivate(5, HDD);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(select('Speichertyp'))).toBe(HDD_DEACTIVATED));
    expect(select('Speichertyp').value).toBe('');
    expect(shownText(select('Speichertyp'))).toBe('');
    expect(document.activeElement).toBe(select('Speichertyp'));

    await vi.waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(api.sent).toHaveLength(2));
    expect(api.sent[1]?.values).toMatchObject({ 15: null });
  });

  it('DER-56-10 (e) after a rejected battery value the battery capacity goes; a battery value with "Akku vorhanden" shows it empty', async () => {
    const api = mockApi({
      create: deactivated('Akku: mit Akku ist deaktiviert', 'values.18', WITH_BATTERY),
    });
    await fillValid();
    api.deactivate(10, WITH_BATTERY);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(select('Akku'))).toBe('Akku: mit Akku ist deaktiviert'));
    expect(shownText(select('Akku'))).toBe('Bitte wählen');
    expect(queryTextbox('Akkukapazität')).toBeNull();

    await choose('Akku', BROKEN_BATTERY);
    expect(textbox('Akkukapazität').value).toBe('');
    expect(errorOf(select('Akku'))).toBeNull();
  });

  it('DER-56-10 (d) marks every field with a new value missing after the reload, focus on the first in form order', async () => {
    const api = mockApi({
      create: deactivated(REFURBISHED_DEACTIVATED, 'conditionValueId', REFURBISHED),
    });
    await fillValid();
    api.deactivate(1, REFURBISHED);
    api.deactivate(11, HUNGARIAN);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(select('Tastaturlayout'))).toBe(HUNGARIAN_DEACTIVATED));
    expect(errorOf(select('Zustand'))).toBe(REFURBISHED_DEACTIVATED);
    expect(shownText(select('Tastaturlayout'))).toBe('Bitte wählen');
    expect(select('Speichertyp').value).toBe(String(HDD));
    expect(summaryItems()).toEqual([REFURBISHED_DEACTIVATED, HUNGARIAN_DEACTIVATED]);
    expect(document.activeElement).toBe(select('Zustand'));
  });

  it('DER-56-10 (d) when reloading the lists fails, only the rejected id is missing and leaves the choice', async () => {
    const api = mockApi({
      create: deactivated(REFURBISHED_DEACTIVATED, 'conditionValueId', REFURBISHED),
      reload: () => failed(),
    });
    await fillValid();
    api.deactivate(11, HUNGARIAN);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(select('Zustand').value).toBe(''));
    expect(errorOf(select('Zustand'))).toBe(REFURBISHED_DEACTIVATED);
    expect(optionTexts(select('Zustand'))).toEqual(['Bitte wählen', 'gebraucht', 'defekt']);
    expect(select('Tastaturlayout').value).toBe(String(HUNGARIAN));
    expect(errorOf(select('Tastaturlayout'))).toBeNull();
  });

  it('DER-56-09 DER-56-10 after supplier_deactivated with a condition deactivated too, the condition shows "Bitte wählen" with its text, focus on the supplier', async () => {
    const api = mockApi({
      create: () =>
        Response.json(
          errorBody('supplier_deactivated', {
            message: 'Lieferant Lieferant West ist deaktiviert',
            details: { path: 'supplierId', id: WEST.id },
          }),
          { status: 422 },
        ),
      suppliers: (() => {
        let calls = 0;
        return () => {
          calls += 1;
          return list(calls === 1 ? [OST, WEST] : [OST, { ...WEST, active: false }]);
        };
      })(),
    });
    await fillValid({ supplierId: String(WEST.id) });
    api.deactivate(1, REFURBISHED);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(select('Zustand'))).toBe(REFURBISHED_DEACTIVATED));
    expect(shownText(select('Zustand'))).toBe('Bitte wählen');
    expect(errorOf(select('Lieferant'))).toBe('Lieferant Lieferant West ist deaktiviert');
    expect(document.activeElement).toBe(select('Lieferant'));
  });

  it('T5j a choice while the lists are read again is checked like any other: missing → emptied with its text, focus only after the reload, never sent', async () => {
    let answer: (response: Response) => void = () => {};
    const delayed = new Promise<Response>((resolve) => {
      answer = resolve;
    });
    const api = mockApi({
      create: deactivated(REFURBISHED_DEACTIVATED, 'conditionValueId', REFURBISHED),
      reload: (listId) => (listId === 11 ? delayed : undefined),
    });
    await fillValid();
    api.deactivate(1, REFURBISHED);
    await choose('Tastaturlayout', GERMAN);
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(errorOf(select('Zustand'))).toBe(REFURBISHED_DEACTIVATED));

    // During the reload: "Ungarisch" chosen again, then deactivated in the other window.
    await choose('Tastaturlayout', HUNGARIAN);
    textbox('Optik-Note').focus();
    expect(errorOf(select('Tastaturlayout'))).toBeNull();
    answer(list([value(GERMAN, 'Deutsch (QWERTZ)'), value(HUNGARIAN, 'Ungarisch', false)]));

    await vi.waitFor(() => expect(errorOf(select('Tastaturlayout'))).toBe(HUNGARIAN_DEACTIVATED));
    expect(select('Tastaturlayout').value).toBe('');
    expect(document.activeElement).toBe(select('Zustand'));
    fireEvent.blur(select('Tastaturlayout'));
    expect(errorOf(select('Tastaturlayout'))).toBe(HUNGARIAN_DEACTIVATED);

    await choose('Zustand', USED);
    fireEvent.click(saveButton());
    expect(errorOf(select('Tastaturlayout'))).toBe('Tastaturlayout fehlt');
    expect(api.sent.filter((body) => JSON.stringify(body).includes(`"16":${HUNGARIAN}`))).toEqual(
      [],
    );
  });

  it('T5j the rejected id chosen again during the reload is emptied with its text; when the reload fails another choice stays and the rejected id leaves the list', async () => {
    let answer: (response: Response) => void = () => {};
    const delayed = new Promise<Response>((resolve) => {
      answer = resolve;
    });
    const api = mockApi({
      create: deactivated(HUNGARIAN_DEACTIVATED, 'values.16', HUNGARIAN),
      reload: (listId) => (listId === 11 ? delayed : undefined),
    });
    await fillValid();
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(errorOf(select('Tastaturlayout'))).toBe(HUNGARIAN_DEACTIVATED));
    await choose('Tastaturlayout', GERMAN);
    await choose('Tastaturlayout', HUNGARIAN);

    answer(failed());

    await vi.waitFor(() =>
      expect(optionTexts(select('Tastaturlayout'))).toEqual(['Bitte wählen', 'Deutsch (QWERTZ)']),
    );
    expect(select('Tastaturlayout').value).toBe('');
    expect(errorOf(select('Tastaturlayout'))).toBe(HUNGARIAN_DEACTIVATED);
    expect(api.sent).toHaveLength(1);
  });

  it('T5j when the reload fails, another choice in the field of details.path stays, and the rejected id is no longer offered', async () => {
    let answer: (response: Response) => void = () => {};
    const delayed = new Promise<Response>((resolve) => {
      answer = resolve;
    });
    mockApi({
      create: deactivated(HUNGARIAN_DEACTIVATED, 'values.16', HUNGARIAN),
      reload: (listId) => (listId === 11 ? delayed : undefined),
    });
    await fillValid();
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(errorOf(select('Tastaturlayout'))).toBe(HUNGARIAN_DEACTIVATED));
    await choose('Tastaturlayout', GERMAN);

    answer(failed());

    await vi.waitFor(() =>
      expect(optionTexts(select('Tastaturlayout'))).toEqual(['Bitte wählen', 'Deutsch (QWERTZ)']),
    );
    expect(select('Tastaturlayout').value).toBe(String(GERMAN));
    expect(errorOf(select('Tastaturlayout'))).toBeNull();
  });
});
