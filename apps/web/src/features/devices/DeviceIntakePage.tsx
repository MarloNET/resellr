import { formatNumber, formatWithUnit, formatYesNo } from '@resellr/domain/format/format-value';
import { ERROR_MESSAGES } from '@resellr/domain/messages/messages.de';
import type { Attribute } from '@resellr/domain/schemas/attribute.schema';
import type { PortEntry } from '@resellr/domain/schemas/attribute-values.schema';
import { type DeviceCreateInput, deviceCreateSchema } from '@resellr/domain/schemas/device.schema';
import {
  type ModelTemplateListItem,
  modelTemplateSearchTermSchema,
} from '@resellr/domain/schemas/model-template.schema';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { ApiError } from '../../api/api-client.ts';
import { useModelTemplateQuery, useModelTemplatesQuery } from '../../api/catalog.api.ts';
import { useCreateDeviceMutation } from '../../api/inventory.api.ts';
import {
  useAttributesQuery,
  usePickListsQuery,
  usePickListValuesQuery,
  useSuppliersQuery,
} from '../../api/settings.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import { type ChoiceItem, findMissingChoices } from '../../components/forms/deactivated-choice.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../components/forms/FormField.tsx';
import { OutcomeUnknownBanner } from '../../components/patterns/OutcomeUnknownBanner.tsx';
import { PageBanner } from '../../components/patterns/PageBanner.tsx';
import {
  noticeOf,
  SaveNoticeBanners,
  type SaveNotice,
} from '../../components/patterns/SaveNoticeBanners.tsx';
import { UnreachableBanner } from '../../components/patterns/UnreachableBanner.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { cn } from '../../components/ui/cn.ts';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';

// Texts of UI-003 `screen.md` and its mockup (UI/UX design v0.6.1; v0.6.8 for the choice after a
// rejection for deactivation, v0.6.9 for `wi_nr_taken`).
const TEXTS = {
  title: 'Gerät einbuchen',
  requiredHint: 'Felder mit * sind Pflicht.',
  device: 'Gerät',
  wiNr: 'WI-Nr',
  supplier: 'Lieferant',
  modelTemplate: 'Modellvorlage',
  modelTemplateSearch: 'Modellvorlage suchen',
  otherModelTemplate: 'Andere Modellvorlage wählen',
  deviceValues: 'Gerätewerte',
  modelData: 'Modelldaten (nur lesen)',
  loadingValues: 'Lade Gerätewerte …',
  condition: 'Zustand',
  visualGrade: 'Optik-Note',
  conditionDescription: 'Zustandsbeschreibung',
  choose: 'Bitte wählen',
  mpn: 'Herstellernummer',
  mpnUnknown: 'unbekannt',
  save: 'Gerät speichern',
  saveAndAssign: 'Speichern und zuordnen',
  saving: 'Speichern …',
  saved: (wiNr: string) => `Gerät ${wiNr} gespeichert`,
  error: (referenceNumber: string | null) =>
    `Das Gerät konnte nicht gespeichert werden. Bitte erneut versuchen. Referenz: ${referenceNumber ?? '–'}`,
  notDeterminable: 'nicht ermittelbar',
} as const;

/** Wait after the last keystroke before the model templates are searched (as in UI-006). */
const SEARCH_DELAY_MS = 300;

/** The fields of the form in form order (DER-54-01); the values of the attributes follow. */
const FIELDS = [
  'wiNr',
  'supplierId',
  'modelTemplateId',
  'conditionValueId',
  'visualGrade',
  'conditionDescription',
] as const;
type Field = (typeof FIELDS)[number];
/** A field error by path: the fixed fields and `values.<id>` (2.0.5). */
type FieldErrors = Partial<Record<string, ReactNode>>;

interface Draft {
  wiNr: string;
  supplierId: number | null;
  modelTemplate: ModelTemplateListItem | null;
  conditionValueId: number | null;
  visualGrade: string;
  conditionDescription: string;
}

const EMPTY_DRAFT: Draft = {
  wiNr: '',
  supplierId: null,
  modelTemplate: null,
  conditionValueId: null,
  visualGrade: '',
  conditionDescription: '',
};

/**
 * Request body of `POST /api/devices`: every field, nothing chosen as `null`. The values of the
 * attributes of the level device come with the attribute fields (CU-111, #178).
 */
