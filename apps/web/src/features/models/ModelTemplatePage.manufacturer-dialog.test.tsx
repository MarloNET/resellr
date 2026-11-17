import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of dialog UI-008 opened from UI-007 (CU-115, CU-114; #179) with a mocked
// `fetch` (Technical Specification 2.4 "Hersteller neu", 6.1, 6.2). A file of its own, because
// the lock after an unknown outcome (CU-049) lasts per test file.

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const NOTEBOOK = { id: 1, name: 'Notebook', active: true, version: 1, attributeCount: 0 };

const manufacturer = (id: number, name: string, active = true) => ({
  id,
  name,
  active,
  gpsrComplete: false,
  gpsrMissing: ['legalName', 'street', 'postalCode', 'city', 'country', 'contact'],
  gpsr: {},
  version: 1,
});
const LENOVO = manufacturer(11, 'Lenovo');
const FUJITSU = manufacturer(13, 'Fujitsu');

const CREATED_TEMPLATE = {
  id: 7,
  deviceTypeId: 1,
  manufacturerId: 13,
  modelName: 'Lifebook E5510',
  typeDesignation: null,
  mpn: null,
  mpnUnknown: true,
  originalEan: null,
  modelValues: {},
  defaultDeviceValues: {},
  version: 1,
  createdAt: '2026-11-16T10:00:00.000Z',
  updatedAt: '2026-11-16T10:00:00.000Z',
};

const CREATED_HINT =
  'Hersteller angelegt. GPSR-Herstellerangaben fehlen noch; ohne sie ist keine Freigabe möglich.';

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = () => Promise<Response> | Response;

/**
 * `fetch` of UI-007: the frame status, the device types without attributes, the manufacturers (Lenovo, plus each
 * one created by `create`), `POST /api/manufacturers` from `create` and
 * `POST /api/model-templates`. Records the bodies of the writes.
 */
function mockApi({ create }: { create?: Route } = {}) {
  const items = [LENOVO];
  const sent: { path: string; body: unknown }[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://127.0.0.1');
    const method = init?.method ?? 'GET';
    if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
    if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
    if (url.pathname === '/api/device-types') {
      return Response.json({ items: [NOTEBOOK], total: 1 });
    }
    // The notebook has no attributes here (#178), so no attribute fields appear.
    if (url.pathname === '/api/device-types/1/attributes' || url.pathname === '/api/pick-lists') {
      return Response.json({ items: [], total: 0 });
    }
    if (method === 'GET' && url.pathname === '/api/manufacturers') {
      return Response.json({ items, total: items.length });
    }
    if (method === 'GET' && url.pathname === '/api/model-templates') {
      return Response.json({ items: [], total: 0 });
    }
    if (method === 'POST' && url.pathname === '/api/manufacturers' && create) {
      sent.push({ path: url.pathname, body: JSON.parse(String(init?.body)) });
      const response = await create();
      if (response.ok) {
        const created = (await response.clone().json()) as typeof FUJITSU & { existing: boolean };
        if (!created.existing) items.push(manufacturer(created.id, created.name));
      }
      return response;
    }
    if (method === 'POST' && url.pathname === '/api/model-templates') {
      sent.push({ path: url.pathname, body: JSON.parse(String(init?.body)) });
      return Response.json(CREATED_TEMPLATE, { status: 201 });
    }
    throw new Error(`unexpected request ${method} ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent };
}

const created =
  (body: object, existing = false) =>
  () =>
    Response.json({ ...body, existing }, { status: existing ? 200 : 201 });

async function openPage() {
  const router = createMemoryRouter(routes, { initialEntries: ['/modelle', '/modelle/neu'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('form', { name: 'Modellvorlage anlegen' });
  return router;
}

// Behind the open dialog the page is hidden from the accessibility tree (`aria-hidden`).
const form = () => screen.getByRole('form', { name: 'Modellvorlage anlegen', hidden: true });
const manufacturerSelect = () =>
  within(form()).getByRole<HTMLSelectElement>('combobox', { name: /^Hersteller/, hidden: true });
const shownManufacturer = () => manufacturerSelect().selectedOptions[0]?.text ?? null;
const newManufacturerButton = () =>
  within(form()).getByRole<HTMLButtonElement>('button', {
    name: 'Neuen Hersteller anlegen',
    hidden: true,
  });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Modellvorlage speichern', hidden: true });

const dialog = () => screen.getByRole('dialog', { name: 'Hersteller anlegen' });
const nameInput = () =>
  within(dialog()).getByRole<HTMLInputElement>('textbox', { name: /^Name des Herstellers/ });
const createButton = () =>
  within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Hersteller anlegen' });
const cancelButton = () =>
  within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Abbrechen' });

/** Opens UI-008 with "Neuen Hersteller anlegen". */
function openDialog() {
  fireEvent.click(newManufacturerButton());
  return dialog();
}

function create(name: string) {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.click(createButton());
}

/** Accessibility assertion of a dialog state: named dialog and controls, linked field error. */
function expectAccessibleDialog() {
  expect(dialog().getAttribute('aria-labelledby')).toBeTruthy();
  expect(nameInput().getAttribute('aria-required')).toBe('true');
  expect(document.querySelector(`label[for="${nameInput().id}"]`)?.textContent).toBeTruthy();
  if (nameInput().getAttribute('aria-invalid') === 'true') {
    const describedBy = nameInput().getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
  }
  for (const button of within(dialog()).getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UI-008 manufacturer dialog opened from UI-007 (CU-115, CU-114)', () => {
  it('UI-008.default DER-50-06 "Neuen Hersteller anlegen" opens the dialog with the focus in "Name des Herstellers"', async () => {
    mockApi();
    await openPage();

    openDialog();

    expect(document.activeElement).toBe(nameInput());
    expect(nameInput().value).toBe('');
    expect(createButton().disabled).toBe(false);
    expect(cancelButton().disabled).toBe(false);
    expectAccessibleDialog();
  });

  it('UI-008.success DER-50-06 Enter creates the manufacturer, it is chosen in UI-007 and the hint links to UI-031', async () => {
    const { sent } = mockApi({ create: created(FUJITSU) });
    await openPage();
    openDialog();

    fireEvent.change(nameInput(), { target: { value: ' Fujitsu ' } });
    fireEvent.submit(nameInput());

    const hint = await screen.findByRole('note');
    expect(hint.textContent).toBe(CREATED_HINT);
    expect(
      within(hint).getByRole('link', { name: 'GPSR-Herstellerangaben' }).getAttribute('href'),
    ).toBe('/einstellungen/hersteller');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent).toEqual([{ path: '/api/manufacturers', body: { name: ' Fujitsu ' } }]);
    expect(shownManufacturer()).toBe('Fujitsu');
    expect(manufacturerSelect().getAttribute('aria-invalid')).not.toBe('true');
  });

  it('UI-008.success DER-50-06 the model template is saved with the new manufacturer', async () => {
    const { sent } = mockApi({ create: created(FUJITSU) });
    const router = await openPage();
    openDialog();
    create('Fujitsu');
    await screen.findByRole('note');

    fireEvent.change(within(form()).getByRole('combobox', { name: /^Geräteart/ }), {
      target: { value: '1' },
    });
    // Saving waits for the attributes of the device type (#178).
    await vi.waitFor(() =>
      expect(within(form()).getByRole('group', { name: 'Merkmale Ebene Modell' })).toBeTruthy(),
    );
    fireEvent.change(within(form()).getByRole('textbox', { name: /^Modellbezeichnung/ }), {
      target: { value: 'Lifebook E5510' },
    });
    fireEvent.click(within(form()).getByRole('checkbox', { name: 'unbekannt' }));
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/modelle'));
    expect(sent[1]).toEqual({
      path: '/api/model-templates',
      body: expect.objectContaining({ manufacturerId: 13, modelName: 'Lifebook E5510' }) as unknown,
    });
  });

  it('UI-008.success DER-50-06 the hint goes when another manufacturer is chosen', async () => {
    mockApi({ create: created(FUJITSU) });
    await openPage();
    openDialog();
    create('Fujitsu');
    await screen.findByRole('note');

    fireEvent.change(manufacturerSelect(), { target: { value: '11' } });

    expect(screen.queryByRole('note')).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['51 characters long', 'x'.repeat(51)],
  ])(
    'UI-008.validation DER-50-07 a %s name shows "Name: 1 bis 50 Zeichen" and creates nothing',
    async (_case, name) => {
      const { sent } = mockApi();
      await openPage();
      openDialog();

      create(name);

      expect(nameInput().getAttribute('aria-invalid')).toBe('true');
      expect(dialog().textContent).toContain('Name: 1 bis 50 Zeichen');
      expect(document.activeElement).toBe(nameInput());
      expect(sent).toEqual([]);
      expect(shownManufacturer()).toBe('Bitte wählen');
      expectAccessibleDialog();
    },
  );

  it('UI-008.validation DER-50-07 an existing name shows "<Name> gibt es bereits und wird verwendet" and the existing manufacturer is chosen in UI-007', async () => {
    const { sent } = mockApi({ create: created(LENOVO, true) });
    await openPage();
    openDialog();

    create('lenovo');

    const hint = await within(dialog()).findByRole('status');
    expect(hint.textContent).toBe('Lenovo gibt es bereits und wird verwendet');
    expect(sent).toHaveLength(1);
    expect(shownManufacturer()).toBe('Lenovo');
    expectAccessibleDialog();

    fireEvent.click(cancelButton());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(shownManufacturer()).toBe('Lenovo');
    expect(optionCount('Lenovo')).toBe(1);
    // Nothing was created, so the hint about the GPSR details does not appear.
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('UI-008.validation DER-50-07 a deactivated manufacturer shows "Hersteller Toshiba ist deaktiviert" at the field and chooses nothing', async () => {
    mockApi({
      create: () =>
        Response.json(
          errorBody('manufacturer_deactivated', { message: 'Hersteller Toshiba ist deaktiviert' }),
          { status: 422 },
        ),
    });
    await openPage();
    openDialog();

    create('toshiba');

    await vi.waitFor(() => expect(nameInput().getAttribute('aria-invalid')).toBe('true'));
    expect(dialog().textContent).toContain('Hersteller Toshiba ist deaktiviert');
    expect(document.activeElement).toBe(nameInput());
    expect(nameInput().value).toBe('toshiba');
    expect(shownManufacturer()).toBe('Bitte wählen');
    expectAccessibleDialog();
  });

  it('UI-008.error DER-50-08 shows "Hersteller konnte nicht angelegt werden. Referenz: <Nr>" on 500 and keeps the input', async () => {
    mockApi({
      create: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openPage();
    openDialog();

    create('Fujitsu');

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain(
      'Hersteller konnte nicht angelegt werden. Referenz: R-7K2M-9QX4',
    );
    expect(nameInput().value).toBe('Fujitsu');
    expect(shownManufacturer()).toBe('Bitte wählen');
    expectAccessibleDialog();
  });

  it('UI-008.conflict DER-50-16 (a) shows P-05 with "Neu laden" on 409 version_conflict, saves nothing and keeps the input', async () => {
    mockApi({ create: () => Response.json(errorBody('version_conflict'), { status: 409 }) });
    await openPage();
    openDialog();

    create('Fujitsu');

    const banner = await within(dialog()).findByRole('alert');
    expect(within(banner).getByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(nameInput().value).toBe('Fujitsu');
    expect(shownManufacturer()).toBe('Bitte wählen');
    expectAccessibleDialog();
  });

  it('UI-008.wird-beendet DER-50-16 (b) shows P-07 without reference number on 503 shutting_down and keeps the input', async () => {
    mockApi({
      create: () =>
        Response.json(errorBody('shutting_down', { referenceNumber: 'R-7K2M-9QX5' }), {
          status: 503,
        }),
    });
    await openPage();
    openDialog();

    create('Fujitsu');

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(banner.textContent).not.toContain('Referenz');
    expect(nameInput().value).toBe('Fujitsu');
    expect(shownManufacturer()).toBe('Bitte wählen');
    expectAccessibleDialog();
  });

  it('"Abbrechen" and Esc close the dialog without a write and lead back to UI-007', async () => {
    const { sent } = mockApi();
    await openPage();
    openDialog();

    fireEvent.change(nameInput(), { target: { value: 'Fujitsu' } });
    fireEvent.click(cancelButton());
    expect(screen.queryByRole('dialog')).toBeNull();

    openDialog();
    // Each opening starts empty.
    expect(nameInput().value).toBe('');
    fireEvent.keyDown(nameInput(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent).toEqual([]);
    expect(screen.getByRole('form', { name: 'Modellvorlage anlegen' })).toBeTruthy();
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-008.ausgang-unbekannt DER-50-09 shows "Ausgang unbekannt, bitte neu laden." without button, keeps the input and locks every write of the page', async () => {
    const { sent } = mockApi({
      create: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await openPage();
    openDialog();

    create('Fujitsu');

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(nameInput().value).toBe('Fujitsu');
    expect(createButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    fireEvent.keyDown(nameInput(), { key: 'Escape' });
    expect(dialog()).toBeTruthy();
    fireEvent.click(createButton());
    expect(saveButton().disabled).toBe(true);
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(sent).toHaveLength(1);
    expectAccessibleDialog();
  });
});

function optionCount(name: string) {
  return Array.from(manufacturerSelect().options).filter(({ text }) => text === name).length;
}
