import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of UI-003 "Gerät einbuchen" (CU-132) with a mocked `fetch` (Technical
// Specification 6.1, 6.2), with the attributes of the device type Notebook of the start data.

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const supplier = (id: number, name: string, active = true) => ({ id, name, active, version: 1 });
const OST = supplier(4, 'Lieferant Ost');
const WEST = supplier(5, 'Lieferant West');
const ALT = supplier(6, 'Lieferant Alt', false);

const PICK_LISTS = [
  { id: 1, key: 'condition', name: 'Zustand', isBatteryList: false, version: 1 },
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
  sortOrder = id,
  batteryPresent: boolean | null = null,
) => ({ id, label, active, batteryPresent, sortOrder, version: 1 });
const CONDITIONS = [value(1, 'gebraucht'), value(2, 'refurbished', false), value(3, 'defekt')];
const PORT_TYPES = [value(81, 'USB-C')];
const PORT_POSITIONS = [value(91, 'links')];
const WITH_BATTERY = 101;
const WITHOUT_BATTERY = 103;
const BATTERIES = [
  value(WITH_BATTERY, 'mit Akku', true, 1, true),
  value(102, 'mit Akku (defekt)', true, 2, true),
  value(WITHOUT_BATTERY, 'ohne Akku', true, 3, false),
];
const KEYBOARD_LAYOUTS = [value(111, 'Deutsch (QWERTZ)')];
const POWER_SUPPLIES = [value(121, 'mit Netzteil (original)')];

const MV_A = {
  id: 7,
  deviceType: { id: 1, name: 'Notebook' },
  manufacturer: { id: 11, name: 'Lenovo' },
  modelName: 'ThinkPad T14 Gen 2',
  typeDesignation: '20W1S0F300',
  mpn: '20W1S0F300',
  mpnUnknown: false,
};
const MV_A_LINE = 'Lenovo ThinkPad T14 Gen 2 (20W1S0F300) · Notebook · Herstellernummer 20W1S0F300';

const attribute = (change: Record<string, unknown>) => ({
  deviceTypeId: 1,
  systemRole: null,
  unit: null,
  unitSpacing: true,
  minValue: null,
  maxValue: null,
  pickListId: null,
  level: 'model',
  variantForming: false,
  required: false,
  datasheetBlock: 'technical',
  active: true,
  version: 1,
  hasValues: true,
  ...change,
});
const ATTRIBUTES = [
  attribute({ id: 3, label: 'Prozessor', dataType: 'text', sortOrder: 1 }),
  attribute({ id: 20, label: 'Displaygröße', dataType: 'decimal', unit: 'Zoll', sortOrder: 2 }),
  attribute({ id: 22, label: 'Anschlüsse', dataType: 'ports', sortOrder: 3 }),
  attribute({ id: 21, label: 'Farbe', dataType: 'text', active: false, sortOrder: 4 }),
  // The attributes of the level device of a Notebook (start data, Requirements 9.3).
  attribute({
    id: 16,
    label: 'Tastaturlayout',
    dataType: 'pick',
    systemRole: 'keyboard_layout',
    pickListId: 11,
    level: 'device',
    required: true,
    sortOrder: 5,
  }),
  attribute({
    id: 17,
    label: 'Netzteil',
    dataType: 'pick',
    systemRole: 'power_supply',
    pickListId: 12,
    level: 'device',
    required: true,
    sortOrder: 6,
  }),
  attribute({
    id: 18,
    label: 'Akku',
    dataType: 'pick',
    systemRole: 'battery',
    pickListId: 10,
    level: 'device',
    required: true,
    sortOrder: 7,
  }),
  attribute({
    id: 19,
    label: 'Akkukapazität',
    dataType: 'integer',
    systemRole: 'battery_capacity',
    unit: '%',
    minValue: '0',
    maxValue: '100',
    level: 'device',
    sortOrder: 8,
  }),
];
const MODEL_TEMPLATE = {
  id: 7,
  deviceTypeId: 1,
  manufacturerId: 11,
  modelName: 'ThinkPad T14 Gen 2',
  typeDesignation: '20W1S0F300',
  mpn: '20W1S0F300',
  mpnUnknown: false,
  originalEan: null,
  modelValues: {
    3: 'Intel Core i5-1135G7',
    20: '14',
    21: 'Schwarz',
    22: [{ count: 2, typeId: 81, positionId: 91 }],
  },
  defaultDeviceValues: {},
  version: 1,
  createdAt: '2026-11-15T10:00:00.000Z',
  updatedAt: '2026-11-15T10:00:00.000Z',
};

const CREATED = {
  id: 31,
  wiNr: '626198',
  modelTemplateId: 7,
  listingId: null,
  supplierId: null,
  conditionValueId: 1,
  visualGrade: 3,
  conditionDescription: '',
  values: {},
  reviewKeys: [],
  captureStatus: 'checked',
  stockStatus: 'available',
  capturedAt: '2026-11-16T10:00:00.000Z',
  capturedOn: '2026-11-16',
  version: 1,
  updatedAt: '2026-11-16T10:00:00.000Z',
};

/** The prefill of a model template without defaults and without condition code (2.5). */
const NO_PREFILL = {
  conditionValueId: null,
  visualGrade: null,
  conditionDescription: '',
  values: {},
  reviewKeys: [],
  codeResult: { found: false, plainText: null },
};

/** The prefill of MV-A with the defaults of AC-REQ-013-01: battery "mit Akku", capacity 85. */
const MV_A_PREFILL = {
  ...NO_PREFILL,
  values: { 16: 111, 18: WITH_BATTERY, 19: { percent: 85 } },
  reviewKeys: ['16', '18', '19'],
};

/** Answers of `GET /api/condition-codes/resolve` (2.2). */
const UNKNOWN_CODE = {
  found: false,
  plainText: null,
  suggestedConditionValueId: null,
  suggestedVisualGrade: null,
};
const DGS_TEXT = 'Display- und Gehäuseschaden';
const DGS = { ...UNKNOWN_CODE, found: true, plainText: DGS_TEXT };

const WI_NR_RULE = 'WI-Nr darf nur Buchstaben und Ziffern enthalten (1–20 Zeichen)';
const CAPACITY_RULE = 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“';
const WEST_DEACTIVATED = 'Lieferant Lieferant West ist deaktiviert';

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});
const supplierDeactivated = () =>
  Response.json(
    errorBody('supplier_deactivated', {
      message: WEST_DEACTIVATED,
      details: { path: 'supplierId', id: WEST.id },
    }),
    { status: 422 },
  );

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;
const list = (items: unknown[]) => Response.json({ items, total: items.length });

/**
 * `fetch` of the page: the frame, suppliers, pick lists with their values, the search, the model
 * template with the attributes of its device type and `POST /api/devices`. Records the bodies of
 * the writes and the number of supplier reads.
 */
