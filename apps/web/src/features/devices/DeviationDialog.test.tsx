import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { AssignDialog, assignedText } from './AssignDialog.tsx';

// Component tests of dialog UI-005 Kontext A (CU-135, #196, REQ-018) as it opens over UI-004
// (CU-134) after "Zuordnen" answers `confirmation_required`/`variant_deviation`, and of its action
// "Neues Modell-Inserat anlegen" (#201, REQ-019), with a mocked `fetch` (Technical Specification
// 6.1, 6.2).

const DEVICE = {
  id: 41,
  version: 1,
  wiNr: '626199',
  modelTemplateId: 3,
  modelTemplateLabel: 'MacBook Pro 13',
};

/** MI-A of MV-A as `GET /api/model-templates/3/listings` lists it. */
const MI_A = {
  id: 9,
  displayTitle: 'MacBook Pro 13',
  variantSummary: {
    conditionLabel: 'Sehr gut',
    visualGrade: 2,
    conditionDescription: '',
    variantValues: [{ label: 'RAM', value: '16' }],
  },
  quantity: 1,
};

const VISUAL_GRADE = {
  key: 'visualGrade',
  label: 'Optik-Note',
  deviceValue: '4',
  listingValue: '2',
};
const CONDITION = {
  key: 'condition',
  label: 'Zustand',
  deviceValue: 'Gut',
  listingValue: 'Sehr gut',
};
const DESCRIPTION = {
  key: 'conditionDescription',
  label: 'Zustandsbeschreibung',
  deviceValue: 'Display- und Gehäuseschaden',
  listingValue: 'leichte Gebrauchsspuren',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

/** `422 confirmation_required`/`variant_deviation` of "Zuordnen" with `deviations`. */
const deviating =
  (...deviations: object[]) =>
  () =>
    Response.json(
      errorBody('confirmation_required', {
        message: 'Das Gerät weicht vom Modell-Inserat ab.',
        details: { kind: 'variant_deviation', deviations },
      }),
      { status: 422 },
    );

const ASSIGNMENT = {
  device: {
    id: 41,
    wiNr: '626199',
    modelTemplateId: 3,
    listingId: 9,
    supplierId: null,
    conditionValueId: 1,
    visualGrade: 4,
    conditionDescription: '',
    values: {},
    reviewKeys: [],
    captureStatus: 'checked',
    stockStatus: 'available',
    capturedAt: '2026-11-18T08:00:00.000Z',
    capturedOn: '2026-11-18',
    version: 2,
    updatedAt: '2026-11-18T08:05:00.000Z',
  },
  listing: { id: 9, quantity: 2 },
  adjustStockChannels: [],
};

type Answer = (init?: RequestInit) => Response | Promise<Response>;

const CHOICE_PATH = `/api/model-templates/${DEVICE.modelTemplateId}/listings`;
const DEVIATIONS_PATH = `${CHOICE_PATH}?deviceId=${DEVICE.id}`;
const ASSIGNMENT_PATH = `/api/devices/${DEVICE.id}/assignment`;
const LISTINGS_PATH = '/api/listings';
const WRITE_PATHS = [ASSIGNMENT_PATH, LISTINGS_PATH];

/**
 * `fetch` answering the list of UI-004 with MI-A, the list of UI-005 with `targets` (by default
 * MI-A with its deviation) and `POST /api/devices/41/assignment` and `POST /api/listings` in turn
 * with `answers`; records the bodies and paths of the writes.
 */
function mockApi(
  {
    targets = () => Response.json({ items: [{ ...MI_A, deviations: [VISUAL_GRADE] }] }),
  }: { targets?: Answer } = {},
  ...answers: Answer[]
) {
  const sent: unknown[] = [];
  const paths: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && path === CHOICE_PATH) return Response.json({ items: [MI_A] });
      if (method === 'GET' && path === DEVIATIONS_PATH) return targets(init);
      const answer = answers[sent.length];
      if (method !== 'POST' || !WRITE_PATHS.includes(path) || !answer) {
        throw new Error(`unexpected request ${method} ${path}`);
      }
      sent.push(JSON.parse(String(init?.body)));
      paths.push(path);
      return answer(init);
    }),
  );
  return { sent, paths };
}

const onOpenChange = vi.fn<(open: boolean) => void>();

