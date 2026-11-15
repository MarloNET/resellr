import { modelTemplateSearchTermSchema } from '@resellr/domain/schemas/model-template.schema';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { useModelTemplatesQuery } from '../../api/catalog.api.ts';
import { useDeviceTypesQuery } from '../../api/settings.api.ts';
import { FormField } from '../../components/forms/FormField.tsx';
import { PageBanner } from '../../components/patterns/PageBanner.tsx';
import { UnreachableBanner } from '../../components/patterns/UnreachableBanner.tsx';
import { buttonClassName } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/Table.tsx';

// Texts of UI-006 `screen.md` (UI/UX design v0.6.1).
const TEXTS = {
  title: 'Modell-Bibliothek',
  search: 'Suchbegriff',
  deviceType: 'Geräteart',
  list: 'Modellvorlagen',
  count: (total: number) => `${total} Modellvorlagen`,
  manufacturer: 'Hersteller',
  modelName: 'Modellbezeichnung',
  typeDesignation: 'Typbezeichnung',
  mpn: 'Herstellernummer',
  /** MPN "unbekannt" (REQ-008, 3.3). */
  mpnUnknown: 'unbekannt',
  loading: 'Suche …',
  emptyHits: 'Keine Modellvorlage gefunden',
  emptyLibrary: 'Noch keine Modellvorlagen',
  create: 'Modellvorlage anlegen',
  error: (referenceNumber: string | null) =>
    `Suche fehlgeschlagen. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Wait after the last keystroke before the hits are asked for ("während der Eingabe", C-10). */
const SEARCH_DELAY_MS = 300;

/**
 * The search term the list is asked for: none for an empty field, the trimmed term from 2
 * characters, and with 1 character the previous one, so no search runs (AC-REQ-009-04).
 */
function nextSearchTerm(input: string, previous: string | undefined): string | undefined {
  if (input.trim() === '') return undefined;
  const result = modelTemplateSearchTermSchema.safeParse(input);
  return result.success ? result.data : previous;
}

/** Hint at the search field for 1 character, the same rule as on the server (2.4). */
function searchHint(input: string): string | undefined {
  if (input.trim() === '') return undefined;
  const result = modelTemplateSearchTermSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/**
 * Model library UI-006 (CU-113, REQ-009; Technical Specification 2.4): search field and device
 * type filter, hit list with counter, row click or arrow keys and Enter open UI-007,
 * "Modellvorlage anlegen" opens UI-007 for a new model template. States: default (latest 50,
 * focus in the search field), loading, empty (Treffer), empty (Bibliothek), error, validation
 * and P-06.
 */
export function ModelLibraryPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  const [deviceTypeId, setDeviceTypeId] = useState<number | undefined>(undefined);
  const query = useModelTemplatesQuery({ q: searchTerm, deviceTypeId });
  const deviceTypes = useDeviceTypesQuery();

  // `Input` and `TableBody` pass no ref on, so the page finds its controls in wrapping elements.
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const focusSearch = () => searchAreaRef.current?.querySelector('input')?.focus();

  useEffect(() => {
    focusSearch();
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => setSearchTerm((previous) => nextSearchTerm(input, previous)),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [input]);

  const rowLinks = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-row-link]') ?? []);

  /** Arrow down from the search field chooses the first hit. */
  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowDown') return;
    const first = rowLinks()[0];
    if (first === undefined) return;
    event.preventDefault();
    first.focus();
  }

  /** Arrow up and down move between the hits, above the first back to the search field. */
  function onRowKeyDown(event: KeyboardEvent<HTMLAnchorElement>, path: string) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void navigate(path);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const links = rowLinks();
    const index = links.indexOf(event.currentTarget);
    const next = event.key === 'ArrowDown' ? links[index + 1] : links[index - 1];
    if (next !== undefined) next.focus();
    else if (event.key === 'ArrowUp') focusSearch();
  }

  // A failed device type request for the filter shows the same states as the search (2.0.7).
  const failed = query.isError ? query.error : deviceTypes.isError ? deviceTypes.error : null;
  const unreachable = failed?.kind === 'unreachable' || deviceTypes.error?.kind === 'unreachable';
  const filtered = searchTerm !== undefined || deviceTypeId !== undefined;
  const data = query.data;
  const hint = searchHint(input);

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="m-0 text-page-title font-semibold">{TEXTS.title}</h1>

      {unreachable && <UnreachableBanner />}
      {failed && failed.kind !== 'unreachable' && (
        <PageBanner variant="error" error={failed}>
          {TEXTS.error}
        </PageBanner>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <form
          role="search"
          aria-label={TEXTS.title}
          className="flex min-w-0 flex-wrap items-start gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchTerm((previous) => nextSearchTerm(input, previous));
          }}
        >
          <div ref={searchAreaRef} className="w-80 min-w-0">
            <FormField label={TEXTS.search} error={hint}>
              {(control) => (
                <Input
                  {...control}
                  type="search"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                />
              )}
            </FormField>
          </div>
          <div className="w-56 min-w-0">
            <FormField label={TEXTS.deviceType}>
              {(control) => (
                <Select
                  {...control}
                  value={deviceTypeId === undefined ? '' : String(deviceTypeId)}
                  onChange={(event) =>
                    setDeviceTypeId(
                      event.target.value === '' ? undefined : Number(event.target.value),
                    )
                  }
                >
                  <option value="" />
                  {(deviceTypes.data?.items ?? []).map((deviceType) => (
                    <option key={deviceType.id} value={deviceType.id}>
                      {deviceType.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
        </form>
        <Link to="/modelle/neu" className={buttonClassName('primary', 'mt-6 shrink-0')}>
          {TEXTS.create}
        </Link>
      </div>

      {query.isPending && (
        <p role="status" className="m-0 text-body text-text-secondary">
          {TEXTS.loading}
        </p>
      )}
      {data && data.total === 0 && (
        <p className="m-0 text-body">{filtered ? TEXTS.emptyHits : TEXTS.emptyLibrary}</p>
      )}
      {data && data.total > 0 && (
        <section ref={listRef} aria-label={TEXTS.list} className="flex min-w-0 flex-col gap-2">
          <p className="m-0 text-label text-text-secondary">{TEXTS.count(data.total)}</p>
          <Table aria-label={TEXTS.list}>
            <TableHeader>
              <tr>
                <TableHead scope="col">{TEXTS.deviceType}</TableHead>
                <TableHead scope="col">{TEXTS.manufacturer}</TableHead>
                <TableHead scope="col">{TEXTS.modelName}</TableHead>
                <TableHead scope="col">{TEXTS.typeDesignation}</TableHead>
                <TableHead scope="col">{TEXTS.mpn}</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => {
                const path = `/modelle/${item.id}`;
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
                    <TableCell>{item.deviceType.name}</TableCell>
                    <TableCell>{item.manufacturer.name}</TableCell>
                    <TableCell>
                      <Link
                        to={path}
                        data-row-link=""
                        className="font-semibold text-primary"
                        onKeyDown={(event) => onRowKeyDown(event, path)}
                      >
                        {item.modelName}
                      </Link>
                    </TableCell>
                    <TableCell>{item.typeDesignation ?? ''}</TableCell>
                    <TableCell>{item.mpnUnknown ? TEXTS.mpnUnknown : (item.mpn ?? '')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
