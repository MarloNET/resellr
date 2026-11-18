import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of UI-009, tab "Suche" (CU-136) with a mocked `fetch` (Technical
// Specification 6.1, 6.2).

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const CANCELLED = {
  id: 4,
  wiNr: '633641',
  modelTemplateLabel: 'ThinkPad T14',
  listing: null,
  stockStatus: 'cancelled',
  captureStatus: 'checked',
};
const AVAILABLE = {
  id: 5,
  wiNr: '633641',
  modelTemplateLabel: 'ThinkPad T14',
  listing: { id: 2, title: 'Lenovo ThinkPad T14, 16 GB, 512 GB' },
  stockStatus: 'available',
  captureStatus: 'review_pending',
};
const SOLD = {
  id: 6,
  wiNr: 'A633642',
  modelTemplateLabel: 'iPhone 13',
  listing: { id: 3, title: 'Apple iPhone 13, 128 GB' },
  stockStatus: 'sold',
  captureStatus: 'checked',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type SearchHandler = (
  params: URLSearchParams,
  init: RequestInit | undefined,
) => Promise<Response> | Response;

/** `fetch` of the page: the frame's status and the device search; records the searches. */
function mockApi({
  search = () => Response.json({ items: [CANCELLED, AVAILABLE, SOLD] }),
}: { search?: SearchHandler } = {}) {
  const searches: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://127.0.0.1');
      if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (url.pathname === '/api/devices') {
        searches.push(url.search);
        return search(url.searchParams, init);
      }
      if (url.pathname.startsWith('/api/devices/')) return new Promise<Response>(() => {});
      throw new Error(`unexpected request ${init?.method ?? 'GET'} ${url.pathname}`);
    }),
  );
  return { searches };
}

function renderPage(path = '/geraete') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const searchField = () => screen.getByRole<HTMLInputElement>('searchbox', { name: 'WI-Nr' });
const hitList = () => screen.getByRole('table', { name: 'Treffer' });
const pending = () => new Promise<Response>(() => {});

async function openPage(path?: string) {
  const router = renderPage(path);
  await screen.findByRole('searchbox', { name: 'WI-Nr' });
  return router;
}

function type(text: string) {
  fireEvent.change(searchField(), { target: { value: text } });
}

