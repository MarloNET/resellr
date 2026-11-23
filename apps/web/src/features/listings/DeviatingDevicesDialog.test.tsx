import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of the dialog `UI-014.abweichung-bestaetigen` (CU-140, #207, REQ-088) as it
// opens over `UI-014.edit` (CU-139) after "Speichern" answers
// `confirmation_required`/`assigned_devices_deviate`, with a mocked `fetch` (Technical
// Specification 6.1, 6.2). P-08 locks every write of the module, so its test comes last.

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const USED = 1;
const CONDITIONS = [{ id: USED, label: 'gebraucht' }].map((entry) => ({
  ...entry,
  active: true,
  batteryPresent: null,
  sortOrder: entry.id,
  version: 1,
}));

/** MI-A of AC-REQ-088-03: visual grade 2, without attributes of the level device. */
const LISTING = {
  id: 9,
  modelTemplateId: 7,
  conditionValueId: USED,
  visualGrade: 2,
  conditionDescription: '',
  variantValues: {},
  otherValues: {},
  deliveryScopeTextBlockIds: [],
  articleNumber: '626198',
  eanMode: 'original',
  ownEan: null,
  displayTitle: 'MacBook Pro 13',
  quantity: 2,
  version: 1,
  stock: { quantity: 2, wiNrs: ['626198', '626199'], batteryText: '', stockHash: 'ab12' },
  prices: [],
  devices: [],
  deliveryScope: [],
};

const OPTIK_NOTE = { key: 'visualGrade', label: 'Optik-Note', deviceValue: '2', listingValue: '3' };

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});
const list = (items: unknown[]) => Response.json({ items, total: items.length });

/** `422 confirmation_required`/`assigned_devices_deviate` for both devices of MI-A. */
const deviating = () =>
  Response.json(
    errorBody('confirmation_required', {
      message: 'Nach dieser Änderung weichen 2 zugeordnete Geräte vom Modell-Inserat ab:',
      details: {
        kind: 'assigned_devices_deviate',
        devices: [
          { wiNr: '626198', deviations: [OPTIK_NOTE] },
          { wiNr: '626199', deviations: [OPTIK_NOTE] },
        ],
      },
    }),
    { status: 422 },
  );

type Route = (body: Record<string, unknown>) => Promise<Response> | Response;

/** The saved model listing as the server answers it, with version 2. */
const saved: Route = ({ confirmDeviatingDevices, ...fields }) => {
  void confirmDeviatingDevices;
  return Response.json({ ...LISTING, ...fields, visualGrade: 3, version: 2 });
};

/**
 * `fetch` of UI-014: the `PATCH` without confirmation answers `assigned_devices_deviate`, the one
 * with `confirmDeviatingDevices: true` answers `confirmed`. Records the bodies of the `PATCH`.
 */
function mockApi({
  confirmed = saved,
  listing = LISTING,
}: { confirmed?: Route; listing?: Record<string, unknown> } = {}) {
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://127.0.0.1');
      const route = `${init?.method ?? 'GET'} ${url.pathname}`;
      if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (route === 'GET /api/listings/9') return Response.json(listing);
      if (route === 'GET /api/pick-lists') {
        return list([{ id: 1, key: 'condition', name: 'Zustand', isBatteryList: false, version: 1 }]);
      }
      if (route === 'GET /api/pick-lists/1/values') return list(CONDITIONS);
      if (route === 'GET /api/text-blocks') return list([]);
      if (route === 'GET /api/channels') return list([]);
      if (route === 'GET /api/device-types') {
        return list([{ id: 1, name: 'Notebook', active: true, version: 1, attributeCount: 0 }]);
      }
      if (route === 'GET /api/model-templates/7') {
        return Response.json({
          id: 7,
          deviceTypeId: 1,
          originalEan: '0194252146835',
          modelValues: {},
          defaultDeviceValues: {},
        });
      }
      if (route === 'GET /api/device-types/1/attributes') return list([]);
      if (route === 'PATCH /api/listings/9') {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        sent.push(body);
        return body.confirmDeviatingDevices === true ? confirmed(body) : deviating();
      }
      throw new Error(`unexpected request ${route}`);
    }),
  );
  return { sent };
}

