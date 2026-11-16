import { ERROR_MESSAGES, FIELD_MESSAGES } from '@resellr/domain/messages/messages.de';
import {
  conditionCodePlainTextSchema,
  conditionCodeSchema,
  type ConditionCodeEntry,
} from '@resellr/domain/schemas/condition-code.schema';
import type { PickListValue } from '@resellr/domain/schemas/pick-list.schema';
import type { Supplier } from '@resellr/domain/schemas/supplier.schema';
import { useEffect, useRef, useState } from 'react';

import type { ApiError } from '../../../api/api-client.ts';
import {
  useConditionCodesQuery,
  useCreateConditionCodeMutation,
  useDeleteConditionCodeMutation,
  usePickListsQuery,
  usePickListValuesQuery,
  useSuppliersQuery,
  useUpdateConditionCodeMutation,
} from '../../../api/settings.api.ts';
import { useWritesLocked } from '../../../api/write-outcome-store.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../../components/forms/FormField.tsx';
import {
  choiceOptions,
  findMissingChoices,
  type ChoiceField,
  type ChoiceItem,
} from '../../../components/forms/deactivated-choice.ts';
import { ConfirmDialog } from '../../../components/patterns/ConfirmDialog.tsx';
import { MaintenanceTable } from '../../../components/patterns/MaintenanceTable.tsx';
import { OutcomeUnknownBanner } from '../../../components/patterns/OutcomeUnknownBanner.tsx';
import { PageBanner } from '../../../components/patterns/PageBanner.tsx';
import {
  noticeOf,
  SaveNoticeBanners,
  type SaveNotice,
} from '../../../components/patterns/SaveNoticeBanners.tsx';
import { UnreachableBanner } from '../../../components/patterns/UnreachableBanner.tsx';
import { Badge } from '../../../components/ui/Badge.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { Input } from '../../../components/ui/Input.tsx';
import { Select } from '../../../components/ui/Select.tsx';

