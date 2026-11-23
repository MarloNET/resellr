import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of UI-007 for changing a model template (CU-114, #181) with a mocked `fetch`
// (Technical Specification 6.1, 6.2).

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const deviceType = (id: number, name: string, active = true) => ({
  id,
  name,
  active,
  version: 1,
  attributeCount: 0,
});
const NOTEBOOK = deviceType(1, 'Notebook');
const TABLET = deviceType(3, 'Tablet');

const manufacturer = (id: number, name: string, active = true) => ({
  id,
  name,
  active,
  gpsrComplete: false,
  gpsrMissing: [],
  gpsr: {},
  version: 1,
});
const LENOVO = manufacturer(11, 'Lenovo');
const FUJITSU = manufacturer(12, 'Fujitsu');
const APPLE = manufacturer(13, 'Apple');

const KEYBOARD_LIST = 2;
const PICK_LISTS = [
  'condition',
  'keyboard_layout',
  'power_supply',
  'battery',
  'storage_type',
  'display_surface',
  'operating_system',
  'port_type',
  'port_position',
].map((key, index) => ({
  id: index + 1,
  key,
  name: key,
  isBatteryList: key === 'battery',
  version: 1,
}));

const pickValue = (id: number, label: string, active = true) => ({
  id,
  label,
  active,
  batteryPresent: null,
  sortOrder: id,
  version: 1,
});
const GERMAN = pickValue(31, 'Deutsch');
const HUNGARIAN = pickValue(32, 'Ungarisch');
const SWISS = pickValue(33, 'Schweiz');

const attribute = (id: number, label: string, change: Record<string, unknown> = {}) => ({
  id,
  deviceTypeId: 1,
  label,
  dataType: 'text',
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
  sortOrder: id,
  active: true,
  version: 1,
  ...change,
});
const PROCESSOR = attribute(1, 'Prozessor', { required: true });
const KEYBOARD = attribute(2, 'Tastaturlayout', {
  dataType: 'pick',
  systemRole: 'keyboard_layout',
  pickListId: KEYBOARD_LIST,
});
const DEVICE_KEYBOARD = attribute(3, 'Tastatur Gerät', {
  dataType: 'pick',
  pickListId: KEYBOARD_LIST,
  level: 'device',
});

/** "ThinkPad T14" of Lenovo with keyboard layout "Ungarisch" as device default (MAR-1058). */
const T14 = {
  id: 7,
  deviceTypeId: 1,
  manufacturerId: 11,
  modelName: 'ThinkPad T14',
  typeDesignation: '20W1',
  mpn: '20W1S0F300',
  mpnUnknown: false,
  originalEan: null,
  modelValues: { 1: 'Intel Core i5-1135G7', 2: 31 },
  defaultDeviceValues: { 3: 32 },
  version: 3,
  createdAt: '2026-11-15T10:00:00.000Z',
  updatedAt: '2026-11-15T10:00:00.000Z',
};

const PATCH = 'PATCH /api/model-templates/7';

/** `GET /api/model-templates/7/usage` without devices and model listings (CU-295). */
const UNUSED = { deviceCount: 0, listingCount: 0, deleteBlockedReason: null };
/** The use with captured devices and model listings: "Geräteart" is locked (#182). */
const USED = { deviceCount: 2, listingCount: 3, deleteBlockedReason: 'listings_reference' };

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = () => Promise<Response> | Response;

/**
 * `fetch` of the page: the frame, the choices, the attributes of the notebook (`attributes`), the values of the
 * keyboard layouts, `GET` and `PATCH /api/model-templates/7`, its use and the list of UI-006 after the
 * return. The lists can change between reads (`state`). Records the bodies of the writes.
 */
function mockApi({
  template = () => Response.json(T14),
  update = () => Response.json({ ...T14, version: 4 }),
  usage = () => Response.json(UNUSED),
  attributes = [PROCESSOR, KEYBOARD, DEVICE_KEYBOARD],
}: {
  template?: Route;
  update?: Route;
  usage?: Route;
  attributes?: readonly ReturnType<typeof attribute>[];
} = {}) {
  const state = {
    deviceTypes: [NOTEBOOK, TABLET],
    manufacturers: [LENOVO, FUJITSU, APPLE],
    keyboards: [GERMAN, HUNGARIAN, SWISS],
  };
  const sent: unknown[] = [];
  const reads: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://127.0.0.1');
      const method = init?.method ?? 'GET';
      reads.push(`${method} ${url.pathname}`);
      if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (url.pathname === '/api/device-types') {
        return Response.json({ items: state.deviceTypes, total: state.deviceTypes.length });
      }
      if (url.pathname === '/api/manufacturers') {
        return Response.json({ items: state.manufacturers, total: state.manufacturers.length });
      }
      if (url.pathname === '/api/device-types/1/attributes') {
        return Response.json({ items: attributes, total: attributes.length });
      }
      if (url.pathname === '/api/device-types/3/attributes') {
        return Response.json({ items: [], total: 0 });
      }
      if (url.pathname === '/api/pick-lists') return Response.json({ items: PICK_LISTS, total: 9 });
      if (url.pathname === `/api/pick-lists/${KEYBOARD_LIST}/values`) {
        return Response.json({ items: state.keyboards, total: state.keyboards.length });
      }
      if (method === 'GET' && url.pathname === '/api/model-templates/7') return template();
      if (method === 'GET' && url.pathname === '/api/model-templates/7/usage') return usage();
      if (method === 'GET' && url.pathname === '/api/model-templates') {
        return Response.json({ items: [], total: 0 });
      }
      if (`${method} ${url.pathname}` === PATCH) {
        sent.push(JSON.parse(String(init?.body)));
        return update();
      }
      throw new Error(`unexpected request ${method} ${url.pathname}`);
    }),
  );
  return { state, sent, reads };
}