const bodyOf = (draft: Draft): DeviceCreateInput => ({
  wiNr: draft.wiNr,
  supplierId: draft.supplierId,
  modelTemplateId: draft.modelTemplate?.id ?? null,
  conditionValueId: draft.conditionValueId,
  visualGrade: draft.visualGrade,
  conditionDescription: draft.conditionDescription,
  values: {},
  confirmedKeys: [],
});

/** Fields of the card "Gerätewerte", shown only once a model template is chosen (DER-54-01). */
const isDeviceValue = (path: string) =>
  path === 'conditionValueId' ||
  path === 'visualGrade' ||
  path === 'conditionDescription' ||
  path.startsWith('values.');

/**
 * Field errors of the check in the browser, the same schema as on the server (2.0.7); without a
 * model template only those of the fields shown.
 */
function checkAll(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of deviceCreateSchema(null).safeParse(bodyOf(draft)).error?.issues ?? []) {
    const path = issue.path.join('.');
    if (draft.modelTemplate === null && isDeviceValue(path)) continue;
    errors[path] ??= issue.message;
  }
  return errors;
}

/** Errors in form order: the fixed fields, then the values (2.0.5 "Fehlerzusammenfassung"). */
function inFormOrder(errors: FieldErrors): [string, ReactNode][] {
  const order = (path: string) => {
    const index = (FIELDS as readonly string[]).indexOf(path);
    return index === -1 ? FIELDS.length : index;
  };
  return Object.entries(errors)
    .filter(([, error]) => Boolean(error))
    .sort(([a], [b]) => order(a) - order(b));
}

/** The input of a field, to see whether it changed since the server answered. */
const fieldValue = (draft: Draft, field: Field) =>
  field === 'modelTemplateId' ? draft.modelTemplate?.id : draft[field];

const optionValue = (id: number | null) => (id === null ? '' : String(id));
const idOf = (value: string) => (value === '' ? null : Number(value));

/** The search term the hit list is asked for: from 2 characters after trimming (2.4). */
function searchTermOf(input: string): string | undefined {
  const result = modelTemplateSearchTermSchema.safeParse(input);
  return result.success ? result.data : undefined;
}

/** "<Hersteller> <Modellbezeichnung> (<Typbezeichnung>) · <Geräteart> · Herstellernummer <Nr>". */
function templateLine(template: ModelTemplateListItem): string {
  const type = template.typeDesignation === null ? '' : ` (${template.typeDesignation})`;
  const mpn = template.mpnUnknown ? TEXTS.mpnUnknown : (template.mpn ?? '');
  return (
    `${template.manufacturer.name} ${template.modelName}${type} · ${template.deviceType.name}` +
    ` · ${TEXTS.mpn} ${mpn}`
  );
}

/** The text of `wi_nr_taken` with "Gerät <WI-Nr>" as link to the device (design v0.6.9). */
function wiNrTakenError(error: ApiError): ReactNode {
  const message = error.error?.message ?? '';
  const deviceId = error.error?.details.deviceId;
  const match = /^(.*?)(Gerät \S+)(.*)$/su.exec(message);
  if (typeof deviceId !== 'number' || match === null) return message;
  const [, before = '', device = '', after = ''] = match;
  return (
    <>
      {before}
      <Link to={`/geraete/${deviceId}`} className="text-primary">
        {device}
      </Link>
      {after}
    </>
  );
}

/** The label of a value of a pick list, read from its list. */
function PickListLabel({ pickListId, valueId }: { pickListId: number | null; valueId: number }) {
  const values = usePickListValuesQuery(pickListId);
  return <>{values.data?.items.find(({ id }) => id === valueId)?.label ?? ''}</>;
}

/** "2 × USB-C vorn, 1 × HDMI" from the lists port type and port position. */
function PortsLabel({ entries }: { entries: readonly PortEntry[] }) {
  const lists = usePickListsQuery();
  const listId = (key: string) => lists.data?.items.find((list) => list.key === key)?.id ?? null;
  return (
    <>
      {entries.map(({ count, typeId, positionId }, index) => (
        <span key={index}>
          {index > 0 && ', '}
          {count} × <PickListLabel pickListId={listId('port_type')} valueId={typeId} />
          {positionId !== null && (
            <>
              {' '}
              <PickListLabel pickListId={listId('port_position')} valueId={positionId} />
            </>
          )}
        </span>
      ))}
    </>
  );
}

