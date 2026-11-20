import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of "Umbuchen" in UI-010 (CU-137) and of UI-004 in the mode "umbuchen" (CU-134,
// #202, REQ-020; Technical Specification 2.6) with a mocked `fetch` (6.1, 6.2), up to UI-014 of
// the target (CU-138) with the banner "Gerät umgebucht".

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

/** "626199", available and assigned to MI-X (2) of MV-A (7). */
const DEVICE = {
  id: 5,
  wiNr: '626199',
  modelTemplateId: 7,
  modelTemplateLabel: 'MacBook Pro 13',
  listingId: 2,
  listing: { id: 2, title: 'MI-X' },
  supplierId: null,
  conditionValueId: 1,
  visualGrade: 4,
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

const choice = (id: number, displayTitle: string, visualGrade: number, quantity: number) => ({
  id,
  displayTitle,
  variantSummary: {
    conditionLabel: 'gebraucht',
    visualGrade,
    conditionDescription: '',
    variantValues: [{ label: 'RAM', value: '16 GB' }],
  },
  quantity,
});
const MI_X = choice(2, 'MI-X', 2, 2);
const MI_Y = choice(4, 'MI-Y', 4, 1);

const REBOOKING = {
  device: { ...DEVICE, listingId: 4, version: 4, listing: undefined },
  listing: { id: 4, quantity: 2 },
  previousListing: { id: 2, quantity: 1 },
  adjustStockChannels: [],
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Answer = () => Response | Promise<Response>;

const pending = () => new Promise<Response>(() => {});

/**
 * `fetch` of the pages: the frame's status, the device, the model listings of MV-A
 * (`listings`) and `POST /api/devices/5/rebooking` with `rebook`; every other read (the card
 * "Gerätewerte", UI-014 of the target) stays without answer. Records the written bodies.
 */
function mockApi({
  device = DEVICE as Record<string, unknown>,
  listings = [MI_X, MI_Y],
  rebook = () => Response.json(REBOOKING) as Response | Promise<Response>,
}: { device?: Record<string, unknown>; listings?: object[]; rebook?: Answer } = {}) {
  const sent: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://127.0.0.1');
      const method = init?.method ?? 'GET';
      if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (method === 'GET' && url.pathname === '/api/devices/5') return Response.json(device);
      if (method === 'GET' && url.pathname === '/api/model-templates/7/listings') {
        return Response.json({ items: listings });
      }
      if (method === 'POST' && url.pathname === '/api/devices/5/rebooking') {
        sent.push(JSON.parse(String(init?.body)));
        return rebook();
      }
      if (method !== 'GET') throw new Error(`unexpected request ${method} ${url.pathname}`);
      return pending();
    }),
  );
  return { sent };
}