function renderPage(path = '/modelle/7') {
  const router = createMemoryRouter(routes, { initialEntries: ['/modelle', path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const form = () => screen.getByRole('form', { name: 'Modellvorlage ändern' });
const select = (name: string) =>
  within(form()).getByRole<HTMLSelectElement>('combobox', { name: new RegExp(`^${name}`) });
const textbox = (name: string) =>
  within(form()).getByRole<HTMLInputElement>('textbox', { name: new RegExp(`^${name}`) });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', {
    name: /^(Modellvorlage speichern|Speichern …)$/,
  });
const optionTexts = (control: HTMLSelectElement) => Array.from(control.options, ({ text }) => text);
const shownText = (control: HTMLSelectElement) => control.selectedOptions[0]?.text ?? null;

/** The text below a field, linked with `aria-describedby` (CU-057). */
function errorOf(control: HTMLElement): string | null {
  const id = control.getAttribute('aria-describedby');
  return id === null ? null : (document.getElementById(id)?.textContent ?? null);
}

/** Opens UI-007 for T14 and waits until its form and its keyboard layouts are shown. */
async function openPage() {
  const router = renderPage();
  await screen.findByRole('form', { name: 'Modellvorlage ändern' });
  await vi.waitFor(() => expect(shownText(select('Tastaturlayout'))).toBe('Deutsch'));
  return router;
}

async function save() {
  await act(async () => {
    fireEvent.click(saveButton());
  });
}

/** Reads every list of the page again, as after the return to the window (2.0.11). */
async function reloadLists() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  focusManager.setFocused(undefined);
}

/** Accessibility assertion of a state: heading, named controls, linked field errors. */
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Modellvorlage ändern' })).toBeTruthy();
  for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
    expect(control.textContent?.trim() || control.getAttribute('aria-label')).toBeTruthy();
  }
  if (screen.queryByRole('form', { name: 'Modellvorlage ändern' }) === null) return;
  for (const control of [
    ...within(form()).getAllByRole('combobox'),
    ...within(form()).getAllByRole('textbox'),
  ]) {
    const name =
      document.querySelector(`label[for="${control.id}"]`)?.textContent ||
      control.getAttribute('aria-label');
    expect(name).toBeTruthy();
    if (control.getAttribute('aria-invalid') === 'true') expect(errorOf(control)).toBeTruthy();
  }
}

