import { NavLink, useLocation } from 'react-router';

interface NavigationEntry {
  label: string;
  to: string;
  /** Paths for which the entry is marked as current (follow-up pages of its screen). */
  isCurrent: (pathname: string) => boolean;
}

const startsWith = (prefix: string) => (pathname: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * The six fixed entries of the left column (CU-045, Design Kap. 3, Technical Specification
 * 4.2); hotspot rule 4.5: no change. "Einstellungen" opens "Händlermarke" (UI-025, first call).
 */
export const NAVIGATION_ENTRIES: readonly NavigationEntry[] = [
  { label: 'Inserate', to: '/inserate', isCurrent: startsWith('/inserate') },
  { label: 'Gerät einbuchen', to: '/geraete/neu', isCurrent: startsWith('/geraete/neu') },
  { label: 'Modell-Bibliothek', to: '/modelle', isCurrent: startsWith('/modelle') },
  {
    label: 'Geräte',
    to: '/geraete',
    isCurrent: (pathname) =>
      startsWith('/geraete')(pathname) && !startsWith('/geraete/neu')(pathname),
  },
  { label: 'Änderungsprotokoll', to: '/protokoll', isCurrent: startsWith('/protokoll') },
  {
    label: 'Einstellungen',
    to: '/einstellungen/haendlermarke',
    isCurrent: startsWith('/einstellungen'),
  },
];

export function Navigation() {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Hauptnavigation">
      <ul className="m-0 flex list-none flex-col p-0">
        {NAVIGATION_ENTRIES.map((entry) => {
          const current = entry.isCurrent(pathname);
          return (
            <li key={entry.to}>
              <NavLink
                to={entry.to}
                aria-current={current ? 'page' : undefined}
                className={
                  'flex h-nav-item items-center px-4 text-body no-underline ' +
                  (current ? 'bg-bg font-semibold text-primary' : 'text-text hover:bg-bg')
                }
              >
                {entry.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
