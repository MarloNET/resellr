import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { NAVIGATION_ENTRIES } from './Navigation.tsx';
import { routes } from './router.tsx';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('router and application frame', () => {
  afterEach(cleanup);

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
      '/einstellungen/haendlermarke',
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

  it('E2 an entry whose screen does not exist yet keeps the frame and the navigation', () => {
    const router = renderAt('/inserate');

    fireEvent.click(screen.getByRole('link', { name: 'Modell-Bibliothek' }));

    expect(router.state.location.pathname).toBe('/modelle');
    expect(screen.getByText('resellr')).toBeTruthy();
    expect(screen.getByTestId('content-area').textContent).toBe('');
    fireEvent.click(screen.getByRole('link', { name: 'Inserate' }));
    expect(screen.getByText('Noch keine Modell-Inserate')).toBeTruthy();
  });

  it('E8 the frame never scrolls horizontally: content area with min-width 0 and no x-overflow', () => {
    renderAt('/inserate');

    const content = screen.getByTestId('content-area');
    expect(content.className).toContain('min-w-0');
    expect(content.className).toContain('overflow-x-hidden');
  });
});
