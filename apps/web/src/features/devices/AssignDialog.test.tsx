import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../app/query-client.ts';
import { AssignDialog, assignedText } from './AssignDialog.tsx';

// Component tests of dialog UI-004 with the actions "Neues Modell-Inserat anlegen" (#197) and
// "Zuordnen" (#194) (CU-134) with a mocked `fetch` (Technical Specification 6.1, 6.2).

const DEVICE = {
  id: 41,
  version: 1,
  wiNr: '626198',
  modelTemplateId: 3,
  modelTemplateLabel: 'MacBook Pro 13',
};

const LISTING = {
  id: 9,
  modelTemplateId: 3,
  conditionValueId: 1,
  visualGrade: 2,
  conditionDescription: '',
  variantValues: { '12': 16 },
  otherValues: {},
  deliveryScopeTextBlockIds: [],
  articleNumber: '626198',
  eanMode: 'original',
  ownEan: null,
  displayTitle: 'MacBook Pro 13',
  quantity: 1,
  version: 1,
};

/** MI-A and MI-B of MV-A as `GET /api/model-templates/3/listings` lists them. */
const CHOICE = {
  items: [
    {
      id: 9,
      displayTitle: 'MacBook Pro 13',
      variantSummary: {
        conditionLabel: 'gebraucht',
        visualGrade: 2,
        conditionDescription: '',
        variantValues: [
          { label: 'RAM', value: '16' },
          { label: 'Tastaturlayout', value: 'Deutsch (QWERTZ)' },
        ],
      },
      quantity: 1,
    },
    {
      id: 10,
      displayTitle: 'MacBook Pro 13',
      variantSummary: {
        conditionLabel: 'gebraucht',
        visualGrade: 4,
        conditionDescription: 'Display gebrochen',
        variantValues: [
          { label: 'RAM', value: '8' },
          { label: 'Tastaturlayout', value: 'Deutsch (QWERTZ)' },
        ],
      },
      quantity: 3,
    },
  ],
};

const ASSIGNMENT = {
  device: {
    id: 41,
    wiNr: '626198',
    modelTemplateId: 3,
    listingId: 9,
    supplierId: null,
    conditionValueId: 1,
    visualGrade: 2,
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

/** Labels of the review keys as the calling screen names its fields. */
const FIELD_LABELS: Record<string, string> = { condition: 'Zustand', '12': 'RAM' };

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Answer = (init?: RequestInit) => Response | Promise<Response>;

const CHOICE_PATH = `/api/model-templates/${DEVICE.modelTemplateId}/listings`;

/**
 * `fetch` answering the list of UI-004 with `choice` (by default without model listing) and the
 * writes `POST /api/listings` and `POST /api/devices/41/assignment` in turn with `answers`;
 * records the paths and bodies of the writes.
 */
function mockApi(
  { choice = () => Response.json({ items: [] }) }: { choice?: Answer } = {},
  ...answers: Answer[]
) {
  const sent: unknown[] = [];
  const paths: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && path === CHOICE_PATH) return choice(init);
      const answer = answers[sent.length];
      const writes = ['/api/listings', `/api/devices/${DEVICE.id}/assignment`];
      if (method !== 'POST' || !writes.includes(path) || answer === undefined) {
        throw new Error(`unexpected request ${method} ${path}`);
      }
      sent.push(JSON.parse(String(init?.body)));
      paths.push(path);
      return answer(init);
    }),
  );
  return { sent, paths };
}

const withChoice = { choice: () => Response.json(CHOICE) };

const onOpenChange = vi.fn<(open: boolean) => void>();

/**
 * UI-010 of the device with UI-004 open; UI-014 shows its path after the creation. The host shows
 * the banner of `onAssigned` as UI-003 does with #189 (DER-58-04).
 */
