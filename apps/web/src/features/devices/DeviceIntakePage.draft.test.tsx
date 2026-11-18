import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of UI-003 "Gerät einbuchen" (CU-132) with the draft for UI-007 (CU-133) and
// "Weiteres Gerät derselben Modellvorlage" (#186), with a mocked `fetch` (Technical Specification
// 6.1, 6.2).

const DRAFT_KEY = 'resellr.deviceIntake.draft';

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const OST = { id: 4, name: 'Lieferant Ost', active: true, version: 1 };
const PICK_LISTS = [
  { id: 1, key: 'condition', name: 'Zustand', isBatteryList: false, version: 1 },
  { id: 11, key: 'keyboard_layout', name: 'Tastaturlayout', isBatteryList: false, version: 1 },
];
const value = (id: number, label: string) => ({
  id,
  label,
  active: true,
  batteryPresent: null,
  sortOrder: id,
  version: 1,
});
const CONDITIONS = [value(1, 'gebraucht')];
const KEYBOARD_LAYOUTS = [value(111, 'Deutsch (QWERTZ)')];
const ATTRIBUTES = [
  {
    id: 16,
    deviceTypeId: 1,
    label: 'Tastaturlayout',
    dataType: 'pick',
    systemRole: 'keyboard_layout',
    unit: null,
    unitSpacing: true,
    minValue: null,
    maxValue: null,
    pickListId: 11,
    level: 'device',
    variantForming: false,
    required: true,
    datasheetBlock: 'technical',
    active: true,
    sortOrder: 1,
    version: 1,
    hasValues: true,
  },
];

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
const MODEL_TEMPLATE = {
  id: 7,
  deviceTypeId: 1,
  manufacturerId: 11,
  modelName: 'ThinkPad T14 Gen 2',
  typeDesignation: '20W1S0F300',
  mpn: '20W1S0F300',
  mpnUnknown: false,
  originalEan: null,
  modelValues: {},
  defaultDeviceValues: {},
  version: 1,
  createdAt: '2026-11-15T10:00:00.000Z',
  updatedAt: '2026-11-15T10:00:00.000Z',
};
const DEVICE_TYPES = [{ id: 1, name: 'Notebook', active: true, version: 1, attributeCount: 1 }];
const MANUFACTURERS = [
  {
    id: 11,
    name: 'Lenovo',
    active: false,
    gpsrComplete: false,
    gpsrMissing: [],
    gpsr: { legalName: '', street: '', postalCode: '', city: '', country: '', email: '' },
    version: 1,
  },
];
const CREATED = {
  id: 31,
  wiNr: '626198',
  modelTemplateId: 7,
  listingId: null,
  supplierId: 4,
  conditionValueId: 1,
  visualGrade: 3,
  conditionDescription: '',
  values: { 16: 111 },
  reviewKeys: [],
  captureStatus: 'checked',
  stockStatus: 'available',
  capturedAt: '2026-11-16T10:00:00.000Z',
  capturedOn: '2026-11-16',
  version: 1,
  updatedAt: '2026-11-16T10:00:00.000Z',
};

type Route = () => Promise<Response> | Response;
const list = (items: unknown[]) => Response.json({ items, total: items.length });
const pending = () => new Promise<Response>(() => {});
/** A `201` whose device is still to be reviewed (2.5). */
const createdToReview = (reviewKeys: string[]) => () =>
  Response.json({ ...CREATED, reviewKeys, captureStatus: 'review_pending' }, { status: 201 });

/** `GET /api/model-templates/7/device-prefill` without values (REQ-013, 2.5). */
const NO_PREFILL = {
  conditionValueId: null,
  visualGrade: null,
  conditionDescription: '',
  values: {},
  reviewKeys: [],
  codeResult: { found: false, plainText: null },
};