function mockApi({
  create = () => Response.json(CREATED, { status: 201 }),
  suppliers = () => list([OST, WEST, ALT]),
  search = () => list([MV_A]),
  modelTemplate = () => Response.json(MODEL_TEMPLATE),
  portTypes = () => list(PORT_TYPES),
  prefill = () => Response.json(NO_PREFILL),
  resolve = () => Response.json(UNKNOWN_CODE),
}: {
  create?: Route;
  suppliers?: Route;
  search?: Route;
  modelTemplate?: Route;
  portTypes?: Route;
  prefill?: Route;
  resolve?: (url: URL) => Response;
} = {}) {
  const sent: Record<string, unknown>[] = [];
  const reads = { suppliers: 0 };
  /** The query strings of the prefill and of the resolution of the condition code. */
  const asked = { prefill: [] as string[], resolve: [] as string[] };
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://127.0.0.1');
    const method = init?.method ?? 'GET';
    const route = `${method} ${url.pathname}`;
    if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
    if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
    if (route === 'GET /api/suppliers') {
      reads.suppliers += 1;
      return suppliers(init);
    }
    if (route === 'GET /api/pick-lists') return list(PICK_LISTS);
    if (route === 'GET /api/pick-lists/1/values') return list(CONDITIONS);
    if (route === 'GET /api/pick-lists/8/values') return portTypes(init);
    if (route === 'GET /api/pick-lists/9/values') return list(PORT_POSITIONS);
    if (route === 'GET /api/pick-lists/10/values') return list(BATTERIES);
    if (route === 'GET /api/pick-lists/11/values') return list(KEYBOARD_LAYOUTS);
    if (route === 'GET /api/pick-lists/12/values') return list(POWER_SUPPLIES);
    if (route === 'GET /api/model-templates') return search(init);
    if (route === 'GET /api/model-templates/7') return modelTemplate(init);
    if (route === 'GET /api/model-templates/7/device-prefill') {
      asked.prefill.push(url.search);
      return prefill(init);
    }
    if (route === 'GET /api/condition-codes/resolve') {
      asked.resolve.push(url.search);
      return resolve(url);
    }
    if (route === 'GET /api/device-types/1/attributes') return list(ATTRIBUTES);
    // UI-004 after "Speichern und zuordnen" lists the model listings of MV-A (#189).
    if (route === 'GET /api/model-templates/7/listings') return Response.json({ items: [] });
    if (route === 'POST /api/devices') {
      sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return create(init);
    }
    throw new Error(`unexpected request ${route}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent, reads, asked };
}

function renderPage() {
  const router = createMemoryRouter(routes, { initialEntries: ['/geraete/neu'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const form = () => screen.getByRole('form', { name: 'Gerät einbuchen' });
const select = (name: string) =>
  within(form()).getByRole<HTMLSelectElement>('combobox', { name: new RegExp(`^${name}`) });
const textbox = (name: string) =>
  within(form()).getByRole<HTMLInputElement>('textbox', { name: new RegExp(`^${name}`) });
const searchBox = () =>
  within(form()).getByRole<HTMLInputElement>('searchbox', { name: /^Modellvorlage suchen/ });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Gerät speichern|Speichern …)$/ });
const saveAndAssignButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern und zuordnen' });
const optionTexts = (control: HTMLSelectElement) => Array.from(control.options, ({ text }) => text);

/** The text below a field, linked with `aria-describedby` (CU-057). */
function errorOf(control: HTMLElement): string | null {
  const id = control.getAttribute('aria-describedby');
  return id === null ? null : (document.getElementById(id)?.textContent ?? null);
}

/** The error summary at the top: its items in order (2.0.5). */
const summaryItems = () =>
  screen
    .queryAllByRole('alert')
    .flatMap((alert) => within(alert).queryAllByRole('listitem'))
    .map((item) => item.textContent);

const pending = () => new Promise<Response>(() => {});

async function openPage() {
  const router = renderPage();
  await screen.findByRole('form', { name: 'Gerät einbuchen' });
  // The suppliers have arrived.
  await vi.waitFor(() => expect(optionTexts(select('Lieferant'))).toContain('Lieferant Ost'));
  return router;
}

async function chooseModelTemplate() {
  fireEvent.change(searchBox(), { target: { value: 'T14' } });
  fireEvent.click(await screen.findByRole('button', { name: MV_A_LINE }));
  await vi.waitFor(() => expect(select('Zustand').options.length).toBeGreaterThan(1));
}

/** Chooses a value of a pick list attribute once its list has arrived. */
async function choose(name: string, valueId: number) {
  await vi.waitFor(() =>
    expect(Array.from(select(name).options, (option) => option.value)).toContain(String(valueId)),
  );
  fireEvent.change(select(name), { target: { value: String(valueId) } });
}

/** A valid form: the fixed fields and the required attributes of a Notebook, "ohne Akku". */
async function fillValid({ wiNr = '626198', supplierId = '', battery = WITHOUT_BATTERY } = {}) {
  fireEvent.change(textbox('WI-Nr'), { target: { value: wiNr } });
  fireEvent.change(select('Lieferant'), { target: { value: supplierId } });
  await chooseModelTemplate();
  fireEvent.change(select('Zustand'), { target: { value: '1' } });
  fireEvent.change(textbox('Optik-Note'), { target: { value: '3' } });
  await choose('Tastaturlayout', 111);
  await choose('Netzteil', 121);
  await choose('Akku', battery);
}

/** Accessibility assertion of a state: heading, named controls, linked field errors. */
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Gerät einbuchen' })).toBeTruthy();
  for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
    expect(control.textContent?.trim() || control.getAttribute('aria-label')).toBeTruthy();
  }
  for (const control of [
    ...within(form()).queryAllByRole('combobox'),
    ...within(form()).queryAllByRole('textbox'),
    ...within(form()).queryAllByRole('searchbox'),
  ]) {
    expect(control.id).toBeTruthy();
    expect(document.querySelector(`label[for="${control.id}"]`)?.textContent).toBeTruthy();
    if (control.getAttribute('aria-invalid') === 'true') expect(errorOf(control)).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UI-003 prefill and review flags (CU-132, REQ-013; Technical Specification 2.5)', () => {
  const chips = () => within(form()).queryAllByText('zu prüfen');
  const confirmButton = (field: string) =>
    within(form()).getByRole<HTMLButtonElement>('button', { name: `${field} bestätigen` });
  const statusLine = () =>
    screen.queryByText(/^Noch \d+ Werte zu prüfen\./) ?? screen.queryByText('Alle Werte geprüft.');

  async function choosePrefilled() {
    await chooseModelTemplate();
    await vi.waitFor(() => expect(chips()).toHaveLength(3));
  }

  it('UI-003.loading DER-55-01 shows "Lade Gerätewerte …" in the values card while the prefill loads', async () => {
    mockApi({ prefill: pending });
    await openPage();
    fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });

    fireEvent.change(searchBox(), { target: { value: 'T14' } });
    fireEvent.click(await screen.findByRole('button', { name: MV_A_LINE }));

    const card = await screen.findByRole('region', { name: 'Gerätewerte' });
    await vi.waitFor(() =>
      expect(within(card).getByRole('status').textContent).toBe('Lade Gerätewerte …'),
    );
    expect(within(card).queryByRole('combobox')).toBeNull();
    expect(saveAndAssignButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it('UI-003.default AC-REQ-013-01 DER-55-02 prefills battery and battery capacity of MV-A with "zu prüfen" and "Bestätigen", the processor without', async () => {
    mockApi({ prefill: () => Response.json(MV_A_PREFILL) });
    await openPage();

    await choosePrefilled();

    expect(select('Tastaturlayout').value).toBe('111');
    expect(select('Akku').value).toBe(String(WITH_BATTERY));
    expect(textbox('Akkukapazität').value).toBe('85');
    expect(select('Netzteil').value).toBe('');
    for (const field of ['Tastaturlayout', 'Akku', 'Akkukapazität']) {
      expect(confirmButton(field).textContent).toBe('Bestätigen');
    }
    expect(within(form()).queryByRole('button', { name: 'Netzteil bestätigen' })).toBeNull();
    const panel = screen.getByRole('complementary', { name: 'Modelldaten (nur lesen)' });
    await within(panel).findByText('Intel Core i5-1135G7');
    expect(within(panel).queryByText('zu prüfen')).toBeNull();
    expect(statusLine()?.textContent).toBe(
      'Noch 3 Werte zu prüfen. Das Gerät kann gespeichert, aber noch nicht zugeordnet werden.',
    );
    expectAccessiblePage();
  });

  it('UI-003.default DER-55-02 shows "Alle Werte geprüft." once every flag is lifted, also without defaults', async () => {
    mockApi({ prefill: () => Response.json(MV_A_PREFILL) });
    await openPage();
    await choosePrefilled();

    for (const field of ['Tastaturlayout', 'Akku', 'Akkukapazität']) {
      fireEvent.click(confirmButton(field));
    }

    expect(chips()).toHaveLength(0);
    expect(statusLine()?.textContent).toBe('Alle Werte geprüft.');
  });

  it('UI-003.disabled DER-55-03 deactivates "Speichern und zuordnen" with the tooltip and the hint naming the fields, also for Ctrl+Enter', async () => {
    const { sent } = mockApi({ prefill: () => Response.json(MV_A_PREFILL) });
    await openPage();
    await choosePrefilled();

    const button = saveAndAssignButton();
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Erst Werte prüfen');
    const hint = document.getElementById(button.getAttribute('aria-describedby') ?? '');
    expect(hint?.textContent).toBe('Erst Werte prüfen: Tastaturlayout, Akku, Akkukapazität');
    expect(screen.getByText('Erst Werte prüfen: Tastaturlayout, Akku, Akkukapazität')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(sent).toEqual([]);
    expect(saveButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it('DER-55-04 "Bestätigen" and changing a value lift its flag and the count drops by one', async () => {
    mockApi({ prefill: () => Response.json(MV_A_PREFILL) });
    await openPage();
    await choosePrefilled();

    fireEvent.click(confirmButton('Akkukapazität'));
    expect(statusLine()?.textContent).toMatch(/^Noch 2 Werte zu prüfen\./);
    expect(textbox('Akkukapazität').value).toBe('85');
    expect(document.activeElement).toBe(textbox('Akkukapazität'));

    await choose('Akku', 102);
    expect(statusLine()?.textContent).toMatch(/^Noch 1 Werte zu prüfen\./);
    expect(within(form()).queryByRole('button', { name: 'Akku bestätigen' })).toBeNull();
    expect(screen.getByText('Erst Werte prüfen: Tastaturlayout')).toBeTruthy();
  });

  it('AC-REQ-013-04 "Gerät speichern" with open flags sends no confirmation, the server answers "review_pending"', async () => {
    const { sent } = mockApi({ prefill: () => Response.json(MV_A_PREFILL) });
    await openPage();
    fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
    await choosePrefilled();
    fireEvent.change(select('Zustand'), { target: { value: '1' } });
    fireEvent.change(textbox('Optik-Note'), { target: { value: '3' } });
    await choose('Netzteil', 121);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      values: { 16: 111, 17: 121, 18: WITH_BATTERY, 19: { percent: '85' } },
      confirmedKeys: [],
    });
  });

  it('AC-REQ-013-02 sends the confirmed and the changed fields as confirmedKeys with "Speichern und zuordnen"', async () => {
    const { sent } = mockApi({ prefill: () => Response.json(MV_A_PREFILL) });
    await openPage();
    fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
    await choosePrefilled();
    fireEvent.change(select('Zustand'), { target: { value: '1' } });
    fireEvent.change(textbox('Optik-Note'), { target: { value: '3' } });
    await choose('Netzteil', 121);
    fireEvent.click(confirmButton('Akkukapazität'));
    fireEvent.click(confirmButton('Tastaturlayout'));
    await choose('Akku', 102);

    expect(saveAndAssignButton().disabled).toBe(false);
    expect(saveAndAssignButton().title).toBe('');
    fireEvent.click(saveAndAssignButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect([...(sent[0]?.confirmedKeys as string[])].sort()).toEqual(['16', '18', '19']);
  });

  it('DER-55-06 the field of a deactivated default stays empty without "zu prüfen" and the user chooses an active value', async () => {
    // The server leaves the deactivated keyboard layout out of the prefill (CU-117).
    mockApi({
      prefill: () =>
        Response.json({
          ...MV_A_PREFILL,
          values: { 18: WITH_BATTERY, 19: { percent: 85 } },
          reviewKeys: ['18', '19'],
        }),
    });
    await openPage();
    await chooseModelTemplate();
    await vi.waitFor(() => expect(chips()).toHaveLength(2));

    expect(select('Tastaturlayout').value).toBe('');
    expect(within(form()).queryByRole('button', { name: 'Tastaturlayout bestätigen' })).toBeNull();
    await choose('Tastaturlayout', 111);

    expect(select('Tastaturlayout').value).toBe('111');
    expect(chips()).toHaveLength(2);
    expect(statusLine()?.textContent).toMatch(/^Noch 2 Werte zu prüfen\./);
  });

  it('"Andere Modellvorlage wählen" drops the prefill with its flags and loads it again', async () => {
    mockApi({ prefill: () => Response.json(MV_A_PREFILL) });
    await openPage();
    await choosePrefilled();
    fireEvent.click(confirmButton('Akku'));

    fireEvent.click(screen.getByRole('button', { name: 'Andere Modellvorlage wählen' }));
    expect(statusLine()).toBeNull();
    await choosePrefilled();

    expect(statusLine()?.textContent).toMatch(/^Noch 3 Werte zu prüfen\./);
  });
});

describe('UI-003 condition code (CU-132, CU-092, REQ-015; Technical Specification 2.5, 2.2, 2.0.11)', () => {
  const codeBox = () => textbox('Zustandscode');
  const chipOf = (field: string) =>
    within(form()).queryByRole('button', { name: `${field} bestätigen` });
  /** The hint below the field "Zustandscode", linked with `aria-describedby`. */
  const codeHint = () => errorOf(codeBox());

  function enterCode(code: string) {
    fireEvent.change(codeBox(), { target: { value: code } });
    fireEvent.blur(codeBox());
  }

  /** The prefill of MV-A with the code "DGS": its plain text, and the suggestions given. */
  const dgsPrefill = (change: Record<string, unknown> = {}) => ({
    ...MV_A_PREFILL,
    conditionDescription: DGS_TEXT,
    codeResult: { found: true, plainText: DGS_TEXT },
    ...change,
  });

  it('UI-003.default DER-57-01 shows "Klartext übernommen: <Text>" after leaving the field, resolved for the chosen supplier', async () => {
    const { asked } = mockApi({ resolve: () => Response.json(DGS) });
    await openPage();
    fireEvent.change(select('Lieferant'), { target: { value: '4' } });

    fireEvent.change(codeBox(), { target: { value: 'DGS' } });
    expect(asked.resolve).toEqual([]);
    expect(codeHint()).toBeNull();
    fireEvent.blur(codeBox());

    await vi.waitFor(() => expect(codeHint()).toBe(`Klartext übernommen: ${DGS_TEXT}`));
    expect(asked.resolve).toEqual(['?code=DGS&supplierId=4']);
    expect(codeBox().maxLength).toBe(20);
    expectAccessiblePage();
  });

  it('UI-003.default the hook of CU-092 resolves without supplierId when no supplier is chosen', async () => {
    const { asked } = mockApi({ resolve: () => Response.json(DGS) });
    await openPage();

    enterCode('dgs');

    await vi.waitFor(() => expect(codeHint()).toBe(`Klartext übernommen: ${DGS_TEXT}`));
    expect(asked.resolve).toEqual(['?code=dgs']);
  });

  it('UI-003.default AC-REQ-015-01 DER-57-02 takes the plain text of "dgs" into the condition description without review flag and sends the code', async () => {
    const { sent, asked } = mockApi({
      resolve: () => Response.json(DGS),
      prefill: () => Response.json(dgsPrefill()),
    });
    await openPage();
    enterCode('dgs');
    await fillValid();

    await vi.waitFor(() => expect(textbox('Zustandsbeschreibung').value).toBe(DGS_TEXT));
    expect(asked.prefill).toContain('?conditionCode=dgs');
    expect(chipOf('Zustandsbeschreibung')).toBeNull();
    expect(chipOf('Zustand')).toBeNull();
    expect(codeHint()).toBe(`Klartext übernommen: ${DGS_TEXT}`);

    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ conditionCode: 'dgs', conditionDescription: DGS_TEXT });
    expectAccessiblePage();
  });

  it('UI-003.default AC-REQ-015-03 code "XYZ" shows "Zustandscode unbekannt", takes no text and lets the user write the description', async () => {
    const { sent } = mockApi();
    await openPage();
    enterCode('XYZ');
    await vi.waitFor(() => expect(codeHint()).toBe('Zustandscode unbekannt'));
    await fillValid();

    expect(textbox('Zustandsbeschreibung').value).toBe('');
    fireEvent.change(textbox('Zustandsbeschreibung'), { target: { value: 'Kratzer am Deckel' } });
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      conditionCode: 'XYZ',
      conditionDescription: 'Kratzer am Deckel',
    });
    expectAccessiblePage();
  });

  it('UI-003.default AC-REQ-015-04 prefills the suggested visual grade 4 with "zu prüfen"', async () => {
    mockApi({
      resolve: () => Response.json({ ...DGS, suggestedVisualGrade: 4 }),
      prefill: () =>
        Response.json(
          dgsPrefill({ visualGrade: 4, reviewKeys: ['visualGrade', '16', '18', '19'] }),
        ),
    });
    await openPage();
    enterCode('DGS');
    await chooseModelTemplate();

    await vi.waitFor(() => expect(textbox('Optik-Note').value).toBe('4'));
    expect(chipOf('Optik-Note')?.textContent).toBe('Bestätigen');
    expect(screen.getByText(/^Noch 4 Werte zu prüfen\./)).toBeTruthy();
  });

  it('UI-003.default DER-57-03 with the suggestion "refurbished" deactivated the condition stays empty without "zu prüfen", the visual grade is flagged', async () => {
    // The server leaves the deactivated suggestion out of the prefill (CU-117).
    mockApi({
      resolve: () =>
        Response.json({ ...DGS, suggestedConditionValueId: 2, suggestedVisualGrade: 4 }),
      prefill: () =>
        Response.json(
          dgsPrefill({
            values: {},
            visualGrade: 4,
            reviewKeys: ['visualGrade'],
          }),
        ),
    });
    await openPage();
    enterCode('DGS');
    await chooseModelTemplate();

    await vi.waitFor(() => expect(textbox('Optik-Note').value).toBe('4'));
    expect(select('Zustand').value).toBe('');
    expect(chipOf('Zustand')).toBeNull();
    expect(chipOf('Optik-Note')).toBeTruthy();
    expect(textbox('Zustandsbeschreibung').value).toBe(DGS_TEXT);
    expect(optionTexts(select('Zustand'))).not.toContain('refurbished');
  });

  it('UI-003.default a code entered after the model template takes its text and suggestions, the values and flags of the attributes stay', async () => {
    let withCode = false;
    const { asked } = mockApi({
      resolve: () =>
        Response.json({ ...DGS, suggestedConditionValueId: 1, suggestedVisualGrade: 4 }),
      prefill: () =>
        Response.json(
          withCode
            ? dgsPrefill({
                conditionValueId: 1,
                visualGrade: 4,
                reviewKeys: ['condition', 'visualGrade', '16', '18', '19'],
              })
            : MV_A_PREFILL,
        ),
    });
    await openPage();
    fireEvent.change(select('Lieferant'), { target: { value: '4' } });
    await chooseModelTemplate();
    await vi.waitFor(() => expect(within(form()).queryAllByText('zu prüfen')).toHaveLength(3));
    fireEvent.click(chipOf('Akku') as HTMLElement);
    await choose('Netzteil', 121);

    withCode = true;
    enterCode('DGS');

    await vi.waitFor(() => expect(textbox('Zustandsbeschreibung').value).toBe(DGS_TEXT));
    expect(asked.prefill.at(-1)).toBe('?conditionCode=DGS&supplierId=4');
    expect(select('Zustand').value).toBe('1');
    expect(textbox('Optik-Note').value).toBe('4');
    expect(select('Netzteil').value).toBe('121');
    expect(chipOf('Zustand')).toBeTruthy();
    expect(chipOf('Optik-Note')).toBeTruthy();
    expect(chipOf('Akku')).toBeNull();
    expect(screen.getByText(/^Noch 4 Werte zu prüfen\./)).toBeTruthy();
    expect(screen.queryByText('Lade Gerätewerte …')).toBeNull();
  });

  it('UI-003.loading AC-REQ-013-01 a code entered while the prefill of the model template loads keeps the values of the model template (FIND-1068-01)', async () => {
    let answerFirst: (response: Response) => void = () => {};
    const { asked } = mockApi({
      resolve: () => Response.json(DGS),
      prefill: () =>
        asked.prefill.length === 1
          ? new Promise<Response>((resolve) => {
              answerFirst = resolve;
            })
          : Response.json(dgsPrefill()),
    });
    await openPage();
    fireEvent.change(searchBox(), { target: { value: 'T14' } });
    fireEvent.click(await screen.findByRole('button', { name: MV_A_LINE }));
    await screen.findByText('Lade Gerätewerte …');

    enterCode('DGS');
    answerFirst(Response.json(MV_A_PREFILL));

    await vi.waitFor(() => expect(textbox('Zustandsbeschreibung').value).toBe(DGS_TEXT));
    expect(asked.prefill).toEqual(['', '?conditionCode=DGS']);
    expect(select('Tastaturlayout').value).toBe('111');
    expect(select('Akku').value).toBe(String(WITH_BATTERY));
    expect(chipOf('Tastaturlayout')).toBeTruthy();
    expect(chipOf('Akku')).toBeTruthy();
    expect(screen.queryByText('Lade Gerätewerte …')).toBeNull();
    expectAccessiblePage();
  });

  describe('after supplier_deactivated (2.0.11 "Lieferant in UI-003", design v0.6.8)', () => {
    const suppliersAfter = () => {
      let calls = 0;
      return () => {
        calls += 1;
        return calls === 1 ? list([OST, WEST]) : list([OST, { ...WEST, active: false }]);
      };
    };
    /** "DGS" exists only for "Lieferant West" unless `withoutSupplier` is set. */
    const resolveFor =
      ({ withoutSupplier = false } = {}) =>
      (url: URL) =>
        Response.json(
          url.searchParams.get('supplierId') === String(WEST.id)
            ? { ...DGS, plainText: 'Display gebrochen (West)', suggestedVisualGrade: 4 }
            : withoutSupplier
              ? DGS
              : UNKNOWN_CODE,
        );
    const westPrefill = () =>
      Response.json(
        dgsPrefill({
          conditionDescription: 'Display gebrochen (West)',
          codeResult: { found: true, plainText: 'Display gebrochen (West)' },
          visualGrade: 4,
          reviewKeys: ['visualGrade', '16', '18', '19'],
        }),
      );

    async function rejectWest() {
      fireEvent.change(select('Lieferant'), { target: { value: String(WEST.id) } });
      enterCode('DGS');
      await vi.waitFor(() =>
        expect(codeHint()).toBe('Klartext übernommen: Display gebrochen (West)'),
      );
      fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
      await chooseModelTemplate();
      await vi.waitFor(() => expect(textbox('Optik-Note').value).toBe('4'));
      fireEvent.change(select('Zustand'), { target: { value: '1' } });
      await choose('Netzteil', 121);
      fireEvent.click(saveButton());
      await vi.waitFor(() => expect(errorOf(select('Lieferant'))).toBe(WEST_DEACTIVATED));
    }

    it('UI-003.validation DER-57-04 resolves "DGS" again without supplierId and shows "Zustandscode unbekannt"; condition, visual grade, description and flags stay', async () => {
      const { asked } = mockApi({
        create: supplierDeactivated,
        suppliers: suppliersAfter(),
        resolve: resolveFor(),
        prefill: westPrefill,
      });
      await openPage();
      await rejectWest();

      await vi.waitFor(() => expect(codeHint()).toBe('Zustandscode unbekannt'));
      expect(asked.resolve).toEqual([`?code=DGS&supplierId=${WEST.id}`, '?code=DGS']);
      expect(select('Zustand').value).toBe('1');
      expect(textbox('Optik-Note').value).toBe('4');
      expect(chipOf('Optik-Note')).toBeTruthy();
      expect(textbox('Zustandsbeschreibung').value).toBe('Display gebrochen (West)');
      expect(within(form()).queryAllByText('zu prüfen')).toHaveLength(4);
      expect(codeBox().value).toBe('DGS');
      expectAccessiblePage();
    });

    it('DER-57-04 shows "Klartext übernommen: <Text>" when the code exists without supplier, values unchanged', async () => {
      mockApi({
        create: supplierDeactivated,
        suppliers: suppliersAfter(),
        resolve: resolveFor({ withoutSupplier: true }),
        prefill: westPrefill,
      });
      await openPage();
      await rejectWest();

      await vi.waitFor(() => expect(codeHint()).toBe(`Klartext übernommen: ${DGS_TEXT}`));
      expect(textbox('Zustandsbeschreibung').value).toBe('Display gebrochen (West)');
      expect(textbox('Optik-Note').value).toBe('4');
    });

    it('DER-57-04 resolves nothing again without a condition code', async () => {
      const { asked } = mockApi({ create: supplierDeactivated, suppliers: suppliersAfter() });
      await openPage();
      await fillValid({ supplierId: String(WEST.id) });

      fireEvent.click(saveButton());
      await vi.waitFor(() => expect(errorOf(select('Lieferant'))).toBe(WEST_DEACTIVATED));

      await vi.waitFor(() =>
        expect(optionTexts(select('Lieferant'))).toEqual(['', 'Lieferant Ost']),
      );
      expect(asked.resolve).toEqual([]);
      expect(codeHint()).toBeNull();
    });
  });
});

describe('UI-003 Gerät einbuchen (CU-132)', () => {
  it('UI-003.default DER-54-01 focuses WI-Nr, shows the values card only after the model template and keeps the field order', async () => {
    mockApi();
    await openPage();

    expect(document.activeElement).toBe(textbox('WI-Nr'));
    expect(screen.getByText('Felder mit * sind Pflicht.')).toBeTruthy();
    expect(within(form()).queryByRole('region', { name: 'Gerätewerte' })).toBeNull();

    await chooseModelTemplate();
    await vi.waitFor(() => expect(select('Akku')).toBeTruthy());

    const labels = () =>
      Array.from(form().querySelectorAll('label'), (label) => label.textContent?.replace('*', ''));
    expect(labels()).toEqual([
      'WI-Nr',
      'Lieferant',
      'Zustandscode',
      'Zustand',
      'Optik-Note',
      'Tastaturlayout',
      'Netzteil',
      'Akku',
      'Zustandsbeschreibung',
    ]);
    expect(within(form()).getByRole('region', { name: 'Gerätewerte' })).toBeTruthy();
    expect(textbox('WI-Nr').getAttribute('aria-required')).toBe('true');
    expect(select('Lieferant').getAttribute('aria-required')).toBeNull();
    for (const name of ['Tastaturlayout', 'Netzteil', 'Akku']) {
      expect(select(name).getAttribute('aria-required')).toBe('true');
      expect(select(name).options[0]?.text).toBe('Bitte wählen');
    }
    await vi.waitFor(() =>
      expect(optionTexts(select('Akku'))).toEqual([
        'Bitte wählen',
        'mit Akku',
        'mit Akku (defekt)',
        'ohne Akku',
      ]),
    );

    // The battery capacity appears after a battery value with "Akku vorhanden".
    await choose('Akku', WITH_BATTERY);
    expect(labels().slice(-4)).toEqual([
      'Akku',
      'Akkukapazität',
      'nicht ermittelbar',
      'Zustandsbeschreibung',
    ]);
    expect(textbox('Akkukapazität').getAttribute('aria-required')).toBe('true');
    expectAccessiblePage();
  });

  it('UI-003.default DER-54-01 shows "Akkukapazität" only with a battery value with "Akku vorhanden", empty when it appears again', async () => {
    mockApi();
    await openPage();
    await chooseModelTemplate();

    await choose('Akku', WITHOUT_BATTERY);
    expect(within(form()).queryByRole('textbox', { name: /^Akkukapazität/ })).toBeNull();

    await choose('Akku', WITH_BATTERY);
    fireEvent.change(textbox('Akkukapazität'), { target: { value: '87' } });
    await choose('Akku', 102);
    expect(textbox('Akkukapazität').value).toBe('87');

    await choose('Akku', WITHOUT_BATTERY);
    expect(within(form()).queryByRole('textbox', { name: /^Akkukapazität/ })).toBeNull();
    await choose('Akku', WITH_BATTERY);
    expect(textbox('Akkukapazität').value).toBe('');
  });

  it('UI-003.validation DER-54-01 names a missing required attribute and the missing battery capacity at the field in form order, nothing sent', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid({ battery: WITH_BATTERY });
    fireEvent.change(select('Netzteil'), { target: { value: '' } });
    fireEvent.change(textbox('Zustandsbeschreibung'), { target: { value: 'x'.repeat(1001) } });

    fireEvent.click(saveButton());

    expect(errorOf(select('Netzteil'))).toBe('Netzteil fehlt');
    expect(errorOf(textbox('Akkukapazität'))).toBe(CAPACITY_RULE);
    // In the order of the card: the attributes, then the condition description (mockup).
    expect(summaryItems()).toEqual([
      'Netzteil fehlt',
      CAPACITY_RULE,
      'Zustandsbeschreibung: höchstens 1.000 Zeichen',
    ]);
    expect(document.activeElement).toBe(select('Netzteil'));
    expect(sent).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-003.default Enter in WI-Nr moves to "Lieferant"', async () => {
    mockApi();
    await openPage();

    fireEvent.keyDown(textbox('WI-Nr'), { key: 'Enter' });

    expect(document.activeElement).toBe(select('Lieferant'));
  });

  it('UI-003.default DER-54-15 offers only the active suppliers and the empty choice, nothing chosen', async () => {
    mockApi();
    await openPage();

    expect(optionTexts(select('Lieferant'))).toEqual(['', 'Lieferant Ost', 'Lieferant West']);
    expect(select('Lieferant').value).toBe('');
  });

  it('UI-003.default offers only the active conditions after "Bitte wählen", not choosable', async () => {
    mockApi();
    await openPage();
    await chooseModelTemplate();

    expect(optionTexts(select('Zustand'))).toEqual(['Bitte wählen', 'gebraucht', 'defekt']);
    expect(select('Zustand').options[0]?.disabled).toBe(true);
    expect(select('Zustand').getAttribute('aria-required')).toBe('true');
  });

  it('UI-003.default DER-54-02 shows the chosen model template and the model data read only without review flag', async () => {
    mockApi();
    await openPage();
    fireEvent.change(searchBox(), { target: { value: 'T' } });
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(screen.queryByRole('button', { name: MV_A_LINE })).toBeNull();

    await chooseModelTemplate();

    expect(screen.getByTestId('chosen-model-template').textContent).toBe(MV_A_LINE);
    expect(screen.getByRole('button', { name: 'Andere Modellvorlage wählen' })).toBeTruthy();
    const panel = screen.getByRole('complementary', { name: 'Modelldaten (nur lesen)' });
    await vi.waitFor(() =>
      expect(
        within(panel)
          .getAllByRole('definition')
          .map((cell) => cell.textContent),
      ).toEqual(['Intel Core i5-1135G7', '14 Zoll', '2 × USB-C links']),
    );
    expect(
      within(panel)
        .getAllByRole('term')
        .map((cell) => cell.textContent),
    ).toEqual(['Prozessor', 'Displaygröße', 'Anschlüsse']);
    expect(within(panel).queryByRole('textbox')).toBeNull();
    expect(within(panel).queryByText('zu prüfen')).toBeNull();
    expectAccessiblePage();
  });

  it('"Andere Modellvorlage wählen" opens the search again and hides the values card', async () => {
    mockApi();
    await openPage();
    await chooseModelTemplate();

    fireEvent.click(screen.getByRole('button', { name: 'Andere Modellvorlage wählen' }));

    expect(searchBox()).toBeTruthy();
    expect(within(form()).queryByRole('region', { name: 'Gerätewerte' })).toBeNull();
  });

  it('AC-REQ-012-01 sends the device with every field to POST /api/devices', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid({ supplierId: '4' });
    fireEvent.change(textbox('Zustandsbeschreibung'), { target: { value: 'Kratzer am Deckel' } });

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      wiNr: '626198',
      supplierId: 4,
      conditionCode: null,
      modelTemplateId: 7,
      conditionValueId: 1,
      visualGrade: '3',
      conditionDescription: 'Kratzer am Deckel',
      values: { 16: 111, 17: 121, 18: WITHOUT_BATTERY },
      confirmedKeys: [],
    });
  });

  it('AC-REQ-012-01 sends the battery capacity with a battery value with "Akku vorhanden"', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid({ battery: WITH_BATTERY });
    fireEvent.change(textbox('Akkukapazität'), { target: { value: '87' } });

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.values).toEqual({
      16: 111,
      17: 121,
      18: WITH_BATTERY,
      19: { percent: '87' },
    });
  });

  it('"Andere Modellvorlage wählen" drops the values of the attributes', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid();

    fireEvent.click(screen.getByRole('button', { name: 'Andere Modellvorlage wählen' }));
    await chooseModelTemplate();
    await vi.waitFor(() => expect(select('Akku')).toBeTruthy());

    expect(select('Tastaturlayout').value).toBe('');
    expect(select('Akku').value).toBe('');
    fireEvent.click(saveButton());
    expect(errorOf(select('Tastaturlayout'))).toBe('Tastaturlayout fehlt');
    expect(sent).toEqual([]);
  });

  it('UI-003.success DER-54-03 shows "Gerät 626198 gespeichert" and the page stays open', async () => {
    mockApi();
    const router = await openPage();
    await fillValid();
    // Without "Weiteres Gerät derselben Modellvorlage" the inputs stay (DER-54-08).
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Weiteres Gerät derselben Modellvorlage' }),
    );

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('status');
    expect(banner.textContent).toContain('Gerät 626198 gespeichert');
    expect(router.state.location.pathname).toBe('/geraete/neu');
    expect(textbox('WI-Nr').value).toBe('626198');
    expectAccessiblePage();
  });

  it('UI-003.success Ctrl+S saves the device, Ctrl+Enter saves it with "Speichern und zuordnen"', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid();
    // The form is saved three times, so it is not emptied after the save (DER-54-08).
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Weiteres Gerät derselben Modellvorlage' }),
    );

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await vi.waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    // The save opens UI-004 (DER-55-05); "Abbrechen" leaves the device unassigned.
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }),
    );
    await vi.waitFor(() => expect(saveAndAssignButton().disabled).toBe(false));
    fireEvent.click(saveAndAssignButton());

    await vi.waitFor(() => expect(sent).toHaveLength(3));
  });

  it('DER-55-05 "Speichern und zuordnen" sends POST /api/devices and opens UI-004 for the saved device', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid();

    fireEvent.click(saveAndAssignButton());

    const dialog = await screen.findByRole('dialog', { name: 'Modell-Inserat wählen' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ wiNr: '626198', modelTemplateId: 7 });
    expect(dialog.textContent).toContain('Gerät626198');
    expect(dialog.textContent).toContain('ModellvorlageThinkPad T14 Gen 2');
    expect(
      await within(dialog).findByText('Für diese Modellvorlage gibt es noch kein Modell-Inserat.'),
    ).toBeTruthy();
  });

  it('DER-55-05 Ctrl+S and Ctrl+Enter send no further POST /api/devices while UI-004 is open', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid();

    fireEvent.click(saveAndAssignButton());
    const dialog = await screen.findByRole('dialog', { name: 'Modell-Inserat wählen' });
    expect(sent).toHaveLength(1);

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(dialog, { key: 's', ctrlKey: true });
    fireEvent.keyDown(dialog, { key: 'Enter', ctrlKey: true });

    // Give a wrongly sent request the time to arrive.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Modell-Inserat wählen' })).toBeTruthy();
  });

  it('CU-058 Esc and "Abbrechen" in UI-004 return the focus to "Speichern und zuordnen", Ctrl+Enter to the field it came from', async () => {
    mockApi();
    await openPage();
    await fillValid();
    // A browser moves the focus of a control that gets disabled to `<body>`, as the save locks
    // the button and the fields until UI-004 opens; jsdom does not, so the test does it.
    const blurWhileSaving = () =>
      vi.waitFor(() => {
        expect(saveAndAssignButton().disabled).toBe(true);
        (document.activeElement as HTMLElement).blur();
      });

    saveAndAssignButton().focus();
    fireEvent.click(saveAndAssignButton());
    await blurWhileSaving();
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });
    await vi.waitFor(() => expect(document.activeElement).toBe(saveAndAssignButton()));

    saveAndAssignButton().focus();
    fireEvent.click(saveAndAssignButton());
    await blurWhileSaving();
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }),
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(saveAndAssignButton()));

    textbox('Optik-Note').focus();
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    await blurWhileSaving();
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });
    await vi.waitFor(() => expect(document.activeElement).toBe(textbox('Optik-Note')));
  });

  it('DER-55-05 a rejected save of "Speichern und zuordnen" keeps UI-003 without UI-004', async () => {
    mockApi({
      create: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openPage();
    await fillValid();

    fireEvent.click(saveAndAssignButton());

    expect((await screen.findByRole('alert')).textContent).toContain('Referenz: R-7K2M-9QX4');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('UI-003.error DER-54-04 shows the banner with the reference number on 500 and keeps the inputs', async () => {
    mockApi({
      create: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openPage();
    await fillValid();

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Das Gerät konnte nicht gespeichert werden. Bitte erneut versuchen. Referenz: R-7K2M-9QX4',
    );
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(textbox('Optik-Note').value).toBe('3');
    expectAccessiblePage();
  });

  it('UI-003.validation DER-54-05 shows WI-Nr "62-61" and Akkukapazität 101 at the fields and in the summary from the check in the browser, focus there, nothing sent', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid({ wiNr: '62-61', battery: WITH_BATTERY });
    fireEvent.change(textbox('Akkukapazität'), { target: { value: '101' } });

    fireEvent.click(saveButton());

    expect(errorOf(textbox('WI-Nr'))).toBe(WI_NR_RULE);
    expect(errorOf(textbox('Akkukapazität'))).toBe(CAPACITY_RULE);
    expect(summaryItems()).toEqual([WI_NR_RULE, CAPACITY_RULE]);
    expect(document.activeElement).toBe(textbox('WI-Nr'));
    expect(sent).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-003.validation DER-54-05 shows WI-Nr "62-61" and Akkukapazität 101 from 422 validation_failed at the fields and in the summary, without own text', async () => {
    mockApi({
      create: () =>
        Response.json(
          errorBody('validation_failed', {
            fields: [
              { path: 'wiNr', code: 'wi_nr_format', message: WI_NR_RULE },
              { path: 'values.19', code: 'battery_capacity_format', message: CAPACITY_RULE },
            ],
          }),
          { status: 422 },
        ),
    });
    await openPage();
    await fillValid({ battery: WITH_BATTERY });
    fireEvent.change(textbox('Akkukapazität'), { target: { value: '87' } });

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(textbox('WI-Nr'))).toBe(WI_NR_RULE));
    expect(errorOf(textbox('Akkukapazität'))).toBe(CAPACITY_RULE);
    expect(summaryItems()).toEqual([WI_NR_RULE, CAPACITY_RULE]);
    expect(document.activeElement).toBe(textbox('WI-Nr'));
    expectAccessiblePage();
  });

  it('UI-003.validation AC-REQ-012-03 an empty WI-Nr and one with a space are rejected naming the WI-Nr rule', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid({ wiNr: '' });

    fireEvent.click(saveButton());
    expect(errorOf(textbox('WI-Nr'))).toBe(WI_NR_RULE);

    fireEvent.change(textbox('WI-Nr'), { target: { value: '626 198' } });
    fireEvent.blur(textbox('WI-Nr'));
    expect(errorOf(textbox('WI-Nr'))).toBe(WI_NR_RULE);
    expect(sent).toEqual([]);
  });

  it('UI-003.validation DER-54-11 shows "Bitte eine Modellvorlage wählen" without model template and sends nothing, also with "Speichern und zuordnen"', async () => {
    const { sent } = mockApi();
    await openPage();
    fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });

    fireEvent.click(saveButton());

    expect(errorOf(searchBox())).toBe('Bitte eine Modellvorlage wählen');
    expect(summaryItems()).toEqual(['Bitte eine Modellvorlage wählen']);
    fireEvent.click(saveAndAssignButton());
    expect(errorOf(searchBox())).toBe('Bitte eine Modellvorlage wählen');
    expect(sent).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-003.validation AC-REQ-012-02 shows wi_nr_taken at the WI-Nr with a link to the existing device', async () => {
    mockApi({
      create: () =>
        Response.json(
          errorBody('wi_nr_taken', {
            message: 'WI-Nr bereits vergeben: Gerät 626198 (nicht zugeordnet)',
            details: { deviceId: 12, listingId: null },
          }),
          { status: 422 },
        ),
    });
    await openPage();
    await fillValid();

    fireEvent.click(saveButton());

    await vi.waitFor(() =>
      expect(errorOf(textbox('WI-Nr'))).toBe(
        'WI-Nr bereits vergeben: Gerät 626198 (nicht zugeordnet)',
      ),
    );
    const link = within(form()).getByRole('link', { name: 'Gerät 626198' });
    expect(link.getAttribute('href')).toBe('/geraete/12');
    expect(summaryItems()).toEqual(['WI-Nr bereits vergeben: Gerät 626198 (nicht zugeordnet)']);
    expect(document.activeElement).toBe(textbox('WI-Nr'));
    // Leaving the field unchanged keeps the text; the browser cannot check it.
    fireEvent.blur(textbox('WI-Nr'));
    expect(errorOf(textbox('WI-Nr'))).toBe(
      'WI-Nr bereits vergeben: Gerät 626198 (nicht zugeordnet)',
    );
    expect(saveButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it('UI-003.validation the summary drops a field error once the field is corrected', async () => {
    mockApi();
    await openPage();
    await fillValid({ wiNr: '62-61' });
    fireEvent.click(saveButton());
    expect(summaryItems()).toEqual([WI_NR_RULE]);

    fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
    fireEvent.blur(textbox('WI-Nr'));

    expect(summaryItems()).toEqual([]);
  });

  describe('supplier after supplier_deactivated (2.0.11, design v0.6.8)', () => {
    /** The suppliers before and after the rejection: "Lieferant West" deactivated meanwhile. */
    function suppliersDeactivatedMeanwhile() {
      let calls = 0;
      return () => {
        calls += 1;
        return calls === 1 ? list([OST, WEST]) : list([OST, { ...WEST, active: false }]);
      };
    }

    it('UI-003.validation DER-54-15 DER-54-16 (a) (d) shows the text at "Lieferant" and in the summary, focus there, reloads the suppliers, empties the choice and keeps the inputs', async () => {
      const { reads } = mockApi({
        create: supplierDeactivated,
        suppliers: suppliersDeactivatedMeanwhile(),
      });
      await openPage();
      await fillValid({ supplierId: '5' });
      fireEvent.change(textbox('Zustandsbeschreibung'), { target: { value: 'Kratzer' } });

      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(errorOf(select('Lieferant'))).toBe(WEST_DEACTIVATED));
      expect(summaryItems()).toEqual([WEST_DEACTIVATED]);
      expect(document.activeElement).toBe(select('Lieferant'));
      await vi.waitFor(() => expect(reads.suppliers).toBe(2));
      await vi.waitFor(() =>
        expect(optionTexts(select('Lieferant'))).toEqual(['', 'Lieferant Ost']),
      );
      // Optional field: empty, no placeholder, nothing chosen.
      expect(select('Lieferant').value).toBe('');
      expect(select('Lieferant').selectedOptions[0]?.text).toBe('');
      expect(errorOf(select('Lieferant'))).toBe(WEST_DEACTIVATED);
      expect(textbox('WI-Nr').value).toBe('626198');
      expect(select('Zustand').value).toBe('1');
      expect(textbox('Optik-Note').value).toBe('3');
      expect(textbox('Zustandsbeschreibung').value).toBe('Kratzer');
      expect(screen.getByTestId('chosen-model-template').textContent).toBe(MV_A_LINE);
      expectAccessiblePage();
    });

    it('DER-54-16 (a) the text stays until the next choice in the field, also the empty choice', async () => {
      mockApi({ create: supplierDeactivated, suppliers: suppliersDeactivatedMeanwhile() });
      await openPage();
      await fillValid({ supplierId: '5' });
      fireEvent.click(saveButton());
      await vi.waitFor(() =>
        expect(optionTexts(select('Lieferant'))).toEqual(['', 'Lieferant Ost']),
      );

      fireEvent.blur(select('Lieferant'));
      fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });
      expect(errorOf(select('Lieferant'))).toBe(WEST_DEACTIVATED);

      fireEvent.change(select('Lieferant'), { target: { value: '' } });
      expect(errorOf(select('Lieferant'))).toBeNull();
    });

    it('DER-54-16 (b) (c) "Gerät speichern" afterwards saves without supplier, without error and never sends the rejected id', async () => {
      let posts = 0;
      const { sent } = mockApi({
        create: () => {
          posts += 1;
          return posts === 1 ? supplierDeactivated() : Response.json(CREATED, { status: 201 });
        },
        suppliers: suppliersDeactivatedMeanwhile(),
      });
      await openPage();
      await fillValid({ supplierId: '5' });
      fireEvent.click(saveButton());
      await vi.waitFor(() =>
        expect(optionTexts(select('Lieferant'))).toEqual(['', 'Lieferant Ost']),
      );

      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(sent).toHaveLength(2));
      expect(sent[1]).toMatchObject({ supplierId: null });
      expect((await screen.findByRole('status')).textContent).toContain('Gerät 626198 gespeichert');
      expect(sent.filter(({ supplierId }) => supplierId === WEST.id)).toHaveLength(1);
    });

    it('DER-54-16 (e) when reloading the suppliers fails, only the rejected supplier is missing: empty with the text of the answer, no other field marked', async () => {
      let calls = 0;
      mockApi({
        create: supplierDeactivated,
        suppliers: () => {
          calls += 1;
          if (calls === 1) return list([OST, WEST]);
          return Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          });
        },
      });
      await openPage();
      await fillValid({ supplierId: '5' });

      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(select('Lieferant').value).toBe(''));
      expect(optionTexts(select('Lieferant'))).toEqual(['', 'Lieferant Ost']);
      expect(errorOf(select('Lieferant'))).toBe(WEST_DEACTIVATED);
      expect(errorOf(select('Zustand'))).toBeNull();
      expect(errorOf(textbox('Optik-Note'))).toBeNull();
      expect(summaryItems()).toEqual([WEST_DEACTIVATED]);
    });

    it('DER-54-16 locks the save while the suppliers are read again after the rejection', async () => {
      let calls = 0;
      const { sent } = mockApi({
        create: supplierDeactivated,
        suppliers: () => {
          calls += 1;
          return calls === 1 ? list([OST, WEST]) : pending();
        },
      });
      await openPage();
      await fillValid({ supplierId: '5' });
      fireEvent.click(saveButton());
      await vi.waitFor(() => expect(errorOf(select('Lieferant'))).toBe(WEST_DEACTIVATED));

      expect(saveButton().disabled).toBe(true);
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
      expect(sent).toHaveLength(1);
    });

    describe('a choice while the suppliers are read again (2.4, addendum MAR-963, pattern T5j)', () => {
      const NORD = supplier(7, 'Lieferant Nord');
      const NORD_DEACTIVATED = 'Lieferant Lieferant Nord ist deaktiviert';

      /** The first read answers at once, the reload only when the test answers it. */
      function delayedReload() {
        let calls = 0;
        let answer: (response: Response) => void = () => {};
        const reload = new Promise<Response>((resolve) => {
          answer = resolve;
        });
        const route = () => {
          calls += 1;
          return calls === 1 ? list([OST, WEST, NORD]) : reload;
        };
        return { route, answer: (response: Response) => answer(response) };
      }

      async function rejectWest(route: Route) {
        const api = mockApi({ create: supplierDeactivated, suppliers: route });
        await openPage();
        await fillValid({ supplierId: '5' });
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(errorOf(select('Lieferant'))).toBe(WEST_DEACTIVATED));
        await vi.waitFor(() => expect(api.reads.suppliers).toBe(2));
        return api;
      }

      it('DER-54-16 (i) another supplier chosen meanwhile and missing in the new list is emptied with its text, focus there only after the reload, never sent', async () => {
        const reload = delayedReload();
        const { sent } = await rejectWest(reload.route);
        fireEvent.change(select('Lieferant'), { target: { value: '7' } });
        textbox('WI-Nr').focus();
        expect(errorOf(select('Lieferant'))).toBeNull();
        expect(document.activeElement).toBe(textbox('WI-Nr'));

        reload.answer(list([OST, { ...WEST, active: false }, { ...NORD, active: false }]));

        await vi.waitFor(() => expect(errorOf(select('Lieferant'))).toBe(NORD_DEACTIVATED));
        expect(select('Lieferant').value).toBe('');
        expect(document.activeElement).toBe(select('Lieferant'));
        expect(summaryItems()).toEqual([NORD_DEACTIVATED]);
        fireEvent.blur(select('Lieferant'));
        expect(errorOf(select('Lieferant'))).toBe(NORD_DEACTIVATED);

        fireEvent.click(saveButton());

        await vi.waitFor(() => expect(sent).toHaveLength(2));
        expect(sent[1]).toMatchObject({ supplierId: null });
        expect(sent.filter(({ supplierId }) => supplierId === NORD.id)).toHaveLength(0);
      });

      it('DER-54-16 (ii) a supplier chosen meanwhile that is active in the new list stays chosen, without text', async () => {
        const reload = delayedReload();
        await rejectWest(reload.route);
        fireEvent.change(select('Lieferant'), { target: { value: '4' } });

        reload.answer(list([OST, { ...WEST, active: false }, NORD]));

        await vi.waitFor(() =>
          expect(optionTexts(select('Lieferant'))).toEqual(['', 'Lieferant Ost', 'Lieferant Nord']),
        );
        expect(select('Lieferant').value).toBe('4');
        expect(errorOf(select('Lieferant'))).toBeNull();
        expect(summaryItems()).toEqual([]);
      });

      it('DER-54-16 (iii) the rejected supplier chosen again meanwhile is emptied with the text and the name before the reload, and never sent again', async () => {
        const reload = delayedReload();
        const { sent } = await rejectWest(reload.route);
        fireEvent.change(select('Lieferant'), { target: { value: '' } });
        fireEvent.change(select('Lieferant'), { target: { value: '5' } });

        reload.answer(list([OST, { ...WEST, name: 'Lieferant West neu', active: false }, NORD]));

        await vi.waitFor(() => expect(errorOf(select('Lieferant'))).toBe(WEST_DEACTIVATED));
        expect(select('Lieferant').value).toBe('');
        expect(document.activeElement).toBe(select('Lieferant'));

        fireEvent.click(saveButton());

        await vi.waitFor(() => expect(sent).toHaveLength(2));
        expect(sent[1]).toMatchObject({ supplierId: null });
        expect(sent.filter(({ supplierId }) => supplierId === WEST.id)).toHaveLength(1);
      });

      it('DER-54-16 (iv) when the reload fails, another supplier chosen meanwhile stays and the rejected one leaves the list', async () => {
        const reload = delayedReload();
        await rejectWest(reload.route);
        fireEvent.change(select('Lieferant'), { target: { value: '7' } });

        reload.answer(
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
        );

        await vi.waitFor(() =>
          expect(optionTexts(select('Lieferant'))).toEqual(['', 'Lieferant Ost', 'Lieferant Nord']),
        );
        expect(select('Lieferant').value).toBe('7');
        expect(errorOf(select('Lieferant'))).toBeNull();
      });
    });
  });

  it('UI-003.conflict DER-54-12 (a) shows P-05 with "Neu laden" on 409 version_conflict, saves nothing and keeps the inputs', async () => {
    mockApi({ create: () => Response.json(errorBody('version_conflict'), { status: 409 }) });
    await openPage();
    await fillValid();

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert.',
    );
    expect(within(banner).getByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(textbox('WI-Nr').value).toBe('626198');
    expectAccessiblePage();
  });

  it('UI-003.unreachable DER-54-12 (b) shows P-06 with "Erneut versuchen" when the suppliers get no answer, without replacing the page', async () => {
    mockApi({
      suppliers: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.getByRole('form', { name: 'Gerät einbuchen' })).toBeTruthy();
    expectAccessiblePage();
  });

  it('UI-003.unreachable DER-54-12 (b) shows P-06 when the model template search takes longer than 5 s, keeping the inputs', async () => {
    mockApi({
      search: (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
    fireEvent.change(searchBox(), { target: { value: 'T14' } });
    // First the wait after the last keystroke, which starts the search, then its time limit.
    await act(() => vi.advanceTimersByTimeAsync(300));
    await act(() => vi.advanceTimersByTimeAsync(5000));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(searchBox().value).toBe('T14');
  });

  it('UI-003.unreachable DER-54-12 (b) shows P-06 when the model template of the panel "Modelldaten" gets no answer, keeping the inputs', async () => {
    mockApi({
      modelTemplate: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await openPage();
    fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
    await chooseModelTemplate();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(screen.getByTestId('chosen-model-template').textContent).toBe(MV_A_LINE);
    expectAccessiblePage();
  });

  it('UI-003.error shows the banner with the reference number when the model template of the panel "Modelldaten" fails with 500, keeping the inputs', async () => {
    mockApi({
      modelTemplate: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openPage();
    fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
    await chooseModelTemplate();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Referenz: R-7K2M-9QX4');
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(screen.getByTestId('chosen-model-template').textContent).toBe(MV_A_LINE);
    expectAccessiblePage();
  });

  it('UI-003.unreachable DER-54-12 (b) shows P-06 when a pick list of the model data gets no answer', async () => {
    mockApi({
      portTypes: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await openPage();
    await chooseModelTemplate();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
  });

  it('UI-003.error shows the banner when a pick list of the model data fails with 500', async () => {
    mockApi({
      portTypes: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openPage();
    await chooseModelTemplate();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Referenz: R-7K2M-9QX4');
  });

  it('UI-003.wird-beendet DER-54-12 (c) shows P-07 without reference number on 503 shutting_down and keeps the inputs', async () => {
    mockApi({
      create: () =>
        Response.json(errorBody('shutting_down', { referenceNumber: 'R-7K2M-9QX5' }), {
          status: 503,
        }),
    });
    await openPage();
    await fillValid();

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(textbox('WI-Nr').value).toBe('626198');
    expectAccessiblePage();
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-003.ausgang-unbekannt DER-54-06 shows "Ausgang unbekannt, bitte neu laden." without button, keeps the inputs and locks every write', async () => {
    const { sent } = mockApi({
      create: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await openPage();
    await fillValid();

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(saveButton().disabled).toBe(true);
    expect(saveAndAssignButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(sent).toHaveLength(1);
    expectAccessiblePage();
  });
});