// Texts of UI-033 `screen.md` and of the patterns P-01 and P-04 (UI/UX design v0.6.2, v0.6.8).
const TEXTS = {
  title: 'Code-Übersetzung',
  list: 'Code-Übersetzungen',
  hint: 'Änderungen wirken nur auf künftig erfasste Codes.',
  loading: 'Lade Einstellungen …',
  empty: 'Noch keine Code-Übersetzungen',
  create: 'Übersetzung anlegen',
  save: 'Speichern',
  saving: 'Speichern …',
  cancel: 'Abbrechen',
  delete: 'Löschen',
  saved: 'Gespeichert',
  code: 'Zustandscode',
  supplier: 'Lieferant',
  allSuppliers: 'alle',
  /** "Lieferant" after a rejection for deactivation, instead of "alle" (design v0.6.8). */
  notChosen: 'Bitte wählen',
  plainText: 'Klartext',
  condition: 'Vorschlag Zustand',
  visualGrade: 'Vorschlag Optik-Note',
  noSuggestion: '–',
  /** P-04: the title is the action, the text names its effect. */
  deleteTitle: 'Übersetzung löschen',
  deleteEffect: (code: string, supplier: string) =>
    `„${code}“ (Lieferant: ${supplier}) wird gelöscht. ` +
    'Änderungen wirken nur auf künftig erfasste Codes.',
  error: (referenceNumber: string | null) =>
    `Einstellungen konnten nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Grades of the choice "Vorschlag Optik-Note" (REQ-022, 1–5). */
const GRADES = ['1', '2', '3', '4', '5'] as const;

/**
 * Option value of "Lieferant" while nothing is chosen after a rejection for deactivation: a
 * state of the browser only, besides `''` = "alle" and an id; it is never sent (2.0.11,
 * Nachtrag MAR-929).
 */
const NOT_CHOSEN = 'not-chosen';

/** Inputs of the form; selections as option values, `''` = all suppliers or no suggestion. */
interface Values {
  code: string;
  supplierId: string;
  plainText: string;
  conditionValueId: string;
  visualGrade: string;
}

interface Draft extends Values {
  /** Values the form was opened with; without a change "Speichern" is disabled (DER-38-07). */
  base: Values;
  /**
   * Version of the state the form is based on, taken when it is opened (2.0.3). A background
   * refetch does not change it, so a change from another window leads to `409` and P-05.
   */
  version: number | null;
}

/** Field errors by the path of the request (2.0.5). */
interface FieldErrors {
  code?: string;
  supplierId?: string;
  plainText?: string;
  suggestedConditionValueId?: string;
  suggestedVisualGrade?: string;
}

const FIELD_PATHS = ['code', 'plainText', 'suggestedVisualGrade'] as const;

/** Fields of a deactivated choice, at `details.path` of the rejection (2.0.11). */
const CHOICE_PATHS = ['supplierId', 'suggestedConditionValueId'] as const;
type ChoicePath = (typeof CHOICE_PATHS)[number];
const isChoicePath = (path: unknown): path is ChoicePath =>
  (CHOICE_PATHS as readonly unknown[]).includes(path);

/** Draft field of each choice. */
const DRAFT_KEYS = {
  supplierId: 'supplierId',
  suggestedConditionValueId: 'conditionValueId',
} as const;

/** Value of a choice after its entry was rejected or is no longer offered (2.0.11, design v0.6.8). */
const EMPTIED: Record<ChoicePath, string> = {
  supplierId: NOT_CHOSEN,
  suggestedConditionValueId: '',
};

/** Ids rejected while the form is open; they are never offered or sent again (2.0.11). */
type RejectedIds = Record<ChoicePath, readonly number[]>;
const NO_REJECTED: RejectedIds = { supplierId: [], suggestedConditionValueId: [] };

/** Rejections of a supplier or condition suggestion deactivated meanwhile (2.0.11). */
const DEACTIVATED_CODES: ReadonlySet<string> = new Set([
  'supplier_deactivated',
  'pick_list_value_deactivated',
]);

/** `null` while a new entry is entered. */
type Selection = { id: number | null };

const optionOf = (id: number | null) => (id === null ? '' : String(id));
const idOf = (option: string) => (option === '' || option === NOT_CHOSEN ? null : Number(option));

function draftOf(entry: ConditionCodeEntry | undefined): Draft {
  const base: Values = {
    code: entry?.code ?? '',
    supplierId: optionOf(entry?.supplierId ?? null),
    plainText: entry?.plainText ?? '',
    conditionValueId: optionOf(entry?.suggestedConditionValueId ?? null),
    visualGrade: optionOf(entry?.suggestedVisualGrade ?? null),
  };
  return { ...base, base, version: entry?.version ?? null };
}

const changed = (draft: Draft) =>
  (Object.keys(draft.base) as (keyof Values)[]).some((key) => draft[key] !== draft.base[key]);

/** First message of the Zod check in the browser, the same schemas as on the server (2.0.7). */
function firstMessage(schema: typeof conditionCodeSchema, value: string): string | undefined {
  const result = schema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

const checkCode = (code: string) => firstMessage(conditionCodeSchema, code);
const checkPlainText = (plainText: string) => firstMessage(conditionCodePlainTextSchema, plainText);

/**
 * Options of a choice (CU-319): the active entries and the stored one, even if deactivated, with
 * "(deaktiviert)", so an entry keeps its supplier or suggestion (REQ-022 "Auswahl aus den aktiven
 * Lieferanten"); it stays offered while the form is open. Rejected ids are left out (2.0.11).
 */
const optionsOf = (items: readonly ChoiceItem[], stored: string, rejected: readonly number[]) =>
  choiceOptions(
    items.filter((item) => !rejected.includes(item.id)),
    { storedId: idOf(stored), markDeactivated: true },
  );

const supplierItems = (suppliers: readonly Supplier[]): ChoiceItem[] =>
  suppliers.map(({ id, name, active }) => ({ id, label: name, active }));
const conditionItems = (values: readonly PickListValue[]): ChoiceItem[] =>
  values.map(({ id, label, active }) => ({ id, label, active }));

/** Text of each choice for an entry no longer offered after the reload (CU-012, 2.0.6). */
const MISSING_TEXT: Record<ChoicePath, (name: string) => string> = {
  supplierId: ERROR_MESSAGES['supplier_deactivated.condition_code'],
  suggestedConditionValueId: ERROR_MESSAGES['pick_list_value_deactivated.condition_suggestion'],
};

/**
 * Condition codes of UI-033 (CU-100, REQ-022, REQ-015; Technical Specification 2.2): maintenance
 * list P-01 with code, supplier, plain text and the suggestions for condition and visual grade;
 * create, change and delete after the confirmation P-04 (DER-38-08). The hint names that changes
 * act only on future captures (DER-38-09). States after 2.0.7: loading, empty, validation,
 * success, error, disabled, speichert (P-08), conflict (P-05), unreachable (P-06), wird-beendet
 * (P-07), ausgang-unbekannt (P-08).
 */
export function ConditionCodesPage() {
  const query = useConditionCodesQuery();
  const suppliersQuery = useSuppliersQuery();
  const pickListsQuery = usePickListsQuery();
  const pickLists = pickListsQuery.data?.items ?? [];
  const conditionListId = pickLists.find((list) => list.key === 'condition')?.id ?? null;
  const conditionsQuery = usePickListValuesQuery(conditionListId);
  const createMutation = useCreateConditionCodeMutation();
  const updateMutation = useUpdateConditionCodeMutation();
  const deleteMutation = useDeleteConditionCodeMutation();
  const writesLocked = useWritesLocked();

  const items = query.data?.items ?? [];
  const suppliers: Supplier[] = suppliersQuery.data?.items ?? [];
  const conditions: PickListValue[] = conditionsQuery.data?.items ?? [];
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(undefined));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [rejected, setRejected] = useState<RejectedIds>(NO_REJECTED);
  // The draft after an awaited reload of the choices, which the user may have changed meanwhile.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // After "Neu laden" (P-05) the inputs stay until the reloaded data has arrived (T-1).
  const [takeReloaded, setTakeReloaded] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  const saving = createMutation.isPending || updateMutation.isPending;
  const busy = saving || deleteMutation.isPending;
  const selectedId = selection?.id ?? null;
  const selected = items.find((item) => item.id === selectedId);

  const supplierName = (id: number | null) =>
    id === null
      ? TEXTS.allSuppliers
      : (suppliers.find((supplier) => supplier.id === id)?.name ?? '');
  const conditionLabel = (id: number | null) =>
    conditions.find((value) => value.id === id)?.label ?? '';

  // The first entry is open once the list has arrived.
  const firstItem = items[0];
  useEffect(() => {
    if (selection === null && firstItem !== undefined) {
      setSelection({ id: firstItem.id });
      setDraft(draftOf(firstItem));
    }
  }, [selection, firstItem]);

  useEffect(() => {
    if (!takeReloaded || query.isFetching) return;
    setTakeReloaded(false);
    // The entry may have been deleted in the other window: then the first one is open.
    const current = selected ?? firstItem;
    setSelection(current ? { id: current.id } : null);
    setDraft(draftOf(current));
    setErrors({});
    setRejected(NO_REJECTED);
  }, [takeReloaded, query.isFetching, selected, firstItem]);

  function open(next: Selection | null, entry?: ConditionCodeEntry) {
    blurCheck.cancel();
    setSelection(next);
    setDraft(draftOf(entry));
    setErrors({});
    setRejected(NO_REJECTED);
    if (notice?.kind !== 'success') setNotice(null);
  }

  /** "Abbrechen" (P-01): back to the stored values, or out of "Übersetzung anlegen". */
  function cancel() {
    if (selectedId === null) open(firstItem ? { id: firstItem.id } : null, firstItem);
    else open(selection, selected);
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    focusFirstError();
  }

  function onSaved(saved: ConditionCodeEntry) {
    setSelection({ id: saved.id });
    setDraft(draftOf(saved));
    setErrors({});
    setRejected(NO_REJECTED);
    setNotice({ kind: 'success' });
  }

  function onSaveFailed(error: ApiError) {
    if (error.kind === 'validation') {
      const next: FieldErrors = {};
      for (const path of FIELD_PATHS) {
        const field = error.error?.fields.find((entry) => entry.path === path);
        if (field) next[path] = field.message;
      }
      if (Object.keys(next).length > 0) {
        showFieldErrors(next);
        return;
      }
    }
    // `name_taken.condition_code` "Diesen Code gibt es für diesen Lieferanten bereits" stands
    // at the code, the field of the combination with the supplier (AC-REQ-022-02).
    if (error.kind === 'rejected' && error.error?.code === 'name_taken') {
      showFieldErrors({ code: error.error.message });
      return;
    }
    const path = error.error?.details.path;
    const id = error.error?.details.id;
    if (
      error.kind === 'rejected' &&
      DEACTIVATED_CODES.has(error.error?.code ?? '') &&
      isChoicePath(path) &&
      typeof id === 'number'
    ) {
      void rejectDeactivated(path, id, error.error?.message ?? '');
      return;
    }
    setNotice(noticeOf(error));
  }

  /**
   * A supplier or condition suggestion deactivated in another window (2.0.11, design v0.6.8):
   * the text stands at the field of `details.path`, which is emptied ("Bitte wählen" at
   * "Lieferant"), and the rejected id is never offered or sent again. Both choices are read
   * again; a second choice with a new value no longer offered is emptied with its own text. The
   * other inputs stay.
   */
  async function rejectDeactivated(path: ChoicePath, id: number, message: string) {
    const before = {
      supplierId: supplierItems(suppliers),
      suggestedConditionValueId: conditionItems(conditions),
    };
    setRejected((current) => ({ ...current, [path]: [...current[path], id] }));
    setDraft((current) => ({ ...current, [DRAFT_KEYS[path]]: EMPTIED[path] }));
    showFieldErrors({ [path]: message });

    const [suppliersRead, conditionsRead] = await Promise.all([
      suppliersQuery.refetch(),
      conditionsQuery.refetch(),
    ]);
    const current = draftRef.current;
    const fields: ChoiceField[] = CHOICE_PATHS.filter((each) => each !== path).map((each) => ({
      path: each,
      id: idOf(current[DRAFT_KEYS[each]]),
      storedId: idOf(current.base[DRAFT_KEYS[each]]),
      before: before[each],
      message: MISSING_TEXT[each],
    }));
    const missing = findMissingChoices(fields, {
      supplierId: suppliersRead.isSuccess ? supplierItems(suppliersRead.data.items) : undefined,
      suggestedConditionValueId: conditionsRead.isSuccess
        ? conditionItems(conditionsRead.data.items)
        : undefined,
    });
    if (missing.length === 0) return;
    const missingPaths = missing.map((each) => each.path as ChoicePath);
    setDraft((draftNow) => {
      const next = { ...draftNow };
      for (const each of missingPaths) next[DRAFT_KEYS[each]] = EMPTIED[each];
      return next;
    });
    setErrors((errorsNow) => ({
      ...errorsNow,
      ...Object.fromEntries(missing.map((each) => [each.path, each.message])),
    }));
    focusFirstError();
  }

  /** A choice in a field ends its rejection text (2.0.11 "bis zur nächsten Wahl"). */
  function choose(path: ChoicePath, option: string) {
    setDraft({ ...draft, [DRAFT_KEYS[path]]: option });
    setErrors((current) => ({ ...current, [path]: undefined }));
  }

  function save() {
    // The save checks the fields itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    if (!changed(draft)) return;
    const found: FieldErrors = {
      code: checkCode(draft.code),
      supplierId:
        draft.supplierId === NOT_CHOSEN ? FIELD_MESSAGES.conditionCodeSupplierNotChosen : undefined,
      plainText: checkPlainText(draft.plainText),
    };
    if (Object.values(found).some((message) => message !== undefined)) {
      showFieldErrors(found);
      return;
    }
    setErrors({});
    setNotice(null);
    const values = {
      code: draft.code,
      supplierId: idOf(draft.supplierId),
      plainText: draft.plainText,
      suggestedConditionValueId: idOf(draft.conditionValueId),
      suggestedVisualGrade: idOf(draft.visualGrade),
    };
    const callbacks = { onSuccess: onSaved, onError: onSaveFailed };
    if (selectedId === null) {
      createMutation.mutate(values, callbacks);
    } else if (draft.version !== null) {
      updateMutation.mutate({ id: selectedId, version: draft.version, ...values }, callbacks);
    }
  }

  /** "Löschen" in the dialog P-04: only the confirmation sends the DELETE (DER-38-08). */
  function remove() {
    if (selected === undefined || draft.version === null) return;
    setNotice(null);
    // The version read when the entry was opened, so that a change in another window answers
    // `version_conflict` (P-05) even after a refetch in the background.
    deleteMutation.mutate(
      { id: selected.id, version: draft.version },
      {
        onSuccess: () => {
          setConfirmDelete(false);
          const next = items.find((item) => item.id !== selected.id);
          open(next ? { id: next.id } : null, next);
          setNotice({ kind: 'success' });
        },
        onError: (error) => {
          setConfirmDelete(false);
          setNotice(noticeOf(error));
        },
      },
    );
  }

  const formLocked = busy || selection === null;
  const unchanged = !changed(draft);
  const loadFailed =
    [query, suppliersQuery, pickListsQuery, conditionsQuery].find((each) => each.isError)?.error ??
    null;
  const loading =
    query.isPending ||
    suppliersQuery.isPending ||
    pickListsQuery.isPending ||
    (conditionListId !== null && conditionsQuery.isPending);

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="m-0 text-page-title font-semibold">{TEXTS.title}</h1>

      <OutcomeUnknownBanner />
      {loadFailed?.kind === 'unreachable' && <UnreachableBanner />}
      {loadFailed && loadFailed.kind !== 'unreachable' && (
        <PageBanner variant="error" error={loadFailed}>
          {TEXTS.error}
        </PageBanner>
      )}
      <SaveNoticeBanners
        notice={notice}
        onClose={() => setNotice(null)}
        onReloaded={() => {
          setNotice(null);
          setTakeReloaded(true);
        }}
        successText={TEXTS.saved}
        errorText={TEXTS.error}
      />

      <p role="note" className="m-0 text-body text-text-secondary">
        {TEXTS.hint}
      </p>

      <MaintenanceTable
        title={TEXTS.list}
        items={loading ? [] : items}
        getId={(item) => item.id}
        selectedId={selectedId}
        onSelect={(item) => open({ id: item.id }, item)}
        renderItem={(item) => (
          <span className="flex flex-col gap-1">
            <span className="flex items-center justify-between gap-2">
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{item.code}</span>
              <Badge variant="draft" className="shrink-0">
                {supplierName(item.supplierId)}
              </Badge>
            </span>
            <span className="min-w-0 text-body [overflow-wrap:anywhere]">{item.plainText}</span>
            {(item.suggestedConditionValueId !== null || item.suggestedVisualGrade !== null) && (
              <span className="text-label text-text-secondary">
                {item.suggestedConditionValueId !== null &&
                  `${TEXTS.condition}: ${conditionLabel(item.suggestedConditionValueId)}`}
                {item.suggestedConditionValueId !== null &&
                  item.suggestedVisualGrade !== null &&
                  ' · '}
                {item.suggestedVisualGrade !== null &&
                  `${TEXTS.visualGrade}: ${item.suggestedVisualGrade}`}
              </span>
            )}
          </span>
        )}
        createLabel={TEXTS.create}
        onCreate={() => open({ id: null })}
        disabled={busy || writesLocked}
        emptyText={query.isSuccess && !loading ? TEXTS.empty : undefined}
        placeholder={
          loading ? (
            <p role="status" className="m-0 px-4 py-2 text-body text-text-secondary">
              {TEXTS.loading}
            </p>
          ) : undefined
        }
      >
        <form
          ref={formRef}
          aria-label={TEXTS.title}
          noValidate
          className="flex flex-col gap-4 rounded-control border border-border bg-surface p-4"
          onPointerDown={blurCheck.pressPointer}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="flex flex-col gap-4 full:flex-row full:flex-wrap full:items-start">
            <div className="full:w-48">
              <FormField label={TEXTS.code} required error={errors.code}>
                {(control) => (
                  <Input
                    {...control}
                    value={draft.code}
                    disabled={formLocked}
                    onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                    onBlur={() => {
                      const code = draft.code;
                      blurCheck.checkOnBlur(() =>
                        setErrors((current) => ({ ...current, code: checkCode(code) })),
                      );
                    }}
                  />
                )}
              </FormField>
            </div>
            <div className="full:w-64">
              <FormField label={TEXTS.supplier} error={errors.supplierId}>
                {(control) => (
                  <Select
                    {...control}
                    value={draft.supplierId}
                    disabled={formLocked}
                    onChange={(event) => choose('supplierId', event.target.value)}
                  >
                    {draft.supplierId === NOT_CHOSEN && (
                      <option value={NOT_CHOSEN} disabled>
                        {TEXTS.notChosen}
                      </option>
                    )}
                    <option value="">{TEXTS.allSuppliers}</option>
                    {optionsOf(
                      supplierItems(suppliers),
                      draft.base.supplierId,
                      rejected.supplierId,
                    ).map((supplier) => (
                      <option key={supplier.id} value={optionOf(supplier.id)}>
                        {supplier.label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          </div>
          <FormField label={TEXTS.plainText} required error={errors.plainText}>
            {(control) => (
              <Input
                {...control}
                value={draft.plainText}
                disabled={formLocked}
                onChange={(event) => setDraft({ ...draft, plainText: event.target.value })}
                onBlur={() => {
                  const plainText = draft.plainText;
                  blurCheck.checkOnBlur(() =>
                    setErrors((current) => ({ ...current, plainText: checkPlainText(plainText) })),
                  );
                }}
              />
            )}
          </FormField>
          <div className="flex flex-col gap-4 full:flex-row full:flex-wrap full:items-start">
            <div className="full:w-64">
              <FormField label={TEXTS.condition} error={errors.suggestedConditionValueId}>
                {(control) => (
                  <Select
                    {...control}
                    value={draft.conditionValueId}
                    disabled={formLocked}
                    onChange={(event) => choose('suggestedConditionValueId', event.target.value)}
                  >
                    <option value="">{TEXTS.noSuggestion}</option>
                    {optionsOf(
                      conditionItems(conditions),
                      draft.base.conditionValueId,
                      rejected.suggestedConditionValueId,
                    ).map((value) => (
                      <option key={value.id} value={optionOf(value.id)}>
                        {value.label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
            <div className="full:w-48">
              <FormField label={TEXTS.visualGrade} error={errors.suggestedVisualGrade}>
                {(control) => (
                  <Select
                    {...control}
                    value={draft.visualGrade}
                    disabled={formLocked}
                    onChange={(event) => setDraft({ ...draft, visualGrade: event.target.value })}
                  >
                    <option value="">{TEXTS.noSuggestion}</option>
                    {GRADES.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={formLocked || writesLocked || unchanged}
            >
              {saving ? TEXTS.saving : TEXTS.save}
            </Button>
            <Button
              type="button"
              // After an unknown outcome the inputs stay visible until reloading (P-08).
              disabled={formLocked || writesLocked || (unchanged && selectedId !== null)}
              onClick={cancel}
            >
              {TEXTS.cancel}
            </Button>
            {selected !== undefined && (
              <Button
                type="button"
                className="full:ml-auto"
                disabled={formLocked || writesLocked}
                onClick={() => setConfirmDelete(true)}
              >
                {TEXTS.delete}
              </Button>
            )}
          </div>
        </form>
      </MaintenanceTable>

      {selected !== undefined && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          onConfirm={remove}
          title={TEXTS.deleteTitle}
          confirmLabel={TEXTS.delete}
          width={480}
          destructive
          confirmDisabled={deleteMutation.isPending || writesLocked}
        >
          {TEXTS.deleteEffect(selected.code, supplierName(selected.supplierId))}
        </ConfirmDialog>
      )}
    </div>
  );
}