const DIALOG_NAME = 'Zugeordnete Geräte weichen ab';
const dialog = () => screen.getByRole('dialog', { name: DIALOG_NAME });
const queryDialog = () => screen.queryByRole('dialog', { name: DIALOG_NAME });
// The open modal dialog hides the form from the accessibility tree (`aria-hidden`).
const form = () => screen.getByRole('form', { name: 'Inseratswerte bearbeiten', hidden: true });
const visualGrade = () =>
  within(form()).getByRole<HTMLInputElement>('textbox', { name: /^Optik-Note/, hidden: true });
const dialogButton = (name: string) =>
  within(dialog()).getByRole<HTMLButtonElement>('button', { name });

/** UI-014 of MI-A in `edit` with the visual grade changed to 3 and saved: the dialog is open. */
async function openDialog() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/inserate/9'] })} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
  await screen.findByRole('form', { name: 'Inseratswerte bearbeiten' });
  await vi.waitFor(() =>
    expect(within(form()).getByRole<HTMLSelectElement>('combobox', { name: /^Zustand/ }).value).toBe(
      String(USED),
    ),
  );
  fireEvent.change(visualGrade(), { target: { value: '3' } });
  fireEvent.click(within(form()).getByRole('button', { name: 'Speichern' }));
  await screen.findByRole('dialog', { name: DIALOG_NAME });
}