/** A stored value of the level model as the panel shows it, read only. */
function ModelValue({ attribute, value }: { attribute: Attribute; value: unknown }) {
  const withUnit = (text: string) =>
    formatWithUnit(text, attribute.unit ?? '', attribute.unitSpacing);
  switch (attribute.dataType) {
    case 'pick':
      return <PickListLabel pickListId={attribute.pickListId} valueId={value as number} />;
    case 'ports':
      return <PortsLabel entries={value as PortEntry[]} />;
    case 'boolean':
      return <>{formatYesNo(value as boolean)}</>;
    case 'integer':
    case 'decimal':
      return <>{withUnit(formatNumber(value as number | string))}</>;
    default:
      return <>{withUnit(String(value))}</>;
  }
}

/**
 * Panel "Modelldaten (nur lesen)": the values of the active attributes of the level model of the
 * chosen model template, in the order of the attributes, without review flag (DER-54-02).
 */
function ModelDataPanel({
  templateId,
  deviceTypeId,
}: {
  templateId: number;
  deviceTypeId: number;
}) {
  const headingId = useId();
  const template = useModelTemplateQuery(templateId);
  const attributes = useAttributesQuery(deviceTypeId);
  const rows = (attributes.data?.items ?? []).filter(
    ({ id, level, active }) =>
      level === 'model' && active && template.data?.modelValues[String(id)] !== undefined,
  );
  return (
    <aside
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-2 self-start rounded-control border border-border bg-surface p-6"
    >
      <h2 id={headingId} className="m-0 border-b border-border pb-4 text-section font-semibold">
        {TEXTS.modelData}
      </h2>
      <dl className="m-0 flex flex-col">
        {rows.map((attribute) => (
          <div
            key={attribute.id}
            className="flex justify-between gap-4 border-b border-border py-2 text-body"
          >
            <dt className="text-text-secondary">{attribute.label}</dt>
            <dd className="m-0 text-right [overflow-wrap:anywhere]">
              <ModelValue
                attribute={attribute}
                value={template.data?.modelValues[String(attribute.id)]}
              />
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

const CARD = 'flex min-w-0 flex-col gap-4 rounded-control border border-border bg-surface p-6';
const CARD_HEADING = 'm-0 text-section font-semibold';
const TEXT_AREA_CLASS = cn(
  'w-full min-w-0 rounded-control bg-surface px-2 py-1 ring-1 ring-border-input ring-inset',
  'text-body text-text aria-invalid:ring-error disabled:bg-bg',
);

/**
 * Device intake UI-003 (CU-132, REQ-012; Technical Specification 2.5): WI-Nr, supplier (only
 * active ones), model template search with hit list and the chosen template, the card
 * "Gerätewerte" after the choice with condition (only active values), visual grade and condition
 * description, the panel "Modelldaten" and the actions "Gerät speichern" (Ctrl+S) and "Speichern
 * und zuordnen" (Ctrl+Enter). States: default (focus in WI-Nr), validation with the error summary
 * at the top and `wi_nr_taken` at the WI-Nr, success, error, ausgang-unbekannt (P-08), conflict
 * (P-05), unreachable (P-06) for the reads and wird-beendet (P-07). After
 * `supplier_deactivated` the supplier is emptied with its text (2.0.11, design v0.6.8). The
 * attribute fields (#178), the condition code (#193), prefill and review flags (#188), the draft
 * for UI-007 (#186) and the dialog UI-004 (#189) follow.
 */
export function DeviceIntakePage() {
  const suppliers = useSuppliersQuery();
  const pickLists = usePickListsQuery();
  const conditionListId =
    pickLists.data?.items.find((list) => list.key === 'condition')?.id ?? null;
  const conditions = usePickListValuesQuery(conditionListId);
  const createMutation = useCreateDeviceMutation();
  const writesLocked = useWritesLocked();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [errors, setErrors] = useState<FieldErrors>({});
  // The error summary shows after a save, built from the field errors still shown (2.0.5).
  const [summaryShown, setSummaryShown] = useState(false);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const [savedWiNr, setSavedWiNr] = useState<string | null>(null);
  // The supplier shows the text of a rejection until the next choice in the field (v0.6.8).
  const [supplierRejected, setSupplierRejected] = useState(false);
  // A rejected supplier whose list could not be read again counts as missing (2.0.11).
  const [droppedSupplier, setDroppedSupplier] = useState<number | null>(null);
  const [reloading, setReloading] = useState(false);
  // The inputs of the last request the server rejected with field errors.
  const answeredDraftRef = useRef<Draft | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchTermOf(searchInput)), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const search = useModelTemplatesQuery({ q: searchTerm }, { enabled: searchTerm !== undefined });
  const hits = draft.modelTemplate === null && searchTerm !== undefined ? search.data?.items : [];

  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const hitsRef = useRef<HTMLUListElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  // `Input` and `Select` pass no ref on, so the page finds them in the card "Gerät". Focus in
  // WI-Nr on opening (UI-003 "Fenstergröße und Bedienung", DER-54-01).
  const deviceCardRef = useRef<HTMLElement>(null);
  useEffect(() => deviceCardRef.current?.querySelector('input')?.focus(), []);

  const activeSuppliers = (suppliers.data?.items ?? []).filter(
    ({ id, active }) => active && id !== droppedSupplier,
  );
  const activeConditions = (conditions.data?.items ?? []).filter(({ active }) => active);

  const saving = createMutation.isPending;
  // Until the suppliers are read again after a rejection, a save could send the rejected id.
  const canSave = !saving && !writesLocked && !reloading;

  function change(next: Partial<Draft>) {
    setDraft((previous) => ({ ...previous, ...next }));
  }

  function setError(path: string, error: ReactNode) {
    setErrors((previous) => ({ ...previous, [path]: error }));
  }

  function checkOnBlur(field: Field) {
    if (field === 'supplierId' && supplierRejected) return;
    const current = draftRef.current;
    // An error of the server (e.g. `wi_nr_taken`) the browser cannot check stays until the
    // value changes.
    const answered = answeredDraftRef.current;
    if (answered !== null && fieldValue(answered, field) === fieldValue(current, field)) return;
    blurCheck.checkOnBlur(() => setError(field, checkAll(current)[field]));
  }

  function chooseSupplier(value: string) {
    change({ supplierId: idOf(value) });
    setError('supplierId', undefined);
    setSupplierRejected(false);
  }

  function chooseTemplate(template: ModelTemplateListItem) {
    change({ modelTemplate: template });
    setError('modelTemplateId', undefined);
    setSearchInput('');
    setSearchTerm(undefined);
  }

  /** Arrow down from the search field moves to the first hit, up and down between the hits. */
  function onHitsKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = Array.from(hitsRef.current?.querySelectorAll('button') ?? []);
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? buttons[index + 1] : buttons[index - 1];
    if (next === undefined) return;
    event.preventDefault();
    next.focus();
  }

  function showServerErrors(next: FieldErrors) {
    answeredDraftRef.current = draftRef.current;
    showFieldErrors(next);
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    setSummaryShown(true);
    focusFirstError();
  }

  function onFailed(error: ApiError) {
    if (error.kind === 'validation') {
      const next: FieldErrors = {};
      for (const { path, message } of error.error?.fields ?? []) next[path] ??= message;
      if (inFormOrder(next).length > 0) {
        showServerErrors(next);
        return;
      }
    }
    const code = error.error?.code;
    if (error.kind === 'rejected' && code === 'wi_nr_taken') {
      showServerErrors({ wiNr: wiNrTakenError(error) });
      return;
    }
    // A supplier deactivated in another window: the text stands at the field and in the
    // summary, the suppliers are read again without it (2.0.11, design v0.6.8).
    const { path, id } = error.error?.details ?? {};
    if (error.kind === 'rejected' && code === 'supplier_deactivated' && path === 'supplierId') {
      showServerErrors({ supplierId: error.error?.message });
      setSupplierRejected(true);
      if (typeof id === 'number') void reloadAfterRejection(id);
      return;
    }
    setNotice(noticeOf(error));
  }

  /**
   * Reads the suppliers again. If the rejected supplier is missing then, the choice is emptied
   * (optional field: the empty choice, value `null`), so its id is never sent again; if the read
   * fails, only the rejected id counts as missing (2.0.11 "Erkennen nach dem Neuladen", DER-54-16).
   * The condition and the attributes are checked the same way with #190.
   */
  async function reloadAfterRejection(rejectedId: number) {
    setReloading(true);
    const toItems = (list: typeof suppliers.data): ChoiceItem[] | undefined =>
      list?.items.map(({ id, name, active }) => ({ id, label: name, active }));
    const before = toItems(suppliers.data) ?? [];
    const reloaded = await suppliers.refetch();
    // A choice made while the list loads is the user's new choice and stays.
    if (draftRef.current.supplierId === rejectedId) {
      const missing = reloaded.isError
        ? [rejectedId]
        : findMissingChoices(
            [
              {
                path: 'supplierId',
                id: rejectedId,
                storedId: null,
                before,
                message: ERROR_MESSAGES['supplier_deactivated.device'],
              },
            ],
            { supplierId: toItems(reloaded.data) },
          ).map(({ id }) => id);
      if (missing.includes(rejectedId)) change({ supplierId: null });
      if (reloaded.isError) setDroppedSupplier(rejectedId);
    }
    setReloading(false);
  }

  function save() {
    // The save checks the fields itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    if (!canSave) return;
    const current = draftRef.current;
    const found = checkAll(current);
    answeredDraftRef.current = null;
    setSupplierRejected(false);
    if (inFormOrder(found).length > 0) {
      showFieldErrors(found);
      return;
    }
    setErrors({});
    setSummaryShown(false);
    setNotice(null);
    createMutation.mutate(bodyOf(current), {
      onSuccess: (device) => {
        setSavedWiNr(device.wiNr);
        setNotice({ kind: 'success' });
      },
      onError: onFailed,
    });
  }

  // Ctrl+S saves the device, Ctrl+Enter saves and assigns (UI-003 "Aktionen").
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;
      if (!ctrl || (event.key.toLowerCase() !== 's' && event.key !== 'Enter')) return;
      event.preventDefault();
      saveRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // A failed read shows P-06 or the error banner; the inputs stay (2.0.7).
  const readErrors = [suppliers.error, pickLists.error, conditions.error, search.error];
  const unreachable = readErrors.some((error) => error?.kind === 'unreachable');
  const readFailed = readErrors.find((error) => error !== null && error.kind !== 'unreachable');
  const summary = summaryShown ? inFormOrder(errors) : [];
  const template = draft.modelTemplate;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-page-title font-semibold">{TEXTS.title}</h1>
          <p className="m-0 text-body text-text-secondary">{TEXTS.requiredHint}</p>
        </div>

        <OutcomeUnknownBanner />
        {unreachable && <UnreachableBanner />}
        {readFailed && (
          <PageBanner variant="error" error={readFailed}>
            {TEXTS.error}
          </PageBanner>
        )}
        <SaveNoticeBanners
          notice={notice}
          onClose={() => setNotice(null)}
          onReloaded={() => setNotice(null)}
          successText={savedWiNr === null ? undefined : TEXTS.saved(savedWiNr)}
          errorText={TEXTS.error}
        />
        {summary.length > 0 && (
          <div
            role="alert"
            className="rounded-control border border-error bg-error-bg px-4 py-2 text-body text-error"
          >
            <ul className="m-0 flex list-disc flex-col gap-1 pl-4">
              {summary.map(([path, error]) => (
                <li key={path}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 full:grid-cols-[minmax(0,1fr)_22rem]">
          <form
            id={formId}
            ref={formRef}
            aria-label={TEXTS.title}
            noValidate
            className="flex min-w-0 flex-col gap-6"
            onPointerDown={blurCheck.pressPointer}
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <section ref={deviceCardRef} aria-label={TEXTS.device} className={CARD}>
              <h2 className={CARD_HEADING}>{TEXTS.device}</h2>
              <div className="grid grid-cols-1 gap-4 full:grid-cols-3">
                <FormField label={TEXTS.wiNr} required error={errors.wiNr}>
                  {(control) => (
                    <Input
                      {...control}
                      value={draft.wiNr}
                      autoComplete="off"
                      disabled={saving}
                      onChange={(event) => change({ wiNr: event.target.value })}
                      onBlur={() => checkOnBlur('wiNr')}
                      onKeyDown={(event) => {
                        // Enter in WI-Nr moves to the supplier (UI-003).
                        if (event.key !== 'Enter' || event.ctrlKey || event.metaKey) return;
                        event.preventDefault();
                        deviceCardRef.current?.querySelector('select')?.focus();
                      }}
                    />
                  )}
                </FormField>
                <FormField label={TEXTS.supplier} error={errors.supplierId}>
                  {(control) => (
                    <Select
                      {...control}
                      value={optionValue(draft.supplierId)}
                      disabled={saving}
                      onChange={(event) => chooseSupplier(event.target.value)}
                      onBlur={() => checkOnBlur('supplierId')}
                    >
                      {/* Optional: the empty choice is "kein Lieferant", without placeholder. */}
                      <option value="" />
                      {activeSuppliers.map(({ id, name }) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
              </div>
            </section>

            <section aria-label={TEXTS.modelTemplate} className={CARD}>
              <h2 className={CARD_HEADING}>{TEXTS.modelTemplate}</h2>
              {template === null ? (
                <div className="flex flex-col gap-2" onKeyDown={onHitsKeyDown}>
                  <FormField
                    label={TEXTS.modelTemplateSearch}
                    required
                    error={errors.modelTemplateId}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="search"
                        autoComplete="off"
                        value={searchInput}
                        disabled={saving}
                        onChange={(event) => setSearchInput(event.target.value)}
                      />
                    )}
                  </FormField>
                  {hits !== undefined && hits.length > 0 && (
                    <ul
                      ref={hitsRef}
                      aria-label={TEXTS.modelTemplate}
                      className="m-0 flex list-none flex-col rounded-control border border-border p-0"
                    >
                      {hits.map((hit) => (
                        <li key={hit.id} className="border-b border-border last:border-b-0">
                          <button
                            type="button"
                            className="w-full cursor-pointer px-4 py-2 text-left text-body hover:bg-bg focus:bg-bg"
                            onClick={() => chooseTemplate(hit)}
                          >
                            {templateLine(hit)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p
                    data-testid="chosen-model-template"
                    className="m-0 rounded-control border border-primary bg-bg px-4 py-2 text-body"
                  >
                    {templateLine(template)}
                  </p>
                  <button
                    type="button"
                    className="cursor-pointer self-start text-body text-primary"
                    disabled={saving}
                    onClick={() => change({ modelTemplate: null })}
                  >
                    {TEXTS.otherModelTemplate}
                  </button>
                </div>
              )}
            </section>

            {template !== null && (
              <section aria-label={TEXTS.deviceValues} className={CARD}>
                <h2 className={CARD_HEADING}>{TEXTS.deviceValues}</h2>
                {conditions.isPending && conditionListId !== null ? (
                  <p role="status" className="m-0 text-body text-text-secondary">
                    {TEXTS.loadingValues}
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 full:grid-cols-3">
                      <FormField label={TEXTS.condition} required error={errors.conditionValueId}>
                        {(control) => (
                          <Select
                            {...control}
                            value={optionValue(draft.conditionValueId)}
                            disabled={saving}
                            onChange={(event) => {
                              change({ conditionValueId: idOf(event.target.value) });
                              setError('conditionValueId', undefined);
                            }}
                            onBlur={() => checkOnBlur('conditionValueId')}
                          >
                            <option value="" disabled>
                              {TEXTS.choose}
                            </option>
                            {activeConditions.map(({ id, label }) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        )}
                      </FormField>
                      <FormField label={TEXTS.visualGrade} required error={errors.visualGrade}>
                        {(control) => (
                          <Input
                            {...control}
                            inputMode="numeric"
                            autoComplete="off"
                            value={draft.visualGrade}
                            disabled={saving}
                            onChange={(event) => change({ visualGrade: event.target.value })}
                            onBlur={() => checkOnBlur('visualGrade')}
                          />
                        )}
                      </FormField>
                    </div>
                    <FormField
                      label={TEXTS.conditionDescription}
                      error={errors.conditionDescription}
                    >
                      {(control) => (
                        <textarea
                          {...control}
                          rows={3}
                          value={draft.conditionDescription}
                          disabled={saving}
                          onChange={(event) => change({ conditionDescription: event.target.value })}
                          onBlur={() => checkOnBlur('conditionDescription')}
                          className={TEXT_AREA_CLASS}
                        />
                      )}
                    </FormField>
                  </>
                )}
              </section>
            )}
          </form>

          {template !== null && (
            <ModelDataPanel templateId={template.id} deviceTypeId={template.deviceType.id} />
          )}
        </div>
      </div>

      {/* The action bar stays visible below the scrolling form (DESIGN.md "Fenstergröße"). */}
      <div className="flex shrink-0 flex-wrap justify-end gap-4 border-t border-border bg-surface px-6 py-4">
        <Button type="submit" form={formId} disabled={!canSave}>
          {saving ? TEXTS.saving : TEXTS.save}
        </Button>
        <Button variant="primary" disabled={!canSave} onClick={save}>
          {TEXTS.saveAndAssign}
        </Button>
      </div>
    </div>
  );
}
