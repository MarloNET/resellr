import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of UI-007 for a new model template (CU-114) with a mocked `fetch`
// (Technical Specification 6.1, 6.2).

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const NOTEBOOK = { id: 1, name: 'Notebook', active: true, version: 1, attributeCount: 0 };
const DRUCKER = { id: 2, name: 'Drucker', active: false, version: 1, attributeCount: 0 };
const TABLET = { id: 3, name: 'Tablet', active: true, version: 1, attributeCount: 0 };

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
const TOSHIBA = manufacturer(12, 'Toshiba', false);

const POST = 'POST /api/model-templates';

const CREATED = {
  id: 7,
  deviceTypeId: 1,
  manufacturerId: 11,
  modelName: 'ThinkPad E15 Gen 2',
  typeDesignation: null,
  mpn: '20TD002MGE',
  mpnUnknown: false,
  originalEan: null,
  modelValues: {},
  defaultDeviceValues: {},
  version: 1,
  createdAt: '2026-11-15T10:00:00.000Z',
  updatedAt: '2026-11-15T10:00:00.000Z',
};

const MPN_REQUIRED = 'Herstellernummer: Wert eingeben oder ‚unbekannt‘ wählen';
const MPN_TOO_LONG = 'Herstellernummer: höchstens 40 Zeichen';
const MPN_INVALID = 'Herstellernummer: nur Buchstaben, Ziffern und die Zeichen - / . erlaubt';
const EAN_RULE = 'EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer';

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame, the device types and manufacturers
 * for the choices, the list of UI-006 after the return and `POST /api/model-templates`. Records
 * the bodies of the writes.
 */