function renderPage() {
  const router = createMemoryRouter(routes, { initialEntries: ['/geraete/5'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const dialog = () => screen.getByRole('dialog', { name: 'Gerät umbuchen' });
const rebookButton = () =>
  within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Umbuchen' });

/** Opens UI-010 and clicks "Umbuchen"; waits for the list of UI-004. */
async function openRebooking() {
  const router = renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Umbuchen' }));
  await screen.findByRole('dialog', { name: 'Gerät umbuchen' });
  return router;
}

/** Chooses MI-Y and clicks "Umbuchen". */
async function rebookToY() {
  fireEvent.click(await within(dialog()).findByRole('radio', { name: /MI-Y/ }));
  fireEvent.click(rebookButton());
}

/** Accessibility assertion of a state: named dialog, title and named controls. */
function expectAccessibleDialog() {
  expect(within(dialog()).getByRole('heading', { name: 'Gerät umbuchen' })).toBeTruthy();
  for (const control of within(dialog()).getAllByRole('button')) {
    expect(control.textContent?.trim() || control.getAttribute('aria-label')).toBeTruthy();
  }
  for (const radio of within(dialog()).queryAllByRole('radio')) {
    expect(radio.closest('label')?.textContent?.trim()).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UI-010 "Umbuchen" and UI-004 in the mode "umbuchen" (CU-137, CU-134, #202, REQ-020)', () => {
  it('UI-004.default DER-61-01 "Umbuchen" in UI-010 opens UI-004 with the title "Gerät umbuchen" and the other model listings of the model template', async () => {
    mockApi();
    await openRebooking();

    const radios = await within(dialog()).findAllByRole('radio');
    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual([
      'MI-YZustand: gebraucht · Optik-Note: 4 · RAM: 16 GBStückzahl 1',
    ]);
    expect(within(dialog()).getByText('626199')).toBeTruthy();
    expect(within(dialog()).getByText('MacBook Pro 13')).toBeTruthy();
    expectAccessibleDialog();
  });

  it('UI-004.disabled deactivates "Umbuchen" without a chosen model listing, with the reason as tooltip', async () => {
    const { sent } = mockApi();
    await openRebooking();
    await within(dialog()).findByRole('radio', { name: /MI-Y/ });

    expect(rebookButton().disabled).toBe(true);
    expect(rebookButton().title).toBe('Bitte ein Modell-Inserat wählen');
    fireEvent.click(rebookButton());
    expect(sent).toEqual([]);
    expectAccessibleDialog();
  });

  it('UI-004.empty shows "Kein anderes Modell-Inserat dieser Modellvorlage" when the model template has no other model listing', async () => {
    mockApi({ listings: [MI_X] });
    await openRebooking();

    expect(
      await within(dialog()).findByText('Kein anderes Modell-Inserat dieser Modellvorlage'),
    ).toBeTruthy();
    expect(within(dialog()).queryByRole('radio')).toBeNull();
    expect(within(dialog()).queryByRole('button', { name: 'Umbuchen' })).toBeNull();
    expectAccessibleDialog();
  });

  it('UI-004.success DER-61-06 rebooks without confirmation and opens UI-014 of the target with the banner "Gerät umgebucht"', async () => {
    const { sent } = mockApi();
    const router = await openRebooking();

    await rebookToY();

    expect(await screen.findByText('Gerät umgebucht')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/inserate/4');
    expect(sent).toEqual([{ version: 3, targetListingId: 4, confirmDeviation: false }]);
    expect(screen.queryByRole('dialog', { name: 'Gerät umbuchen' })).toBeNull();
  });

  it('UI-004.error AC-REQ-020-02 shows "Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden" in the dialog after device_not_available; the dialog stays', async () => {
    mockApi({
      rebook: () =>
        Response.json(
          errorBody('device_not_available', {
            message: 'Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden',
          }),
          { status: 422 },
        ),
    });
    await openRebooking();

    await rebookToY();

    expect((await within(dialog()).findByRole('alert')).textContent).toBe(
      'Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden',
    );
    expect(within(dialog()).getByRole<HTMLInputElement>('radio', { name: /MI-Y/ }).checked).toBe(
      true,
    );
    expectAccessibleDialog();
  });

  it('UI-004.error shows "Zuordnung fehlgeschlagen. Referenz: <Nr>" when "Umbuchen" answers 500; the choice stays', async () => {
    mockApi({
      rebook: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openRebooking();

    await rebookToY();

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toContain('Zuordnung fehlgeschlagen. Referenz: R-7K2M-9QX4');
    expect(within(dialog()).getByRole<HTMLInputElement>('radio', { name: /MI-Y/ }).checked).toBe(
      true,
    );
  });

  it('shows the text of target_deviation in the dialog until its second step follows with #203; nothing is stored', async () => {
    mockApi({
      rebook: () =>
        Response.json(
          errorBody('confirmation_required', {
            message: 'Das Gerät weicht vom Ziel-Modell-Inserat ab.',
            details: { kind: 'target_deviation', deviations: [] },
          }),
          { status: 422 },
        ),
    });
    await openRebooking();

    await rebookToY();

    expect((await within(dialog()).findByRole('alert')).textContent).toBe(
      'Das Gerät weicht vom Ziel-Modell-Inserat ab.',
    );
  });

  it('UI-010 offers "Umbuchen" only for an available, assigned device', async () => {
    mockApi({ device: { ...DEVICE, stockStatus: 'sold' } });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Gerät 626199' });
    expect(screen.queryByRole('button', { name: 'Umbuchen' })).toBeNull();
    cleanup();

    mockApi({ device: { ...DEVICE, listingId: null, listing: null } });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Gerät 626199' });
    expect(screen.queryByRole('button', { name: 'Umbuchen' })).toBeNull();
  });
});
