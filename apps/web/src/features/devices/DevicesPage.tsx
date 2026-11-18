import type { DeviceSearchItem } from '@resellr/domain/schemas/device.schema';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useDeviceSearchQuery } from '../../api/inventory.api.ts';
import { FormField } from '../../components/forms/FormField.tsx';
import { PageBanner } from '../../components/patterns/PageBanner.tsx';
import { UnreachableBanner } from '../../components/patterns/UnreachableBanner.tsx';
import { buttonClassName } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/Table.tsx';
import { cn } from '../../components/ui/cn.ts';

/** Inventory status of a device as UI-009 and UI-010 show it (3.5). */
export const STOCK_STATUS_LABELS: Record<DeviceSearchItem['stockStatus'], string> = {
  available: 'verfügbar',
  sold: 'verkauft',
  cancelled: 'storniert',
};

/** Capture status of a device as UI-009 and UI-010 show it (REQ-013). */
export const CAPTURE_STATUS_LABELS: Record<DeviceSearchItem['captureStatus'], string> = {
  checked: 'geprüft',
  review_pending: 'unvollständig geprüft',
};

/** "nicht zugeordnet" for a device without model listing (UI-009, UI-010). */
export const UNASSIGNED_TEXT = 'nicht zugeordnet';

// Texts of UI-009 `screen.md` (UI/UX design v0.6.1).
const TEXTS = {
  title: 'Geräte',
  tabs: 'Ansichten',
  search: 'WI-Nr',
  list: 'Treffer',
  wiNr: 'WI-Nr',
  modelTemplate: 'Modellvorlage',
  listing: 'Modell-Inserat',
  stockStatus: 'Bestandsstatus',
  captureStatus: 'Erfassungsstatus',
  intake: 'Gerät einbuchen',
  loading: 'Suche …',
  empty: 'Kein Gerät mit dieser WI-Nr',
  error: (referenceNumber: string | null) =>
    `Suche fehlgeschlagen. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/**
 * Tabs of UI-009 by their value of `?reiter=` (Technical Specification 4.2, 7.3); the first one
 * is shown without the parameter. "Nicht zugeordnet" follows with #258.
 */
const TABS = [{ key: 'suche', label: 'Suche', search: '' }] as const;

/** Wait after the last keystroke before the hits are asked for ("während der Eingabe", C-10). */
const SEARCH_DELAY_MS = 300;

/** The search term: a part of the WI-Nr from 1 character, none for an empty field (2.5). */
const searchTermOf = (input: string) => (input.trim() === '' ? undefined : input.trim());

/** Tab "Suche" of UI-009: search field and hit list with the states of the search. */
function SearchTab() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  // The term of the last Enter: its hits open the device when there is exactly one (DER-87-02).
  // A changed input drops it; an error keeps it until "Erneut versuchen" brings an answer.
  const [openTerm, setOpenTerm] = useState<string | undefined>(undefined);
  const query = useDeviceSearchQuery(searchTerm);

  // `Input` passes no ref on, so the page finds the field in a wrapping element.
  const searchAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    searchAreaRef.current?.querySelector('input')?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchTermOf(input)), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const data = searchTerm === undefined ? undefined : query.data;

  useEffect(() => {
    if (openTerm === undefined || openTerm !== searchTerm) return;
    if (query.isFetching || query.isError || !data) return;
    setOpenTerm(undefined);
    const [only, ...others] = data.items;
    if (only && others.length === 0) void navigate(`/geraete/${only.id}`);
  }, [openTerm, searchTerm, data, query.isFetching, query.isError, navigate]);

  const unreachable = query.isError && query.error.kind === 'unreachable';
  const failed = query.isError && !unreachable ? query.error : null;

  return (
    <div role="tabpanel" aria-label="Suche" className="flex flex-col gap-4">
      {unreachable && <UnreachableBanner />}
      {failed && (
        <PageBanner variant="error" error={failed}>
          {TEXTS.error}
        </PageBanner>
      )}

      <form
        role="search"
        aria-label={TEXTS.title}
        onSubmit={(event) => {
          event.preventDefault();
          const term = searchTermOf(input);
          setSearchTerm(term);
          setOpenTerm(term);
        }}
      >
        <div ref={searchAreaRef} className="w-80 min-w-0">
          <FormField label={TEXTS.search}>
            {(control) => (
              <Input
                {...control}
                type="search"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setOpenTerm(undefined);
                }}
              />
            )}
          </FormField>
        </div>
      </form>

      {searchTerm !== undefined && query.isPending && (
        <p role="status" className="m-0 text-body text-text-secondary">
          {TEXTS.loading}
        </p>
      )}
      {data && data.items.length === 0 && <p className="m-0 text-body">{TEXTS.empty}</p>}
      {data && data.items.length > 0 && (
        <Table aria-label={TEXTS.list}>
          <TableHeader>
            <tr>
              <TableHead scope="col">{TEXTS.wiNr}</TableHead>
              <TableHead scope="col">{TEXTS.modelTemplate}</TableHead>
              <TableHead scope="col">{TEXTS.listing}</TableHead>
              <TableHead scope="col">{TEXTS.stockStatus}</TableHead>
              <TableHead scope="col">{TEXTS.captureStatus}</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => {
              const path = `/geraete/${item.id}`;
              return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer focus-within:bg-bg"
                  onClick={(event) => {
                    // The link navigates itself; a click elsewhere in the row opens it too.
                    if ((event.target as HTMLElement).closest('a')) return;
                    void navigate(path);
                  }}
                >
                  <TableCell>
                    <Link to={path} className="font-semibold text-primary">
                      {item.wiNr}
                    </Link>
                  </TableCell>
                  <TableCell>{item.modelTemplateLabel}</TableCell>
                  <TableCell>{item.listing?.title ?? UNASSIGNED_TEXT}</TableCell>
                  <TableCell>{STOCK_STATUS_LABELS[item.stockStatus]}</TableCell>
                  <TableCell>{CAPTURE_STATUS_LABELS[item.captureStatus]}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/**
 * Devices UI-009 (CU-136, REQ-016; Technical Specification 2.5, 7.3): tabs by `?reiter=`, open
 * for more tabs, and "Gerät einbuchen". Tab "Suche": search by a part of the WI-Nr while typing,
 * hits with WI-Nr, model template, model listing or "nicht zugeordnet", inventory and capture
 * status; a row click or Enter on its link opens UI-010, Enter in the search field with exactly
 * one hit opens it too (DER-87-02). States default (focus in the search field), loading,
 * empty (Suche), error and unreachable (P-06, DER-87-04); the tab "Nicht zugeordnet" follows
 * with #258.
 */
export function DevicesPage() {
  // Read without `useSearchParams`, whose bundled hint names a URL of another host (REQ-079).
  const tabKey = new URLSearchParams(useLocation().search).get('reiter');
  const tab = TABS.find((entry) => entry.key === tabKey) ?? TABS[0];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="m-0 text-page-title font-semibold">{TEXTS.title}</h1>
        <Link to="/geraete/neu" className={buttonClassName('primary', 'shrink-0')}>
          {TEXTS.intake}
        </Link>
      </div>

      <nav aria-label={TEXTS.tabs}>
        <ul role="tablist" className="m-0 flex list-none gap-4 border-b border-border p-0">
          {TABS.map((entry) => {
            const current = entry.key === tab.key;
            return (
              <li key={entry.key} role="presentation">
                <Link
                  role="tab"
                  aria-selected={current}
                  to={{ search: entry.search }}
                  className={cn(
                    'inline-flex h-nav-item items-center px-2 text-body no-underline',
                    current ? 'border-b-2 border-primary font-semibold text-primary' : 'text-text',
                  )}
                >
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab.key === 'suche' && <SearchTab />}
    </div>
  );
}
