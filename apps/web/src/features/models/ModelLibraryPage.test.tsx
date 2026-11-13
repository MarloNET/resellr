import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of UI-006 (CU-113) with a mocked `fetch` (Technical Specification 6.1, 6.2).

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const NOTEBOOK = { id: 1, name: 'Notebook', active: true, version: 1, attributeCount: 0 };
const MONITOR = { id: 2, name: 'Monitor', active: true, version: 1, attributeCount: 0 };

const MV_A = {
  id: 7,
  deviceType: { id: 1, name: 'Notebook' },
  manufacturer: { id: 3, name: 'Apple' },
  modelName: 'MacBook Pro 13',
  typeDesignation: 'A1708',
  mpn: 'MHGT3D/A',
  mpnUnknown: false,
};
const PROART = {
  id: 9,
  deviceType: { id: 2, name: 'Monitor' },
  manufacturer: { id: 4, name: 'ASUS' },
  modelName: 'ProArt PA278QV',
  typeDesignation: null,
  mpn: null,
  mpnUnknown: true,
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type ListHandler = (
  params: URLSearchParams,
  init: RequestInit | undefined,
) => Promise<Response> | Response;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame, the device types for the filter and
 * the model templates. Records the query strings of the model template requests.
 */
function mockApi({
  list = () => Response.json({ items: [PROART, MV_A], total: 2 }),
}: { list?: ListHandler } = {}) {
  const searches: URLSearchParams[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://127.0.0.1');
    if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
    if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
    if (url.pathname === '/api/device-types') {
      return Response.json({ items: [NOTEBOOK, MONITOR], total: 2 });
    }
    if (url.pathname === '/api/model-templates') {
      searches.push(url.searchParams);
      return list(url.searchParams, init);
    }
    throw new Error(`unexpected request ${init?.method ?? 'GET'} ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { searches };
}

function renderLibrary() {
  const router = createMemoryRouter(routes, { initialEntries: ['/modelle'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const searchField = () => screen.getByRole<HTMLInputElement>('searchbox', { name: 'Suchbegriff' });
const deviceTypeFilter = () =>
  screen.getByRole<HTMLSelectElement>('combobox', { name: 'Geräteart' });
const hitList = () => screen.getByRole('table', { name: 'Modellvorlagen' });
const rowLink = (name: string) => within(hitList()).getByRole('link', { name });
const createLink = () => screen.getByRole('link', { name: 'Modellvorlage anlegen' });
const pending = () => new Promise<Response>(() => {});

async function openPage() {
  const router = renderLibrary();
  await screen.findByRole('link', { name: 'MacBook Pro 13' });
  return router;
}

function type(text: string) {
  fireEvent.change(searchField(), { target: { value: text } });
}

/** Accessibility assertion of a state: heading, named controls, linked field hint. */
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Modell-Bibliothek' })).toBeTruthy();
  expect(searchField()).toBeTruthy();
  expect(deviceTypeFilter()).toBeTruthy();
  if (searchField().getAttribute('aria-invalid') === 'true') {
    const describedBy = searchField().getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
  }
  for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
    expect(control.textContent?.trim() || control.getAttribute('aria-label')).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UI-006 Modell-Bibliothek (CU-113)', () => {
  it('UI-006.default DER-51-01 shows the latest created with device type, manufacturer, names and MPN, the counter and the focus in the search field', async () => {
    const { searches } = mockApi();

    await openPage();

    expect(searches.map(String)).toEqual(['']);
    expect(document.activeElement).toBe(searchField());
    expect(screen.getByText('2 Modellvorlagen')).toBeTruthy();
    const headers = within(hitList())
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual([
      'Geräteart',
      'Hersteller',
      'Modellbezeichnung',
      'Typbezeichnung',
      'Herstellernummer',
    ]);
    const cells = (name: string) =>
      within(rowLink(name).closest('tr')!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent);
    expect(cells('MacBook Pro 13')).toEqual([
      'Notebook',
      'Apple',
      'MacBook Pro 13',
      'A1708',
      'MHGT3D/A',
    ]);
    expect(cells('ProArt PA278QV')).toEqual(['Monitor', 'ASUS', 'ProArt PA278QV', '', 'unbekannt']);
    expect(createLink().getAttribute('href')).toBe('/modelle/neu');
    expectAccessiblePage();
  });

  it('UI-006.loading DER-51-02 shows the placeholder "Suche …" while the request runs', async () => {
    mockApi({ list: pending });

    renderLibrary();

    expect((await screen.findByRole('status')).textContent).toBe('Suche …');
    expect(screen.queryByRole('table')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-006.loading DER-51-02 shows "Suche …" instead of the old hits while a search runs', async () => {
    mockApi({
      list: (params) => (params.has('q') ? pending() : Response.json({ items: [MV_A], total: 1 })),
    });
    await openPage();

    type('macbook');

    expect((await screen.findByRole('status')).textContent).toBe('Suche …');
    expect(screen.queryByRole('link', { name: 'MacBook Pro 13' })).toBeNull();
  });

  it('AC-REQ-009-01 the search "macbook pro" asks the server and lists MV-A with all columns', async () => {
    const { searches } = mockApi({
      list: (params) =>
        Response.json(params.has('q') ? { items: [MV_A], total: 1 } : { items: [], total: 0 }),
    });
    renderLibrary();
    await screen.findByText('Noch keine Modellvorlagen');

    type('macbook pro');

    await screen.findByRole('link', { name: 'MacBook Pro 13' });
    expect(searches.at(-1)?.get('q')).toBe('macbook pro');
    expect(screen.getByText('1 Modellvorlagen')).toBeTruthy();
    expect(within(rowLink('MacBook Pro 13').closest('tr')!).getByText('MHGT3D/A')).toBeTruthy();
  });

  it('UI-006.empty (Bibliothek) DER-51-03 shows "Noch keine Modellvorlagen" and "Modellvorlage anlegen"', async () => {
    mockApi({ list: () => Response.json({ items: [], total: 0 }) });

    renderLibrary();

    expect(await screen.findByText('Noch keine Modellvorlagen')).toBeTruthy();
    expect(screen.queryByText('Keine Modellvorlage gefunden')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(createLink().getAttribute('href')).toBe('/modelle/neu');
    expectAccessiblePage();
  });

  it('UI-006.empty (Treffer) AC-REQ-009-03 shows "Keine Modellvorlage gefunden" for "Zenbook" and offers creating one', async () => {
    const { searches } = mockApi({
      list: (params) =>
        params.has('q')
          ? Response.json({ items: [], total: 0 })
          : Response.json({ items: [MV_A], total: 1 }),
    });
    await openPage();

    type('Zenbook');

    expect(await screen.findByText('Keine Modellvorlage gefunden')).toBeTruthy();
    expect(searches.at(-1)?.get('q')).toBe('Zenbook');
    expect(screen.queryByText('Noch keine Modellvorlagen')).toBeNull();
    expect(createLink().getAttribute('href')).toBe('/modelle/neu');
    expectAccessiblePage();
  });

  it('UI-006.validation AC-REQ-009-04 a search term with 1 character shows "Mindestens 2 Zeichen" and does not search', async () => {
    const { searches } = mockApi();
    await openPage();

    type('m');

    expect(await screen.findByText('Mindestens 2 Zeichen')).toBeTruthy();
    expect(searchField().getAttribute('aria-invalid')).toBe('true');
    // Longer than the wait before a search: still no request with `q`.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(searches.filter((params) => params.has('q'))).toEqual([]);
    expect(rowLink('MacBook Pro 13')).toBeTruthy();
    expectAccessiblePage();

    type('mb');
    await vi.waitFor(() => expect(searches.at(-1)?.get('q')).toBe('mb'));
    expect(screen.queryByText('Mindestens 2 Zeichen')).toBeNull();
  });

  it('UI-006.error DER-51-04 shows "Suche fehlgeschlagen. Referenz: <Nr>" with the reference number of the answer', async () => {
    mockApi({
      list: (params) =>
        params.has('q')
          ? Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
              status: 500,
            })
          : Response.json({ items: [MV_A], total: 1 }),
    });
    await openPage();

    type('macbook');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe('Suche fehlgeschlagen. Referenz: R-7K2M-9QX4');
    expect(searchField().value).toBe('macbook');
    expectAccessiblePage();
  });

  it('DER-51-07 shows P-06 with "Erneut versuchen" without replacing the page when the request gets no answer; it disappears after an answer', async () => {
    let reachable = false;
    mockApi({
      list: () => {
        if (!reachable) throw new TypeError('Failed to fetch');
        return Response.json({ items: [MV_A], total: 1 });
      },
    });
    renderLibrary();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(searchField()).toBeTruthy();
    expect(screen.queryByText('Noch keine Modellvorlagen')).toBeNull();
    expectAccessiblePage();

    reachable = true;
    fireEvent.click(within(banner).getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByRole('link', { name: 'MacBook Pro 13' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('DER-51-07 shows P-06 when the request takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      list: (_params, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    renderLibrary();
    await screen.findByText('Suche …');

    await vi.advanceTimersByTimeAsync(5000);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'resellr ist nicht erreichbar.',
    );
    expect(searchField()).toBeTruthy();
  });

  it('DER-51-05 the device type filter asks only for model templates of this device type', async () => {
    const { searches } = mockApi({
      list: (params) =>
        Response.json(
          params.get('deviceTypeId') === '2'
            ? { items: [PROART], total: 1 }
            : { items: [PROART, MV_A], total: 2 },
        ),
    });
    await openPage();
    await within(deviceTypeFilter()).findByRole('option', { name: 'Monitor' });

    fireEvent.change(deviceTypeFilter(), { target: { value: '2' } });

    await vi.waitFor(() => expect(screen.getByText('1 Modellvorlagen')).toBeTruthy());
    expect(searches.at(-1)?.get('deviceTypeId')).toBe('2');
    expect(rowLink('ProArt PA278QV')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'MacBook Pro 13' })).toBeNull();
  });

  it('DER-51-06 a click on a row opens UI-007 with this model template', async () => {
    mockApi();
    const router = await openPage();

    fireEvent.click(within(rowLink('MacBook Pro 13').closest('tr')!).getByText('Apple'));

    expect(router.state.location.pathname).toBe('/modelle/7');
  });

  it('DER-51-06 arrow keys choose a row and Enter opens UI-007 with it', async () => {
    mockApi();
    const router = await openPage();

    fireEvent.keyDown(searchField(), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowLink('ProArt PA278QV'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowLink('MacBook Pro 13'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowLink('MacBook Pro 13'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rowLink('ProArt PA278QV'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(searchField());

    fireEvent.keyDown(searchField(), { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });

    expect(router.state.location.pathname).toBe('/modelle/7');
  });

  it('DER-51-06 "Modellvorlage anlegen" opens UI-007 for a new model template', async () => {
    mockApi();
    const router = await openPage();

    fireEvent.click(createLink());

    expect(router.state.location.pathname).toBe('/modelle/neu');
  });
});