/** UI-010 of the device with UI-004 open; the host shows the banner of `onAssigned`. */
function renderDialog() {
  function Host() {
    const [assigned, setAssigned] = useState<string | null>(null);
    return (
      <>
        {assigned !== null && <div role="status">{assigned}</div>}
        <AssignDialog
          open
          device={DEVICE}
          onOpenChange={onOpenChange}
          onAssigned={({ device, listing }) =>
            setAssigned(assignedText(device.wiNr, listing.quantity))
          }
        />
      </>
    );
  }
  const router = createMemoryRouter(
    [
      { path: '/geraete/:deviceId', element: <Host /> },
      { path: '/inserate/:listingId', element: <p>UI-014</p> },
    ],
    { initialEntries: [`/geraete/${DEVICE.id}`] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const assignDialog = () => screen.getByRole('dialog', { name: 'Modell-Inserat wählen' });
const dialog = () => screen.getByRole('dialog', { name: 'Abweichungen bei Zuordnung' });
const queryDialog = () => screen.queryByRole('dialog', { name: 'Abweichungen bei Zuordnung' });
const button = (name: string) => within(dialog()).getByRole<HTMLButtonElement>('button', { name });

/** Chooses MI-A in UI-004 and clicks "Zuordnen"; waits for UI-005. */
async function openDeviations() {
  const router = renderDialog();
  const radio = await within(assignDialog()).findByRole<HTMLInputElement>('radio');
  fireEvent.click(radio);
  fireEvent.click(within(assignDialog()).getByRole('button', { name: 'Zuordnen' }));
  await screen.findByRole('dialog', { name: 'Abweichungen bei Zuordnung' });
  return router;
}

/** The rows of the table as text per cell. */
const tableRows = () =>
  within(within(dialog()).getByRole('table'))
    .getAllByRole('row')
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));

/** Accessibility assertion of a state: named dialog, title, named table and controls. */
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  onOpenChange.mockReset();
});

/** The model listing `POST /api/listings` creates from the device (MI-B of MV-A, RAM 8). */
const CREATED = {
  id: 12,
  modelTemplateId: 3,
  conditionValueId: 1,
  visualGrade: 2,
  conditionDescription: '',
  variantValues: { '7': 8 },
  otherValues: {},
  deliveryScopeTextBlockIds: [],
  articleNumber: '626199',
  eanMode: 'original',
  ownEan: null,
  displayTitle: 'MacBook Pro 13',
  quantity: 1,
  version: 1,
};

const RAM = { key: '7', label: 'RAM', deviceValue: '8 GB', listingValue: '16 GB' };

