import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { ListingPage } from '../listings/ListingPage.tsx';
import { rebookedLocation } from './AssignDialog.tsx';
import { DeviationDialog } from './DeviationDialog.tsx';

// Component tests of the action "Umbuchen" in dialog UI-005 (CU-135, #202, REQ-020; Technical
// Specification 2.6 "Zustände") for an already assigned device, with a mocked `fetch` (6.1, 6.2).

/** "626199" of MV-A (3), assigned to MI-X (9). */
const DEVICE = { id: 41, version: 2, modelTemplateId: 3 };

const choice = (id: number, displayTitle: string, visualGrade: number, quantity: number) => ({
  id,
  displayTitle,
  variantSummary: {
    conditionLabel: 'gebraucht',
    visualGrade,
    conditionDescription: '',
    variantValues: [],
  },
  quantity,
});
const VISUAL_GRADE = {
  key: 'visualGrade',
  label: 'Optik-Note',
  deviceValue: '4',
  listingValue: '2',
};
const MI_X = { ...choice(9, 'MI-X', 2, 2), deviations: [VISUAL_GRADE] };
const MI_Y = { ...choice(11, 'MI-Y', 4, 1), deviations: [] };

const REBOOKING = {
  device: {
    id: 41,
    wiNr: '626199',
    modelTemplateId: 3,
    listingId: 11,
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
    version: 3,
    updatedAt: '2026-11-18T08:05:00.000Z',
  },
  listing: { id: 11, quantity: 2 },
  previousListing: { id: 9, quantity: 1 },
  adjustStockChannels: [],
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Answer = () => Response | Promise<Response>;

/**
 * `fetch` answering the model listings of MV-A with their deviations (`listings`) and
 * `POST /api/devices/41/rebooking` with `rebook`; every other read (UI-014) stays without answer.
 */
function mockApi({
  listings = [MI_X, MI_Y],
  rebook = () => Response.json(REBOOKING) as Response | Promise<Response>,
}: { listings?: object[]; rebook?: Answer } = {}) {
  const sent: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://127.0.0.1');
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url.pathname === '/api/model-templates/3/listings') {
        return Response.json({ items: listings });
      }
      if (method === 'POST' && url.pathname === '/api/devices/41/rebooking') {
        sent.push(JSON.parse(String(init?.body)));
        return rebook();
      }
      if (method !== 'GET') throw new Error(`unexpected request ${method} ${url.pathname}`);
      return new Promise<Response>(() => {});
    }),
  );
  return { sent };
}

/** UI-005 for the device, assigned to MI-X unless `assigned` is `false`. */
function renderDialog({ assigned = true } = {}) {
  function Host() {
    const navigate = useNavigate();
    return (
      <DeviationDialog
        deviations={[VISUAL_GRADE]}
        device={DEVICE}
        listingId={9}
        assignedListingId={assigned ? 9 : undefined}
        onClose={() => {}}
        onAssigned={() => {}}
        onRebooked={(rebooking) => void navigate(...rebookedLocation(rebooking))}
      />
    );
  }
  const router = createMemoryRouter(
    [
      { path: '/geraete/:deviceId', element: <Host /> },
      { path: '/inserate/:listingId', element: <ListingPage /> },
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

const dialog = () => screen.getByRole('dialog', { name: 'Abweichungen bei Zuordnung' });
const footerRebook = () =>
  within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Umbuchen' });
const targets = () =>
  within(dialog()).getByRole('region', { name: 'Anderes Modell-Inserat derselben Modellvorlage' });

/** Waits for the model listings of UI-005 and opens the choice of the target. */
async function openChoice() {
  await within(dialog()).findByRole('table');
  await vi.waitFor(() => expect(footerRebook().disabled).toBe(false));
  fireEvent.click(footerRebook());
}

/** Accessibility assertion of a state: named dialog, title and named controls. */
function expectAccessibleDialog() {
  expect(
    within(dialog()).getByRole('heading', { name: 'Abweichungen bei Zuordnung' }),
  ).toBeTruthy();
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

describe('UI-005 "Umbuchen" (CU-135, #202, REQ-020)', () => {
  it('UI-005.disabled DER-61-02 "Umbuchen" is not available without another model listing of the model template and shows "Kein anderes Modell-Inserat dieser Modellvorlage"', async () => {
    const { sent } = mockApi({ listings: [MI_X] });
    renderDialog();

    expect(
      await within(dialog()).findByText('Kein anderes Modell-Inserat dieser Modellvorlage'),
    ).toBeTruthy();
    expect(footerRebook().disabled).toBe(true);
    expect(footerRebook().title).toBe('Kein anderes Modell-Inserat dieser Modellvorlage');
    fireEvent.click(footerRebook());
    expect(within(dialog()).queryByRole('radio')).toBeNull();
    expect(sent).toEqual([]);
    expectAccessibleDialog();
  });

  it('UI-005.default "Umbuchen" opens in the dialog the other model listings of the model template with title, variant data and quantity', async () => {
    mockApi();
    renderDialog();

    await openChoice();

    expect(
      within(targets())
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['MI-YZustand: gebraucht · Optik-Note: 4Stückzahl 1']);
    const rebook = within(targets()).getByRole<HTMLButtonElement>('button', { name: 'Umbuchen' });
    expect(rebook.disabled).toBe(true);
    expectAccessibleDialog();
  });

  it('UI-005.success DER-61-06 "Umbuchen" rebooks to the chosen target without confirmation and opens UI-014 of it with the banner "Gerät umgebucht"', async () => {
    const { sent } = mockApi();
    const router = renderDialog();
    await openChoice();

    fireEvent.click(within(targets()).getByRole('radio', { name: /MI-Y/ }));
    fireEvent.click(within(targets()).getByRole('button', { name: 'Umbuchen' }));

    expect(await screen.findByText('Gerät umgebucht')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/inserate/11');
    expect(sent).toEqual([{ version: 2, targetListingId: 11, confirmDeviation: false }]);
  });

  it('UI-005.error shows "Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden" after device_not_available; the dialog stays', async () => {
    mockApi({
      rebook: () =>
        Response.json(
          errorBody('device_not_available', {
            message: 'Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden',
          }),
          { status: 422 },
        ),
    });
    renderDialog();
    await openChoice();

    fireEvent.click(within(targets()).getByRole('radio', { name: /MI-Y/ }));
    fireEvent.click(within(targets()).getByRole('button', { name: 'Umbuchen' }));

    expect((await within(dialog()).findByRole('alert')).textContent).toBe(
      'Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden',
    );
    expectAccessibleDialog();
  });

  it('does not offer "Umbuchen" for a device that is not assigned yet (Kontext A)', async () => {
    mockApi();
    renderDialog({ assigned: false });

    await within(dialog()).findByRole('table');
    expect(within(dialog()).queryByRole('button', { name: 'Umbuchen' })).toBeNull();
    expect(
      within(dialog()).queryByText('Kein anderes Modell-Inserat dieser Modellvorlage'),
    ).toBeNull();
  });
});