function mockApi({
  create = () => Response.json(CREATED, { status: 201 }),
  deviceTypes = () => Response.json({ items: [NOTEBOOK, DRUCKER, TABLET], total: 3 }),
  manufacturers = () => Response.json({ items: [LENOVO, TOSHIBA], total: 2 }),
}: { create?: Route; deviceTypes?: Route; manufacturers?: Route } = {}) {
  const sent: unknown[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://127.0.0.1');
    const method = init?.method ?? 'GET';
    if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
    if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
    if (url.pathname === '/api/device-types') return deviceTypes(init);
    if (url.pathname === '/api/manufacturers') return manufacturers(init);
    if (method === 'GET' && url.pathname === '/api/model-templates') {
      return Response.json({ items: [], total: 0 });
    }
    if (`${method} ${url.pathname}` === POST) {
      sent.push(JSON.parse(String(init?.body)));
      return create(init);
    }
    throw new Error(`unexpected request ${method} ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent };
}

function renderPage() {
  const router = createMemoryRouter(routes, { initialEntries: ['/modelle', '/modelle/neu'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const form = () => screen.getByRole('form', { name: 'Modellvorlage anlegen' });
const select = (name: string) =>
  within(form()).getByRole<HTMLSelectElement>('combobox', { name: new RegExp(`^${name}`) });
const textbox = (name: string) =>
  within(form()).getByRole<HTMLInputElement>('textbox', { name: new RegExp(`^${name}`) });
const unknownBox = () =>
  within(form()).getByRole<HTMLInputElement>('checkbox', { name: 'unbekannt' });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', {
    name: /^(Modellvorlage speichern|Speichern …)$/,
  });
const cancelButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Abbrechen' });

/** The text below a field, linked with `aria-describedby` (CU-057). */
function errorOf(control: HTMLElement): string | null {
  const id = control.getAttribute('aria-describedby');
  return id === null ? null : (document.getElementById(id)?.textContent ?? null);
}

const pending = () => new Promise<Response>(() => {});

async function openPage() {
  const router = renderPage();
  await screen.findByRole('form', { name: 'Modellvorlage anlegen' });
  return router;
}

function fill({
  manufacturerId = '11',
  modelName = 'ThinkPad E15 Gen 2',
  typeDesignation = '',
  mpn = '20TD002MGE',
  originalEan = '',
} = {}) {
  fireEvent.change(select('Hersteller'), { target: { value: manufacturerId } });
  fireEvent.change(textbox('Modellbezeichnung'), { target: { value: modelName } });
  fireEvent.change(textbox('Typbezeichnung'), { target: { value: typeDesignation } });
  fireEvent.change(textbox('Herstellernummer'), { target: { value: mpn } });
  fireEvent.change(textbox('Original-EAN'), { target: { value: originalEan } });
}

/** Accessibility assertion of a state: heading, named controls, linked field errors. */
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Modellvorlage anlegen' })).toBeTruthy();
  for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
    expect(control.textContent?.trim() || control.getAttribute('aria-label')).toBeTruthy();
  }
  if (screen.queryByRole('form', { name: 'Modellvorlage anlegen' }) === null) return;
  for (const control of [
    ...within(form()).getAllByRole('combobox'),
    ...within(form()).getAllByRole('textbox'),
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

describe('UI-007 Modellvorlage anlegen (CU-114)', () => {
  it('UI-007.loading shows "Lade Modellvorlage …" while the choices load', async () => {
    mockApi({ deviceTypes: pending });
    renderPage();

    expect(await screen.findByText('Lade Modellvorlage …')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('UI-007.default shows the empty form with the active device types and manufacturers, required marks and both actions', async () => {
    mockApi();
    await openPage();

    expect(screen.getByRole('link', { name: /Zurück zur Modell-Bibliothek/ })).toBeTruthy();
    expect(within(form()).getByRole('heading', { level: 2, name: 'Modelldaten' })).toBeTruthy();
    expect(Array.from(select('Geräteart').options, (option) => option.text)).toEqual([
      'Notebook',
      'Tablet',
    ]);
    expect(select('Geräteart').value).toBe('1');
    expect(Array.from(select('Hersteller').options, (option) => option.text)).toEqual([
      '',
      'Lenovo',
    ]);
    for (const name of ['Geräteart', 'Hersteller']) {
      expect(select(name).getAttribute('aria-required')).toBe('true');
    }
    for (const name of ['Modellbezeichnung', 'Herstellernummer']) {
      expect(textbox(name).getAttribute('aria-required')).toBe('true');
    }
    expect(textbox('Typbezeichnung').getAttribute('aria-required')).toBeNull();
    expect(textbox('Original-EAN').getAttribute('aria-required')).toBeNull();
    expect(unknownBox().checked).toBe(false);
    expect(saveButton().disabled).toBe(false);
    expect(cancelButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it('AC-REQ-008-01 sends the model template with all fields to POST /api/model-templates', async () => {
    const { sent } = mockApi();
    await openPage();

    fill({ typeDesignation: '20TD', originalEan: '2000000177007' });
    fireEvent.change(select('Geräteart'), { target: { value: '3' } });
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      deviceTypeId: 3,
      manufacturerId: 11,
      modelName: 'ThinkPad E15 Gen 2',
      typeDesignation: '20TD',
      mpn: '20TD002MGE',
      mpnUnknown: false,
      originalEan: '2000000177007',
    });
  });

  it('AC-REQ-008-03 "unbekannt" empties and locks the MPN field and sends mpn null', async () => {
    const { sent } = mockApi();
    await openPage();
    fill({ mpn: 'ABC' });

    fireEvent.click(unknownBox());

    expect(textbox('Herstellernummer').value).toBe('');
    expect(textbox('Herstellernummer').disabled).toBe(true);
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ mpn: null, mpnUnknown: true });
  });

  it('UI-007.speichert DER-50-01 locks the save button and every input and shows "Speichern …" while the answer is pending', async () => {
    mockApi({ create: pending });
    await openPage();
    fill();

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(saveButton().textContent).toBe('Speichern …'));
    expect(saveButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    for (const control of [
      ...within(form()).getAllByRole<HTMLInputElement>('combobox'),
      ...within(form()).getAllByRole<HTMLInputElement>('textbox'),
      unknownBox(),
    ]) {
      expect(control.disabled).toBe(true);
    }
    expectAccessiblePage();
  });

  it('UI-007.speichert DER-50-01 has no time limit for the answer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({ create: pending });
    await openPage();
    fill();
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(saveButton().textContent).toBe('Speichern …'));

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(saveButton().textContent).toBe('Speichern …');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-007.success DER-50-02 returns to UI-006 and shows the banner "Modellvorlage gespeichert"', async () => {
    mockApi();
    const router = await openPage();
    fill();

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/modelle'));
    expect(screen.getByRole('heading', { level: 1, name: 'Modell-Bibliothek' })).toBeTruthy();
    expect(await screen.findByText('Modellvorlage gespeichert')).toBeTruthy();
    // The banner comes once: the history entry no longer carries it.
    expect(router.state.location.state).toBeNull();
  });

  it('UI-007.error DER-50-03 shows the banner with the reference number on 500 and keeps the inputs', async () => {
    mockApi({
      create: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openPage();
    fill();

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Modellvorlage konnte nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(textbox('Modellbezeichnung').value).toBe('ThinkPad E15 Gen 2');
    expect(textbox('Herstellernummer').value).toBe('20TD002MGE');
    expect(saveButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it('UI-007.validation DER-50-04 shows "Modellbezeichnung: 1 bis 100 Zeichen" at the field with the focus on the first error, and sends nothing', async () => {
    const { sent } = mockApi();
    await openPage();
    fill({ modelName: '' });

    fireEvent.click(saveButton());

    await vi.waitFor(() =>
      expect(errorOf(textbox('Modellbezeichnung'))).toBe('Modellbezeichnung: 1 bis 100 Zeichen'),
    );
    expect(document.activeElement).toBe(textbox('Modellbezeichnung'));
    expect(sent).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-007.validation DER-50-05 shows "Hersteller fehlt" without a chosen manufacturer, with the focus there', async () => {
    const { sent } = mockApi();
    await openPage();
    fill({ manufacturerId: '', modelName: '' });

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(select('Hersteller'))).toBe('Hersteller fehlt'));
    expect(errorOf(textbox('Modellbezeichnung'))).toBe('Modellbezeichnung: 1 bis 100 Zeichen');
    expect(document.activeElement).toBe(select('Hersteller'));
    expect(sent).toEqual([]);
  });

  it('UI-007.validation DER-50-13 shows "Typbezeichnung: höchstens 50 Zeichen" for more than 50 characters', async () => {
    const { sent } = mockApi();
    await openPage();
    fill({ typeDesignation: 'T'.repeat(51) });

    fireEvent.click(saveButton());

    await vi.waitFor(() =>
      expect(errorOf(textbox('Typbezeichnung'))).toBe('Typbezeichnung: höchstens 50 Zeichen'),
    );
    expect(sent).toEqual([]);
  });

  it.each(['0194252146836', '1234567', '12345678901', '4006381A3393'])(
    'UI-007.validation DER-50-14 shows the EAN rule for the original EAN "%s"',
    async (originalEan) => {
      const { sent } = mockApi();
      await openPage();
      fill({ originalEan });

      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(errorOf(textbox('Original-EAN'))).toBe(EAN_RULE));
      expect(document.activeElement).toBe(textbox('Original-EAN'));
      expect(sent).toEqual([]);
    },
  );

  it.each([
    ['empty', '', MPN_REQUIRED],
    ['over 40 characters', 'A'.repeat(41), MPN_TOO_LONG],
    ['with an invalid character', 'ABC#123', MPN_INVALID],
    ['with 45 characters and "#"', `${'A'.repeat(20)}#${'B'.repeat(24)}`, MPN_TOO_LONG],
  ])(
    'UI-007.validation DER-50-17 shows exactly one message at the MPN %s, with the focus there',
    async (_case, mpn, message) => {
      const { sent } = mockApi();
      await openPage();
      fill({ mpn });

      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(errorOf(textbox('Herstellernummer'))).toBe(message));
      expect(document.activeElement).toBe(textbox('Herstellernummer'));
      expect(screen.queryAllByText(/^Herstellernummer:/)).toHaveLength(1);
      expect(sent).toEqual([]);
      expectAccessiblePage();
    },
  );

  it('UI-007.validation DER-50-17 checks the MPN on leaving the field with the same rule', async () => {
    mockApi();
    await openPage();
    fill({ mpn: 'ÄB-12' });

    fireEvent.blur(textbox('Herstellernummer'));

    await vi.waitFor(() => expect(errorOf(textbox('Herstellernummer'))).toBe(MPN_INVALID));
    fireEvent.change(textbox('Herstellernummer'), { target: { value: ' 20TD002MGE ' } });
    fireEvent.blur(textbox('Herstellernummer'));
    await vi.waitFor(() => expect(errorOf(textbox('Herstellernummer'))).toBeNull());
  });

  it('UI-007.validation DER-50-17 sends a valid MPN with spaces at the edges, the server stores it trimmed', async () => {
    const { sent } = mockApi();
    await openPage();
    fill({ mpn: ' 20TD002MGE ' });

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ mpn: ' 20TD002MGE ' });
  });

  it('UI-007.validation shows the field errors of 422 validation_failed at the fields, focus on the first', async () => {
    mockApi({
      create: () =>
        Response.json(
          errorBody('validation_failed', {
            fields: [
              { path: 'mpn', code: 'mpn_too_long', message: MPN_TOO_LONG },
              { path: 'originalEan', code: 'custom', message: EAN_RULE },
            ],
          }),
          { status: 422 },
        ),
    });
    await openPage();
    fill();

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(textbox('Herstellernummer'))).toBe(MPN_TOO_LONG));
    expect(errorOf(textbox('Original-EAN'))).toBe(EAN_RULE);
    expect(document.activeElement).toBe(textbox('Herstellernummer'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('UI-007.validation deactivated device type or manufacturer (2.4, 2.0.11, Nachtrag MAR-904)', () => {
    /** A list answer: the first call with `before`, every later one with `after`. */
    const firstThen = (before: unknown[], after: unknown[]) => {
      let calls = 0;
      return () => {
        calls += 1;
        const items = calls === 1 ? before : after;
        return Response.json({ items, total: items.length });
      };
    };

    it('T5 AC-REQ-004-03 shows device_type_deactivated at "Geräteart" with the focus there and reloads the choice without it', async () => {
      const deviceTypes = vi.fn(
        firstThen([NOTEBOOK, TABLET], [{ ...NOTEBOOK, active: false }, TABLET]),
      );
      const manufacturers = vi.fn(firstThen([LENOVO], [LENOVO]));
      const { sent } = mockApi({
        deviceTypes,
        manufacturers,
        create: () =>
          Response.json(
            errorBody('device_type_deactivated', {
              message: 'Geräteart Notebook ist deaktiviert',
              details: { path: 'deviceTypeId', id: 1 },
            }),
            { status: 422 },
          ),
      });
      await openPage();
      fill();

      fireEvent.click(saveButton());

      await vi.waitFor(() =>
        expect(errorOf(select('Geräteart'))).toBe('Geräteart Notebook ist deaktiviert'),
      );
      expect(document.activeElement).toBe(select('Geräteart'));
      await vi.waitFor(() =>
        expect(Array.from(select('Geräteart').options, (option) => option.text)).toEqual([
          'Tablet',
        ]),
      );
      expect(manufacturers).toHaveBeenCalledTimes(2);
      expect(sent).toHaveLength(1);
      expect(textbox('Modellbezeichnung').value).toBe('ThinkPad E15 Gen 2');
      expect(screen.queryByRole('alert')).toBeNull();
      expectAccessiblePage();
    });

    it('T5 AC-REQ-101-02 shows manufacturer_deactivated at "Hersteller" with the focus there and reloads the choice without it', async () => {
      const deviceTypes = vi.fn(firstThen([NOTEBOOK], [NOTEBOOK]));
      const manufacturers = vi.fn(
        firstThen(
          [LENOVO, manufacturer(13, 'Fujitsu')],
          [LENOVO, manufacturer(13, 'Fujitsu', false)],
        ),
      );
      mockApi({
        deviceTypes,
        manufacturers,
        create: () =>
          Response.json(
            errorBody('manufacturer_deactivated', {
              message: 'Hersteller Fujitsu ist deaktiviert',
              details: { path: 'manufacturerId', id: 13 },
            }),
            { status: 422 },
          ),
      });
      await openPage();
      fill({ manufacturerId: '13' });

      fireEvent.click(saveButton());

      await vi.waitFor(() =>
        expect(errorOf(select('Hersteller'))).toBe('Hersteller Fujitsu ist deaktiviert'),
      );
      expect(document.activeElement).toBe(select('Hersteller'));
      await vi.waitFor(() =>
        expect(Array.from(select('Hersteller').options, (option) => option.text)).toEqual([
          '',
          'Lenovo',
        ]),
      );
      expect(deviceTypes).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('saves with Ctrl+S like the primary button', async () => {
    const { sent } = mockApi();
    await openPage();
    fill();

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await vi.waitFor(() => expect(sent).toHaveLength(1));
  });

  it('"Abbrechen" discards the inputs and returns to UI-006 without saving', async () => {
    const { sent } = mockApi();
    const router = await openPage();
    fill();

    fireEvent.click(cancelButton());

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/modelle'));
    expect(screen.queryByText('Modellvorlage gespeichert')).toBeNull();
    expect(sent).toEqual([]);
  });

  it('UI-007.unreachable DER-50-15 (a) shows P-06 with "Erneut versuchen" when the device types get no answer, without replacing the page', async () => {
    mockApi({
      deviceTypes: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Modellvorlage anlegen' })).toBeTruthy();
    expectAccessiblePage();
  });

  it('UI-007.unreachable DER-50-15 (a) shows P-06 when the device types take longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      deviceTypes: (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    renderPage();
    await screen.findByText('Lade Modellvorlage …');

    await act(() => vi.advanceTimersByTimeAsync(5000));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
  });

  it('UI-007.wird-beendet DER-50-15 (b) shows P-07 without reference number on 503 shutting_down and keeps the inputs', async () => {
    mockApi({
      create: () =>
        Response.json(errorBody('shutting_down', { referenceNumber: 'R-7K2M-9QX5' }), {
          status: 503,
        }),
    });
    await openPage();
    fill();

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-/);
    expect(textbox('Modellbezeichnung').value).toBe('ThinkPad E15 Gen 2');
    expectAccessiblePage();
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-007.ausgang-unbekannt DER-50-12 shows "Ausgang unbekannt, bitte neu laden." without button after a lost connection, keeps the inputs and locks the save', async () => {
    const { sent } = mockApi({
      create: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await openPage();
    fill();

    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(textbox('Modellbezeichnung').value).toBe('ThinkPad E15 Gen 2');
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(sent).toHaveLength(1);
    expectAccessiblePage();
  });
});
