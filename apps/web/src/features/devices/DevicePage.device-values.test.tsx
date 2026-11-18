import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of the card "Gerätewerte" of UI-010 (CU-137, #190) with a mocked `fetch`
// (Technical Specification 6.1, 6.2, 10.2 T11, T5j): changing the device values, the read only
// device, the patterns P-05, P-07, P-08 and the choice after `pick_list_value_deactivated`
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
const ENGLISH = 113;
const ORIGINAL = 121;

const START_LISTS: Record<number, ReturnType<typeof value>[]> = {
  1: [value(USED, 'gebraucht'), value(REFURBISHED, 'refurbished'), value(DEFECT, 'defekt')],
  5: [value(SSD, 'SSD (NVMe)'), value(HDD, 'HDD')],
  8: [],
  9: [],
  10: [
    value(WITH_BATTERY, 'mit Akku', true, true),
    value(BROKEN_BATTERY, 'mit Akku (defekt)', true, true),
    value(WITHOUT_BATTERY, 'ohne Akku', true, false),
  ],
  11: [
    value(GERMAN, 'Deutsch (QWERTZ)'),
    value(HUNGARIAN, 'Ungarisch'),
    value(ENGLISH, 'Englisch (QWERTY, US)'),
  ],
  12: [value(ORIGINAL, 'mit Netzteil (original)')],
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

const STORED_VALUES = { 15: SSD, 16: GERMAN, 17: ORIGINAL, 18: WITH_BATTERY, 19: { percent: 85 } };
const DEVICE = {
  id: 5,
  wiNr: '626198',
  modelTemplateId: 7,
  modelTemplateLabel: 'ThinkPad T14 Gen 2',
  listingId: null,
  listing: null,
  supplierId: null,
  conditionValueId: USED,
  visualGrade: 3,
  conditionDescription: 'Kratzer am Deckel',
  values: STORED_VALUES,
  reviewKeys: [],
  captureStatus: 'checked',
  stockStatus: 'available',
  capturedAt: '2026-11-16T09:00:00.000Z',
  capturedOn: '2026-11-16',
  version: 1,
  updatedAt: '2026-11-16T09:00:00.000Z',
};

const CAPACITY_RULE = 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“';
const HUNGARIAN_DEACTIVATED = 'Tastaturlayout: Ungarisch ist deaktiviert';

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
 * `fetch` of UI-010 with lists the test can change in "another window": `device` answers
 * `GET /api/devices/5`, `update` the `PATCH`, `reload` the reads of a list after its first one.
 * Records the bodies of the `PATCH` and the number of reads per list.
 */
function mockApi({
  device = DEVICE,
  update = (init) => Response.json({ ...DEVICE, ...JSON.parse(String(init?.body)), version: 2 }),
  reload,
}: {
  device?: Record<string, unknown> | (() => Record<string, unknown>);
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
        const answer = reads[listId] > 1 ? reload?.(listId) : undefined;
        return answer ?? list(lists[listId] ?? []);
      }
      if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (route === 'GET /api/devices/5') {
        return Response.json(typeof device === 'function' ? device() : device);
      }
      if (route === 'GET /api/pick-lists') return list(PICK_LISTS);
      if (route === 'GET /api/model-templates/7') return Response.json(MODEL_TEMPLATE);
      if (route === 'GET /api/device-types/1/attributes') return list(ATTRIBUTES);
      if (route === 'PATCH /api/devices/5') {
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

const card = () => screen.getByRole('form', { name: 'Gerätewerte' });
const select = (name: string) =>
  within(card()).getByRole<HTMLSelectElement>('combobox', { name: new RegExp(`^${name}`) });
const textbox = (name: string) =>
  within(card()).getByRole<HTMLInputElement>('textbox', { name: new RegExp(`^${name}`) });
const queryTextbox = (name: string) =>
  within(card()).queryByRole<HTMLInputElement>('textbox', { name: new RegExp(`^${name}`) });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Gerätewerte speichern|Speichern …)$/ });
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

/** UI-010 of device 5 with its values in the form and every list read. */
async function openDevice() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/geraete/5'] })} />
    </QueryClientProvider>,
  );
  await screen.findByRole('form', { name: 'Gerätewerte' });
  await vi.waitFor(() =>
    expect(optionTexts(select('Netzteil'))).toContain('mit Netzteil (original)'),
  );
  await vi.waitFor(() => expect(optionTexts(select('Zustand')).length).toBeGreaterThan(1));
  await vi.waitFor(() => expect(optionTexts(select('Tastaturlayout')).length).toBeGreaterThan(1));
}