function renderDialog() {
  function Host() {
    const [assigned, setAssigned] = useState<string | null>(null);
    return (
      <>
        {assigned !== null && <div role="status">{assigned}</div>}
        <AssignDialog
          open
          device={DEVICE}
          fieldLabel={(key) => FIELD_LABELS[key] ?? key}
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
      { path: '/inserate/:listingId', element: <h1>UI-014</h1> },
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

const dialog = () => screen.getByRole('dialog', { name: 'Modell-Inserat wählen' });
const createButton = () =>
  within(dialog()).getByRole<HTMLButtonElement>('button', {
    name: 'Neues Modell-Inserat anlegen',
  });
const articleNumberInput = () =>
  within(dialog()).queryByRole<HTMLInputElement>('textbox', { name: /^Artikelnummer/ });
const assignButton = () =>
  within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Zuordnen' });
const radios = () => within(dialog()).queryAllByRole<HTMLInputElement>('radio');

/** Waits for the list of model listings and chooses the one at `index`. */
async function choose(index: number) {
  await vi.waitFor(() => expect(radios().length).toBeGreaterThan(index));
  fireEvent.click(radios()[index]!);
}

/** Accessibility assertion of a state: named dialog, title, named controls and options. */
function expectAccessibleDialog() {
  expect(within(dialog()).getByRole('heading', { name: 'Modell-Inserat wählen' })).toBeTruthy();
  for (const button of within(dialog()).getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
  for (const radio of radios()) {
    expect(radio.closest('label')?.textContent?.trim()).toBeTruthy();
  }
  const group = within(dialog()).queryByRole('group', { name: 'Modell-Inserat' });
  if (radios().length > 0) expect(group).toBeTruthy();
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  onOpenChange.mockReset();
});

describe('UI-004 "Neues Modell-Inserat anlegen" (CU-134, #197)', () => {
  it('UI-004.default shows the device with WI-Nr and model template, the actions and no article number field', () => {
    mockApi();
    renderDialog();

    expect(within(dialog()).getByRole('heading', { name: 'Modell-Inserat wählen' })).toBeTruthy();
    expect(dialog().textContent).toContain('Gerät626198');
    expect(dialog().textContent).toContain('ModellvorlageMacBook Pro 13');
    expect(createButton().disabled).toBe(false);
    expect(within(dialog()).getByRole('button', { name: 'Abbrechen' })).toBeTruthy();
    expect(articleNumberInput()).toBeNull();
    // Dialog width 720 px, never wider than the window less 16 px (2.0.10).
    expect(dialog().style.width).toMatch(/^min\(720px, /);
  });

  it('AC-REQ-017-03 UI-004.empty without a model listing of the model template offers only "Neues Modell-Inserat anlegen"', async () => {
    mockApi();
    renderDialog();

    expect(
      await within(dialog()).findByText(
        'Für diese Modellvorlage gibt es noch kein Modell-Inserat.',
      ),
    ).toBeTruthy();
    expect(within(dialog()).queryByRole('radio')).toBeNull();
    expect(within(dialog()).queryByRole('button', { name: 'Zuordnen' })).toBeNull();
    expect(createButton().disabled).toBe(false);
    expectAccessibleDialog();
  });

  it('UI-004.success creates the model listing from the device and opens it in UI-014', async () => {
    const { sent } = mockApi({}, () => Response.json(LISTING, { status: 201 }));
    const router = renderDialog();

    fireEvent.click(createButton());

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/inserate/9'));
    expect(sent).toEqual([{ fromDeviceId: 41, deviceVersion: 1 }]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('UI-004.validation DER-60-04 shows the field "Artikelnummer" with "Artikelnummer bereits vergeben" after article_number_taken; nothing is created', async () => {
    const { sent } = mockApi(
      {},
      () =>
        Response.json(
          errorBody('article_number_taken', {
            message: 'Artikelnummer bereits vergeben',
            details: { path: 'articleNumber' },
          }),
          { status: 422 },
        ),
      () => Response.json({ ...LISTING, articleNumber: '626198-2' }, { status: 201 }),
    );
    const router = renderDialog();

    fireEvent.click(createButton());

    await vi.waitFor(() => expect(articleNumberInput()).not.toBeNull());
    const input = articleNumberInput()!;
    expect(input.value).toBe('626198');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
    const errorId = input.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(errorId)?.textContent).toContain(
      'Artikelnummer bereits vergeben',
    );
    expect(document.activeElement).toBe(input);
    expect(router.state.location.pathname).toBe('/geraete/41');
    expect(onOpenChange).not.toHaveBeenCalled();

    // Another article number is sent with the request and creates the model listing.
    fireEvent.change(input, { target: { value: '626198-2' } });
    fireEvent.click(createButton());

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/inserate/9'));
    expect(sent).toEqual([
      { fromDeviceId: 41, deviceVersion: 1 },
      { fromDeviceId: 41, deviceVersion: 1, articleNumber: '626198-2' },
    ]);
  });

  it('UI-004.validation checks the article number in the browser before sending', async () => {
    const { sent } = mockApi({}, () =>
      Response.json(
        errorBody('article_number_taken', { message: 'Artikelnummer bereits vergeben' }),
        { status: 422 },
      ),
    );
    renderDialog();
    fireEvent.click(createButton());
    await vi.waitFor(() => expect(articleNumberInput()).not.toBeNull());

    fireEvent.change(articleNumberInput()!, { target: { value: 'MI A' } });
    fireEvent.click(createButton());

    const errorId = articleNumberInput()!.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(errorId)?.textContent).toContain(
      'Artikelnummer: 1 bis 30 Zeichen, nur Buchstaben, Ziffern und „-“',
    );
    expect(sent).toHaveLength(1);
  });

  it('UI-004.error shows variant_duplicate with its text in the dialog; the dialog stays open', async () => {
    const message =
      'Gleiche Variantenangaben wie Modell-Inserat MacBook Pro 13; bitte dort zuordnen';
    mockApi({}, () =>
      Response.json(errorBody('variant_duplicate', { message, details: { listingId: 9 } }), {
        status: 422,
      }),
    );
    const router = renderDialog();

    fireEvent.click(createButton());

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toBe(message);
    expect(router.state.location.pathname).toBe('/geraete/41');
    expect(articleNumberInput()).toBeNull();
  });

  it('UI-004.error shows device_not_available.new_listing with its text in the dialog; the dialog stays open', async () => {
    const message = 'Gerät ist bereits verkauft oder storniert';
    mockApi({}, () =>
      Response.json(errorBody('device_not_available', { message }), { status: 422 }),
    );
    const router = renderDialog();

    fireEvent.click(createButton());

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toBe(message);
    expect(router.state.location.pathname).toBe('/geraete/41');
    expect(articleNumberInput()).toBeNull();
  });

  it('UI-004.error shows "Zuordnung fehlgeschlagen. Referenz: <Nr>" for a server error', async () => {
    mockApi({}, () =>
      Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
        status: 500,
      }),
    );
    renderDialog();

    fireEvent.click(createButton());

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toContain('Zuordnung fehlgeschlagen. Referenz: R-7K2M-9QX4');
    expect(createButton().disabled).toBe(false);
  });

  it('"Abbrechen" closes the dialog without a write; the device stays unassigned', async () => {
    const { sent } = mockApi(withChoice);
    renderDialog();
    await choose(0);

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(sent).toEqual([]);
  });
});

describe('UI-004 rejection of a device with open review flags (CU-134, #189, REQ-013)', () => {
  const reviewPending = () =>
    Response.json(
      errorBody('review_pending', {
        message: 'Erst Werte prüfen',
        details: { keys: ['condition', '12'] },
      }),
      { status: 422 },
    );

  it('AC-REQ-013-03 "Zuordnen" shows "Erst Werte prüfen" naming the flagged values in the dialog; nothing is assigned', async () => {
    const { sent } = mockApi(withChoice, reviewPending);
    renderDialog();
    await choose(0);

    fireEvent.click(assignButton());

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toBe('Erst Werte prüfen: Zustand, RAM');
    expect(sent).toEqual([{ version: 1, listingId: 9, confirmDeviation: false }]);
    expect(screen.queryByRole('status')).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    // UI-004.default: the choice and the actions stay for another try once the values are checked.
    expect(radios()[0]!.checked).toBe(true);
    expect(assignButton().disabled).toBe(false);
    expectAccessibleDialog();
  });

  it('AC-REQ-013-03 "Neues Modell-Inserat anlegen" shows "Erst Werte prüfen" naming the flagged values in the dialog; nothing is created', async () => {
    const { sent } = mockApi({}, reviewPending);
    const router = renderDialog();

    fireEvent.click(createButton());

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toBe('Erst Werte prüfen: Zustand, RAM');
    expect(sent).toEqual([{ fromDeviceId: 41, deviceVersion: 1 }]);
    expect(router.state.location.pathname).toBe('/geraete/41');
    expect(articleNumberInput()).toBeNull();
    expect(createButton().disabled).toBe(false);
    expectAccessibleDialog();
  });
});

describe('UI-004 "Zuordnen" (CU-134, #194, REQ-017; Technical Specification 2.6)', () => {
  it('UI-004.loading DER-58-02 shows "Lade Modell-Inserate …" while the list loads', () => {
    mockApi({ choice: () => new Promise<Response>(() => {}) });
    renderDialog();

    expect(within(dialog()).getByRole('status').textContent).toBe('Lade Modell-Inserate …');
    expect(
      within(dialog()).queryByText('Für diese Modellvorlage gibt es noch kein Modell-Inserat.'),
    ).toBeNull();
    expect(radios()).toEqual([]);
    expectAccessibleDialog();
  });

  it('UI-004.default DER-58-01 lists each model listing with title, variant data and quantity to choose by radio button, 720 px wide and never higher than the window', async () => {
    mockApi(withChoice);
    renderDialog();

    await vi.waitFor(() => expect(radios()).toHaveLength(2));
    expect(dialog().textContent).toContain('Gerät626198');
    expect(dialog().textContent).toContain('ModellvorlageMacBook Pro 13');
    const [miA, miB] = radios().map((radio) => radio.closest('label')?.textContent ?? '');
    for (const text of [
      'MacBook Pro 13',
      'Zustand: gebraucht',
      'Optik-Note: 2',
      'RAM: 16',
      'Tastaturlayout: Deutsch (QWERTZ)',
      'Stückzahl 1',
    ]) {
      expect(miA).toContain(text);
    }
    expect(miA).not.toContain('Zustandsbeschreibung');
    for (const text of [
      'Optik-Note: 4',
      'Zustandsbeschreibung: Display gebrochen',
      'Stückzahl 3',
    ]) {
      expect(miB).toContain(text);
    }
    expect(radios().every((radio) => !radio.checked)).toBe(true);
    expect(
      within(dialog()).queryByText('Für diese Modellvorlage gibt es noch kein Modell-Inserat.'),
    ).toBeNull();
    expect(createButton().disabled).toBe(false);
    // Width 720 px, height at most the window: title and action bar stay, the content scrolls
    // (2.0.10).
    expect(dialog().style.width).toMatch(/^min\(720px, /);
    expect(dialog().style.maxHeight).toBe('calc(100dvh - 16px)');
    expect(dialog().querySelector('.overflow-y-auto')?.contains(radios()[0]!)).toBe(true);
    expectAccessibleDialog();
  });

  it('UI-004.disabled DER-58-03 deactivates "Zuordnen" without a chosen model listing, with the reason "Bitte ein Modell-Inserat wählen" as tooltip', async () => {
    const { sent } = mockApi(withChoice);
    renderDialog();
    await vi.waitFor(() => expect(radios()).toHaveLength(2));

    expect(assignButton().disabled).toBe(true);
    expect(assignButton().title).toBe('Bitte ein Modell-Inserat wählen');
    expect(assignButton().parentElement?.title).toBe('Bitte ein Modell-Inserat wählen');
    fireEvent.submit(within(dialog()).getByRole('form'));
    expect(sent).toEqual([]);
    expectAccessibleDialog();

    await choose(1);

    expect(assignButton().disabled).toBe(false);
    expect(assignButton().title).toBe('');
  });

  it('UI-004.success DER-58-04 assigns the device to the chosen model listing and shows "Gerät <WI-Nr> zugeordnet (Stückzahl n)"', async () => {
    const { sent, paths } = mockApi(withChoice, () => Response.json(ASSIGNMENT));
    renderDialog();
    await choose(0);

    fireEvent.click(assignButton());

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(paths).toEqual(['/api/devices/41/assignment']);
    expect(sent).toEqual([{ version: 1, listingId: 9, confirmDeviation: false }]);
    // The test keeps the dialog open; behind it the host shows the banner (hidden by the overlay).
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe(
      'Gerät 626198 zugeordnet (Stückzahl 2)',
    );
  });

  it('UI-004.success Enter assigns the chosen model listing (UI-004 "Fenstergröße und Bedienung")', async () => {
    const { sent } = mockApi(withChoice, () => Response.json(ASSIGNMENT));
    renderDialog();
    await choose(1);

    fireEvent.submit(within(dialog()).getByRole('form'));

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sent).toEqual([{ version: 1, listingId: 10, confirmDeviation: false }]);
  });

  it('UI-004.speichert locks the choice and the actions while the assignment runs', async () => {
    mockApi(withChoice, () => new Promise<Response>(() => {}));
    renderDialog();
    await choose(0);

    fireEvent.click(assignButton());

    await vi.waitFor(() => expect(assignButton().disabled).toBe(true));
    expect(radios().every((radio) => radio.disabled)).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(
      within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Abbrechen' }).disabled,
    ).toBe(true);
  });

  it('UI-004.error DER-58-02 shows "Zuordnung fehlgeschlagen. Referenz: <Nr>" when the assignment answers 500; the choice stays', async () => {
    mockApi(withChoice, () =>
      Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
        status: 500,
      }),
    );
    renderDialog();
    await choose(0);

    fireEvent.click(assignButton());

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toContain('Zuordnung fehlgeschlagen. Referenz: R-7K2M-9QX4');
    expect(radios()[0]!.checked).toBe(true);
    expect(assignButton().disabled).toBe(false);
    expect(onOpenChange).not.toHaveBeenCalled();
    expectAccessibleDialog();
  });

  it('UI-004.error shows the list error "Zuordnung fehlgeschlagen. Referenz: <Nr>" when the list answers 500', async () => {
    mockApi({
      choice: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-3B7C-1KD2' }), {
          status: 500,
        }),
    });
    renderDialog();

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toContain('Zuordnung fehlgeschlagen. Referenz: R-3B7C-1KD2');
    expect(within(dialog()).queryByRole('status')).toBeNull();
    expectAccessibleDialog();
  });

  it.each([
    ['other_model_template', 'Gerät gehört zu anderer Modellvorlage'],
    ['already_assigned', 'Gerät ist bereits einem Modell-Inserat zugeordnet'],
    ['device_not_available', 'Gerät ist bereits verkauft oder storniert'],
  ])(
    'UI-004.error shows the rejection %s with its text in the dialog; the dialog stays open',
    async (code, message) => {
      mockApi(withChoice, () => Response.json(errorBody(code, { message }), { status: 422 }));
      renderDialog();
      await choose(0);

      fireEvent.click(assignButton());

      const alert = await within(dialog()).findByRole('alert');
      expect(alert.textContent).toBe(message);
      expect(onOpenChange).not.toHaveBeenCalled();
      expectAccessibleDialog();
    },
  );

  it('UI-004.conflict DER-58-07 (a) shows P-05 with "Neu laden" after 409 version_conflict on "Zuordnen"; the choice stays visible', async () => {
    mockApi(withChoice, () => Response.json(errorBody('version_conflict'), { status: 409 }));
    renderDialog();
    await choose(1);

    fireEvent.click(assignButton());

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert.',
    );
    expect(within(banner).getByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(radios()[1]!.checked).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
    expectAccessibleDialog();
  });

  it('UI-004.unreachable DER-58-07 (b) shows P-06 with "Erneut versuchen" when the list gets no answer, without replacing the dialog', async () => {
    mockApi({
      choice: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderDialog();

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(within(dialog()).getByText('626198')).toBeTruthy();
    expect(createButton()).toBeTruthy();
    expectAccessibleDialog();
  });

  it('UI-004.unreachable DER-58-07 (b) shows P-06 when the list takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      choice: (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    renderDialog();

    await act(() => vi.advanceTimersByTimeAsync(5000));

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
  });

  it('UI-004.wird-beendet DER-58-07 (c) shows P-07 without reference number after 503 shutting_down on "Zuordnen"; the choice stays visible', async () => {
    mockApi(withChoice, () =>
      Response.json(errorBody('shutting_down', { referenceNumber: 'R-0000-0000' }), {
        status: 503,
      }),
    );
    renderDialog();
    await choose(0);

    fireEvent.click(assignButton());

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('resellr wird gerade beendet.');
    expect(banner.textContent).not.toContain('R-0000-0000');
    expect(radios()[0]!.checked).toBe(true);
    expectAccessibleDialog();
  });

  // Last test of the file: the unknown outcome locks the writes of the page until it is loaded
  // again (CU-049), that is for the rest of this file.
  it('UI-004.ausgang-unbekannt DER-58-05 shows "Ausgang unbekannt, bitte neu laden." without "Erneut versuchen" and locks "Zuordnen" until the page is loaded again', async () => {
    const { sent } = mockApi(withChoice, () => {
      throw new TypeError('Failed to fetch');
    });
    renderDialog();
    await choose(0);

    fireEvent.click(assignButton());

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(assignButton().disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(radios()[0]!.checked).toBe(true);
    fireEvent.submit(within(dialog()).getByRole('form'));
    expect(sent).toHaveLength(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expectAccessibleDialog();
  });
});