/** Accessibility assertion: a named modal dialog with description, named table and buttons. */
function expectAccessibleDialog() {
  const element = dialog();
  const describedBy = element.getAttribute('aria-describedby');
  expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
  expect(within(element).getByRole('table', { name: DIALOG_NAME })).toBeTruthy();
  for (const header of within(element).getAllByRole('columnheader')) {
    expect(header.textContent?.trim()).toBeTruthy();
  }
  for (const button of within(element).getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UI-014.abweichung-bestaetigen "Zugeordnete Geräte weichen ab" (CU-140, #207, REQ-088)', () => {
  it('UI-014.abweichung-bestaetigen DER-64-03 shows title, text, the table WI-Nr and Merkmal with "Optik-Note: Gerät 2, Modell-Inserat 3" for both devices, the hint and both buttons', async () => {
    mockApi();

    await openDialog();

    expect(within(dialog()).getByRole('heading', { name: DIALOG_NAME })).toBeTruthy();
    expect(dialog().textContent).toContain(
      'Nach dieser Änderung weichen 2 zugeordnete Geräte vom Modell-Inserat ab:',
    );
    const table = within(dialog()).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'WI-Nr',
      'Merkmal',
    ]);
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => Array.from(row.children, (cell) => cell.textContent)),
    ).toEqual([
      ['626198', 'Optik-Note: Gerät 2, Modell-Inserat 3'],
      ['626199', 'Optik-Note: Gerät 2, Modell-Inserat 3'],
    ]);
    expect(dialog().textContent).toContain(
      'Die Bestätigung wird im Änderungsprotokoll festgehalten.',
    );
    expect(dialogButton('Änderung trotzdem speichern')).toBeTruthy();
    expect(dialogButton('Abbrechen')).toBeTruthy();
    expect(dialog().style.width).toContain('800');
    expectAccessibleDialog();
  });

  it('UI-014.abweichung-bestaetigen DER-64-03 "Abbrechen" stores nothing and the form keeps the inputs', async () => {
    const { sent } = mockApi();
    await openDialog();

    fireEvent.click(dialogButton('Abbrechen'));

    await vi.waitFor(() => expect(queryDialog()).toBeNull());
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toHaveProperty('confirmDeviatingDevices');
    expect(visualGrade().value).toBe('3');
  });

  it('UI-014.speichert UI-014.success "Änderung trotzdem speichern" locks the dialog until the answer, sends the same request with confirmDeviatingDevices: true and shows "Inseratswerte gespeichert"', async () => {
    let answer: (response: Response) => void = () => {};
    const { sent } = mockApi({
      confirmed: () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    await openDialog();

    fireEvent.click(dialogButton('Änderung trotzdem speichern'));

    await vi.waitFor(() => expect(dialogButton('Änderung trotzdem speichern').disabled).toBe(true));
    expect(dialogButton('Abbrechen').disabled).toBe(true);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({ ...sent[0], confirmDeviatingDevices: true });
    answer(Response.json({ ...LISTING, visualGrade: 3, version: 2 }));
    await screen.findByText('Inseratswerte gespeichert');
    expect(queryDialog()).toBeNull();
  });

  it('UI-014.error DER-64-07 shows "Speichern nicht möglich. Referenz: <Nr>" on 500, the dialog stays and nothing is stored', async () => {
    mockApi({
      confirmed: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openDialog();

    fireEvent.click(dialogButton('Änderung trotzdem speichern'));

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('Speichern nicht möglich. Referenz: R-7K2M-9QX4');
    expect(dialogButton('Änderung trotzdem speichern').disabled).toBe(false);
    expect(visualGrade().value).toBe('3');
    expectAccessibleDialog();
  });

  it('UI-014.conflict DER-64-09 (a) shows P-05 with "Neu laden" on 409 version_conflict, keeps the inputs; "Neu laden" takes the model listing read again with its version', async () => {
    const current = structuredClone(LISTING);
    const { sent } = mockApi({
      listing: current,
      confirmed: () => Response.json(errorBody('version_conflict'), { status: 409 }),
    });
    await openDialog();

    fireEvent.click(dialogButton('Änderung trotzdem speichern'));

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.',
    );
    expect(visualGrade().value).toBe('3');
    expectAccessibleDialog();
    // Changed in another window meanwhile.
    Object.assign(current, { visualGrade: 4, version: 5 });

    fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));

    await vi.waitFor(() => expect(queryDialog()).toBeNull());
    await vi.waitFor(() => expect(visualGrade().value).toBe('4'));
    fireEvent.click(within(form()).getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => expect(sent).toHaveLength(3));
    expect(sent[2]).toMatchObject({ version: 5, visualGrade: '4' });
  });

  it('UI-014.wird-beendet DER-64-09 (b) shows P-07 without reference number on 503 shutting_down and keeps the inputs', async () => {
    mockApi({
      confirmed: () =>
        Response.json(errorBody('shutting_down', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 503,
        }),
    });
    await openDialog();

    fireEvent.click(dialogButton('Änderung trotzdem speichern'));

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert.',
    );
    expect(banner.textContent).not.toContain('Referenz');
    expect(dialog()).toBeTruthy();
    expect(visualGrade().value).toBe('3');
  });

  it('closes the dialog and shows a field error of the confirmed request at the form', async () => {
    mockApi({
      confirmed: () =>
        Response.json(
          errorBody('validation_failed', {
            fields: [
              {
                path: 'articleNumber',
                code: 'invalid',
                message: 'Artikelnummer: 1 bis 30 Zeichen, nur Buchstaben, Ziffern und „-“',
              },
            ],
          }),
          { status: 422 },
        ),
    });
    await openDialog();

    fireEvent.click(dialogButton('Änderung trotzdem speichern'));

    await vi.waitFor(() => expect(queryDialog()).toBeNull());
    expect(form().textContent).toContain('Artikelnummer: 1 bis 30 Zeichen');
    expect(visualGrade().value).toBe('3');
  });

  // Last: P-08 locks every write of the module until the page is reloaded.
  it('UI-014.ausgang-unbekannt DER-64-09 (c) shows the permanent "Ausgang unbekannt, bitte neu laden." without button, keeps the inputs and locks the dialog', async () => {
    mockApi({
      confirmed: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await openDialog();

    fireEvent.click(dialogButton('Änderung trotzdem speichern'));

    const text = await within(dialog()).findByText(/Ausgang unbekannt, bitte neu laden\./);
    const banner = text.closest('[role="alert"]') ?? text;
    expect(within(banner as HTMLElement).queryByRole('button')).toBeNull();
    await vi.waitFor(() => expect(dialogButton('Änderung trotzdem speichern').disabled).toBe(true));
    expect(dialogButton('Abbrechen').disabled).toBe(true);
    expect(visualGrade().value).toBe('3');
  });
});