/** Accessibility assertion: named controls with labels, linked field errors, named buttons. */
function expectAccessibleCard() {
  for (const control of [
    ...within(card()).queryAllByRole('combobox'),
    ...within(card()).queryAllByRole('textbox'),
  ]) {
    expect(document.querySelector(`label[for="${control.id}"]`)?.textContent).toBeTruthy();
    if (control.getAttribute('aria-invalid') === 'true') expect(errorOf(control)).toBeTruthy();
  }
  for (const button of screen.queryAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UI-010 Gerätewerte (CU-137, Story #56)', () => {
  it('UI-010.default UI-010.success DER-56-01 shows the form of UI-003 without WI-Nr, saves a changed value with PATCH and shows "Gerät gespeichert"', async () => {
    const { sent } = mockApi();
    await openDevice();

    expect(within(card()).queryByRole('textbox', { name: /^WI-Nr/ })).toBeNull();
    expect(within(card()).queryByRole('combobox', { name: /^Lieferant/ })).toBeNull();
    expect(select('Zustand').value).toBe(String(USED));
    expect(textbox('Optik-Note').value).toBe('3');
    expect(textbox('Akkukapazität').value).toBe('85');
    expect(textbox('Zustandsbeschreibung').value).toBe('Kratzer am Deckel');
    expectAccessibleCard();

    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      version: 1,
      conditionValueId: USED,
      visualGrade: '4',
      conditionDescription: 'Kratzer am Deckel',
      values: { 15: SSD, 16: GERMAN, 17: ORIGINAL, 18: WITH_BATTERY, 19: { percent: '85' } },
      confirmedKeys: [],
    });
    expect(await screen.findByText('Gerät gespeichert')).toBeTruthy();
    expect(textbox('Optik-Note').value).toBe('4');
  });

  it.each([
    ['sold', 'sold'],
    ['cancelled', 'cancelled'],
  ])(
    'UI-010.disabled DER-56-02 shows the values of a %s device read only, without "Gerätewerte speichern"',
    async (_case, stockStatus) => {
      mockApi({ device: { ...DEVICE, stockStatus } });
      await openDevice();

      expect(screen.getByText('Werte schreibgeschützt')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Gerätewerte speichern' })).toBeNull();
      for (const control of [
        ...within(card()).getAllByRole('combobox'),
        ...within(card()).getAllByRole('textbox'),
      ]) {
        expect((control as HTMLInputElement).disabled).toBe(true);
      }
      expectAccessibleCard();
    },
  );

  it('UI-010.disabled DER-56-02 a device sold meanwhile is reported with device_not_available and becomes read only', async () => {
    let sold = false;
    const api = mockApi({
      device: () => (sold ? { ...DEVICE, stockStatus: 'sold', version: 2 } : DEVICE),
      update: () => {
        sold = true;
        return Response.json(
          errorBody('device_not_available', { message: 'Werte schreibgeschützt' }),
          { status: 422 },
        );
      },
    });
    await openDevice();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    expect((await screen.findByRole('alert')).textContent).toBe('Werte schreibgeschützt');
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Gerätewerte speichern' })).toBeNull(),
    );
    await vi.waitFor(() => expect(textbox('Optik-Note').disabled).toBe(true));
    expect(textbox('Optik-Note').value).toBe('4');
    expect(api.sent).toHaveLength(1);
  });

  it('UI-010.default DER-56-03 shows "Akkukapazität" exactly with "Akku vorhanden"; without it PATCH sends the capacity as null', async () => {
    const { sent } = mockApi();
    await openDevice();

    await choose('Akku', WITHOUT_BATTERY);
    expect(queryTextbox('Akkukapazität')).toBeNull();
    await choose('Akku', BROKEN_BATTERY);
    expect(textbox('Akkukapazität').value).toBe('');
    await choose('Akku', WITHOUT_BATTERY);
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.values).toMatchObject({ 18: WITHOUT_BATTERY, 19: null });
  });

  it('UI-010.validation DER-56-06 names a missing condition, a visual grade outside 1 to 5, a long condition description and a missing power supply at their fields, nothing sent', async () => {
    const { sent } = mockApi({
      device: { ...DEVICE, values: { 15: SSD, 16: GERMAN, 18: WITHOUT_BATTERY } },
    });
    await openDevice();
    fireEvent.change(select('Zustand'), { target: { value: '' } });
    fireEvent.change(textbox('Optik-Note'), { target: { value: '0' } });
    fireEvent.change(textbox('Zustandsbeschreibung'), { target: { value: 'x'.repeat(1001) } });

    fireEvent.click(saveButton());

    expect(errorOf(select('Zustand'))).toBe('Zustand fehlt');
    expect(errorOf(textbox('Optik-Note'))).toBe('Optik-Note: ganze Zahl von 1 bis 5');
    expect(errorOf(textbox('Zustandsbeschreibung'))).toBe(
      'Zustandsbeschreibung: höchstens 1.000 Zeichen',
    );
    expect(errorOf(select('Netzteil'))).toBe('Netzteil fehlt');
    expect(document.activeElement).toBe(select('Zustand'));
    expect(sent).toEqual([]);
    expectAccessibleCard();
  });

  it('UI-010.validation AC-REQ-014-02 shows the field errors of 422 validation_failed at the field, focus there', async () => {
    mockApi({
      update: () =>
        Response.json(
          errorBody('validation_failed', {
            fields: [
              { path: 'values.19', code: 'battery_capacity_format', message: CAPACITY_RULE },
            ],
          }),
          { status: 422 },
        ),
    });
    await openDevice();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(textbox('Akkukapazität'))).toBe(CAPACITY_RULE));
    expect(document.activeElement).toBe(textbox('Akkukapazität'));
  });

  it('UI-010.conflict DER-56-07 (a) shows P-05 with "Neu laden" on 409 version_conflict and keeps the inputs', async () => {
    mockApi({
      update: () => Response.json(errorBody('version_conflict'), { status: 409 }),
    });
    await openDevice();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(textbox('Optik-Note').value).toBe('4');
    expectAccessibleCard();
  });

  it('UI-010.wird-beendet DER-56-07 (b) shows P-07 without reference number on 503 shutting_down and keeps the inputs', async () => {
    mockApi({
      update: () => Response.json(errorBody('shutting_down'), { status: 503 }),
    });
    await openDevice();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert.',
    );
    expect(banner.textContent).not.toContain('Referenz');
    expect(textbox('Optik-Note').value).toBe('4');
  });
});

