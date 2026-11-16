import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of UI-003 "Gerät einbuchen" (CU-132) with a mocked `fetch` (Technical
// Specification 6.1, 6.2). The attribute fields of the level device follow with #178.

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
];
const value = (id: number, label: string, active = true, sortOrder = id) => ({
  id,
  label,
  active,
  batteryPresent: null,
  sortOrder,
  version: 1,
});
const CONDITIONS = [value(1, 'gebraucht'), value(2, 'refurbished', false), value(3, 'defekt')];
const PORT_TYPES = [value(81, 'USB-C')];
const PORT_POSITIONS = [value(91, 'links')];

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
  attribute({ id: 18, label: 'Akku', dataType: 'pick', level: 'device', sortOrder: 5 }),
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
}: { create?: Route; suppliers?: Route; search?: Route } = {}) {
  const sent: Record<string, unknown>[] = [];
  const reads = { suppliers: 0 };
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
    if (route === 'GET /api/pick-lists/8/values') return list(PORT_TYPES);
    if (route === 'GET /api/pick-lists/9/values') return list(PORT_POSITIONS);
    if (route === 'GET /api/model-templates') return search(init);
    if (route === 'GET /api/model-templates/7') return Response.json(MODEL_TEMPLATE);
    if (route === 'GET /api/device-types/1/attributes') return list(ATTRIBUTES);
    if (route === 'POST /api/devices') {
      sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return create(init);
    }
    throw new Error(`unexpected request ${route}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent, reads };
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

async function fillValid({ wiNr = '626198', supplierId = '' } = {}) {
  fireEvent.change(textbox('WI-Nr'), { target: { value: wiNr } });
  fireEvent.change(select('Lieferant'), { target: { value: supplierId } });
  await chooseModelTemplate();
  fireEvent.change(select('Zustand'), { target: { value: '1' } });
  fireEvent.change(textbox('Optik-Note'), { target: { value: '3' } });
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

describe('UI-003 Gerät einbuchen (CU-132)', () => {
  it('UI-003.default DER-54-01 focuses WI-Nr, shows the values card only after the model template and keeps the field order', async () => {
    mockApi();
    await openPage();

    expect(document.activeElement).toBe(textbox('WI-Nr'));
    expect(screen.getByText('Felder mit * sind Pflicht.')).toBeTruthy();
    expect(within(form()).queryByRole('region', { name: 'Gerätewerte' })).toBeNull();

    await chooseModelTemplate();

    const labels = Array.from(form().querySelectorAll('label'), (label) =>
      label.textContent?.replace('*', ''),
    );
    expect(labels).toEqual(['WI-Nr', 'Lieferant', 'Zustand', 'Optik-Note', 'Zustandsbeschreibung']);
    expect(within(form()).getByRole('region', { name: 'Gerätewerte' })).toBeTruthy();
    expect(textbox('WI-Nr').getAttribute('aria-required')).toBe('true');
    expect(select('Lieferant').getAttribute('aria-required')).toBeNull();
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
      modelTemplateId: 7,
      conditionValueId: 1,
      visualGrade: '3',
      conditionDescription: 'Kratzer am Deckel',
      values: {},
      confirmedKeys: [],
    });
  });

  it('UI-003.success DER-54-03 shows "Gerät 626198 gespeichert" and the page stays open', async () => {
    mockApi();
    const router = await openPage();
    await fillValid();

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

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await vi.waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    await vi.waitFor(() => expect(saveAndAssignButton().disabled).toBe(false));
    fireEvent.click(saveAndAssignButton());

    await vi.waitFor(() => expect(sent).toHaveLength(3));
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

  it('UI-003.validation DER-54-05 shows the WI-Nr "62-61" at the field and in the summary from the check in the browser, focus there, nothing sent', async () => {
    const { sent } = mockApi();
    await openPage();
    await fillValid({ wiNr: '62-61' });
    fireEvent.change(textbox('Optik-Note'), { target: { value: '7' } });

    fireEvent.click(saveButton());

    expect(errorOf(textbox('WI-Nr'))).toBe(WI_NR_RULE);
    expect(errorOf(textbox('Optik-Note'))).toBe('Optik-Note: ganze Zahl von 1 bis 5');
    expect(summaryItems()).toEqual([WI_NR_RULE, 'Optik-Note: ganze Zahl von 1 bis 5']);
    expect(document.activeElement).toBe(textbox('WI-Nr'));
    expect(sent).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-003.validation DER-54-05 shows the field errors of 422 validation_failed at the field and in the summary, without own text', async () => {
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
    await fillValid();

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(textbox('WI-Nr'))).toBe(WI_NR_RULE));
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

    await act(() => vi.advanceTimersByTimeAsync(5400));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(textbox('WI-Nr').value).toBe('626198');
    expect(searchBox().value).toBe('T14');
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