function mockApi({
  modelTemplate = () => Response.json(MODEL_TEMPLATE),
  prefill = () => Response.json(NO_PREFILL),
  create = () => Response.json(CREATED, { status: 201 }),
}: { modelTemplate?: Route; prefill?: Route; create?: Route } = {}) {
  const sent: Record<string, unknown>[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://127.0.0.1');
    const route = `${init?.method ?? 'GET'} ${url.pathname}`;
    if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
    if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
    if (route === 'GET /api/suppliers') return list([OST]);
    if (route === 'GET /api/pick-lists') return list(PICK_LISTS);
    if (route === 'GET /api/pick-lists/1/values') return list(CONDITIONS);
    if (route === 'GET /api/pick-lists/11/values') return list(KEYBOARD_LAYOUTS);
    if (route === 'GET /api/device-types') return list(DEVICE_TYPES);
    if (route === 'GET /api/manufacturers') return list(MANUFACTURERS);
    if (route === 'GET /api/model-templates') return list([MV_A]);
    if (route === 'GET /api/model-templates/7') return modelTemplate();
    if (route === 'GET /api/model-templates/7/device-prefill') return prefill();
    if (route === 'GET /api/device-types/1/attributes') return list(ATTRIBUTES);
    if (route === 'POST /api/devices') {
      sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return create();
    }
    throw new Error(`unexpected request ${route}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent };
}

/** UI-003 as it opens, or after the return from UI-007 with its history state. */
function renderPage(state: unknown = null) {
  const router = createMemoryRouter(routes, {
    initialEntries: [{ pathname: '/geraete/neu', state }],
  });
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
const chosenLine = () => screen.queryByTestId('chosen-model-template')?.textContent ?? null;
const nextDeviceBox = () =>
  screen.getByRole<HTMLInputElement>('checkbox', {
    name: 'Weiteres Gerät derselben Modellvorlage',
  });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Gerät speichern|Speichern …)$/ });
const newTemplateLink = () => screen.getByRole('link', { name: 'Neue Modellvorlage anlegen' });

async function openPage(state: unknown = null) {
  const router = renderPage(state);
  await screen.findByRole('form', { name: 'Gerät einbuchen' });
  await vi.waitFor(() =>
    expect(Array.from(select('Lieferant').options, ({ text }) => text)).toContain('Lieferant Ost'),
  );
  return router;
}

/** The inputs of UI-003 as the page stores them before UI-007 opens. */
const storedForm = (change: Record<string, unknown> = {}) => ({
  wiNr: '626198',
  supplierId: 4,
  modelTemplate: null,
  conditionValueId: null,
  visualGrade: '',
  conditionDescription: '',
  values: {},
  reviewKeys: [],
  confirmedKeys: [],
  ...change,
});

/** Accessibility assertion of a state: heading, named controls and labelled fields. */
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Gerät einbuchen' })).toBeTruthy();
  for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
    expect(control.textContent?.trim() || control.getAttribute('aria-label')).toBeTruthy();
  }
  for (const control of [
    ...within(form()).queryAllByRole('combobox'),
    ...within(form()).queryAllByRole('textbox'),
  ]) {
    expect(document.querySelector(`label[for="${control.id}"]`)?.textContent).toBeTruthy();
  }
  expect(nextDeviceBox().closest('label')?.textContent).toBe(
    'Weiteres Gerät derselben Modellvorlage',
  );
}

async function chooseModelTemplate() {
  fireEvent.change(within(form()).getByRole('searchbox', { name: /^Modellvorlage suchen/ }), {
    target: { value: 'T14' },
  });
  fireEvent.click(await screen.findByRole('button', { name: MV_A_LINE }));
  await vi.waitFor(() => expect(select('Zustand').options.length).toBeGreaterThan(1));
}

async function fillValid() {
  fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
  fireEvent.change(select('Lieferant'), { target: { value: '4' } });
  await chooseModelTemplate();
  fireEvent.change(select('Zustand'), { target: { value: '1' } });
  fireEvent.change(textbox('Optik-Note'), { target: { value: '3' } });
  await vi.waitFor(() => expect(select('Tastaturlayout').options.length).toBeGreaterThan(1));
  fireEvent.change(select('Tastaturlayout'), { target: { value: '111' } });
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('UI-003 draft for UI-007 and next device (CU-132, CU-133, #186)', () => {
  it('UI-003.default DER-54-07 "Neue Modellvorlage anlegen" keeps the inputs under resellr.deviceIntake.draft and opens UI-007 with UI-003 as calling page', async () => {
    mockApi();
    const router = await openPage();
    fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
    fireEvent.change(select('Lieferant'), { target: { value: '4' } });

    fireEvent.click(newTemplateLink());

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/modelle/neu'));
    expect(router.state.location.state).toEqual({ caller: 'device-intake' });
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null')).toEqual({
      form: storedForm(),
      modelTemplateId: null,
    });
  });

  it('UI-003.default offers "Neue Modellvorlage anlegen" also beside "Andere Modellvorlage wählen"', async () => {
    mockApi();
    await openPage();
    expect(newTemplateLink()).toBeTruthy();

    await chooseModelTemplate();

    expect(screen.getByRole('button', { name: 'Andere Modellvorlage wählen' })).toBeTruthy();
    expect(newTemplateLink()).toBeTruthy();
    expectAccessiblePage();
  });

  it('UI-003.success DER-54-07 after the save in UI-007 the inputs stand unchanged, the new model template is chosen and "Modellvorlage gespeichert" shows', async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: storedForm(), modelTemplateId: 7 }));
    mockApi();
    const router = await openPage({ savedNotice: 'Modellvorlage gespeichert' });

    await vi.waitFor(() => expect(chosenLine()).toBe(MV_A_LINE));
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(select('Lieferant').value).toBe('4');
    expect(screen.getByText('Modellvorlage gespeichert')).toBeTruthy();
    // The draft is taken over once; the history entry no longer carries the banner.
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    await vi.waitFor(() => expect(router.state.location.state).toBeNull());
    await vi.waitFor(() => expect(select('Zustand').options.length).toBeGreaterThan(1));
    expectAccessiblePage();
  });

  it('DER-54-07 the model template handed back replaces one chosen before UI-007 opened', async () => {
    const other = { ...MV_A, id: 8, modelName: 'ThinkPad X280', typeDesignation: null };
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ form: storedForm({ modelTemplate: other }), modelTemplateId: 7 }),
    );
    mockApi();
    await openPage();

    await vi.waitFor(() => expect(chosenLine()).toBe(MV_A_LINE));
    expect(textbox('WI-Nr').value).toBe('626198');
  });

  it('UI-003.loading DER-54-14 after "Vorhandene verwenden" the card "Gerätewerte" shows "Lade Gerätewerte …", the inputs stay and the save waits', async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: storedForm(), modelTemplateId: 7 }));
    mockApi({ modelTemplate: pending });
    await openPage();

    const card = within(form()).getByRole('region', { name: 'Gerätewerte' });
    expect(within(card).getByRole('status').textContent).toBe('Lade Gerätewerte …');
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(select('Lieferant').value).toBe('4');
    expect(saveButton().disabled).toBe(true);
    expect(within(form()).queryByRole('searchbox')).toBeNull();
    expectAccessiblePage();
  });

  it('opens empty without a draft', async () => {
    mockApi();
    await openPage();

    expect(textbox('WI-Nr').value).toBe('');
    expect(chosenLine()).toBeNull();
  });

  it('UI-003.success DER-54-08 with "Weiteres Gerät derselben Modellvorlage" (on by default) a saved device empties the form and keeps the model template', async () => {
    const { sent } = mockApi();
    await openPage();
    expect(nextDeviceBox().checked).toBe(true);
    await fillValid();

    fireEvent.click(saveButton());

    expect(await screen.findByText('Gerät 626198 gespeichert')).toBeTruthy();
    expect(sent).toHaveLength(1);
    await vi.waitFor(() => expect(textbox('WI-Nr').value).toBe(''));
    expect(select('Lieferant').value).toBe('');
    expect(chosenLine()).toBe(MV_A_LINE);
    expect(select('Zustand').value).toBe('');
    expect(textbox('Optik-Note').value).toBe('');
    expect(select('Tastaturlayout').value).toBe('');
    expect(document.activeElement).toBe(textbox('WI-Nr'));
    expect(screen.getByRole('heading', { level: 1, name: 'Gerät einbuchen' })).toBeTruthy();
    expectAccessiblePage();
  });

  it('DER-54-08 keeps the inputs while a value is still to be reviewed', async () => {
    // "Tastaturlayout" comes prefilled and stays to be reviewed (REQ-013).
    mockApi({
      prefill: () => Response.json({ ...NO_PREFILL, values: { 16: 111 }, reviewKeys: ['16'] }),
      create: createdToReview(['16']),
    });
    await openPage();
    fireEvent.change(textbox('WI-Nr'), { target: { value: '626198' } });
    await chooseModelTemplate();
    fireEvent.change(select('Zustand'), { target: { value: '1' } });
    fireEvent.change(textbox('Optik-Note'), { target: { value: '3' } });
    await vi.waitFor(() => expect(select('Tastaturlayout').value).toBe('111'));
    expect(screen.getByRole('button', { name: 'Tastaturlayout bestätigen' })).toBeTruthy();

    fireEvent.click(saveButton());

    expect(await screen.findByText('Gerät 626198 gespeichert')).toBeTruthy();
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(nextDeviceBox().checked).toBe(true);
  });

  it('DER-54-08 keeps the inputs when the answer still has a value to review, though none is open in the browser', async () => {
    mockApi({ create: createdToReview(['16']) });
    await openPage();
    await fillValid();

    fireEvent.click(saveButton());

    expect(await screen.findByText('Gerät 626198 gespeichert')).toBeTruthy();
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(select('Tastaturlayout').value).toBe('111');
  });

  it('UI-003.speichert locks "Neue Modellvorlage anlegen" while the save runs (P-08)', async () => {
    mockApi({ create: pending });
    const router = await openPage();
    await fillValid();

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(saveButton().textContent).toBe('Speichern …'));
    expect(screen.getByRole('button', { name: 'Andere Modellvorlage wählen' })).toHaveProperty(
      'disabled',
      true,
    );
    const link = newTemplateLink();
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('href')).toBeNull();
    fireEvent.click(link);
    expect(router.state.location.pathname).toBe('/geraete/neu');
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    expectAccessiblePage();
  });

  it('UI-003.error a failed read of the model template handed back gives up the return: the error shows, the search and the inputs stay and the save is possible again', async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: storedForm(), modelTemplateId: 7 }));
    mockApi({
      modelTemplate: () =>
        Response.json(
          {
            error: {
              code: 'internal_error',
              message: '',
              fields: [],
              details: {},
              referenceNumber: 'R-7K2M-9QX4',
            },
          },
          { status: 500 },
        ),
    });
    await openPage();

    expect(
      await within(form()).findByRole('searchbox', { name: /^Modellvorlage suchen/ }),
    ).toBeTruthy();
    expect(screen.getByText(/Referenz: R-7K2M-9QX4/)).toBeTruthy();
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(select('Lieferant').value).toBe('4');
    expect(within(form()).queryByRole('region', { name: 'Gerätewerte' })).toBeNull();
    expect(saveButton().disabled).toBe(false);
    expect(newTemplateLink()).toBeTruthy();
    expectAccessiblePage();
  });

  it('DER-54-08 "Speichern und zuordnen" does not empty the form', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern und zuordnen' }));

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(await screen.findByText('Gerät 626198 gespeichert')).toBeTruthy();
    expect(textbox('WI-Nr').value).toBe('626198');
  });

  it('DER-54-08 without "Weiteres Gerät derselben Modellvorlage" the inputs stay after the save', async () => {
    mockApi();
    await openPage();
    await fillValid();
    fireEvent.click(nextDeviceBox());
    expect(nextDeviceBox().checked).toBe(false);

    fireEvent.click(saveButton());

    expect(await screen.findByText('Gerät 626198 gespeichert')).toBeTruthy();
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(textbox('Optik-Note').value).toBe('3');
  });
});
