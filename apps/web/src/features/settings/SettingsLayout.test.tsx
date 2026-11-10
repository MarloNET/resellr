import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '../../app/router.tsx';
import { LAST_SECTION_STORAGE_KEY, SETTINGS_SECTIONS } from './SettingsLayout.tsx';

const DESIGNED_SECTIONS = [
  'Händlermarke',
  'Gerätearten und Merkmale',
  'Auswahllisten',
  'Titelmuster',
  'Textbausteine',
  'Hersteller und GPSR',
  'Lieferanten',
  'Code-Übersetzung',
  'Zustandszuordnung',
  'Kategoriezuordnung',
  'Merkmalszuordnung',
  'Beschreibungsvorlagen',
  'Kanäle und Preisregeln',
  'Datenblatt-Layout',
];

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

function sectionList() {
  return screen.getByRole('navigation', { name: 'Einstellungen' });
}

describe('UI-025 settings layout (CU-093)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('UI-025.default: DER-33-01 lists exactly the 14 designed sections without "Zugangspasswort" and opens "Händlermarke" first', async () => {
    const router = renderAt('/inserate');

    const mainNavigation = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    fireEvent.click(within(mainNavigation).getByRole('link', { name: 'Einstellungen' }));

    const links = within(
      await screen.findByRole('navigation', { name: 'Einstellungen' }),
    ).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(DESIGNED_SECTIONS);
    expect(within(sectionList()).queryByText('Zugangspasswort')).toBeNull();
    expect(router.state.location.pathname).toBe('/einstellungen/haendlermarke');
    expect(within(sectionList()).getByRole('link', { current: 'page' }).textContent).toBe(
      'Händlermarke',
    );
  });

  it('UI-025.default: each section leads to /einstellungen/:bereich (Technical Specification 4.2)', () => {
    renderAt('/einstellungen/haendlermarke');

    expect(
      within(sectionList())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(
      [
        'haendlermarke',
        'geraetearten',
        'auswahllisten',
        'titelmuster',
        'textbausteine',
        'hersteller',
        'lieferanten',
        'code-uebersetzung',
        'zustandszuordnung',
        'kategoriezuordnung',
        'merkmalszuordnung',
        'beschreibungsvorlagen',
        'kanaele',
        'datenblatt-layout',
      ].map((slug) => `/einstellungen/${slug}`),
    );
    expect(SETTINGS_SECTIONS).toHaveLength(14);
  });

  it('UI-025.default: DER-33-02 remembers the last opened section and opens it again', async () => {
    const router = renderAt('/einstellungen/haendlermarke');

    fireEvent.click(within(sectionList()).getByRole('link', { name: 'Auswahllisten' }));
    expect(
      await screen.findByRole('link', { name: 'Auswahllisten', current: 'page' }),
    ).toBeTruthy();
    expect(localStorage.getItem(LAST_SECTION_STORAGE_KEY)).toBe('auswahllisten');

    fireEvent.click(screen.getByRole('link', { name: 'Inserate' }));
    await screen.findByText('Noch keine Modell-Inserate');
    const mainNavigation = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    fireEvent.click(within(mainNavigation).getByRole('link', { name: 'Einstellungen' }));

    expect(
      await screen.findByRole('link', { name: 'Auswahllisten', current: 'page' }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe('/einstellungen/auswahllisten');
  });

  it('UI-025.default: /einstellungen opens the remembered section', async () => {
    localStorage.setItem(LAST_SECTION_STORAGE_KEY, 'lieferanten');
    const router = renderAt('/einstellungen');

    expect(await screen.findByRole('link', { name: 'Lieferanten', current: 'page' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/einstellungen/lieferanten');
  });

  it('UI-025.default: an unknown remembered value falls back to "Händlermarke"', async () => {
    localStorage.setItem(LAST_SECTION_STORAGE_KEY, 'zugangspasswort');
    const router = renderAt('/einstellungen');

    expect(await screen.findByRole('link', { name: 'Händlermarke', current: 'page' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/einstellungen/haendlermarke');
  });

  it('UI-025.default: arrow down and up move the focus through the list, Enter opens', async () => {
    const router = renderAt('/einstellungen/haendlermarke');
    const list = sectionList();
    const link = (name: string) => within(list).getByRole('link', { name });

    link('Händlermarke').focus();
    fireEvent.keyDown(link('Händlermarke'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(link('Gerätearten und Merkmale'));
    fireEvent.keyDown(link('Gerätearten und Merkmale'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(link('Auswahllisten'));
    fireEvent.keyDown(link('Auswahllisten'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(link('Gerätearten und Merkmale'));

    // Enter on a link follows it (browser behaviour of <a>); jsdom models that as a click.
    fireEvent.click(link('Gerätearten und Merkmale'));
    expect(
      await screen.findByRole('link', { name: 'Gerätearten und Merkmale', current: 'page' }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe('/einstellungen/geraetearten');
  });

  it('UI-025.default: the focus stays on the first and last entry at the ends of the list', () => {
    renderAt('/einstellungen/haendlermarke');
    const links = within(sectionList()).getAllByRole('link');
    const first = links[0]!;
    const last = links[links.length - 1]!;

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(last);
  });

  it('UI-025.default: DER-33-03 the list stands above the content below `full` and beside it from `full` on (R-1)', () => {
    renderAt('/einstellungen/haendlermarke');

    const layout = screen.getByTestId('settings-layout');
    expect(layout.className).toContain('flex-col');
    expect(layout.className).toContain('full:flex-row');
    const column = screen.getByTestId('settings-section-column');
    expect(column.className).toContain('full:w-60');
    expect(layout.firstElementChild).toBe(column);
    expect(screen.getByTestId('settings-content').className).toContain('min-w-0');
  });

  it('UI-025.default: a throwing localStorage.getItem still opens "Händlermarke" in the frame', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });
    const router = renderAt('/einstellungen');

    expect(await screen.findByRole('link', { name: 'Händlermarke', current: 'page' })).toBeTruthy();
    expect(within(sectionList()).getAllByRole('link')).toHaveLength(14);
    expect(router.state.location.pathname).toBe('/einstellungen/haendlermarke');
  });

  it('UI-025.default: a throwing localStorage.setItem keeps the frame and the open section', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    renderAt('/einstellungen/haendlermarke');

    fireEvent.click(within(sectionList()).getByRole('link', { name: 'Auswahllisten' }));
    expect(
      await screen.findByRole('link', { name: 'Auswahllisten', current: 'page' }),
    ).toBeTruthy();
    expect(within(sectionList()).getAllByRole('link')).toHaveLength(14);
  });

  it('UI-025.default: a section path in other letter case marks the matching section as current', () => {
    renderAt('/einstellungen/Auswahllisten');

    expect(within(sectionList()).getByRole('link', { current: 'page' }).textContent).toBe(
      'Auswahllisten',
    );
    expect(localStorage.getItem(LAST_SECTION_STORAGE_KEY)).toBe('auswahllisten');
  });

  it('UI-025.default: a section without its screen keeps the list, an empty content area and the address', () => {
    const router = renderAt('/einstellungen/kanaele');

    expect(router.state.location.pathname).toBe('/einstellungen/kanaele');
    expect(within(sectionList()).getAllByRole('link')).toHaveLength(14);
    expect(screen.getByTestId('settings-content').textContent).toBe('');
  });

  it('an unknown section is not a route of UI-025 and falls back to the empty frame', () => {
    renderAt('/einstellungen/zugangspasswort');

    expect(screen.queryByRole('navigation', { name: 'Einstellungen' })).toBeNull();
    expect(screen.getByTestId('content-area').textContent).toBe('');
  });
});