// Before the tests of #196: their last one locks the writes of the module until a reload (P-08).
describe('UI-005 Kontext A "Neues Modell-Inserat anlegen" (CU-135, CU-134, #201, REQ-019)', () => {
  it('AC-REQ-019-05 UI-005.default "Neues Modell-Inserat anlegen" creates a model listing from the deviating device and opens it in UI-014', async () => {
    const { sent, paths } = mockApi(
      { targets: () => Response.json({ items: [{ ...MI_A, deviations: [RAM] }] }) },
      deviating(RAM),
      () => Response.json(CREATED, { status: 201 }),
    );
    const router = await openDeviations();
    await vi.waitFor(() => expect(button('Neues Modell-Inserat anlegen').disabled).toBe(false));
    expectAccessibleDialog();

    fireEvent.click(button('Neues Modell-Inserat anlegen'));

    // UI-014 of the new model listing (UI-005 "Navigation danach").
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/inserate/12'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(paths).toEqual([ASSIGNMENT_PATH, LISTINGS_PATH]);
    expect(sent).toEqual([
      { version: 1, listingId: 9, confirmDeviation: false },
      { fromDeviceId: 41, deviceVersion: 1 },
    ]);
  });

  it('UI-005.default "Neues Modell-Inserat anlegen" is not available when another model listing of the model template matches the device', async () => {
    const MI_B = { ...MI_A, id: 10, deviations: [] };
    const { sent } = mockApi(
      { targets: () => Response.json({ items: [{ ...MI_A, deviations: [RAM] }, MI_B] }) },
      deviating(RAM),
    );
    await openDeviations();
    await vi.waitFor(() => expect(within(dialog()).queryByRole('status')).toBeNull());

    expect(button('Neues Modell-Inserat anlegen').disabled).toBe(true);
    expect(button('Trotzdem zuordnen').disabled).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it('UI-005.default "Neues Modell-Inserat anlegen" is not available while the model listings load', async () => {
    mockApi({ targets: () => new Promise<Response>(() => {}) }, deviating(RAM));
    await openDeviations();

    expect(button('Neues Modell-Inserat anlegen').disabled).toBe(true);
  });

  it('UI-005 a rejection variant_duplicate of the creation shows in UI-004 with its text, as UI-004', async () => {
    const message =
      'Gleiche Variantenangaben wie Modell-Inserat MacBook Pro 13; bitte dort zuordnen';
    mockApi(
      { targets: () => Response.json({ items: [{ ...MI_A, deviations: [RAM] }] }) },
      deviating(RAM),
      () =>
        Response.json(errorBody('variant_duplicate', { message, details: { listingId: 10 } }), {
          status: 422,
        }),
    );
    const router = await openDeviations();
    await vi.waitFor(() => expect(button('Neues Modell-Inserat anlegen').disabled).toBe(false));

    fireEvent.click(button('Neues Modell-Inserat anlegen'));

    const alert = await within(assignDialog()).findByRole('alert');
    expect(alert.textContent).toBe(message);
    expect(queryDialog()).toBeNull();
    expect(router.state.location.pathname).toBe('/geraete/41');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('UI-005 article_number_taken of the creation shows the field "Artikelnummer" in UI-004, as UI-004; another article number creates the model listing', async () => {
    const { sent } = mockApi(
      { targets: () => Response.json({ items: [{ ...MI_A, deviations: [RAM] }] }) },
      deviating(RAM),
      () =>
        Response.json(
          errorBody('article_number_taken', {
            message: 'Artikelnummer bereits vergeben',
            details: { path: 'articleNumber' },
          }),
          { status: 422 },
        ),
      () => Response.json({ ...CREATED, articleNumber: '626199-2' }, { status: 201 }),
    );
    const router = await openDeviations();
    await vi.waitFor(() => expect(button('Neues Modell-Inserat anlegen').disabled).toBe(false));

    fireEvent.click(button('Neues Modell-Inserat anlegen'));

    const input = await within(assignDialog()).findByRole<HTMLInputElement>('textbox', {
      name: /Artikelnummer/,
    });
    expect(input.value).toBe('626199');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(queryDialog()).toBeNull();

    fireEvent.change(input, { target: { value: '626199-2' } });
    fireEvent.click(
      within(assignDialog()).getByRole('button', { name: 'Neues Modell-Inserat anlegen' }),
    );

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/inserate/12'));
    expect(sent.slice(1)).toEqual([
      { fromDeviceId: 41, deviceVersion: 1 },
      { fromDeviceId: 41, deviceVersion: 1, articleNumber: '626199-2' },
    ]);
  });

  it('UI-005 UI-004 locks its actions while the creation runs', async () => {
    mockApi(
      { targets: () => Response.json({ items: [{ ...MI_A, deviations: [RAM] }] }) },
      deviating(RAM),
      () => new Promise<Response>(() => {}),
    );
    await openDeviations();
    await vi.waitFor(() => expect(button('Neues Modell-Inserat anlegen').disabled).toBe(false));

    fireEvent.click(button('Neues Modell-Inserat anlegen'));

    const create = within(assignDialog()).getByRole<HTMLButtonElement>('button', {
      name: 'Neues Modell-Inserat anlegen',
    });
    await vi.waitFor(() => expect(create.disabled).toBe(true));
    expect(
      within(assignDialog()).getByRole<HTMLButtonElement>('button', { name: 'Abbrechen' }).disabled,
    ).toBe(true);
  });
});

describe('UI-005 Kontext A "Abweichungen bei Zuordnung" (CU-135, #196, REQ-018)', () => {
  it('UI-005.default AC-REQ-018-01 DER-59-02 shows the hint, the table "Optik-Note: Gerät 4, Modell-Inserat 2" and the three actions, 800 px wide and never higher than the window', async () => {
    const { sent } = mockApi({}, deviating(VISUAL_GRADE, CONDITION));
    await openDeviations();

    expect(within(dialog()).getByText('Das Gerät weicht vom Modell-Inserat ab.')).toBeTruthy();
    expect(tableRows()).toEqual([
      ['Merkmal', 'Wert am Gerät', 'Wert am Modell-Inserat'],
      ['Optik-Note', '4', '2'],
      ['Zustand', 'Gut', 'Sehr gut'],
    ]);
    expect(button('Trotzdem zuordnen').disabled).toBe(false);
    expect(button('Neues Modell-Inserat anlegen')).toBeTruthy();
    expect(button('Abbrechen').disabled).toBe(false);
    expect(within(dialog()).queryByRole('button', { name: 'Umbuchen' })).toBeNull();
    // Width 800 px, height at most the window: title and action bar stay, the content scrolls
    // (2.0.10).
    expect(dialog().style.width).toMatch(/^min\(800px, /);
    expect(dialog().style.maxHeight).toBe('calc(100dvh - 16px)');
    expect(
      dialog().querySelector('.overflow-y-auto')?.contains(within(dialog()).getByRole('table')),
    ).toBe(true);
    expect(sent).toEqual([{ version: 1, listingId: 9, confirmDeviation: false }]);
    expectAccessibleDialog();
  });

  it('UI-005.default AC-REQ-018-05 shows both condition descriptions complete side by side', async () => {
    mockApi({}, deviating(DESCRIPTION));
    await openDeviations();

    const descriptions = within(dialog()).getByRole('region', { name: 'Zustandsbeschreibung' });
    expect(descriptions.textContent).toContain('GerätDisplay- und Gehäuseschaden');
    expect(descriptions.textContent).toContain('Modell-Inseratleichte Gebrauchsspuren');
    // Without other deviations there is no table.
    expect(within(dialog()).queryByRole('table')).toBeNull();
    expectAccessibleDialog();
  });

  it('AC-REQ-018-02 "Trotzdem zuordnen" assigns with confirmDeviation and closes UI-004 with "Gerät 626199 zugeordnet (Stückzahl 2)"', async () => {
    const { sent } = mockApi({}, deviating(VISUAL_GRADE), () => Response.json(ASSIGNMENT));
    await openDeviations();

    fireEvent.click(button('Trotzdem zuordnen'));

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    // UI-005 closes itself as well; the test host keeps UI-004 open.
    expect(queryDialog()).toBeNull();
    expect(sent).toEqual([
      { version: 1, listingId: 9, confirmDeviation: false },
      { version: 1, listingId: 9, confirmDeviation: true },
    ]);
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe(
      'Gerät 626199 zugeordnet (Stückzahl 2)',
    );
  });

  it('UI-005.speichert locks the actions while "Trotzdem zuordnen" runs', async () => {
    mockApi({}, deviating(VISUAL_GRADE), () => new Promise<Response>(() => {}));
    await openDeviations();

    fireEvent.click(button('Trotzdem zuordnen'));

    await vi.waitFor(() => expect(button('Trotzdem zuordnen').disabled).toBe(true));
    expect(button('Abbrechen').disabled).toBe(true);
    expect(button('Neues Modell-Inserat anlegen').disabled).toBe(true);
  });

  it('DER-59-02 "Abbrechen" returns to UI-004 without saving; the choice stays', async () => {
    const { sent } = mockApi({}, deviating(VISUAL_GRADE));
    await openDeviations();

    fireEvent.click(button('Abbrechen'));

    await vi.waitFor(() => expect(queryDialog()).toBeNull());
    expect(within(assignDialog()).getByRole<HTMLInputElement>('radio').checked).toBe(true);
    expect(sent).toHaveLength(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('DER-59-02 Esc returns to UI-004 without saving', async () => {
    const { sent } = mockApi({}, deviating(VISUAL_GRADE));
    await openDeviations();

    fireEvent.keyDown(dialog(), { key: 'Escape' });

    await vi.waitFor(() => expect(queryDialog()).toBeNull());
    expect(assignDialog()).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('UI-005.loading DER-59-03 shows "Lade Modell-Inserate …" as UI-004 while its data load', async () => {
    mockApi({ targets: () => new Promise<Response>(() => {}) }, deviating(VISUAL_GRADE));
    await openDeviations();

    expect(within(dialog()).getByRole('status').textContent).toBe('Lade Modell-Inserate …');
    // The deviations of the answer show at once.
    expect(tableRows()[1]).toEqual(['Optik-Note', '4', '2']);
    expectAccessibleDialog();
  });

  it('UI-005.error DER-59-03 shows "Zuordnung fehlgeschlagen. Referenz: <Nr>" as UI-004 when its data answer 500', async () => {
    mockApi(
      {
        targets: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-3B7C-1KD2' }), {
            status: 500,
          }),
      },
      deviating(VISUAL_GRADE),
    );
    await openDeviations();

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toContain('Zuordnung fehlgeschlagen. Referenz: R-3B7C-1KD2');
    expect(tableRows()[1]).toEqual(['Optik-Note', '4', '2']);
    expectAccessibleDialog();
  });

  it('UI-005.error DER-59-03 shows "Zuordnung fehlgeschlagen. Referenz: <Nr>" when "Trotzdem zuordnen" answers 500; the dialog stays', async () => {
    mockApi({}, deviating(VISUAL_GRADE), () =>
      Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
        status: 500,
      }),
    );
    await openDeviations();

    fireEvent.click(button('Trotzdem zuordnen'));

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toContain('Zuordnung fehlgeschlagen. Referenz: R-7K2M-9QX4');
    expect(button('Trotzdem zuordnen').disabled).toBe(false);
    expect(onOpenChange).not.toHaveBeenCalled();
    expectAccessibleDialog();
  });

  it('UI-005.error shows a rejection of "Trotzdem zuordnen" with its text, as UI-004', async () => {
    const message = 'Gerät ist bereits verkauft oder storniert';
    mockApi({}, deviating(VISUAL_GRADE), () =>
      Response.json(errorBody('device_not_available', { message }), { status: 422 }),
    );
    await openDeviations();

    fireEvent.click(button('Trotzdem zuordnen'));

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toBe(message);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('UI-005.conflict DER-59-05 (a) shows P-05 with "Neu laden" after 409 version_conflict on "Trotzdem zuordnen"; the deviations stay visible', async () => {
    mockApi({}, deviating(VISUAL_GRADE), () =>
      Response.json(errorBody('version_conflict'), { status: 409 }),
    );
    await openDeviations();

    fireEvent.click(button('Trotzdem zuordnen'));

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert.',
    );
    expect(within(banner).getByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(tableRows()[1]).toEqual(['Optik-Note', '4', '2']);
    expect(onOpenChange).not.toHaveBeenCalled();
    expectAccessibleDialog();
  });

  it('UI-005.unreachable DER-59-05 (b) shows P-06 with "Erneut versuchen" when its data get no answer, without replacing the dialog', async () => {
    mockApi(
      {
        targets: () => {
          throw new TypeError('Failed to fetch');
        },
      },
      deviating(VISUAL_GRADE),
    );
    await openDeviations();

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(tableRows()[1]).toEqual(['Optik-Note', '4', '2']);
    expectAccessibleDialog();
  });

  it('UI-005.unreachable DER-59-05 (b) shows P-06 when its data take longer than 5 s', async () => {
    mockApi(
      {
        targets: (init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
      },
      deviating(VISUAL_GRADE),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openDeviations();

    await act(() => vi.advanceTimersByTimeAsync(5000));

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
  });

  it('UI-005.wird-beendet DER-59-05 (c) shows P-07 without reference number after 503 shutting_down on "Trotzdem zuordnen"; the deviations stay visible', async () => {
    mockApi({}, deviating(VISUAL_GRADE), () =>
      Response.json(errorBody('shutting_down', { referenceNumber: 'R-0000-0000' }), {
        status: 503,
      }),
    );
    await openDeviations();

    fireEvent.click(button('Trotzdem zuordnen'));

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('resellr wird gerade beendet.');
    expect(banner.textContent).not.toContain('R-0000-0000');
    expect(tableRows()[1]).toEqual(['Optik-Note', '4', '2']);
    expectAccessibleDialog();
  });

  // Last test of the file: the unknown outcome locks the writes of the page until it is loaded
  // again (CU-049), that is for the rest of this file.
  it('UI-005.ausgang-unbekannt DER-59-03 shows "Ausgang unbekannt, bitte neu laden." without a button and locks "Trotzdem zuordnen" until the page is loaded again', async () => {
    const { sent } = mockApi({}, deviating(VISUAL_GRADE), () => {
      throw new TypeError('Failed to fetch');
    });
    await openDeviations();

    fireEvent.click(button('Trotzdem zuordnen'));

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(button('Trotzdem zuordnen').disabled).toBe(true);
    expect(button('Abbrechen').disabled).toBe(true);
    expect(tableRows()[1]).toEqual(['Optik-Note', '4', '2']);
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(queryDialog()).toBeTruthy();
    expect(sent).toHaveLength(2);
    expectAccessibleDialog();
  });
});
