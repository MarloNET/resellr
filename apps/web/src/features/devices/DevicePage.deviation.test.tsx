import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of dialog UI-005 Kontext B (CU-135, CU-137, #191, REQ-014) as it opens over
// UI-010 after "Gerätewerte speichern" of an assigned device answers `confirmation_required`/
// `variant_deviation`, with a mocked `fetch` (Technical Specification 2.5, 6.1, 6.2).

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};
const PICK_LISTS = [{ id: 1, key: 'condition', name: 'Zustand', isBatteryList: false, version: 1 }];
const USED = 1;
const CONDITIONS = [
  { id: USED, label: 'gebraucht', active: true, batteryPresent: null, sortOrder: 1, version: 1 },
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
/** Device 626198 with visual grade 2, assigned to MI-A. */
const DEVICE = {
  id: 5,
  wiNr: '626198',
  modelTemplateId: 7,
  modelTemplateLabel: 'ThinkPad T14 Gen 2',
  listingId: 9,
  listing: { id: 9, title: 'ThinkPad T14 Gen 2' },
  supplierId: null,
  conditionValueId: USED,
  visualGrade: 2,
  conditionDescription: '',
  values: {},
  reviewKeys: [],
  captureStatus: 'checked',
  stockStatus: 'available',
  capturedAt: '2026-11-16T09:00:00.000Z',
  capturedOn: '2026-11-16',
  version: 3,
  updatedAt: '2026-11-16T09:00:00.000Z',
};

const VISUAL_GRADE = {
  key: 'visualGrade',
  label: 'Optik-Note',
  deviceValue: '4',
  listingValue: '2',
};
const DESCRIPTION = {
  key: 'conditionDescription',
  label: 'Zustandsbeschreibung',
  deviceValue: 'Display- und Gehäuseschaden',
  listingValue: '–',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (body: Record<string, unknown>) => Response;

/** `422 confirmation_required`/`variant_deviation` of "Gerätewerte speichern" (2.5). */
const deviating =
  (deviations: object[], rebookTargets: object[] = []): Route =>
  () =>
    Response.json(
      errorBody('confirmation_required', {
        message: 'Das Gerät weicht vom Modell-Inserat ab.',
        details: { kind: 'variant_deviation', deviations, rebookTargets },
      }),
      { status: 422 },
    );
const saved: Route = ({ visualGrade }) =>
  Response.json({ ...DEVICE, visualGrade: Number(visualGrade), version: 4 });
const failed: Route = () =>
  Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), { status: 500 });

/**
 * `fetch` of UI-010: the first `PATCH` answers `first`, every later one (with the decision)
 * `decided`. Records the bodies of the `PATCH`. After the second `PATCH`, `GET` of the device
 * answers `reloaded` (stored meanwhile in another window).
 */
function mockApi(first: Route, decided: Route = saved, reloaded: object = DEVICE) {
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://127.0.0.1');
      const route = `${init?.method ?? 'GET'} ${url.pathname}`;
      if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (route === 'GET /api/devices/5') {
        return Response.json(sent.length < 2 ? DEVICE : reloaded);
      }
      if (route === 'GET /api/pick-lists') return Response.json({ items: PICK_LISTS, total: 1 });
      if (route === 'GET /api/pick-lists/1/values') {
        return Response.json({ items: CONDITIONS, total: 1 });
      }
      if (route === 'GET /api/model-templates/7') return Response.json(MODEL_TEMPLATE);
      if (route === 'GET /api/device-types/1/attributes')
        return Response.json({ items: [], total: 0 });
      if (route === 'PATCH /api/devices/5') {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        sent.push(body);
        return (sent.length === 1 ? first : decided)(body);
      }
      throw new Error(`unexpected request ${route}`);
    }),
  );
  return { sent };
}

const card = () => screen.getByRole('form', { name: 'Gerätewerte' });
const visualGrade = () =>
  within(card()).getByRole<HTMLInputElement>('textbox', { name: /^Optik-Note/ });
const dialog = () => screen.getByRole('dialog', { name: 'Abweichungen bei Zuordnung' });
const button = (name: string) => within(dialog()).getByRole<HTMLButtonElement>('button', { name });

/** UI-010 of device 5; changes the visual grade from 2 to 4 and saves. */
async function saveVisualGrade4() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/geraete/5'] })} />
    </QueryClientProvider>,
  );
  await screen.findByRole('form', { name: 'Gerätewerte' });
  fireEvent.change(visualGrade(), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gerätewerte speichern' }));
  await screen.findByRole('dialog', { name: 'Abweichungen bei Zuordnung' });
}

/** Accessibility assertion: named dialog with heading, named buttons, labelled table. */
function expectAccessibleDialog() {
  expect(
    within(dialog()).getByRole('heading', { name: 'Abweichungen bei Zuordnung' }),
  ).toBeTruthy();
  for (const control of within(dialog()).getAllByRole('button')) {
    expect(control.textContent?.trim() || control.getAttribute('aria-label')).toBeTruthy();
  }
  const table = within(dialog()).queryByRole('table');
  if (table) expect(table.getAttribute('aria-label')).toBeTruthy();
}

