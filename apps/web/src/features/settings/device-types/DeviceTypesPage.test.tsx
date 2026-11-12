import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-027 with a mocked `fetch` (Technical Specification 6.1, 6.2).

const NOTEBOOK = { id: 1, name: 'Notebook', active: true, version: 3, attributeCount: 10 };
const TABLET = { id: 2, name: 'Tablet', active: false, version: 1, attributeCount: 7 };

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

type DeviceTypeItem = typeof NOTEBOOK;

/** An attribute of a device type as `GET /api/device-types/{id}/attributes` lists it (2.1). */
type AttributeItem = {
  id: number;
  deviceTypeId: number;
  label: string;
  dataType: 'text' | 'integer' | 'decimal' | 'boolean' | 'pick' | 'ports';
  systemRole: 'keyboard_layout' | 'power_supply' | 'battery' | 'battery_capacity' | null;
  unit: string | null;
  unitSpacing: boolean;
  minValue: string | null;
  maxValue: string | null;
  pickListId: number | null;
  level: 'model' | 'device';
  variantForming: boolean;
  required: boolean;
  datasheetBlock:
    'identification' | 'condition' | 'delivery_scope' | 'technical' | 'ports' | 'software';
  sortOrder: number;
  active: boolean;
  version: number;
  hasValues: boolean;
};

const PICK_LISTS = [
  { id: 4, key: 'battery', name: 'Akku', isBatteryList: true, version: 1 },
  { id: 5, key: 'storage_type', name: 'Speichertyp', isBatteryList: false, version: 1 },
];

const ATTRIBUTES_PATH = /^\/api\/device-types\/(\d+)\/attributes/;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame (UI-044), the device types, their
 * attributes (none unless given), the pick lists and one handler per write `METHOD path`. Like
 * the server, a saved device type or attribute is part of the next list. Records the writes
 * with their JSON body.
 */
function mockApi({
  list,
  writes = {},
  attributes = {},
}: {
  list?: Route;
  writes?: Record<string, Route>;
  attributes?: Record<number, AttributeItem[]>;
} = {}) {
  const items: DeviceTypeItem[] = [NOTEBOOK, TABLET];
  const attributesOf = (deviceTypeId: number) => (attributes[deviceTypeId] ??= []);
  const sent: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/ops/status') return Response.json(OPS_STATUS);
    const attributesPath = ATTRIBUTES_PATH.exec(path);
    if (method === 'GET' && attributesPath) {
      const listed = attributesOf(Number(attributesPath[1]));
      return Response.json({ items: listed, total: listed.length });
    }
    if (method === 'GET' && path.startsWith('/api/pick-lists')) {
      return Response.json({ items: PICK_LISTS, total: PICK_LISTS.length });
    }
    if (method === 'GET' && path.startsWith('/api/device-types')) {
      return list ? list(init) : Response.json({ items, total: items.length });
    }
    const key = `${method} ${path}`;
    sent.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = writes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    const response = await handler(init);
    if (response.ok && !path.endsWith('/attribute-order')) {
      const saved = (await response.clone().json()) as DeviceTypeItem | AttributeItem;
      if ('deviceTypeId' in saved) {
        const listed = attributesOf(saved.deviceTypeId);
        const index = listed.findIndex((item) => item.id === saved.id);
        if (index === -1) listed.push({ ...saved, hasValues: false });
        else listed[index] = { ...listed[index], ...saved };
      } else {
        const index = items.findIndex((item) => item.id === saved.id);
        if (index === -1) items.push(saved);
        else items[index] = saved;
      }
    }
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, sent };
}

function renderDeviceTypes() {
  const router = createMemoryRouter(routes, { initialEntries: ['/einstellungen/geraetearten'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const nameInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Name/ });
const statusSwitch = () => screen.getByRole('switch', { name: 'Status' });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Geräteart speichern|Speichern …)$/ });
const listRegion = () => screen.getByRole('region', { name: 'Gerätearten' });

const SAVED_NOTEBOOK = { ...NOTEBOOK, name: 'Laptop', version: 4 };
const PATCH_NOTEBOOK = 'PATCH /api/device-types/1';

/** A response that never arrives, e.g. a write without time limit (P-08). */
const pending = () => new Promise<Response>(() => {});

async function openPage() {
  renderDeviceTypes();
  await screen.findByRole('button', { name: /Notebook/ });
  await vi.waitFor(() => expect(nameInput().value).toBe('Notebook'));
}

function rename(name: string) {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.click(saveButton());
}

/** Types into "Name" like the user: the field has the focus. */
function typeName(value: string) {
  act(() => nameInput().focus());
  fireEvent.change(nameInput(), { target: { value } });
}

/** Leaves "Name" with the keyboard (Tab): the focus moves to the next control. */
function leaveNameByKeyboard() {
  act(() => statusSwitch().focus());
}

/**
 * First half of a mouse click: the button goes down on the element and, like in the browser, the
 * focus moves to it, so "Name" loses it.
 */
function pressPointer(element: HTMLElement) {
  fireEvent.pointerDown(element);
  fireEvent.mouseDown(element);
  act(() => element.focus());
}