const pending = () => new Promise<Response>(() => {});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UI-007 changing a model template (CU-114, #181)', () => {
  it('UI-007.loading DER-52-01 shows "Lade Modellvorlage …" while the model template loads', async () => {
    mockApi({ template: pending });
    renderPage();

    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Lade Modellvorlage …');
    expect(screen.getByRole('heading', { level: 1, name: 'Modellvorlage ändern' })).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-007.default DER-52-02 opens with the stored values and the hint on model data', async () => {
    mockApi();
    await openPage();

    expect(screen.getByRole('note').textContent).toBe(
      'Änderungen an Modelldaten wirken auf alle Modell-Inserate und Datenblätter dieser Modellvorlage.',
    );
    expect(shownText(select('Geräteart'))).toBe('Notebook');
    expect(shownText(select('Hersteller'))).toBe('Lenovo');
    expect(textbox('Modellbezeichnung').value).toBe('ThinkPad T14');
    expect(textbox('Typbezeichnung').value).toBe('20W1');
    expect(textbox('Herstellernummer').value).toBe('20W1S0F300');
    expect(textbox('Prozessor').value).toBe('Intel Core i5-1135G7');
    expect(shownText(select('Tastatur Gerät'))).toBe('Ungarisch');
    expectAccessiblePage();
  });

  it('UI-007.speichert UI-007.success sends PATCH with the version shown and returns to UI-006 with the banner', async () => {
    const { sent } = mockApi();
    const router = await openPage();

    fireEvent.change(textbox('Typbezeichnung'), { target: { value: '20W2' } });
    await save();

    expect(sent).toEqual([
      {
        version: 3,
        deviceTypeId: 1,
        manufacturerId: 11,
        modelName: 'ThinkPad T14',
        typeDesignation: '20W2',
        mpn: '20W1S0F300',
        mpnUnknown: false,
        originalEan: '',
        modelValues: { 1: 'Intel Core i5-1135G7', 2: 31 },
        defaultDeviceValues: { 3: 32 },
      },
    ]);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/modelle'));
    expect(await screen.findByText('Modellvorlage gespeichert')).toBeTruthy();
  });

  it('UI-007.speichert shows "Speichern …" and locks the inputs while PATCH runs', async () => {
    mockApi({ update: pending });
    await openPage();

    await save();

    expect(saveButton().textContent).toBe('Speichern …');
    expect(saveButton().disabled).toBe(true);
    expect(textbox('Modellbezeichnung').disabled).toBe(true);
    expectAccessiblePage();
  });

  it('UI-007.validation AC-REQ-010-03 an emptied required field is rejected and named in the browser, nothing is sent', async () => {
    const { sent } = mockApi();
    await openPage();

    fireEvent.change(textbox('Modellbezeichnung'), { target: { value: ' ' } });
    fireEvent.change(textbox('Prozessor'), { target: { value: '' } });
    await save();

    expect(errorOf(textbox('Modellbezeichnung'))).toBe('Modellbezeichnung: 1 bis 100 Zeichen');
    expect(errorOf(textbox('Prozessor'))).toBe('Prozessor fehlt');
    expect(document.activeElement).toBe(textbox('Modellbezeichnung'));
    expect(sent).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-007.validation AC-REQ-010-03 a field error of the server is shown at its field', async () => {
    mockApi({
      update: () =>
        Response.json(
          errorBody('validation_failed', {
            fields: [
              {
                path: 'modelName',
                code: 'too_small',
                message: 'Modellbezeichnung: 1 bis 100 Zeichen',
              },
            ],
          }),
          { status: 422 },
        ),
    });
    await openPage();

    await save();

    expect(errorOf(textbox('Modellbezeichnung'))).toBe('Modellbezeichnung: 1 bis 100 Zeichen');
  });

  it('UI-007.conflict DER-52-05 shows P-05 with "Neu laden", nothing saved, the inputs stay until the reload', async () => {
    let version = 3;
    mockApi({
      template: () => Response.json({ ...T14, typeDesignation: '20W9', version }),
      update: () => Response.json(errorBody('version_conflict', { message: 'x' }), { status: 409 }),
    });
    const router = await openPage();
    fireEvent.change(textbox('Typbezeichnung'), { target: { value: '20W2' } });

    await save();

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.',
    );
    expect(textbox('Typbezeichnung').value).toBe('20W2');
    expect(router.state.location.pathname).toBe('/modelle/7');
    expectAccessiblePage();

    version = 4;
    await act(async () => {
      fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));
    });
    await vi.waitFor(() => expect(textbox('Typbezeichnung').value).toBe('20W9'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-007.error DER-52-06 a model template deleted meanwhile shows "Dieser Eintrag ist nicht mehr vorhanden." without reference number on loading', async () => {
    mockApi({
      template: () =>
        Response.json(
          errorBody('not_found', { message: 'Dieser Eintrag ist nicht mehr vorhanden.' }),
          { status: 404 },
        ),
    });
    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe('Dieser Eintrag ist nicht mehr vorhanden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('form')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-007.error DER-52-06 "Neu laden" of a model template deleted meanwhile shows the banner instead of the form', async () => {
    let deleted = false;
    mockApi({
      template: () =>
        deleted
          ? Response.json(
              errorBody('not_found', { message: 'Dieser Eintrag ist nicht mehr vorhanden.' }),
              { status: 404 },
            )
          : Response.json(T14),
      update: () => Response.json(errorBody('version_conflict', { message: 'x' }), { status: 409 }),
    });
    await openPage();
    await save();
    const conflict = screen.getByRole('alert');

    deleted = true;
    await act(async () => {
      fireEvent.click(within(conflict).getByRole('button', { name: 'Neu laden' }));
    });

    await vi.waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Dieser Eintrag ist nicht mehr vorhanden.',
      ),
    );
    expect(screen.queryByRole('form')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    expectAccessiblePage();
  });

  it('UI-007.error DER-52-06 a model template deleted meanwhile shows the same banner on saving', async () => {
    mockApi({
      update: () =>
        Response.json(
          errorBody('not_found', { message: 'Dieser Eintrag ist nicht mehr vorhanden.' }),
          { status: 404 },
        ),
    });
    await openPage();

    await save();

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toBe('Dieser Eintrag ist nicht mehr vorhanden.');
    expect(banner.textContent).not.toContain('Referenz');
    expect(within(banner).queryByRole('button')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-007.error shows the error banner with the reference number for 500', async () => {
    mockApi({
      update: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openPage();

    await save();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Modellvorlage konnte nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(textbox('Modellbezeichnung').value).toBe('ThinkPad T14');
    expectAccessiblePage();
  });

  describe('DER-52-08 stored entries deactivated meanwhile (2.0.11, Nachtrag MAR-904, MAR-1058)', () => {
    it('DER-52-08 shows the stored, deactivated manufacturer and device type as chosen, besides the active ones, without a mark; saving another change succeeds', async () => {
      const api = mockApi();
      api.state.manufacturers = [manufacturer(11, 'Lenovo', false), FUJITSU, APPLE];
      api.state.deviceTypes = [deviceType(1, 'Notebook', false), TABLET];
      const router = await openPage();

      expect(shownText(select('Hersteller'))).toBe('Lenovo');
      expect(optionTexts(select('Hersteller'))).toEqual([
        'Bitte wählen',
        'Lenovo',
        'Fujitsu',
        'Apple',
      ]);
      expect(shownText(select('Geräteart'))).toBe('Notebook');
      expect(optionTexts(select('Geräteart'))).toEqual(['Bitte wählen', 'Notebook', 'Tablet']);

      fireEvent.change(textbox('Typbezeichnung'), { target: { value: '20W2' } });
      await save();

      expect(api.sent).toEqual([expect.objectContaining({ manufacturerId: 11, deviceTypeId: 1 })]);
      await vi.waitFor(() => expect(router.state.location.pathname).toBe('/modelle'));
    });

    it('DER-52-08 shows a stored, deactivated pick list value as chosen with "(deaktiviert)", besides the active values', async () => {
      const api = mockApi();
      api.state.keyboards = [GERMAN, pickValue(32, 'Ungarisch', false), SWISS];
      await openPage();

      expect(shownText(select('Tastatur Gerät'))).toBe('Ungarisch (deaktiviert)');
      expect(optionTexts(select('Tastatur Gerät'))).toEqual([
        '',
        'Deutsch',
        'Ungarisch (deaktiviert)',
        'Schweiz',
      ]);
      // "Tastaturlayout" of the level model does not hold "Ungarisch".
      expect(optionTexts(select('Tastaturlayout'))).toEqual(['', 'Deutsch', 'Schweiz']);
    });

    it('DER-52-08 a change to a manufacturer deactivated meanwhile shows "Hersteller Fujitsu ist deaktiviert" at the field with the focus and reads the lists again', async () => {
      const api = mockApi({
        update: () =>
          Response.json(
            errorBody('manufacturer_deactivated', {
              message: 'Hersteller Fujitsu ist deaktiviert',
              details: { path: 'manufacturerId', id: 12 },
            }),
            { status: 422 },
          ),
      });
      await openPage();
      fireEvent.change(select('Hersteller'), { target: { value: '12' } });
      api.state.manufacturers = [LENOVO, manufacturer(12, 'Fujitsu', false), APPLE];
      const readsBefore = api.reads.filter((read) => read === 'GET /api/manufacturers').length;

      await save();

      await vi.waitFor(() =>
        expect(errorOf(select('Hersteller'))).toBe('Hersteller Fujitsu ist deaktiviert'),
      );
      expect(document.activeElement).toBe(select('Hersteller'));
      expect(api.reads.filter((read) => read === 'GET /api/manufacturers').length).toBeGreaterThan(
        readsBefore,
      );
      expect(api.reads).toContain('GET /api/device-types');
      // The stored manufacturer stays offered; there is no fallback to it (2.4).
      expect(shownText(select('Hersteller'))).toBe('Bitte wählen');
      expect(optionTexts(select('Hersteller'))).toEqual(['Bitte wählen', 'Lenovo', 'Apple']);
    });

    it('DER-52-08 a change to a device type deactivated meanwhile shows "Geräteart Tablet ist deaktiviert" at the field with the focus', async () => {
      const api = mockApi({
        update: () =>
          Response.json(
            errorBody('device_type_deactivated', {
              message: 'Geräteart Tablet ist deaktiviert',
              details: { path: 'deviceTypeId', id: 3 },
            }),
            { status: 422 },
          ),
      });
      await openPage();
      fireEvent.change(select('Geräteart'), { target: { value: '3' } });
      api.state.deviceTypes = [NOTEBOOK, deviceType(3, 'Tablet', false)];
      // The attributes of the tablet come before the save is possible (2.4, #178).
      await vi.waitFor(() => expect(saveButton().disabled).toBe(false));

      await save();

      await vi.waitFor(() =>
        expect(errorOf(select('Geräteart'))).toBe('Geräteart Tablet ist deaktiviert'),
      );
      expect(document.activeElement).toBe(select('Geräteart'));
    });

    it('DER-52-08 a change to a pick list value deactivated meanwhile shows "<Merkmal>: <Wert> ist deaktiviert" at the field of the attribute with the focus', async () => {
      const api = mockApi({
        update: () =>
          Response.json(
            errorBody('pick_list_value_deactivated', {
              message: 'Tastaturlayout: Schweiz ist deaktiviert',
              details: { path: 'modelValues.2', id: 33 },
            }),
            { status: 422 },
          ),
      });
      await openPage();
      fireEvent.change(select('Tastaturlayout'), { target: { value: '33' } });
      api.state.keyboards = [GERMAN, HUNGARIAN, pickValue(33, 'Schweiz', false)];

      await save();

      await vi.waitFor(() =>
        expect(errorOf(select('Tastaturlayout'))).toBe('Tastaturlayout: Schweiz ist deaktiviert'),
      );
      expect(document.activeElement).toBe(select('Tastaturlayout'));
      // The stored value of "Tastatur Gerät" stays chosen without a message (2.4 "Erkennen").
      expect(shownText(select('Tastatur Gerät'))).toBe('Ungarisch');
      expect(errorOf(select('Tastatur Gerät'))).toBeNull();
    });

    it('DER-52-08 T16 a newly chosen manufacturer deactivated in a reload stays shown without a mark; saving gives manufacturer_deactivated', async () => {
      const api = mockApi({
        update: () =>
          Response.json(
            errorBody('manufacturer_deactivated', {
              message: 'Hersteller Fujitsu ist deaktiviert',
              details: { path: 'manufacturerId', id: 12 },
            }),
            { status: 422 },
          ),
      });
      await openPage();
      fireEvent.change(select('Hersteller'), { target: { value: '12' } });
      api.state.manufacturers = [LENOVO, manufacturer(12, 'Fujitsu', false), APPLE];

      await reloadLists();
      await vi.waitFor(() =>
        expect(
          api.reads.filter((read) => read === 'GET /api/manufacturers').length,
        ).toBeGreaterThan(1),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expectAccessiblePage();
      expect(shownText(select('Hersteller'))).toBe('Fujitsu');
      expect(optionTexts(select('Hersteller'))).toEqual([
        'Bitte wählen',
        'Lenovo',
        'Fujitsu',
        'Apple',
      ]);

      await save();

      expect(api.sent).toEqual([expect.objectContaining({ manufacturerId: 12 })]);
      await vi.waitFor(() =>
        expect(errorOf(select('Hersteller'))).toBe('Hersteller Fujitsu ist deaktiviert'),
      );
      expect(shownText(select('Hersteller'))).toBe('Bitte wählen');
    });
  });

  it('shows M-15 for an address without a valid id', async () => {
    mockApi();
    renderPage('/modelle/abc');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
  });
});

describe('UI-007 device type locked by captured devices (CU-114, #182)', () => {
  const LOCKED_REASON = 'Geräteart kann nicht geändert werden, weil Geräte erfasst sind';

  /** The texts linked to a control with `aria-describedby`. */
  const descriptionsOf = (control: HTMLElement) =>
    (control.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent ?? null);

  it('UI-007.disabled DER-52-03 locks "Geräteart" of a model template with devices and names the reason', async () => {
    mockApi({ usage: () => Response.json(USED) });
    await openPage();

    const deviceTypeSelect = select('Geräteart');
    expect(deviceTypeSelect.disabled).toBe(true);
    expect(shownText(deviceTypeSelect)).toBe('Notebook');
    expect(descriptionsOf(deviceTypeSelect)).toEqual([LOCKED_REASON]);
    // The other fields stay open for changes (2.4 "Ändern").
    expect(select('Hersteller').disabled).toBe(false);
    expect(textbox('Modellbezeichnung').disabled).toBe(false);
    expect(saveButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it('UI-007.disabled DER-52-04 reads …/usage and shows neither a row "Verwendung" nor its counts', async () => {
    const { reads } = mockApi({ usage: () => Response.json(USED) });
    await openPage();

    expect(reads).toContain('GET /api/model-templates/7/usage');
    expect(select('Geräteart').disabled).toBe(true);
    expect(screen.queryByText(/Verwendung/)).toBeNull();
    // `deviceCount` 2 and `listingCount` 3 are not shown, neither alone nor in a text.
    expect(screen.queryByText(/^\s*[23]\s*$/)).toBeNull();
    expect(screen.queryByText(/Geräte: |Modell-Inserate: /)).toBeNull();
    expect(screen.getByRole('note').textContent).toBe(
      'Änderungen an Modelldaten wirken auf alle Modell-Inserate und Datenblätter dieser Modellvorlage.',
    );
  });

  it('UI-007.default DER-52-04 leaves "Geräteart" open without devices (deviceCount 0)', async () => {
    const { reads } = mockApi();
    await openPage();

    expect(reads).toContain('GET /api/model-templates/7/usage');
    expect(select('Geräteart').disabled).toBe(false);
    expect(descriptionsOf(select('Geräteart'))).toEqual([]);
    expect(screen.queryByText(LOCKED_REASON)).toBeNull();
    expectAccessiblePage();
  });

  it('UI-007.loading DER-52-04 opens the form only after …/usage has arrived', async () => {
    mockApi({ usage: pending });
    renderPage();

    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Lade Modellvorlage …');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('UI-007.disabled a locked "Geräteart" sends the stored device type on saving another change', async () => {
    const { sent } = mockApi({ usage: () => Response.json(USED) });
    await openPage();

    fireEvent.change(textbox('Typbezeichnung'), { target: { value: '20W2' } });
    await save();

    expect(sent).toEqual([expect.objectContaining({ deviceTypeId: 1, typeDesignation: '20W2' })]);
  });

  it('UI-007.validation AC-REQ-010-02 a device captured meanwhile rejects the new device type with the text at "Geräteart"', async () => {
    const { sent } = mockApi({
      update: () =>
        Response.json(errorBody('device_type_in_use', { message: LOCKED_REASON }), {
          status: 422,
        }),
    });
    await openPage();

    fireEvent.change(select('Geräteart'), { target: { value: '3' } });
    // The attributes of the tablet come before the save is possible (2.4, #178).
    await vi.waitFor(() => expect(saveButton().disabled).toBe(false));
    await save();

    expect(sent).toEqual([expect.objectContaining({ deviceTypeId: 3 })]);
    await vi.waitFor(() => expect(errorOf(select('Geräteart'))).toBe(LOCKED_REASON));
    expect(document.activeElement).toBe(select('Geräteart'));
    expect(screen.queryByText(/Modellvorlage konnte nicht gespeichert werden/)).toBeNull();
    expectAccessiblePage();
  });

  it('UI-007.error shows the error banner when …/usage cannot be read', async () => {
    mockApi({
      usage: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    renderPage();

    expect((await screen.findByRole('alert')).textContent).toContain('Referenz: R-7K2M-9QX4');
    expect(screen.queryByRole('form')).toBeNull();
  });
});

describe('UI-007 deactivated and reactivated required attribute (M-32, 2.5, Story #34)', () => {
  /** "ThinkPad T14" saved while "Prozessor" was deactivated: without a value for it. */
  const WITHOUT_PROCESSOR = { ...T14, modelValues: { 2: 31 } };
  const PROCESSOR_MISSING = 'Prozessor fehlt';

  it('UI-007.default DER-34-22 shows no field for a deactivated attribute; PATCH sends no key for it, so its stored value stays', async () => {
    const { sent } = mockApi({
      attributes: [{ ...PROCESSOR, active: false }, KEYBOARD, DEVICE_KEYBOARD],
    });
    await openPage();

    expect(within(form()).queryByRole('textbox', { name: /^Prozessor/ })).toBeNull();
    fireEvent.change(textbox('Typbezeichnung'), { target: { value: '20W2' } });
    await save();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ modelValues: { 2: 31 } });
    expect((sent[0] as { modelValues: object }).modelValues).not.toHaveProperty('1');
  });

  it('UI-007.default UI-007.validation DER-34-23 shows a reactivated required attribute without a value as an empty required field "*"; changing only the type designation names "Prozessor fehlt" in the browser, nothing sent; with the processor entered it saves', async () => {
    const { sent } = mockApi({ template: () => Response.json(WITHOUT_PROCESSOR) });
    await openPage();

    expect(textbox('Prozessor').value).toBe('');
    expect(textbox('Prozessor').getAttribute('aria-required')).toBe('true');
    expect(document.querySelector(`label[for="${textbox('Prozessor').id}"]`)?.textContent).toBe(
      'Prozessor*',
    );
    fireEvent.change(textbox('Typbezeichnung'), { target: { value: '20W2' } });
    await save();

    expect(errorOf(textbox('Prozessor'))).toBe(PROCESSOR_MISSING);
    expect(document.activeElement).toBe(textbox('Prozessor'));
    expect(textbox('Typbezeichnung').value).toBe('20W2');
    expect(sent).toEqual([]);
    expectAccessiblePage();

    fireEvent.change(textbox('Prozessor'), { target: { value: 'Intel Core i5-1135G7' } });
    await save();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      typeDesignation: '20W2',
      modelValues: { 1: 'Intel Core i5-1135G7', 2: 31 },
    });
  });

  it('UI-007.validation DER-34-23 shows "Prozessor fehlt" of 422 validation_failed at modelValues.<id> at the field, focus there, nothing saved, the inputs stay', async () => {
    // "Prozessor" was made required in another window after UI-007 read the attributes, so the
    // check in the browser lets the request pass and the server names the missing value.
    const { sent } = mockApi({
      template: () => Response.json(WITHOUT_PROCESSOR),
      attributes: [{ ...PROCESSOR, required: false }, KEYBOARD, DEVICE_KEYBOARD],
      update: () =>
        Response.json(
          errorBody('validation_failed', {
            fields: [{ path: 'modelValues.1', code: 'value_missing', message: PROCESSOR_MISSING }],
          }),
          { status: 422 },
        ),
    });
    const router = await openPage();
    fireEvent.change(textbox('Typbezeichnung'), { target: { value: '20W2' } });

    await save();

    await vi.waitFor(() => expect(errorOf(textbox('Prozessor'))).toBe(PROCESSOR_MISSING));
    expect(document.activeElement).toBe(textbox('Prozessor'));
    expect(textbox('Typbezeichnung').value).toBe('20W2');
    expect(sent).toHaveLength(1);
    expect(router.state.location.pathname).toBe('/modelle/7');
    expectAccessiblePage();
  });
});
