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

const PLACEHOLDER = 'Bitte wählen';
const optionTexts = (control: HTMLSelectElement) => Array.from(control.options, ({ text }) => text);
/** The text the field shows: the selected option. */
const shownText = (control: HTMLSelectElement) => control.selectedOptions[0]?.text ?? null;

async function openPage() {
  const router = renderPage();
  await screen.findByRole('form', { name: 'Modellvorlage anlegen' });
  return router;
}

function fill({
  deviceTypeId = '1',
  manufacturerId = '11',
  modelName = 'ThinkPad E15 Gen 2',
  typeDesignation = '',
  mpn = '20TD002MGE',
  originalEan = '',
} = {}) {
  fireEvent.change(select('Geräteart'), { target: { value: deviceTypeId } });
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

  it('UI-007.default T5a shows the empty form with "Bitte wählen" in device type and manufacturer, the active entries, required marks and both actions', async () => {
    mockApi();
    await openPage();

    expect(screen.getByRole('link', { name: /Zurück zur Modell-Bibliothek/ })).toBeTruthy();
    expect(within(form()).getByRole('heading', { level: 2, name: 'Modelldaten' })).toBeTruthy();
    expect(optionTexts(select('Geräteart'))).toEqual([PLACEHOLDER, 'Notebook', 'Tablet']);
    expect(optionTexts(select('Hersteller'))).toEqual([PLACEHOLDER, 'Lenovo']);
    for (const name of ['Geräteart', 'Hersteller']) {
      // Nothing is chosen in advance, and the placeholder cannot be chosen (Design v0.6.7).
      expect(select(name).value).toBe('');
      expect(shownText(select(name))).toBe(PLACEHOLDER);
      expect(select(name).options[0]?.disabled).toBe(true);
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

  it('UI-007.validation shows "Geräteart fehlt" without a chosen device type, with the focus there, and sends nothing (Nachtrag MAR-925)', async () => {
    const { sent } = mockApi();
    await openPage();
    fill({ deviceTypeId: '', manufacturerId: '' });

    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(errorOf(select('Geräteart'))).toBe('Geräteart fehlt'));
    expect(errorOf(select('Hersteller'))).toBe('Hersteller fehlt');
    expect(document.activeElement).toBe(select('Geräteart'));
    expect(sent).toEqual([]);
    expectAccessiblePage();
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

  describe('UI-007.validation deactivated device type or manufacturer (2.4, 2.0.11, Nachträge MAR-904, MAR-925)', () => {
    /** A list answer: the first call with `before`, every later one with `after`. */
    const firstThen = (before: unknown[], after: unknown[]) => {
      let calls = 0;
      return () => {
        calls += 1;
        const items = calls === 1 ? before : after;
        return Response.json({ items, total: items.length });
      };
    };

    /** A list answer: the first call with `items`, every later one fails with 500. */
    const firstThenFail = (items: unknown[]) => {
      let calls = 0;
      return () => {
        calls += 1;
        return calls === 1
          ? Response.json({ items, total: items.length })
          : Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX6' }), {
              status: 500,
            });
      };
    };

    const rejectOnce = (code: string, message: string, path: string, id: number) => {
      let calls = 0;
      return () => {
        calls += 1;
        return calls === 1
          ? Response.json(errorBody(code, { message, details: { path, id } }), { status: 422 })
          : Response.json(CREATED, { status: 201 });
      };
    };

    const NOTEBOOK_DEACTIVATED = 'Geräteart Notebook ist deaktiviert';
    const FUJITSU = manufacturer(13, 'Fujitsu');
    const FUJITSU_DEACTIVATED = 'Hersteller Fujitsu ist deaktiviert';

    it('AC-REQ-004-03 DER-50-18 T5 T5b shows device_type_deactivated at "Geräteart" with the focus there, reloads the choice without it and shows "Bitte wählen"', async () => {
      const deviceTypes = vi.fn(
        firstThen([NOTEBOOK, TABLET], [{ ...NOTEBOOK, active: false }, TABLET]),
      );
      const manufacturers = vi.fn(firstThen([LENOVO], [LENOVO]));
      const { sent } = mockApi({
        deviceTypes,
        manufacturers,
        create: rejectOnce('device_type_deactivated', NOTEBOOK_DEACTIVATED, 'deviceTypeId', 1),
      });
      await openPage();
      fill();

      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(errorOf(select('Geräteart'))).toBe(NOTEBOOK_DEACTIVATED));
      expect(document.activeElement).toBe(select('Geräteart'));
      await vi.waitFor(() =>
        expect(optionTexts(select('Geräteart'))).toEqual([PLACEHOLDER, 'Tablet']),
      );
      expect(manufacturers).toHaveBeenCalledTimes(2);
      // The field shows what it would send: nothing (FIND-397-04).
      expect(select('Geräteart').value).toBe('');
      expect(shownText(select('Geräteart'))).toBe(PLACEHOLDER);
      expect(screen.queryByRole('alert')).toBeNull();
      expectAccessiblePage();

      // The text stays when the field is left without a choice.
      fireEvent.blur(select('Geräteart'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(errorOf(select('Geräteart'))).toBe(NOTEBOOK_DEACTIVATED);

      // Saving without a choice sends nothing and shows the required rule instead.
      fireEvent.click(saveButton());
      await vi.waitFor(() => expect(errorOf(select('Geräteart'))).toBe('Geräteart fehlt'));
      expect(document.activeElement).toBe(select('Geräteart'));
      expect(sent).toHaveLength(1);

      // Choosing an active entry removes the text; the save sends the new id, never the rejected.
      fireEvent.change(select('Geräteart'), { target: { value: '3' } });
      expect(errorOf(select('Geräteart'))).toBeNull();
      fireEvent.click(saveButton());
      await vi.waitFor(() => expect(sent).toHaveLength(2));
      expect(sent.map((body) => (body as { deviceTypeId: unknown }).deviceTypeId)).toEqual([1, 3]);
    });

    it('DER-50-18 T5d keeps manufacturer, model name, type designation, MPN "unbekannt" and original EAN after device_type_deactivated', async () => {
      const { sent } = mockApi({
        deviceTypes: firstThen([NOTEBOOK, TABLET], [TABLET]),
        create: rejectOnce('device_type_deactivated', NOTEBOOK_DEACTIVATED, 'deviceTypeId', 1),
      });
      await openPage();
      fill({ typeDesignation: '20TD', originalEan: '2000000177007' });
      fireEvent.click(unknownBox());

      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(select('Geräteart').value).toBe(''));
      expect(select('Hersteller').value).toBe('11');
      expect(textbox('Modellbezeichnung').value).toBe('ThinkPad E15 Gen 2');
      expect(textbox('Typbezeichnung').value).toBe('20TD');
      expect(unknownBox().checked).toBe(true);
      expect(textbox('Original-EAN').value).toBe('2000000177007');

      fireEvent.change(select('Geräteart'), { target: { value: '3' } });
      fireEvent.click(saveButton());
      await vi.waitFor(() => expect(sent).toHaveLength(2));
      expect(sent[1]).toEqual({
        deviceTypeId: 3,
        manufacturerId: 11,
        modelName: 'ThinkPad E15 Gen 2',
        typeDesignation: '20TD',
        mpn: null,
        mpnUnknown: true,
        originalEan: '2000000177007',
      });
    });

    it('AC-REQ-101-02 DER-50-18 T5 T5c shows manufacturer_deactivated at "Hersteller" with the focus there, reloads the choice without it and shows "Bitte wählen"', async () => {
      const deviceTypes = vi.fn(firstThen([NOTEBOOK], [NOTEBOOK]));
      const manufacturers = vi.fn(
        firstThen([LENOVO, FUJITSU], [LENOVO, manufacturer(13, 'Fujitsu', false)]),
      );
      const { sent } = mockApi({
        deviceTypes,
        manufacturers,
        create: rejectOnce('manufacturer_deactivated', FUJITSU_DEACTIVATED, 'manufacturerId', 13),
      });
      await openPage();
      fill({ manufacturerId: '13', typeDesignation: '20TD', originalEan: '2000000177007' });

      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(errorOf(select('Hersteller'))).toBe(FUJITSU_DEACTIVATED));
      expect(document.activeElement).toBe(select('Hersteller'));
      await vi.waitFor(() =>
        expect(optionTexts(select('Hersteller'))).toEqual([PLACEHOLDER, 'Lenovo']),
      );
      expect(deviceTypes).toHaveBeenCalledTimes(2);
      expect(select('Hersteller').value).toBe('');
      expect(shownText(select('Hersteller'))).toBe(PLACEHOLDER);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(select('Geräteart').value).toBe('1');
      expect(textbox('Modellbezeichnung').value).toBe('ThinkPad E15 Gen 2');
      expect(textbox('Typbezeichnung').value).toBe('20TD');
      expect(textbox('Herstellernummer').value).toBe('20TD002MGE');
      expect(textbox('Original-EAN').value).toBe('2000000177007');

      fireEvent.blur(select('Hersteller'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(errorOf(select('Hersteller'))).toBe(FUJITSU_DEACTIVATED);

      fireEvent.click(saveButton());
      await vi.waitFor(() => expect(errorOf(select('Hersteller'))).toBe('Hersteller fehlt'));
      expect(sent).toHaveLength(1);

      fireEvent.change(select('Hersteller'), { target: { value: '11' } });
      expect(errorOf(select('Hersteller'))).toBeNull();
      fireEvent.click(saveButton());
      await vi.waitFor(() => expect(sent).toHaveLength(2));
      expect(sent[1]).toMatchObject({ deviceTypeId: 1, manufacturerId: 11 });
    });

    it.each([
      ['Geräteart', 'device_type_deactivated', NOTEBOOK_DEACTIVATED, 'deviceTypeId', 1],
      ['Hersteller', 'manufacturer_deactivated', FUJITSU_DEACTIVATED, 'manufacturerId', 13],
    ] as const)(
      'DER-50-18 T5e empties "%s" and drops the rejected entry from the choice when reloading fails',
      async (field, code, message, path, id) => {
        const { sent } = mockApi({
          deviceTypes: firstThenFail([NOTEBOOK, TABLET]),
          manufacturers: firstThenFail([LENOVO, FUJITSU]),
          create: rejectOnce(code, message, path, id),
        });
        await openPage();
        fill({ manufacturerId: '13' });

        fireEvent.click(saveButton());

        await vi.waitFor(() => expect(select(field).value).toBe(''));
        expect(errorOf(select(field))).toBe(message);
        expect(Array.from(select(field).options, ({ value }) => value)).not.toContain(String(id));
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(errorOf(select(field))).toMatch(/ fehlt$/));
        expect(sent).toHaveLength(1);
      },
    );

    it('DER-50-18 keeps the entry chosen when it is active again after reloading (Nachtrag MAR-925, verworfen (b))', async () => {
      mockApi({
        deviceTypes: firstThen([NOTEBOOK, TABLET], [NOTEBOOK, TABLET]),
        create: rejectOnce('device_type_deactivated', NOTEBOOK_DEACTIVATED, 'deviceTypeId', 1),
      });
      await openPage();
      fill();

      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(errorOf(select('Geräteart'))).toBe(NOTEBOOK_DEACTIVATED));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(select('Geräteart').value).toBe('1');
      expect(shownText(select('Geräteart'))).toBe('Notebook');
    });

    it.each([
      ['T5g', 'device_type_deactivated', NOTEBOOK_DEACTIVATED, 'deviceTypeId', 1],
      ['T5h', 'manufacturer_deactivated', FUJITSU_DEACTIVATED, 'manufacturerId', 13],
    ] as const)(
      'AC-REQ-004-03 AC-REQ-101-02 DER-50-18 %s empties and marks both fields when both entries are deactivated, %s, focus on "Geräteart" (Nachtrag MAR-952)',
      async (_test, code, message, path, id) => {
        const { sent } = mockApi({
          deviceTypes: firstThen([NOTEBOOK, TABLET], [{ ...NOTEBOOK, active: false }, TABLET]),
          manufacturers: firstThen([LENOVO, FUJITSU], [LENOVO]),
          create: rejectOnce(code, message, path, id),
        });
        await openPage();
        fill({ manufacturerId: '13' });

        fireEvent.click(saveButton());

        await vi.waitFor(() => expect(select('Hersteller').value).toBe(''));
        // Each field shows what it would send: nothing, never another entry (FIND-946-01).
        expect(select('Geräteart').value).toBe('');
        expect(shownText(select('Geräteart'))).toBe(PLACEHOLDER);
        expect(shownText(select('Hersteller'))).toBe(PLACEHOLDER);
        expect(errorOf(select('Geräteart'))).toBe(NOTEBOOK_DEACTIVATED);
        expect(errorOf(select('Hersteller'))).toBe(FUJITSU_DEACTIVATED);
        await vi.waitFor(() => expect(document.activeElement).toBe(select('Geräteart')));
        expectAccessiblePage();

        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(errorOf(select('Geräteart'))).toBe('Geräteart fehlt'));
        expect(errorOf(select('Hersteller'))).toBe('Hersteller fehlt');
        expect(sent).toHaveLength(1);

        fireEvent.change(select('Geräteart'), { target: { value: '3' } });
        fireEvent.change(select('Hersteller'), { target: { value: '11' } });
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(2));
        expect(sent[1]).toMatchObject({ deviceTypeId: 3, manufacturerId: 11 });
      },
    );

    it.each([
      [
        'Geräteart',
        'Hersteller',
        'device_type_deactivated',
        NOTEBOOK_DEACTIVATED,
        'deviceTypeId',
        1,
      ],
      [
        'Hersteller',
        'Geräteart',
        'manufacturer_deactivated',
        FUJITSU_DEACTIVATED,
        'manufacturerId',
        13,
      ],
    ] as const)(
      'DER-50-18 T5i empties only the rejected "%s" when reloading fails, "%s" shows exactly the entry it sends (Nachtrag MAR-952)',
      async (rejected, other, code, message, path, id) => {
        const { sent } = mockApi({
          deviceTypes: firstThenFail([NOTEBOOK, TABLET]),
          manufacturers: firstThenFail([LENOVO, FUJITSU]),
          create: rejectOnce(code, message, path, id),
        });
        await openPage();
        fill({ manufacturerId: '13' });

        fireEvent.click(saveButton());

        await vi.waitFor(() => expect(select(rejected).value).toBe(''));
        await new Promise((resolve) => setTimeout(resolve, 50));
        const kept = { Geräteart: ['1', 'Notebook'], Hersteller: ['13', 'Fujitsu'] }[other];
        expect([select(other).value, shownText(select(other))]).toEqual(kept);
        expect(errorOf(select(other))).toBeNull();

        fireEvent.change(select(rejected), {
          target: { value: rejected === 'Geräteart' ? '3' : '11' },
        });
        fireEvent.click(saveButton());
        await vi.waitFor(() => expect(sent).toHaveLength(2));
        const otherPath = other === 'Geräteart' ? 'deviceTypeId' : 'manufacturerId';
        expect((sent[1] as Record<string, unknown>)[otherPath]).toBe(Number(kept[0]));
      },
    );

    it('DER-50-18 locks the save while the choices are read again after a rejection (FIND-397-06)', async () => {
      let deviceTypeCalls = 0;
      const { sent } = mockApi({
        deviceTypes: () => {
          deviceTypeCalls += 1;
          return deviceTypeCalls === 1
            ? Response.json({ items: [NOTEBOOK, TABLET], total: 2 })
            : pending();
        },
        create: rejectOnce('device_type_deactivated', NOTEBOOK_DEACTIVATED, 'deviceTypeId', 1),
      });
      await openPage();
      fill();

      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(errorOf(select('Geräteart'))).toBe(NOTEBOOK_DEACTIVATED));
      await vi.waitFor(() => expect(deviceTypeCalls).toBe(2));
      expect(saveButton().disabled).toBe(true);
      fireEvent.click(saveButton());
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(sent).toHaveLength(1);
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