const tableRows = () =>
  within(within(dialog()).getByRole('table'))
    .getAllByRole('row')
    .map((row) => Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UI-005 Kontext B "Abweichungen bei Zuordnung" over UI-010 (CU-135, #191, REQ-014)', () => {
  it('UI-005.default DER-56-04 shows the deviation table, the hint "Das Gerät weicht vom Modell-Inserat ab." and the actions "Zuordnung behalten", "Neues Modell-Inserat anlegen" and "Umbuchen"; nothing stored', async () => {
    const { sent } = mockApi(deviating([VISUAL_GRADE, DESCRIPTION]));
    await saveVisualGrade4();

    expect(sent).toEqual([
      {
        version: 3,
        conditionValueId: USED,
        visualGrade: '4',
        conditionDescription: '',
        values: {},
        confirmedKeys: [],
      },
    ]);
    expect(within(dialog()).getByText('Das Gerät weicht vom Modell-Inserat ab.')).toBeTruthy();
    expect(tableRows()).toEqual([
      ['Merkmal', 'Wert am Gerät', 'Wert am Modell-Inserat'],
      ['Optik-Note', '4', '2'],
    ]);
    const description = within(dialog()).getByRole('region', { name: 'Zustandsbeschreibung' });
    expect(within(description).getByText('Display- und Gehäuseschaden')).toBeTruthy();
    expect(button('Zuordnung behalten').disabled).toBe(false);
    // "Neues Modell-Inserat anlegen" (#201) and "Umbuchen" (#202) are shown but not available.
    expect(button('Neues Modell-Inserat anlegen').disabled).toBe(true);
    expect(button('Umbuchen').disabled).toBe(true);
    expect(button('Abbrechen').disabled).toBe(false);
    expect(within(dialog()).queryByRole('button', { name: 'Trotzdem zuordnen' })).toBeNull();
    expectAccessibleDialog();
  });

  it('AC-REQ-014-07 shows "Optik-Note" with "4" at the device and "2" at the model listing, with the choice "Zuordnung behalten" and "Neues Modell-Inserat anlegen"', async () => {
    mockApi(deviating([VISUAL_GRADE]));
    await saveVisualGrade4();

    expect(tableRows()).toContainEqual(['Optik-Note', '4', '2']);
    expect(button('Zuordnung behalten')).toBeTruthy();
    expect(button('Neues Modell-Inserat anlegen')).toBeTruthy();
  });

  it('UI-010.success DER-56-05 "Zuordnung behalten" sends the same request with deviationDecision keep, closes the dialog and shows "Gerät gespeichert"', async () => {
    const { sent } = mockApi(deviating([VISUAL_GRADE]));
    await saveVisualGrade4();

    fireEvent.click(button('Zuordnung behalten'));

    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toEqual({ ...sent[0], deviationDecision: 'keep' });
    expect(await screen.findByText('Gerät gespeichert')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(visualGrade().value).toBe('4');
  });

  it('UI-005.error DER-56-05 shows "Speichern nicht möglich. Referenz: R-7K2M-9QX4" in the dialog on a technical error, the dialog stays', async () => {
    mockApi(deviating([VISUAL_GRADE]), failed);
    await saveVisualGrade4();

    fireEvent.click(button('Zuordnung behalten'));

    expect(
      await within(dialog()).findByText('Speichern nicht möglich. Referenz: R-7K2M-9QX4'),
    ).toBeTruthy();
    expect(button('Zuordnung behalten').disabled).toBe(false);
    expectAccessibleDialog();
  });

  it('"Abbrechen" closes the dialog without a request, the inputs stay', async () => {
    const { sent } = mockApi(deviating([VISUAL_GRADE]));
    await saveVisualGrade4();

    fireEvent.click(button('Abbrechen'));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent).toHaveLength(1);
    expect(visualGrade().value).toBe('4');
  });

  it('UI-005.conflict shows P-05 with "Neu laden" in the dialog after 409 version_conflict on "Zuordnung behalten"; the deviations stay visible', async () => {
    mockApi(
      deviating([VISUAL_GRADE]),
      () => Response.json(errorBody('version_conflict'), { status: 409 }),
      { ...DEVICE, visualGrade: 3, version: 4 },
    );
    await saveVisualGrade4();

    fireEvent.click(button('Zuordnung behalten'));

    expect(await within(dialog()).findByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(within(dialog()).getByRole('alert').textContent).toContain('Neu laden');
    expect(tableRows()).toContainEqual(['Optik-Note', '4', '2']);
    expect(button('Zuordnung behalten').disabled).toBe(false);
    expectAccessibleDialog();
  });

  it('UI-005.conflict "Neu laden" closes the dialog and the form takes the device read again (T-1)', async () => {
    const { sent } = mockApi(
      deviating([VISUAL_GRADE]),
      () => Response.json(errorBody('version_conflict'), { status: 409 }),
      { ...DEVICE, visualGrade: 3, version: 4 },
    );
    await saveVisualGrade4();
    fireEvent.click(button('Zuordnung behalten'));

    fireEvent.click(await within(dialog()).findByRole('button', { name: 'Neu laden' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await vi.waitFor(() => expect(visualGrade().value).toBe('3'));
    expect(screen.queryByRole('button', { name: 'Neu laden' })).toBeNull();
    expect(sent).toHaveLength(2);
  });
});

// Last in this file: P-08 locks the writes of the page until it is loaded again (CU-049).
describe('UI-005 Kontext B ausgang-unbekannt (P-08)', () => {
  it('UI-005.ausgang-unbekannt shows "Ausgang unbekannt, bitte neu laden." without a button and locks "Zuordnung behalten"', async () => {
    mockApi(deviating([VISUAL_GRADE]), () => {
      throw new TypeError('Failed to fetch');
    });
    await saveVisualGrade4();

    fireEvent.click(button('Zuordnung behalten'));

    const banner = await within(dialog()).findByText(/Ausgang unbekannt, bitte neu laden\./);
    expect(within(banner.closest('[role="alert"]') ?? banner).queryByRole('button')).toBeNull();
    await vi.waitFor(() => expect(button('Zuordnung behalten').disabled).toBe(true));
    expect(button('Abbrechen').disabled).toBe(true);
    expectAccessibleDialog();
  });
});