describe('UI-010 choice after pick_list_value_deactivated (2.0.11, design v0.6.8, T11)', () => {
  /** A device whose condition "refurbished" and keyboard layout "Ungarisch" are deactivated. */
  const WITH_DEACTIVATED = {
    ...DEVICE,
    conditionValueId: REFURBISHED,
    values: { ...STORED_VALUES, 16: HUNGARIAN },
  };

  it('UI-010.default DER-56-08 shows the stored, deactivated condition and keyboard layout as chosen with "(deaktiviert)" beside the active ones; another change saves (200)', async () => {
    const api = mockApi({ device: WITH_DEACTIVATED });
    api.deactivate(1, REFURBISHED);
    api.deactivate(11, HUNGARIAN);
    await openDevice();

    expect(shownText(select('Zustand'))).toBe('refurbished (deaktiviert)');
    expect(optionTexts(select('Zustand'))).toEqual([
      'Bitte wählen',
      'gebraucht',
      'refurbished (deaktiviert)',
      'defekt',
    ]);
    expect(shownText(select('Tastaturlayout'))).toBe('Ungarisch (deaktiviert)');

    fireEvent.change(textbox('Zustandsbeschreibung'), { target: { value: 'Neu: Delle' } });
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(api.sent).toHaveLength(1));
    expect(api.sent[0]).toMatchObject({
      conditionValueId: REFURBISHED,
      conditionDescription: 'Neu: Delle',
      values: { 16: HUNGARIAN },
    });
    expect(await screen.findByText('Gerät gespeichert')).toBeTruthy();
  });

  it('UI-010.validation DER-56-08 DER-56-11 (a) a change to a value deactivated meanwhile shows "Bitte wählen" with the text, focus there, reloads the lists, keeps the inputs, no fallback to the stored value, which stays choosable', async () => {
    const api = mockApi({
      device: WITH_DEACTIVATED,
      update: deactivated('Zustand defekt ist deaktiviert', 'conditionValueId', DEFECT),
    });
    api.deactivate(1, REFURBISHED);
    await openDevice();
    await choose('Zustand', DEFECT);
    fireEvent.change(textbox('Optik-Note'), { target: { value: '2' } });
    api.deactivate(1, DEFECT);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(select('Zustand').value).toBe(''));
    expect(shownText(select('Zustand'))).toBe('Bitte wählen');
    expect(errorOf(select('Zustand'))).toBe('Zustand defekt ist deaktiviert');
    expect(document.activeElement).toBe(select('Zustand'));
    expect(api.reads[1]).toBe(2);
    expect(optionTexts(select('Zustand'))).toEqual([
      'Bitte wählen',
      'gebraucht',
      'refurbished (deaktiviert)',
    ]);
    expect(textbox('Optik-Note').value).toBe('2');
    expectAccessibleCard();

    // DER-56-11 (b) (c): the text stays until the next choice; without a choice nothing is sent.
    fireEvent.blur(select('Zustand'));
    expect(errorOf(select('Zustand'))).toBe('Zustand defekt ist deaktiviert');
    await vi.waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());
    expect(errorOf(select('Zustand'))).toBe('Zustand fehlt');
    expect(api.sent).toHaveLength(1);

    // The stored, deactivated entry is chosen again and saves without rejection.
    await choose('Zustand', REFURBISHED);
    expect(errorOf(select('Zustand'))).toBeNull();
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(api.sent).toHaveLength(2));
    expect(api.sent[1]).toMatchObject({ conditionValueId: REFURBISHED });
    expect(api.sent.filter((body) => body.conditionValueId === DEFECT)).toHaveLength(1);
  });

  it('DER-56-11 (b) after a rejected battery value the battery capacity goes; with a battery value without "Akku vorhanden" PATCH sends battery_capacity null', async () => {
    let patches = 0;
    const api = mockApi({
      update: (init) => {
        patches += 1;
        return patches === 1
          ? deactivated('Akku: mit Akku (defekt) ist deaktiviert', 'values.18', BROKEN_BATTERY)()
          : Response.json({ ...DEVICE, ...JSON.parse(String(init?.body)), version: 2 });
      },
    });
    await openDevice();
    await choose('Akku', BROKEN_BATTERY);
    api.deactivate(10, BROKEN_BATTERY);

    fireEvent.click(saveButton());

    await vi.waitFor(() =>
      expect(errorOf(select('Akku'))).toBe('Akku: mit Akku (defekt) ist deaktiviert'),
    );
    expect(shownText(select('Akku'))).toBe('Bitte wählen');
    expect(queryTextbox('Akkukapazität')).toBeNull();

    await choose('Akku', WITHOUT_BATTERY);
    await vi.waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(api.sent).toHaveLength(2));
    expect(api.sent[1]?.values).toMatchObject({ 18: WITHOUT_BATTERY, 19: null });
  });

  it('DER-56-11 (d) marks every field with a new value missing after the reload, focus on the first in form order, but not a stored, unchanged, deactivated value', async () => {
    const api = mockApi({
      device: { ...DEVICE, values: { ...STORED_VALUES, 15: HDD } },
      update: deactivated('Zustand defekt ist deaktiviert', 'conditionValueId', DEFECT),
    });
    await openDevice();
    await choose('Zustand', DEFECT);
    await choose('Tastaturlayout', HUNGARIAN);
    api.deactivate(1, DEFECT);
    api.deactivate(11, HUNGARIAN);
    api.deactivate(5, HDD);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(select('Tastaturlayout'))).toBe(HUNGARIAN_DEACTIVATED));
    expect(errorOf(select('Zustand'))).toBe('Zustand defekt ist deaktiviert');
    expect(shownText(select('Tastaturlayout'))).toBe('Bitte wählen');
    expect(shownText(select('Speichertyp'))).toBe('HDD (deaktiviert)');
    expect(errorOf(select('Speichertyp'))).toBeNull();
    expect(document.activeElement).toBe(select('Zustand'));
  });

  it('DER-56-11 (d) when reloading the lists fails, only the rejected id is missing', async () => {
    const api = mockApi({
      update: deactivated('Zustand defekt ist deaktiviert', 'conditionValueId', DEFECT),
      reload: () => failed(),
    });
    await openDevice();
    await choose('Zustand', DEFECT);
    await choose('Tastaturlayout', HUNGARIAN);
    api.deactivate(11, HUNGARIAN);

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(select('Zustand').value).toBe(''));
    expect(errorOf(select('Zustand'))).toBe('Zustand defekt ist deaktiviert');
    expect(optionTexts(select('Zustand'))).toEqual(['Bitte wählen', 'gebraucht', 'refurbished']);
    expect(select('Tastaturlayout').value).toBe(String(HUNGARIAN));
    expect(errorOf(select('Tastaturlayout'))).toBeNull();
  });

  it('T5j a choice while the lists are read again is checked like any other; the stored entry chosen meanwhile stays without text', async () => {
    let answer: (response: Response) => void = () => {};
    const delayed = new Promise<Response>((resolve) => {
      answer = resolve;
    });
    const api = mockApi({
      device: WITH_DEACTIVATED,
      update: deactivated('Zustand defekt ist deaktiviert', 'conditionValueId', DEFECT),
      reload: (listId) => (listId === 11 ? delayed : undefined),
    });
    api.deactivate(1, REFURBISHED);
    api.deactivate(11, HUNGARIAN);
    await openDevice();
    await choose('Zustand', DEFECT);
    await choose('Tastaturlayout', GERMAN);
    api.deactivate(1, DEFECT);
    fireEvent.click(saveButton());
    await vi.waitFor(() =>
      expect(errorOf(select('Zustand'))).toBe('Zustand defekt ist deaktiviert'),
    );

    // During the reload: "Englisch" chosen, deactivated in the other window meanwhile.
    await choose('Tastaturlayout', ENGLISH);
    textbox('Optik-Note').focus();
    answer(
      list([
        value(GERMAN, 'Deutsch (QWERTZ)'),
        value(HUNGARIAN, 'Ungarisch', false),
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
    // The stored "Ungarisch" stays choosable with "(deaktiviert)" and ends the text.
    expect(optionTexts(select('Tastaturlayout'))).toEqual([
      'Bitte wählen',
      'Deutsch (QWERTZ)',
      'Ungarisch (deaktiviert)',
    ]);
    await choose('Tastaturlayout', HUNGARIAN);
    expect(errorOf(select('Tastaturlayout'))).toBeNull();
    expect(api.sent.filter((body) => JSON.stringify(body).includes(`"16":${ENGLISH}`))).toEqual([]);
  });
});

// Last in this file: P-08 locks the writes of the page until it is loaded again (CU-049).
describe('UI-010 ausgang-unbekannt (P-08)', () => {
  it('UI-010.ausgang-unbekannt DER-56-07 (c) shows the permanent P-08 without button, keeps the inputs and locks the save', async () => {
    mockApi({
      update: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await openDevice();
    fireEvent.change(textbox('Optik-Note'), { target: { value: '4' } });

    fireEvent.click(saveButton());

    const banner = await screen.findByText(/Ausgang unbekannt, bitte neu laden\./);
    expect(within(banner.closest('[role="alert"]') ?? banner).queryByRole('button')).toBeNull();
    expect(textbox('Optik-Note').value).toBe('4');
    await vi.waitFor(() => expect(saveButton().disabled).toBe(true));
  });
});
