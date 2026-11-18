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

type SearchHandler = (params: URLSearchParams) => Promise<Response> | Response;

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
      if (url.pathname === '/api/devices') {
        searches.push(url.search);
        return search(url.searchParams);
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
  vi.unstubAllGlobals();
});

describe('UI-009 Geräte, tab "Suche" (CU-136)', () => {
  it('UI-009.default DER-54-09 has the focus in the search field, the tab "Suche" and "Gerät einbuchen", without a search', async () => {
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

  it('UI-009.default shows the tab "Suche" also with ?reiter=suche and an unknown tab', async () => {
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

  it('UI-009.loading DER-54-09 shows "Suche …" while the search runs', async () => {
    mockApi({ search: pending });
    await openPage();

    type('6336');

    expect((await screen.findByRole('status')).textContent).toBe('Suche …');
    expect(screen.queryByRole('table')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-009.empty (Suche) DER-54-09 shows "Kein Gerät mit dieser WI-Nr" without a hit', async () => {
    mockApi({ search: () => Response.json({ items: [] }) });
    await openPage();

    type('999');

    expect(await screen.findByText('Kein Gerät mit dieser WI-Nr')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-009.error DER-54-09 shows "Suche fehlgeschlagen. Referenz: <Nr>" on 500 internal_error, keeping the input', async () => {
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

  it('DER-54-10 a click on a row opens UI-010 with this device', async () => {
    mockApi();
    const router = await openPage();
    type('6336');
    await screen.findByRole('table', { name: 'Treffer' });

    fireEvent.click(within(hitList()).getAllByRole('cell', { name: 'ThinkPad T14' })[1]!);

    expect(router.state.location.pathname).toBe('/geraete/5');
  });

  it('DER-54-10 each WI-Nr is a link to UI-010, so Enter on it opens the device', async () => {
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
});