/** Accessibility assertion of a state: heading, selected tab, named controls. */
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Geräte' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Suche' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('tabpanel', { name: 'Suche' })).toBeTruthy();
  expect(searchField()).toBeTruthy();
  for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
    expect(control.textContent?.trim() || control.getAttribute('aria-label')).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UI-009 Geräte, tab "Suche" (CU-136)', () => {
  it('UI-009.default DER-54-09 DER-87-02 has the focus in the search field, the tab "Suche" and "Gerät einbuchen", without a search', async () => {
    const { searches } = mockApi();

    await openPage();

    expect(document.activeElement).toBe(searchField());
    const content = screen.getByRole('main');
    expect(
      within(content).getByRole('link', { name: 'Gerät einbuchen' }).getAttribute('href'),
    ).toBe('/geraete/neu');
    expect(screen.queryByRole('table')).toBeNull();
    expect(searches).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-009.default DER-87-02 shows the tab "Suche" also with ?reiter=suche and an unknown tab', async () => {
    mockApi();

    await openPage('/geraete?reiter=suche');
    expectAccessiblePage();
    cleanup();

    await openPage('/geraete?reiter=unbekannt');
    expectAccessiblePage();
  });

  it('DER-54-09 a part of a WI-Nr lists WI-Nr, model template, model listing or "nicht zugeordnet", inventory and capture status of each hit', async () => {
    const { searches } = mockApi();
    await openPage();

    type('6336');

    await screen.findByRole('table', { name: 'Treffer' });
    expect(searches).toEqual(['?wiNr=6336']);
    const headers = within(hitList())
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual([
      'WI-Nr',
      'Modellvorlage',
      'Modell-Inserat',
      'Bestandsstatus',
      'Erfassungsstatus',
    ]);
    const rows = within(hitList())
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );
    expect(rows).toEqual([
      ['633641', 'ThinkPad T14', 'nicht zugeordnet', 'storniert', 'geprüft'],
      [
        '633641',
        'ThinkPad T14',
        'Lenovo ThinkPad T14, 16 GB, 512 GB',
        'verfügbar',
        'unvollständig geprüft',
      ],
      ['A633642', 'iPhone 13', 'Apple iPhone 13, 128 GB', 'verkauft', 'geprüft'],
    ]);
    expectAccessiblePage();
  });

  it('UI-009.loading DER-54-09 DER-87-01 shows "Suche …" while the search runs', async () => {
    mockApi({ search: pending });
    await openPage();

    type('6336');

    expect((await screen.findByRole('status')).textContent).toBe('Suche …');
    expect(screen.queryByRole('table')).toBeNull();
    expectAccessiblePage();
  });

  it('AC-REQ-016-02 UI-009.empty (Suche) DER-54-09 shows "Kein Gerät mit dieser WI-Nr" without a hit', async () => {
    mockApi({ search: () => Response.json({ items: [] }) });
    await openPage();

    type('999');

    expect(await screen.findByText('Kein Gerät mit dieser WI-Nr')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-009.error DER-54-09 DER-87-01 shows "Suche fehlgeschlagen. Referenz: <Nr>" on 500 internal_error, keeping the input', async () => {
    mockApi({
      search: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openPage();

    type('6336');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe('Suche fehlgeschlagen. Referenz: R-7K2M-9QX4');
    expect(searchField().value).toBe('6336');
    expectAccessiblePage();
  });

  it('clearing the field removes the hits without a new search', async () => {
    const { searches } = mockApi();
    await openPage();
    type('6336');
    await screen.findByRole('table', { name: 'Treffer' });

    type('  ');

    await vi.waitFor(() => expect(screen.queryByRole('table')).toBeNull());
    expect(searches).toEqual(['?wiNr=6336']);
  });

  it('DER-54-10 DER-87-02 a click on a row opens UI-010 with this device', async () => {
    mockApi();
    const router = await openPage();
    type('6336');
    await screen.findByRole('table', { name: 'Treffer' });

    fireEvent.click(within(hitList()).getAllByRole('cell', { name: 'ThinkPad T14' })[1]!);

    expect(router.state.location.pathname).toBe('/geraete/5');
  });

  it('DER-54-10 DER-87-02 each WI-Nr is a link to UI-010, so Enter on it opens the device', async () => {
    mockApi();
    await openPage();
    type('6336');
    await screen.findByRole('table', { name: 'Treffer' });

    const links = within(hitList()).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/geraete/4',
      '/geraete/5',
      '/geraete/6',
    ]);
  });

  it('DER-87-02 Enter in the search field opens the first row when there is exactly one hit', async () => {
    const { searches } = mockApi({ search: () => Response.json({ items: [SOLD] }) });
    const router = await openPage();

    type('A6336');
    fireEvent.submit(searchField());

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/geraete/6'));
    expect(searches).toEqual(['?wiNr=A6336']);
  });

  it('DER-87-02 Enter after the hits have arrived opens the only hit', async () => {
    mockApi({ search: () => Response.json({ items: [SOLD] }) });
    const router = await openPage();
    type('A6336');
    await screen.findByRole('table', { name: 'Treffer' });

    fireEvent.submit(searchField());

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/geraete/6'));
  });

  it('DER-87-02 Enter with more than one hit stays in the hit list', async () => {
    mockApi();
    const router = await openPage();
    type('6336');
    await screen.findByRole('table', { name: 'Treffer' });

    fireEvent.submit(searchField());

    await screen.findByRole('table', { name: 'Treffer' });
    expect(router.state.location.pathname).toBe('/geraete');
    expect(within(hitList()).getAllByRole('row')).toHaveLength(4);
  });

  it('DER-87-02 Enter without a hit shows "Kein Gerät mit dieser WI-Nr" and stays on the page', async () => {
    mockApi({ search: () => Response.json({ items: [] }) });
    const router = await openPage();
    type('999');

    fireEvent.submit(searchField());

    expect(await screen.findByText('Kein Gerät mit dieser WI-Nr')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/geraete');
  });

  it('UI-009.unreachable DER-87-04 shows P-06 with "Erneut versuchen" above the page when the search gets no answer; it disappears after an answer', async () => {
    let reachable = false;
    mockApi({
      search: () => {
        if (!reachable) throw new TypeError('Failed to fetch');
        return Response.json({ items: [SOLD] });
      },
    });
    await openPage();
    type('A6336');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(banner.textContent).not.toContain('Suche fehlgeschlagen');
    expect(searchField().value).toBe('A6336');
    expectAccessiblePage();

    reachable = true;
    fireEvent.click(within(banner).getByRole('button', { name: 'Erneut versuchen' }));

    await screen.findByRole('table', { name: 'Treffer' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-009.unreachable DER-87-04 shows P-06 when the search takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      search: (_params, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    await openPage();
    type('A6336');
    await screen.findByRole('status');

    await vi.advanceTimersByTimeAsync(5000);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'resellr ist nicht erreichbar.',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Geräte' })).toBeTruthy();
  });

  it('DER-87-05 the button "Gerät einbuchen" opens UI-003', async () => {
    mockApi();
    const router = await openPage();

    fireEvent.click(
      within(screen.getByRole('main')).getByRole('link', { name: 'Gerät einbuchen' }),
    );

    expect(router.state.location.pathname).toBe('/geraete/neu');
  });
});
