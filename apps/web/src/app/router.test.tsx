import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router';

import { NAVIGATION_ENTRIES } from './Navigation.tsx';
import { createQueryClient } from './query-client.ts';
import { routes } from './router.tsx';

const DATA_DIR_PATH = 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten';

function renderAt(path: string, routeObjects: RouteObject[] = routes) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const fetchMock = vi.fn<typeof fetch>();

describe('router and application frame', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () =>
      Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('E1 redirects / to /inserate and shows the empty state of UI-002 in the content area', async () => {
    const router = renderAt('/');

    const content = await screen.findByTestId('content-area');
    expect(router.state.location.pathname).toBe('/inserate');
    expect(within(content).getByText('Noch keine Modell-Inserate')).toBeTruthy();
    expect(
      within(content).getByRole('link', { name: 'Gerät einbuchen' }).getAttribute('href'),
    ).toBe('/geraete/neu');
  });

  it('E2 shows the fixed head "resellr" and the six entries in their own scrolling area', () => {
    renderAt('/inserate');

    const column = screen.getByTestId('navigation-column');
    const head = within(column).getByText('resellr');
    const scrollArea = screen.getByTestId('navigation-scroll-area');
    expect(head.closest('[data-testid="navigation-scroll-area"]')).toBeNull();
    expect(column.className).toContain('w-nav');
    expect(head.className).toContain('h-nav-header');
    expect(scrollArea.className).toContain('overflow-y-auto');
    expect(scrollArea.className).toContain('overflow-x-hidden');

    const links = within(scrollArea).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Inserate',
      'Gerät einbuchen',
      'Modell-Bibliothek',
      'Geräte',
      'Änderungsprotokoll',
      'Einstellungen',
    ]);
    for (const link of links) expect(link.className).toContain('h-nav-item');
  });

  it('E2 each entry leads to the route of its screen (Technical Specification 4.2)', () => {
    renderAt('/inserate');

    const hrefs = screen
      .getAllByRole('link')
      .filter((link) => link.closest('nav'))
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      '/inserate',
      '/geraete/neu',
      '/modelle',
      '/geraete',
      '/protokoll',
      '/einstellungen',
    ]);
  });

  it('E2 marks the entry of the current screen', () => {
    renderAt('/inserate');

    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(within(nav).getByRole('link', { current: 'page' }).textContent).toBe('Inserate');
  });

  it.each([
    ['/geraete/neu', 'Gerät einbuchen'],
    ['/geraete', 'Geräte'],
    ['/geraete/17', 'Geräte'],
    ['/modelle/neu', 'Modell-Bibliothek'],
    ['/einstellungen/lieferanten', 'Einstellungen'],
    ['/protokoll', 'Änderungsprotokoll'],
  ])('E2 marks exactly one entry for %s', (path, label) => {
    expect(NAVIGATION_ENTRIES.filter((entry) => entry.isCurrent(path)).map((e) => e.label)).toEqual(
      [label],
    );
  });

  it.each([
    ['/geraete/neu', 'Gerät einbuchen'],
    ['/geraete/17', 'Geräte'],
    ['/einstellungen/lieferanten', 'Einstellungen'],
  ])('E2 renders aria-current and the marking on exactly one entry for %s', (path, label) => {
    renderAt(path);

    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const current = within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual([label]);
    const marked = within(nav)
      .getAllByRole('link')
      .filter((link) => link.className.includes('text-primary'));
    expect(marked.map((link) => link.textContent)).toEqual([label]);
  });

  it('E2 an entry whose screen does not exist yet keeps the frame and the navigation', () => {
    const router = renderAt('/inserate');

    fireEvent.click(screen.getByRole('link', { name: 'Modell-Bibliothek' }));

    expect(router.state.location.pathname).toBe('/modelle');
    expect(screen.getByText('resellr')).toBeTruthy();
    expect(screen.getByTestId('content-area').textContent).toBe('');
    fireEvent.click(screen.getByRole('link', { name: 'Inserate' }));
    expect(screen.getByText('Noch keine Modell-Inserate')).toBeTruthy();
  });

  it('fallback route * keeps frame and navigation for a path outside Technical Specification 4.2', () => {
    const router = renderAt('/unbekannt');

    expect(router.state.location.pathname).toBe('/unbekannt');
    expect(within(screen.getByTestId('navigation-column')).getByText('resellr')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(NAVIGATION_ENTRIES.length);
    expect(links.filter((link) => link.hasAttribute('aria-current'))).toEqual([]);
    expect(links.filter((link) => link.className.includes('text-primary'))).toEqual([]);
    const content = screen.getByTestId('content-area');
    expect(content.childElementCount).toBe(0);
    expect(content.textContent).toBe('');
  });

  it('E8 the frame never scrolls horizontally: content area with min-width 0 and no x-overflow', () => {
    renderAt('/inserate');

    const content = screen.getByTestId('content-area');
    expect(content.className).toContain('min-w-0');
    expect(content.className).toContain('overflow-x-hidden');
  });

  it.each(['/inserate', '/geraete/neu', '/modelle', '/einstellungen/haendlermarke', '/unbekannt'])(
    'DER-95-01 shows the backup notice with the path below the entries on %s',
    async (path) => {
      renderAt(path);

      const scrollArea = screen.getByTestId('navigation-scroll-area');
      const notice = within(scrollArea).getByRole('region', { name: 'Sicherung einrichten' });
      expect(await within(notice).findByText(DATA_DIR_PATH)).toBeTruthy();
      expect(within(notice).getByText(FIXED_TEXTS.backupNoticeIntro)).toBeTruthy();
      expect(within(notice).getByText(FIXED_TEXTS.backupNoticeWarning)).toBeTruthy();
      const nav = within(scrollArea).getByRole('navigation', { name: 'Hauptnavigation' });
      // Below the entries in the same scrolling area, pushed to its end (2.17, variant A).
      expect(nav.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(notice.closest('.mt-auto')).not.toBeNull();
    },
  );

  it('DER-95-01 keeps the backup notice with the path after a change of page', async () => {
    const router = renderAt('/inserate');
    await screen.findByText(DATA_DIR_PATH);

    fireEvent.click(screen.getByRole('link', { name: 'Modell-Bibliothek' }));
    expect(router.state.location.pathname).toBe('/modelle');
    const notice = screen.getByRole('region', { name: 'Sicherung einrichten' });
    expect(within(notice).getByText(DATA_DIR_PATH)).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: 'Einstellungen' }));
    expect(router.state.location.pathname).toBe('/einstellungen/haendlermarke');
    expect(
      within(screen.getByRole('region', { name: 'Sicherung einrichten' })).getByText(DATA_DIR_PATH),
    ).toBeTruthy();
  });

  it('DER-95-01 shows no backup notice on a route outside the frame like /beendet (UI-046)', () => {
    // UI-046 (#143) is not built yet; its route will sit outside AppFrame like this one.
    renderAt('/beendet', [
      { path: '/beendet', element: <p>{FIXED_TEXTS.shutdownDone}</p> },
      ...routes,
    ]);

    expect(screen.getByText(FIXED_TEXTS.shutdownDone)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Sicherung einrichten' })).toBeNull();
    expect(screen.queryByText('Sicherung einrichten')).toBeNull();
  });
});
