import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../app/query-client.ts';
import { AssignDialog } from './AssignDialog.tsx';

// Component tests of dialog UI-004 with the action "Neues Modell-Inserat anlegen" (CU-134, #197)
// with a mocked `fetch` (Technical Specification 6.1, 6.2).

const DEVICE = { id: 41, version: 1, wiNr: '626198', modelTemplateLabel: 'MacBook Pro 13' };

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

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

/** `fetch` answering `POST /api/listings` in turn with `answers`; records the request bodies. */
function mockApi(...answers: (() => Response)[]) {
  const sent: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      const answer = answers[sent.length];
      if (method !== 'POST' || path !== '/api/listings' || answer === undefined) {
        throw new Error(`unexpected request ${method} ${path}`);
      }
      sent.push(JSON.parse(String(init?.body)));
      return answer();
    }),
  );
  return { sent };
}

const onOpenChange = vi.fn<(open: boolean) => void>();

/** UI-010 of the device with UI-004 open; UI-014 shows its path after the creation. */
function renderDialog() {
  const router = createMemoryRouter(
    [
      {
        path: '/geraete/:deviceId',
        element: <AssignDialog open device={DEVICE} onOpenChange={onOpenChange} />,
      },
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

afterEach(() => {
  cleanup();
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

  it('UI-004.empty without a model listing of the model template offers only "Neues Modell-Inserat anlegen"', () => {
    mockApi();
    renderDialog();

    expect(
      within(dialog()).getByText('Für diese Modellvorlage gibt es noch kein Modell-Inserat.'),
    ).toBeTruthy();
    expect(within(dialog()).queryByRole('radio')).toBeNull();
    expect(within(dialog()).queryByRole('button', { name: 'Zuordnen' })).toBeNull();
  });

  it('UI-004.success creates the model listing from the device and opens it in UI-014', async () => {
    const { sent } = mockApi(() => Response.json(LISTING, { status: 201 }));
    const router = renderDialog();

    fireEvent.click(createButton());

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/inserate/9'));
    expect(sent).toEqual([{ fromDeviceId: 41, deviceVersion: 1 }]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('UI-004.validation DER-60-04 shows the field "Artikelnummer" with "Artikelnummer bereits vergeben" after article_number_taken; nothing is created', async () => {
    const { sent } = mockApi(
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
    const { sent } = mockApi(() =>
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
    mockApi(() =>
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

  it('UI-004.error shows "Zuordnung fehlgeschlagen. Referenz: <Nr>" for a server error', async () => {
    mockApi(() =>
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

  it('"Abbrechen" closes the dialog without a request; the device stays unassigned', () => {
    mockApi();
    renderDialog();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
