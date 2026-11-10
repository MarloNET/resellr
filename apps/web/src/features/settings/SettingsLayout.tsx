import { useEffect, type KeyboardEvent } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';

interface SettingsSection {
  label: string;
  /** Path segment `bereich` of `/einstellungen/:bereich` (Technical Specification 4.2). */
  slug: string;
}

/**
 * The 14 fixed sections of UI-025 in design order (Technical Specification 4.5 and 7.3,
 * OD-02 variant A): "Zugangspasswort" (UI-040) is not part of release 0.1.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { label: 'Händlermarke', slug: 'haendlermarke' },
  { label: 'Gerätearten und Merkmale', slug: 'geraetearten' },
  { label: 'Auswahllisten', slug: 'auswahllisten' },
  { label: 'Titelmuster', slug: 'titelmuster' },
  { label: 'Textbausteine', slug: 'textbausteine' },
  { label: 'Hersteller und GPSR', slug: 'hersteller' },
  { label: 'Lieferanten', slug: 'lieferanten' },
  { label: 'Code-Übersetzung', slug: 'code-uebersetzung' },
  { label: 'Zustandszuordnung', slug: 'zustandszuordnung' },
  { label: 'Kategoriezuordnung', slug: 'kategoriezuordnung' },
  { label: 'Merkmalszuordnung', slug: 'merkmalszuordnung' },
  { label: 'Beschreibungsvorlagen', slug: 'beschreibungsvorlagen' },
  { label: 'Kanäle und Preisregeln', slug: 'kanaele' },
  { label: 'Datenblatt-Layout', slug: 'datenblatt-layout' },
];

export const LAST_SECTION_STORAGE_KEY = 'resellr.settings.lastSection';

const DEFAULT_SECTION = 'haendlermarke';

const SETTINGS_PREFIX = '/einstellungen/';

function isSectionSlug(value: string | null): value is string {
  return SETTINGS_SECTIONS.some((section) => section.slug === value);
}

/**
 * Index route `/einstellungen`: opens the last used section, "Händlermarke" on the first call
 * or when the stored value is not one of the 14 sections (UI-025.default).
 */
export function LastSettingsSectionRedirect() {
  const stored = localStorage.getItem(LAST_SECTION_STORAGE_KEY);
  return (
    <Navigate
      to={`${SETTINGS_PREFIX}${isSectionSlug(stored) ? stored : DEFAULT_SECTION}`}
      replace
    />
  );
}

/** Arrow up/down move the focus within the list; Enter follows the focused link (UI-025). */
function moveFocus(event: KeyboardEvent<HTMLUListElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const links = Array.from(event.currentTarget.querySelectorAll('a'));
  const index = links.indexOf(event.target as HTMLAnchorElement);
  if (index === -1) return;
  event.preventDefault();
  const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
  links[Math.min(Math.max(next, 0), links.length - 1)]?.focus();
}

/**
 * Settings layout UI-025 (CU-093): second navigation column with the 14 sections and the
 * content of the open section. Single column as base form, so the list stands above the
 * content below the breakpoint `full` (R-1 (1), Technical Specification 2.0.10); from `full`
 * on the list is a 240 px column beside the content.
 */
export function SettingsLayout() {
  const { pathname } = useLocation();
  const openSlug = pathname.slice(SETTINGS_PREFIX.length).split('/')[0] ?? '';

  useEffect(() => {
    if (isSectionSlug(openSlug)) localStorage.setItem(LAST_SECTION_STORAGE_KEY, openSlug);
  }, [openSlug]);

  return (
    <div data-testid="settings-layout" className="flex min-h-full flex-col full:flex-row">
      <div
        data-testid="settings-section-column"
        className="shrink-0 border-b border-border bg-surface py-2 full:w-60 full:border-r full:border-b-0"
      >
        <nav aria-label="Einstellungen">
          <ul className="m-0 flex list-none flex-col p-0" onKeyDown={moveFocus}>
            {SETTINGS_SECTIONS.map((section) => {
              const current = section.slug === openSlug;
              return (
                <li key={section.slug}>
                  <Link
                    to={`${SETTINGS_PREFIX}${section.slug}`}
                    aria-current={current ? 'page' : undefined}
                    className={
                      'flex h-nav-item items-center px-4 text-body no-underline ' +
                      (current ? 'bg-bg font-semibold text-primary' : 'text-text hover:bg-bg')
                    }
                  >
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <div data-testid="settings-content" className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