/** Second half of a mouse click, in the order of the browser: `pointerup`, `mouseup`, `click`. */
async function releasePointerAndClick(element: HTMLElement) {
  await act(async () => {
    fireEvent.pointerUp(element);
    fireEvent.mouseUp(element);
    fireEvent.click(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Another window renamed "Notebook" to "Notebook Pro" (version 4) after the first list request.
 * Like the server, `PATCH` answers `409 version_conflict` unless it sends version 4.
 */
function mockConcurrentChange() {
  let listCalls = 0;
  return mockApi({
    list: () => {
      listCalls += 1;
      const notebook =
        listCalls === 1 ? NOTEBOOK : { ...NOTEBOOK, name: 'Notebook Pro', version: 4 };
      return Response.json({ items: [notebook, TABLET], total: 2 });
    },
    writes: {
      [PATCH_NOTEBOOK]: (init) => {
        const body = JSON.parse(String(init?.body)) as { version: number; name: string };
        return body.version === 4
          ? Response.json({ ...NOTEBOOK, name: body.name, version: 5 })
          : Response.json(errorBody('version_conflict'), { status: 409 });
      },
    },
  });
}

/** The browser window gets the focus again; TanStack Query loads the list in the background. */
async function refetchOnFocus() {
  fireEvent(window, new Event('visibilitychange'));
  await screen.findByRole('button', { name: /Notebook Pro/ });
}

/** Accessibility assertion of a state: every control has a name, field errors are linked. */
function expectAccessibleForm() {
  expect(nameInput().getAttribute('aria-required')).toBe('true');
  expect(statusSwitch().getAttribute('aria-checked')).toMatch(/^(true|false)$/);
  const describedBy = nameInput().getAttribute('aria-describedby');
  if (nameInput().getAttribute('aria-invalid') === 'true') {
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
  }
  for (const button of screen.getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const RAM: AttributeItem = {
  id: 12,
  deviceTypeId: 1,
  label: 'RAM',
  dataType: 'integer',
  systemRole: null,
  unit: 'GB',
  unitSpacing: false,
  minValue: '1',
  maxValue: '256',
  pickListId: null,
  level: 'device',
  variantForming: true,
  required: true,
  datasheetBlock: 'technical',
  sortOrder: 1,
  active: true,
  version: 2,
  hasValues: false,
};
const DISPLAY: AttributeItem = {
  ...RAM,
  id: 13,
  label: 'Displaygröße',
  dataType: 'decimal',
  unit: 'Zoll',
  unitSpacing: true,
  minValue: null,
  maxValue: null,
  level: 'model',
  variantForming: false,
  sortOrder: 2,
  version: 1,
};
const BATTERY_CAPACITY: AttributeItem = {
  ...RAM,
  id: 18,
  label: 'Akkukapazität',
  systemRole: 'battery_capacity',
  unit: '%',
  minValue: null,
  maxValue: null,
  variantForming: false,
  required: false,
  datasheetBlock: 'condition',
  sortOrder: 3,
  version: 1,
};
const BATTERY: AttributeItem = {
  ...RAM,
  id: 17,
  label: 'Akku',
  dataType: 'pick',
  systemRole: 'battery',
  unit: null,
  minValue: null,
  maxValue: null,
  pickListId: 4,
  variantForming: false,
  datasheetBlock: 'delivery_scope',
  sortOrder: 4,
  version: 1,
};

const attributeRegion = () => screen.getByRole('region', { name: 'Merkmale' });
const panel = () => screen.getByRole('form', { name: 'Merkmal bearbeiten' });
const panelField = (name: RegExp | string) =>
  within(panel()).getByLabelText<HTMLInputElement & HTMLSelectElement>(name);
const panelSave = () =>
  within(panel()).getByRole<HTMLButtonElement>('button', {
    name: /^(Merkmal speichern|Speichern …)$/,
  });
const attributeRow = (label: string) =>
  within(attributeRegion())
    .getAllByRole('row')
    .find((row) => within(row).queryByRole('button', { name: label })) as HTMLElement;

async function openAttributes(attributes: AttributeItem[], writes: Record<string, Route> = {}) {
  const api = mockApi({ attributes: { 1: [...attributes] }, writes });
  await openPage();
  if (attributes.length > 0) {
    await within(attributeRegion()).findByRole('button', { name: attributes[0]?.label });
  }
  return api;
}

async function openPanelOf(label: string) {
  fireEvent.click(within(attributeRegion()).getByRole('button', { name: label }));
  return panel();
}

/** Accessibility assertion of the panel: named controls, required marks, linked field errors. */
function expectAccessiblePanel() {
  const form = panel();
  for (const control of within(form).queryAllByRole('textbox')) {
    expect(control.id && form.querySelector(`label[for="${control.id}"]`)).toBeTruthy();
    const describedBy = control.getAttribute('aria-describedby');
    if (control.getAttribute('aria-invalid') === 'true') {
      expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
    }
  }
  expect(panelField(/^Bezeichnung/).getAttribute('aria-required')).toBe('true');
  for (const button of screen.getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
}

/** Viewport at least `full` wide (1366 px): the panel stands beside the table (R-1 (3)). */
function stubViewport({ full }: { full: boolean }) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      media,
      matches: full,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

describe('UI-027 attributes (CU-095, REQ-005)', () => {
  beforeEach(() => stubViewport({ full: true }));

  it('UI-027.default below 1366 px the panel overlays the table as a sheet with "Schließen" (R-1 (3))', async () => {
    stubViewport({ full: false });
    await openAttributes([RAM]);
    await openPanelOf('RAM');

    const sheet = screen.getByRole('dialog', { name: 'Merkmal bearbeiten' });
    expect(within(sheet).getByRole('form', { name: 'Merkmal bearbeiten' })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('UI-027.default from 1366 px the panel stands beside the table and closes with "Schließen"', async () => {
    await openAttributes([RAM]);
    await openPanelOf('RAM');

    const aside = screen.getByRole('complementary', { name: 'Merkmal bearbeiten' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(attributeRow('RAM').getAttribute('aria-current')).toBe('true');
    fireEvent.click(within(aside).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('complementary', { name: 'Merkmal bearbeiten' })).toBeNull();
  });
  it('UI-027.empty DER-34-01 a device type without attributes shows "Noch keine Merkmale. Legen Sie das erste Merkmal an."', async () => {
    await openAttributes([]);

    const region = await screen.findByRole('region', { name: 'Merkmale' });
    expect(
      await within(region).findByText('Noch keine Merkmale. Legen Sie das erste Merkmal an.'),
    ).toBeTruthy();
    expect(within(region).queryByRole('table')).toBeNull();
    fireEvent.click(within(region).getByRole('button', { name: 'Merkmal anlegen' }));
    expect(panelField(/^Bezeichnung/).value).toBe('');
    expectAccessiblePanel();
  });

  it('UI-027.default shows the attribute table with the columns of UI-027 and the order controls', async () => {
    await openAttributes([RAM, DISPLAY]);

    const table = within(attributeRegion()).getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Reihenfolge',
      'Bezeichnung',
      'Datentyp',
      'Einheit',
      'Ebene',
      'variantenbildend',
      'Pflicht',
      'Datenblatt-Block',
      'Status',
    ]);
    const cells = (label: string) =>
      within(attributeRow(label))
        .getAllByRole('cell')
        .slice(1, -1)
        .map((cell) => cell.textContent);
    expect(cells('RAM')).toEqual([
      'RAM',
      'Ganzzahl',
      'GB',
      'Gerät',
      'Ja',
      'Ja',
      'Technik',
      'aktiv',
    ]);
    expect(cells('Displaygröße')).toEqual([
      'Displaygröße',
      'Dezimalzahl',
      'Zoll',
      'Modell',
      '–',
      'Ja',
      'Technik',
      'aktiv',
    ]);
    expect(within(attributeRow('RAM')).getByRole('button', { name: 'Hoch' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByRole('button', { name: /löschen/i })).toBeNull();
    expect(screen.queryByRole('form', { name: 'Merkmal bearbeiten' })).toBeNull();
  });

  it('UI-027.success DER-34-09 "Merkmal speichern" closes the panel, updates the row and shows "Merkmal gespeichert"', async () => {
    const { sent } = await openAttributes([RAM, DISPLAY], {
      'PATCH /api/attributes/12': () =>
        Response.json({ ...RAM, label: 'Arbeitsspeicher', unit: 'GiB', version: 3 }),
    });
    await openPanelOf('RAM');

    fireEvent.change(panelField(/^Bezeichnung/), { target: { value: 'Arbeitsspeicher' } });
    fireEvent.change(panelField(/^Einheit/), { target: { value: 'GiB' } });
    fireEvent.click(panelSave());

    const banner = await screen.findByText('Merkmal gespeichert');
    expect(banner).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Merkmal bearbeiten' })).toBeNull();
    expect(within(attributeRow('Arbeitsspeicher')).getByText('GiB')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/attributes/12',
        body: {
          version: 2,
          label: 'Arbeitsspeicher',
          dataType: 'integer',
          unit: 'GiB',
          unitSpacing: false,
          minValue: '1',
          maxValue: '256',
          pickListId: null,
          level: 'device',
          variantForming: true,
          required: true,
          datasheetBlock: 'technical',
        },
      },
    ]);
    // DER-34-12: the answer opens no impact dialog UI-043.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('UI-027.success AC-REQ-005-01 creates "Bildschirmdiagonale" with unit, range, level model and required', async () => {
    const created = {
      ...DISPLAY,
      id: 20,
      label: 'Bildschirmdiagonale',
      minValue: '10',
      maxValue: '60',
      sortOrder: 2,
    };
    const { sent } = await openAttributes([RAM], {
      'POST /api/device-types/1/attributes': () => Response.json(created, { status: 201 }),
    });
    fireEvent.click(within(attributeRegion()).getByRole('button', { name: /Merkmal anlegen/ }));

    fireEvent.change(panelField(/^Bezeichnung/), { target: { value: 'Bildschirmdiagonale' } });
    fireEvent.change(panelField(/^Datentyp/), { target: { value: 'decimal' } });
    fireEvent.change(panelField(/^Einheit/), { target: { value: 'Zoll' } });
    fireEvent.change(panelField(/^Mindestwert/), { target: { value: '10' } });
    fireEvent.change(panelField(/^Höchstwert/), { target: { value: '60' } });
    fireEvent.click(within(panel()).getByLabelText('Pflichtmerkmal'));
    fireEvent.click(panelSave());

    await screen.findByText('Merkmal gespeichert');
    expect(sent[0]?.body).toEqual({
      label: 'Bildschirmdiagonale',
      dataType: 'decimal',
      unit: 'Zoll',
      unitSpacing: true,
      minValue: '10',
      maxValue: '60',
      pickListId: null,
      level: 'model',
      variantForming: false,
      required: true,
      datasheetBlock: 'technical',
      active: true,
    });
    expect(attributeRow('Bildschirmdiagonale')).toBeTruthy();
  });

  it.each([
    ['empty', '', 'Bezeichnung: 1 bis 100 Zeichen'],
    ['101 characters long', 'a'.repeat(101), 'Bezeichnung: 1 bis 100 Zeichen'],
    ['with braces', 'RAM {GB}', 'Bezeichnung darf { und } nicht enthalten'],
    [
      'a fixed placeholder name',
      'Stückzahl',
      'Bezeichnung ist für einen festen Platzhalter vergeben: Stückzahl',
    ],
  ])(
    'UI-027.validation DER-34-02 a label that is %s shows its text at "Bezeichnung" with the focus on it',
    async (_case, label, text) => {
      const { sent } = await openAttributes([RAM]);
      await openPanelOf('RAM');

      fireEvent.change(panelField(/^Bezeichnung/), { target: { value: label } });
      fireEvent.click(panelSave());

      expect(await within(panel()).findByText(text)).toBeTruthy();
      expect(document.activeElement).toBe(panelField(/^Bezeichnung/));
      expect(sent).toEqual([]);
      expectAccessiblePanel();
    },
  );

  // Q-1: the check on leaving a field must not change an error line while the mouse button is
  // pressed on "Merkmal speichern"; otherwise the button moves and the click is lost.
  it('UI-027.success DER-34-09 a mouse click on "Merkmal speichern" after a corrected label saves the new attribute', async () => {
    const created = { ...DISPLAY, id: 21, label: 'Gewicht', dataType: 'text' as const };
    const { sent } = await openAttributes([RAM], {
      'POST /api/device-types/1/attributes': () => Response.json(created, { status: 201 }),
    });
    fireEvent.click(within(attributeRegion()).getByRole('button', { name: /Merkmal anlegen/ }));
    fireEvent.click(panelSave());
    expect(await within(panel()).findByText('Bezeichnung: 1 bis 100 Zeichen')).toBeTruthy();
    expect(document.activeElement).toBe(panelField(/^Bezeichnung/));
    fireEvent.change(panelField(/^Bezeichnung/), { target: { value: 'Gewicht' } });

    pressPointer(panelSave());
    expect(within(panel()).getByText('Bezeichnung: 1 bis 100 Zeichen')).toBeTruthy();
    await releasePointerAndClick(panelSave());

    expect(await screen.findByText('Merkmal gespeichert')).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Merkmal bearbeiten' })).toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      method: 'POST',
      path: '/api/device-types/1/attributes',
      body: { label: 'Gewicht' },
    });
  });

  it('UI-027.success DER-34-09 a mouse click on "Merkmal speichern" after a corrected unit saves the attribute', async () => {
    const { sent } = await openAttributes([RAM, DISPLAY], {
      'PATCH /api/attributes/12': () => Response.json({ ...RAM, unit: 'GiB', version: 3 }),
    });
    await openPanelOf('RAM');
    act(() => panelField(/^Einheit/).focus());
    fireEvent.change(panelField(/^Einheit/), { target: { value: 'x'.repeat(21) } });
    act(() => panelField(/^Bezeichnung/).focus());
    expect(within(panel()).getByText('Einheit: höchstens 20 Zeichen')).toBeTruthy();
    act(() => panelField(/^Einheit/).focus());
    fireEvent.change(panelField(/^Einheit/), { target: { value: 'GiB' } });

    pressPointer(panelSave());
    expect(within(panel()).getByText('Einheit: höchstens 20 Zeichen')).toBeTruthy();
    await releasePointerAndClick(panelSave());

    expect(await screen.findByText('Merkmal gespeichert')).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      method: 'PATCH',
      path: '/api/attributes/12',
      body: { unit: 'GiB' },
    });
  });

  it('UI-027.validation DER-34-02 a mouse click on "Merkmal speichern" after an invalid label shows the error after the click, without request', async () => {
    const { sent } = await openAttributes([RAM]);
    await openPanelOf('RAM');
    act(() => panelField(/^Bezeichnung/).focus());
    fireEvent.change(panelField(/^Bezeichnung/), { target: { value: 'a'.repeat(101) } });

    pressPointer(panelSave());
    expect(within(panel()).queryByText('Bezeichnung: 1 bis 100 Zeichen')).toBeNull();
    await releasePointerAndClick(panelSave());

    expect(within(panel()).getByText('Bezeichnung: 1 bis 100 Zeichen')).toBeTruthy();
    expect(document.activeElement).toBe(panelField(/^Bezeichnung/));
    expect(sent).toEqual([]);
    expectAccessiblePanel();
  });

  it('UI-027.validation DER-34-02 shows the server text of validation_failed at the field with the focus on it', async () => {
    await openAttributes([RAM], {
      'PATCH /api/attributes/12': () =>
        Response.json(
          errorBody('validation_failed', {
            fields: [
              {
                path: 'label',
                code: 'attribute_label_placeholder',
                message: 'Bezeichnung ist für einen festen Platzhalter vergeben: Preis',
              },
            ],
          }),
          { status: 422 },
        ),
    });
    await openPanelOf('RAM');

    fireEvent.change(panelField(/^Einheit/), { target: { value: 'MB' } });
    fireEvent.click(panelSave());

    expect(
      await within(panel()).findByText(
        'Bezeichnung ist für einen festen Platzhalter vergeben: Preis',
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(panelField(/^Bezeichnung/));
    expect(panelField(/^Einheit/).value).toBe('MB');
  });

  it('UI-027.validation DER-34-02 "Akkukapazität" is allowed for the attribute with the role battery_capacity', async () => {
    const { sent } = await openAttributes([RAM, BATTERY_CAPACITY], {
      'PATCH /api/attributes/18': () => Response.json({ ...BATTERY_CAPACITY, version: 2 }),
    });
    await openPanelOf('Akkukapazität');

    fireEvent.change(panelField(/^Einheit/), { target: { value: 'Prozent' } });
    fireEvent.click(panelSave());

    await screen.findByText('Merkmal gespeichert');
    expect(sent).toHaveLength(1);
  });

  it('UI-027.validation DER-34-03 a minimum above the maximum shows "Mindestwert darf nicht größer als Höchstwert sein"; other data types have no such fields', async () => {
    const { sent } = await openAttributes([RAM]);
    await openPanelOf('RAM');

    fireEvent.change(panelField(/^Mindestwert/), { target: { value: '300' } });
    fireEvent.click(panelSave());

    expect(
      await within(panel()).findByText('Mindestwert darf nicht größer als Höchstwert sein'),
    ).toBeTruthy();
    expect(document.activeElement).toBe(panelField(/^Mindestwert/));
    expect(sent).toEqual([]);

    for (const dataType of ['text', 'boolean', 'pick', 'ports']) {
      fireEvent.change(panelField(/^Datentyp/), { target: { value: dataType } });
      expect(within(panel()).queryByLabelText(/^Mindestwert/)).toBeNull();
      expect(within(panel()).queryByLabelText(/^Höchstwert/)).toBeNull();
    }
    expectAccessiblePanel();
  });

  it('UI-027.validation a bound that is no number shows "Mindestwert: Zahl" or "Höchstwert: ganze Zahl"', async () => {
    const { sent } = await openAttributes([RAM, DISPLAY]);
    await openPanelOf('RAM');

    fireEvent.change(panelField(/^Höchstwert/), { target: { value: '1,5' } });
    fireEvent.click(panelSave());
    expect(await within(panel()).findByText('Höchstwert: ganze Zahl')).toBeTruthy();

    fireEvent.click(within(panel()).getByRole('button', { name: 'Abbrechen' }));
    await openPanelOf('Displaygröße');
    fireEvent.change(panelField(/^Mindestwert/), { target: { value: 'abc' } });
    fireEvent.click(panelSave());
    expect(await within(panel()).findByText('Mindestwert: Zahl')).toBeTruthy();
    expect(panelField(/^Mindestwert/).getAttribute('inputmode')).toBe('decimal');
    expect(panelField(/^Mindestwert/).type).toBe('text');
    expect(sent).toEqual([]);
  });

  it('sends no bounds, no pick list and no flag that the changed data type or level does not allow (2.1)', async () => {
    const { sent } = await openAttributes([RAM], {
      'PATCH /api/attributes/12': () =>
        Response.json({ ...RAM, dataType: 'text', level: 'model', version: 3 }),
    });
    await openPanelOf('RAM');

    fireEvent.change(panelField(/^Datentyp/), { target: { value: 'text' } });
    fireEvent.change(panelField(/^Ebene/), { target: { value: 'model' } });
    fireEvent.click(panelSave());

    await screen.findByText('Merkmal gespeichert');
    expect(sent[0]?.body).toMatchObject({
      dataType: 'text',
      level: 'model',
      minValue: null,
      maxValue: null,
      pickListId: null,
      variantForming: false,
    });
  });

  it('UI-027.validation DER-34-04 data type "Auswahl aus Liste" without a list shows "Auswahlliste fehlt"', async () => {
    const { sent } = await openAttributes([RAM]);
    fireEvent.click(within(attributeRegion()).getByRole('button', { name: /Merkmal anlegen/ }));

    fireEvent.change(panelField(/^Bezeichnung/), { target: { value: 'Speichertyp' } });
    fireEvent.change(panelField(/^Datentyp/), { target: { value: 'pick' } });
    fireEvent.click(panelSave());

    expect(await within(panel()).findByText('Auswahlliste fehlt')).toBeTruthy();
    expect(sent).toEqual([]);
    const options = within(panelField(/^Auswahlliste/)).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['', 'Akku', 'Speichertyp']);
    expectAccessiblePanel();
  });

  it('UI-027.validation DER-34-05 name_taken shows "Bezeichnung ist bei dieser Geräteart bereits vergeben" at the field with the focus on it', async () => {
    await openAttributes([RAM, DISPLAY], {
      'PATCH /api/attributes/13': () =>
        Response.json(
          errorBody('name_taken', {
            message: 'Bezeichnung ist bei dieser Geräteart bereits vergeben',
          }),
          { status: 422 },
        ),
    });
    await openPanelOf('Displaygröße');

    fireEvent.change(panelField(/^Bezeichnung/), { target: { value: 'ram' } });
    fireEvent.click(panelSave());

    expect(
      await within(panel()).findByText('Bezeichnung ist bei dieser Geräteart bereits vergeben'),
    ).toBeTruthy();
    expect(panelField(/^Bezeichnung/).getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(panelField(/^Bezeichnung/));
  });

  it('UI-027.validation shows "Einheit: höchstens 20 Zeichen" for a unit over 20 characters', async () => {
    await openAttributes([RAM]);
    await openPanelOf('RAM');

    fireEvent.change(panelField(/^Einheit/), { target: { value: 'a'.repeat(21) } });
    fireEvent.click(panelSave());

    expect(await within(panel()).findByText('Einheit: höchstens 20 Zeichen')).toBeTruthy();
  });

  it('AC-REQ-005-06 the flag "Variantenbildend" exists at level device only', async () => {
    await openAttributes([RAM]);
    await openPanelOf('RAM');

    expect(within(panel()).getByLabelText<HTMLInputElement>('Variantenbildend').checked).toBe(true);
    fireEvent.change(panelField(/^Ebene/), { target: { value: 'model' } });
    expect(within(panel()).queryByLabelText('Variantenbildend')).toBeNull();
  });

  it('AC-REQ-005-07 DER-34-08 battery_capacity keeps "Variantenbildend" at "Nein"; data type, level and list of a system role are locked', async () => {
    await openAttributes([RAM, BATTERY_CAPACITY, BATTERY]);
    await openPanelOf('Akkukapazität');

    const flag = within(panel()).getByLabelText<HTMLInputElement>('Variantenbildend');
    expect(flag.checked).toBe(false);
    expect(flag.disabled).toBe(true);
    expect(panelField(/^Datentyp/).disabled).toBe(true);
    expect(panelField(/^Ebene/).disabled).toBe(true);
    expect(panelField(/^Bezeichnung/).disabled).toBe(false);
    expect(within(panel()).getByLabelText<HTMLInputElement>('Pflichtmerkmal').disabled).toBe(false);
    expect(panelField(/^Datenblatt-Block/).disabled).toBe(false);
    expectAccessiblePanel();

    fireEvent.click(within(panel()).getByRole('button', { name: 'Abbrechen' }));
    await openPanelOf('Akku');
    expect(panelField(/^Auswahlliste/).disabled).toBe(true);
    expect(panelField(/^Auswahlliste/).value).toBe('4');
  });

  it('UI-027.speichert shows "Speichern …" and locks the panel and the table without time limit', async () => {
    await openAttributes([RAM, DISPLAY], { 'PATCH /api/attributes/12': pending });
    await openPanelOf('RAM');
    vi.useFakeTimers({ shouldAdvanceTime: true });

    fireEvent.change(panelField(/^Einheit/), { target: { value: 'GiB' } });
    fireEvent.click(panelSave());

    expect(
      (await within(panel()).findByRole('button', { name: 'Speichern …' })).hasAttribute(
        'disabled',
      ),
    ).toBe(true);
    expect(panelField(/^Bezeichnung/).disabled).toBe(true);
    expect(panelField(/^Einheit/).disabled).toBe(true);
    expect(
      within(attributeRow('Displaygröße')).getByRole<HTMLButtonElement>('button', {
        name: 'Merkmal deaktivieren',
      }).disabled,
    ).toBe(true);
    expect(
      within(attributeRow('Displaygröße')).getByRole<HTMLButtonElement>('button', {
        name: 'Hoch',
      }).disabled,
    ).toBe(true);
    expect(nameInput().disabled).toBe(true);
    // Only the triggering save button shows "Speichern …"; the others keep their label (P-08).
    expect(screen.getAllByRole('button', { name: 'Speichern …' })).toHaveLength(1);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Geräteart speichern' }).disabled,
    ).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(within(panel()).getByRole('button', { name: 'Speichern …' })).toBeTruthy();
    expectAccessiblePanel();
  });

  it('DER-34-07 "Merkmal deaktivieren" sends active false and the row shows "deaktiviert"', async () => {
    const { sent } = await openAttributes([RAM, DISPLAY], {
      'PATCH /api/attributes/12': () => Response.json({ ...RAM, active: false, version: 3 }),
    });

    fireEvent.click(
      within(attributeRow('RAM')).getByRole('button', { name: 'Merkmal deaktivieren' }),
    );

    await screen.findByText('Merkmal gespeichert');
    expect(sent).toEqual([
      { method: 'PATCH', path: '/api/attributes/12', body: { version: 2, active: false } },
    ]);
    expect(within(attributeRow('RAM')).getByText('deaktiviert')).toBeTruthy();
    expect(
      within(attributeRow('RAM')).queryByRole('button', { name: 'Merkmal deaktivieren' }),
    ).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('DER-34-06 "Runter" sends the complete order of the attributes with the version of the device type', async () => {
    const { sent } = await openAttributes([RAM, DISPLAY], {
      'PUT /api/device-types/1/attribute-order': () => Response.json({ ...NOTEBOOK, version: 4 }),
    });

    fireEvent.click(within(attributeRow('RAM')).getByRole('button', { name: 'Runter' }));

    await screen.findByText('Merkmal gespeichert');
    expect(sent).toEqual([
      {
        method: 'PUT',
        path: '/api/device-types/1/attribute-order',
        body: { version: 3, attributeIds: [13, 12] },
      },
    ]);
  });

  it('UI-027.conflict shows P-05 when the attribute changed in another window', async () => {
    await openAttributes([RAM], {
      'PATCH /api/attributes/12': () =>
        Response.json(errorBody('version_conflict'), { status: 409 }),
    });
    await openPanelOf('RAM');

    fireEvent.change(panelField(/^Einheit/), { target: { value: 'GiB' } });
    fireEvent.click(panelSave());

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert.',
    );
    expect(panelField(/^Einheit/).value).toBe('GiB');
  });
});

describe('UI-027 device types (CU-095)', () => {
  it('UI-027.default shows the device types with status, opens the first one and offers no deletion (AC-REQ-004-04)', async () => {
    mockApi();
    await openPage();

    const rows = within(listRegion()).getAllByRole('button', { name: /Merkmal/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      'Notebookaktiv10 Merkmale',
      'Tabletdeaktiviert7 Merkmale',
    ]);
    expect(rows[0]?.getAttribute('aria-current')).toBe('true');
    expect(within(listRegion()).getByText('2')).toBeTruthy();
    expect(statusSwitch().getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: 'Geräteart anlegen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Geräteart speichern' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /löschen/i })).toBeNull();
    expect(screen.queryByText(/löschen/i)).toBeNull();
    expectAccessibleForm();
  });

  it('UI-027.default selecting another device type shows its name and status', async () => {
    mockApi();
    await openPage();

    fireEvent.click(screen.getByRole('button', { name: /Tablet/ }));

    expect(nameInput().value).toBe('Tablet');
    expect(statusSwitch().getAttribute('aria-checked')).toBe('false');
  });

  it('UI-027.loading DER-33-04 shows "Lade Gerätearten …" while GET /api/device-types runs', async () => {
    mockApi({ list: pending });
    renderDeviceTypes();

    expect((await screen.findByRole('status')).textContent).toBe('Lade Gerätearten …');
    expect(nameInput().disabled).toBe(true);
    expectAccessibleForm();
  });

  it('UI-027.success DER-33-05 shows "Geräteart gespeichert" after a rename and closes it after 5 s', async () => {
    const { sent } = mockApi({ writes: { [PATCH_NOTEBOOK]: () => Response.json(SAVED_NOTEBOOK) } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('Laptop');

    const banner = await screen.findByText('Geräteart gespeichert');
    expect(banner.closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/device-types/1',
        body: { version: 3, name: 'Laptop', active: true },
      },
    ]);
    expect(nameInput().value).toBe('Laptop');
    expect(screen.getByRole('button', { name: /Laptop/ })).toBeTruthy();
    expectAccessibleForm();

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Geräteart gespeichert')).toBeNull();
  });

  it('UI-027.success DER-33-12 a rename opens no impact dialog UI-043', async () => {
    mockApi({ writes: { [PATCH_NOTEBOOK]: () => Response.json(SAVED_NOTEBOOK) } });
    await openPage();

    rename('Laptop');

    await screen.findByText('Geräteart gespeichert');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('UI-027.success AC-REQ-004-01 "Geräteart anlegen" creates "Monitor" and marks it in the list', async () => {
    const monitor = { id: 3, name: 'Monitor', active: true, version: 1, attributeCount: 0 };
    const { sent } = mockApi({
      writes: { 'POST /api/device-types': () => Response.json(monitor, { status: 201 }) },
    });
    await openPage();

    fireEvent.click(screen.getByRole('button', { name: 'Geräteart anlegen' }));
    expect(nameInput().value).toBe('');
    expect(statusSwitch().getAttribute('aria-checked')).toBe('true');
    rename('Monitor');

    await screen.findByText('Geräteart gespeichert');
    expect(sent).toEqual([
      { method: 'POST', path: '/api/device-types', body: { name: 'Monitor', active: true } },
    ]);
    expect(screen.getByRole('button', { name: /Monitor/ }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('UI-027.success AC-REQ-004-03 the switch deactivates a device type', async () => {
    const { sent } = mockApi({
      writes: { [PATCH_NOTEBOOK]: () => Response.json({ ...NOTEBOOK, active: false, version: 4 }) },
    });
    await openPage();

    fireEvent.click(statusSwitch());
    expect(statusSwitch().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(saveButton());

    await screen.findByText('Geräteart gespeichert');
    expect(sent[0]?.body).toEqual({ version: 3, name: 'Notebook', active: false });
    expect(screen.getByRole('button', { name: /Notebook/ }).textContent).toContain('deaktiviert');
  });

  it.each([
    ['empty', ''],
    ['51 characters', 'x'.repeat(51)],
  ])(
    'UI-027.validation DER-33-06 a name that is %s shows "Name: 1 bis 50 Zeichen" in the browser with the focus on it',
    async (_case, name) => {
      const { sent } = mockApi();
      await openPage();

      rename(name);

      expect(await screen.findByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
      expect(document.activeElement).toBe(nameInput());
      expect(nameInput().getAttribute('aria-invalid')).toBe('true');
      expect(sent).toEqual([]);
      expectAccessibleForm();
    },
  );

  it('UI-027.validation DER-33-06 shows the field error of a 422 validation_failed at "Name" with the focus on it', async () => {
    mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [{ path: 'name', code: 'too_big', message: 'Name: 1 bis 50 Zeichen' }],
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();

    rename('Laptop');

    expect(await screen.findByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
    expect(nameInput().value).toBe('Laptop');
  });

  it('UI-027.validation AC-REQ-004-02 shows "Name ist bereits vergeben" at the field', async () => {
    mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () =>
          Response.json(errorBody('name_taken', { message: 'Name ist bereits vergeben' }), {
            status: 422,
          }),
      },
    });
    await openPage();

    rename('tablet');

    expect(await screen.findByText('Name ist bereits vergeben')).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
    expect(screen.queryByText('Geräteart gespeichert')).toBeNull();
  });

  it('UI-027.validation DER-33-06 leaving "Name" with the keyboard checks the field at once', async () => {
    mockApi();
    await openPage();

    typeName('x'.repeat(51));
    leaveNameByKeyboard();

    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    expectAccessibleForm();
  });

  // QA-D1: the check on leaving the field must not change the error line while the mouse button
  // is pressed on "Geräteart speichern"; otherwise the button moves and the click is lost.
  it('UI-027.validation DER-33-06 a mouse click on save after an invalid name shows the error after the click, without request', async () => {
    const { sent } = mockApi();
    await openPage();
    fireEvent.click(screen.getByRole('button', { name: 'Geräteart anlegen' }));
    typeName('x'.repeat(51));

    pressPointer(saveButton());
    expect(screen.queryByText('Name: 1 bis 50 Zeichen')).toBeNull();
    await releasePointerAndClick(saveButton());

    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
    expect(sent).toEqual([]);
  });

  it('UI-027.validation DER-33-06 a mouse click on save after a corrected name saves when renaming', async () => {
    const { sent } = mockApi({ writes: { [PATCH_NOTEBOOK]: () => Response.json(SAVED_NOTEBOOK) } });
    await openPage();
    typeName('x'.repeat(51));
    leaveNameByKeyboard();
    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    typeName('Laptop');

    pressPointer(saveButton());
    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    await releasePointerAndClick(saveButton());

    expect(await screen.findByText('Geräteart gespeichert')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/device-types/1',
        body: { version: 3, name: 'Laptop', active: true },
      },
    ]);
    expect(screen.queryByText('Name: 1 bis 50 Zeichen')).toBeNull();
  });

  it('UI-027.validation AC-REQ-004-02 a mouse click on save after a corrected name sends the new device type and shows "Name ist bereits vergeben"', async () => {
    const { sent } = mockApi({
      writes: {
        'POST /api/device-types': () =>
          Response.json(errorBody('name_taken', { message: 'Name ist bereits vergeben' }), {
            status: 422,
          }),
      },
    });
    await openPage();
    fireEvent.click(screen.getByRole('button', { name: 'Geräteart anlegen' }));
    typeName('x'.repeat(51));
    leaveNameByKeyboard();
    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    typeName('Tablet');

    pressPointer(saveButton());
    await releasePointerAndClick(saveButton());

    expect(await screen.findByText('Name ist bereits vergeben')).toBeTruthy();
    expect(screen.queryByText('Name: 1 bis 50 Zeichen')).toBeNull();
    expect(document.activeElement).toBe(nameInput());
    expect(sent).toEqual([
      { method: 'POST', path: '/api/device-types', body: { name: 'Tablet', active: true } },
    ]);
  });

  it('UI-027.validation DER-33-06 a mouse click on the status switch after an invalid name toggles it', async () => {
    mockApi();
    await openPage();
    typeName('x'.repeat(51));

    pressPointer(statusSwitch());
    expect(screen.queryByText('Name: 1 bis 50 Zeichen')).toBeNull();
    await releasePointerAndClick(statusSwitch());

    expect(statusSwitch().getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
  });

  it('UI-027.error DER-33-10 shows the error banner with the reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
      },
    });
    await openPage();

    rename('Laptop');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Einstellungen konnten nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(nameInput().value).toBe('Laptop');
    expect(saveButton().disabled).toBe(false);
    expectAccessibleForm();
  });

  it('UI-027.speichert DER-33-07 shows "Speichern …" and locks all inputs without time limit', async () => {
    mockApi({ writes: { [PATCH_NOTEBOOK]: pending } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('Laptop');

    expect(
      (await screen.findByRole('button', { name: 'Speichern …' })).hasAttribute('disabled'),
    ).toBe(true);
    expect(nameInput().disabled).toBe(true);
    expect((statusSwitch() as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Geräteart anlegen' }).disabled,
    ).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Tablet/ }).disabled).toBe(true);
    // No time limit for writes (Ä-29): still saving after a minute.
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(screen.getByRole('button', { name: 'Speichern …' })).toBeTruthy();
    expectAccessibleForm();
  });

  it('UI-027.conflict DER-33-08 (a) shows P-05 with "Neu laden" and keeps the inputs; "Neu laden" takes the reloaded data', async () => {
    let listCalls = 0;
    mockApi({
      list: () => {
        listCalls += 1;
        const notebook =
          listCalls === 1 ? NOTEBOOK : { ...NOTEBOOK, name: 'Notebook Pro', version: 4 };
        return Response.json({ items: [notebook, TABLET], total: 2 });
      },
      writes: {
        [PATCH_NOTEBOOK]: () => Response.json(errorBody('version_conflict'), { status: 409 }),
      },
    });
    await openPage();

    rename('Laptop');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.',
    );
    expect(nameInput().value).toBe('Laptop');
    expect(screen.queryByText('Geräteart gespeichert')).toBeNull();
    expectAccessibleForm();

    fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(nameInput().value).toBe('Notebook Pro'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-027.conflict DER-33-08 (a) a refetch between opening and saving sends the version the form is based on and shows P-05', async () => {
    const { sent } = mockConcurrentChange();
    await openPage();

    fireEvent.change(nameInput(), { target: { value: 'Laptop' } });
    await refetchOnFocus();
    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert.',
    );
    expect(sent.map((write) => write.body)).toEqual([{ version: 3, name: 'Laptop', active: true }]);
    expect(nameInput().value).toBe('Laptop');
    expect(screen.queryByText('Geräteart gespeichert')).toBeNull();
    expectAccessibleForm();
  });

  it('UI-027.conflict DER-33-08 (a) after P-05 a focus change before "Neu laden" does not overwrite the other change', async () => {
    const { sent } = mockConcurrentChange();
    await openPage();

    rename('Laptop');
    await screen.findByRole('alert');
    await refetchOnFocus();
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(sent.map((write) => write.body)).toEqual([
      { version: 3, name: 'Laptop', active: true },
      { version: 3, name: 'Laptop', active: true },
    ]);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Geräteart gespeichert')).toBeNull();

    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(nameInput().value).toBe('Notebook Pro'));
    expect(screen.queryByRole('alert')).toBeNull();
    rename('Laptop');
    await screen.findByText('Geräteart gespeichert');
    expect(sent[2]?.body).toEqual({ version: 4, name: 'Laptop', active: true });
  });

  it('UI-027.unreachable DER-33-08 (b) shows P-06 with "Erneut versuchen" when the list gets no answer, without replacing the page', async () => {
    mockApi({
      list: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderDeviceTypes();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Gerätearten und Merkmale' })).toBeTruthy();
    expect(listRegion()).toBeTruthy();
    expectAccessibleForm();
  });

  it('UI-027.wird-beendet DER-33-08 (c) shows P-07 without reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () => Response.json(errorBody('shutting_down'), { status: 503 }),
      },
    });
    await openPage();

    rename('Laptop');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-/);
    expect(nameInput().value).toBe('Laptop');
    expectAccessibleForm();
  });

  it('shows "Dieser Eintrag ist nicht mehr vorhanden." when the device type is gone', async () => {
    mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () =>
          Response.json(
            errorBody('not_found', { message: 'Dieser Eintrag ist nicht mehr vorhanden.' }),
            {
              status: 404,
            },
          ),
      },
    });
    await openPage();

    rename('Laptop');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-027.ausgang-unbekannt DER-33-07 a save without HTTP answer shows "Ausgang unbekannt, bitte neu laden." without button and locks every further write', async () => {
    const { sent } = mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    await openPage();

    rename('Laptop');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(nameInput().value).toBe('Laptop');
    expect(saveButton().disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Geräteart anlegen' }).disabled,
    ).toBe(true);
    fireEvent.click(saveButton());
    expect(sent).toHaveLength(1);
    expectAccessibleForm();
  });
});
