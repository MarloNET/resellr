import {
  batteryPresentRequiredSchema,
  pickListValueLabelSchema,
  type PickList,
  type PickListValue,
} from '@resellr/domain/schemas/pick-list.schema';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import type { ApiError } from '../../../api/api-client.ts';
import {
  useCreatePickListValueMutation,
  usePickListsQuery,
  usePickListValuesQuery,
  useReorderPickListValuesMutation,
  useUpdatePickListValueMutation,
} from '../../../api/settings.api.ts';
import { useWritesLocked } from '../../../api/write-outcome-store.ts';
import { FormField, useFocusFirstError } from '../../../components/forms/FormField.tsx';
import { ConflictBanner } from '../../../components/patterns/ConflictBanner.tsx';
import {
  MaintenanceTable,
  moveEntry,
  OrderControls,
  useDragOrder,
} from '../../../components/patterns/MaintenanceTable.tsx';
import { OutcomeUnknownBanner } from '../../../components/patterns/OutcomeUnknownBanner.tsx';
import { bannerClassName, PageBanner } from '../../../components/patterns/PageBanner.tsx';
import { ShuttingDownBanner } from '../../../components/patterns/ShuttingDownBanner.tsx';
import { UnreachableBanner } from '../../../components/patterns/UnreachableBanner.tsx';
import { Badge } from '../../../components/ui/Badge.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { cn } from '../../../components/ui/cn.ts';
import { Input } from '../../../components/ui/Input.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/Table.tsx';

// Texts of UI-028 `screen.md` and of the pattern P-01 (UI/UX design v0.6.1).
const TEXTS = {
  title: 'Auswahllisten',
  loading: 'Lade Einstellungen …',
  empty: 'Noch keine Werte in dieser Liste',
  create: 'Wert anlegen',
  order: 'Reihenfolge',
  value: 'Wert',
  status: 'Status',
  batteryPresent: 'Akku vorhanden',
  yes: 'Ja',
  no: 'Nein',
  active: 'aktiv',
  inactive: 'deaktiviert',
  edit: 'Bearbeiten',
  deactivate: 'Deaktivieren',
  save: 'Speichern',
  saving: 'Speichern …',
  cancel: 'Abbrechen',
  saved: 'Gespeichert',
  /** "Umbenennung wirkt auf alle Datensätze (Hinweis vor Speichern)", action of UI-028. */
  renameHint: 'Umbenennung wirkt auf alle Datensätze',
  error: (referenceNumber: string | null) =>
    `Einstellungen konnten nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Banner at the top of the page after a write (2.0.7). */
type Notice =
  | { kind: 'success' }
  | { kind: 'error'; error: ApiError }
  | { kind: 'conflict' }
  | { kind: 'shutting-down' }
  | { kind: 'not-found'; message: string };

interface Draft {
  label: string;
  active: boolean;
  /** Only in the list battery; `null` while nothing is chosen. */
  batteryPresent: boolean | null;
}

/**
 * Row in inline editing: a new value at the end of the table, or an existing one with the
 * version it was opened in (2.0.3), so a change from another window leads to `409` and P-05.
 */
type Editing = { id: null; draft: Draft } | { id: number; version: number; draft: Draft };

type FieldErrors = { label?: string; batteryPresent?: string };

const NEW_DRAFT: Draft = { label: '', active: true, batteryPresent: null };

const draftOf = (value: PickListValue): Draft => ({
  label: value.label,
  active: value.active,
  batteryPresent: value.batteryPresent,
});

/** The draft differs from what is stored, so "Speichern" is enabled (`UI-028.disabled`). */
function isChanged(draft: Draft, stored: Draft) {
  return (
    draft.label.trim() !== stored.label.trim() ||
    draft.active !== stored.active ||
    draft.batteryPresent !== stored.batteryPresent
  );
}

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? undefined : result.error?.issues[0]?.message;

/** The checks of the server in the browser, with the same schemas (2.0.7 `.validation`). */
function checkDraft(draft: Draft, isBatteryList: boolean): FieldErrors {
  return {
    label: firstMessage(pickListValueLabelSchema.safeParse(draft.label)),
    batteryPresent: isBatteryList
      ? firstMessage(batteryPresentRequiredSchema.safeParse(draft.batteryPresent))
      : undefined,
  };
}

const hasErrors = (errors: FieldErrors) => Boolean(errors.label ?? errors.batteryPresent);

/**
 * Pick lists of UI-028 (CU-096, REQ-007; Technical Specification 2.1): the nine lists on the
 * left, the values of the chosen list on the right with order, value, status and, only in the
 * list battery, "Akku vorhanden". Create, inline editing, deactivate and the order by dragging
 * or with "Hoch"/"Runter". There is no action to create or delete a list or a value (RQ-07,
 * DER-35-09). States after 2.0.7: loading, empty, validation, success, error, disabled,
 * speichert (P-08), conflict (P-05), unreachable (P-06), wird-beendet (P-07), ausgang-unbekannt
 * (P-08). A rename opens no impact dialog UI-043 (DER-35-13).
 */
export function PickListsPage() {
  const listsQuery = usePickListsQuery();
  const lists = listsQuery.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const list = lists.find((item) => item.id === selectedId);
  const valuesQuery = usePickListValuesQuery(list?.id ?? null);
  const values = valuesQuery.data?.items ?? [];

  const createMutation = useCreatePickListValueMutation();
  const updateMutation = useUpdatePickListValueMutation();
  const reorderMutation = useReorderPickListValuesMutation();
  const writesLocked = useWritesLocked();

  const [editing, setEditing] = useState<Editing | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  // After "Neu laden" (P-05) the inputs stay until the reloaded data has arrived (T-1).
  const [takeReloaded, setTakeReloaded] = useState(false);

  const tableRef = useRef<HTMLElement>(null);
  const focusFirstError = useFocusFirstError(tableRef);

  const saving = createMutation.isPending || updateMutation.isPending || reorderMutation.isPending;
  const locked = saving || writesLocked;
  const isBatteryList = list?.isBatteryList ?? false;

  // The first list is chosen once the lists have arrived.
  const firstList = lists[0];
  useEffect(() => {
    if (selectedId === null && firstList !== undefined) setSelectedId(firstList.id);
  }, [selectedId, firstList]);

  useEffect(() => {
    if (!takeReloaded || valuesQuery.isFetching) return;
    setTakeReloaded(false);
    setErrors({});
    setEditing((current) => {
      if (current === null || current.id === null) return current;
      const reloaded = values.find((value) => value.id === current.id);
      return reloaded
        ? { id: reloaded.id, version: reloaded.version, draft: draftOf(reloaded) }
        : null;
    });
  }, [takeReloaded, valuesQuery.isFetching, values]);

  const dragProps = useDragOrder({
    disabled: locked || editing !== null,
    onMove: (from, to) => reorder(from, to),
  });

  function chooseList(next: PickList) {
    setSelectedId(next.id);
    setEditing(null);
    setErrors({});
    if (notice?.kind !== 'success') setNotice(null);
  }

  function startEditing(next: Editing | null) {
    setEditing(next);
    setErrors({});
    if (notice?.kind !== 'success') setNotice(null);
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    focusFirstError();
  }

  function onFailed(error: ApiError) {
    switch (error.kind) {
      case 'validation': {
        const fieldMessage = (path: string) =>
          error.error?.fields.find((entry) => entry.path === path)?.message;
        showFieldErrors({
          label: fieldMessage('label'),
          batteryPresent: fieldMessage('batteryPresent'),
        });
        return;
      }
      case 'rejected':
        // `name_taken.pick_list_value` "Wert gibt es in dieser Liste bereits" stands at the field.
        if (error.error?.code === 'name_taken') showFieldErrors({ label: error.error.message });
        else setNotice({ kind: 'error', error });
        return;
      case 'conflict':
        setNotice({ kind: 'conflict' });
        return;
      case 'shutting-down':
        setNotice({ kind: 'shutting-down' });
        return;
      case 'not-found':
        setNotice({ kind: 'not-found', message: error.error?.message ?? '' });
        return;
      case 'outcome-unknown':
        // The banner P-08 shows itself once the page is locked (CU-049).
        setNotice(null);
        return;
      default:
        setNotice({ kind: 'error', error });
    }
  }

  const onSaved = () => {
    setEditing(null);
    setErrors({});
    setNotice({ kind: 'success' });
  };
  const callbacks = { onSuccess: onSaved, onError: onFailed };

  function save() {
    if (list === undefined || editing === null) return;
    const checked = checkDraft(editing.draft, isBatteryList);
    if (hasErrors(checked)) {
      showFieldErrors(checked);
      return;
    }
    setNotice(null);
    const { label, active } = editing.draft;
    const batteryPresent = isBatteryList ? editing.draft.batteryPresent : undefined;
    if (editing.id === null) {
      createMutation.mutate({ pickListId: list.id, label, active, batteryPresent }, callbacks);
    } else {
      updateMutation.mutate(
        {
          id: editing.id,
          pickListId: list.id,
          version: editing.version,
          label,
          active,
          batteryPresent,
        },
        callbacks,
      );
    }
  }

  function deactivate(value: PickListValue) {
    if (list === undefined) return;
    setNotice(null);
    updateMutation.mutate(
      { id: value.id, pickListId: list.id, version: value.version, active: false },
      callbacks,
    );
  }

  function reorder(from: number, to: number) {
    if (list === undefined || from === to) return;
    setNotice(null);
    const valueIds = moveEntry(
      values.map((value) => value.id),
      from,
      to,
    );
    reorderMutation.mutate(
      { pickListId: list.id, version: list.version, valueIds },
      { onSuccess: () => setNotice({ kind: 'success' }), onError: onFailed },
    );
  }

  const listsFailed = listsQuery.isError ? listsQuery.error : null;
  const valuesFailed = valuesQuery.isError ? valuesQuery.error : null;
  const loadFailed = listsFailed ?? valuesFailed;
  const loading = listsQuery.isPending || (list !== undefined && valuesQuery.isPending);
  const empty = !loading && list !== undefined && values.length === 0 && editing === null;

  const loadingText = (
    <p role="status" className="m-0 px-4 py-2 text-body text-text-secondary">
      {TEXTS.loading}
    </p>
  );

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
      {notice?.kind === 'success' && (
        <PageBanner variant="success" onClose={() => setNotice(null)}>
          {TEXTS.saved}
        </PageBanner>
      )}
      {notice?.kind === 'error' && (
        <PageBanner variant="error" error={notice.error} onClose={() => setNotice(null)}>
          {TEXTS.error}
        </PageBanner>
      )}
      {notice?.kind === 'conflict' && (
        <ConflictBanner
          onReloaded={() => {
            setNotice(null);
            setTakeReloaded(true);
          }}
        />
      )}
      {notice?.kind === 'shutting-down' && <ShuttingDownBanner />}
      {notice?.kind === 'not-found' && (
        <div role="alert" className={bannerClassName('warn')}>
          {notice.message}
        </div>
      )}

      <MaintenanceTable
        title={TEXTS.title}
        items={lists}
        getId={(item) => item.id}
        selectedId={selectedId}
        onSelect={chooseList}
        renderItem={(item) => (
          <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{item.name}</span>
        )}
        showCount={false}
        disabled={saving}
        placeholder={listsQuery.isPending ? loadingText : undefined}
      >
        <section
          ref={tableRef}
          aria-label={list?.name ?? TEXTS.title}
          className="flex flex-col gap-2 rounded-control border border-border bg-surface p-4"
        >
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-section font-semibold">{list?.name}</h2>
            {!loading && !empty && list !== undefined && (
              <Button
                disabled={locked || editing !== null}
                onClick={() => startEditing({ id: null, draft: NEW_DRAFT })}
              >
                <span aria-hidden="true">+</span>
                {TEXTS.create}
              </Button>
            )}
          </header>

          {loading && loadingText}
          {empty && (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="m-0 text-body">{TEXTS.empty}</p>
              <Button
                variant="primary"
                disabled={locked}
                onClick={() => startEditing({ id: null, draft: NEW_DRAFT })}
              >
                {TEXTS.create}
              </Button>
            </div>
          )}
          {!loading && !empty && list !== undefined && (
            <Table>
              <TableHeader>
                <TableRow className="whitespace-nowrap">
                  <TableHead>{TEXTS.order}</TableHead>
                  <TableHead>{TEXTS.value}</TableHead>
                  <TableHead>{TEXTS.status}</TableHead>
                  {isBatteryList && <TableHead>{TEXTS.batteryPresent}</TableHead>}
                  {/* The row actions have no column heading in UI-028. */}
                  <TableCell />
                </TableRow>
              </TableHeader>
              <TableBody>
                {values.map((value, index) =>
                  editing !== null && editing.id === value.id ? (
                    <EditRow
                      key={value.id}
                      position={index + 1}
                      editing={editing}
                      stored={draftOf(value)}
                      isBatteryList={isBatteryList}
                      errors={errors}
                      saving={saving}
                      writesLocked={writesLocked}
                      onChange={(draft) => setEditing({ ...editing, draft })}
                      onBlurLabel={() =>
                        setErrors({
                          ...errors,
                          label: checkDraft(editing.draft, isBatteryList).label,
                        })
                      }
                      onSave={save}
                      onCancel={() => startEditing(null)}
                    />
                  ) : (
                    <TableRow
                      key={value.id}
                      {...dragProps(index)}
                      className={cn(dragProps(index).draggable && 'cursor-grab')}
                    >
                      <TableCell>
                        <OrderControls
                          index={index}
                          count={values.length}
                          disabled={locked || editing !== null}
                          onMove={reorder}
                        />
                      </TableCell>
                      {/* Values break only between words; the table scrolls if they do not fit (2.0.10). */}
                      <TableCell className="min-w-32 font-semibold [overflow-wrap:break-word]">
                        {value.label}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={value.active ? 'published' : 'draft'}>
                          {value.active ? TEXTS.active : TEXTS.inactive}
                        </Badge>
                      </TableCell>
                      {isBatteryList && (
                        <TableCell>
                          {value.batteryPresent === null
                            ? ''
                            : value.batteryPresent
                              ? TEXTS.yes
                              : TEXTS.no}
                        </TableCell>
                      )}
                      <TableCell>
                        <span className="flex flex-wrap gap-2">
                          <Button
                            disabled={locked || editing !== null}
                            onClick={() =>
                              startEditing({
                                id: value.id,
                                version: value.version,
                                draft: draftOf(value),
                              })
                            }
                          >
                            {TEXTS.edit}
                          </Button>
                          {value.active && (
                            <Button
                              disabled={locked || editing !== null}
                              onClick={() => deactivate(value)}
                            >
                              {TEXTS.deactivate}
                            </Button>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ),
                )}
                {editing !== null && editing.id === null && (
                  <EditRow
                    position={values.length + 1}
                    editing={editing}
                    stored={NEW_DRAFT}
                    isBatteryList={isBatteryList}
                    errors={errors}
                    saving={saving}
                    writesLocked={writesLocked}
                    onChange={(draft) => setEditing({ ...editing, draft })}
                    onBlurLabel={() =>
                      setErrors({
                        ...errors,
                        label: checkDraft(editing.draft, isBatteryList).label,
                      })
                    }
                    onSave={save}
                    onCancel={() => startEditing(null)}
                  />
                )}
              </TableBody>
            </Table>
          )}
        </section>
      </MaintenanceTable>
    </div>
  );
}

interface EditRowProps {
  position: number;
  editing: Editing;
  /** Stored state of the row, for `UI-028.disabled` and the rename hint. */
  stored: Draft;
  isBatteryList: boolean;
  errors: FieldErrors;
  saving: boolean;
  writesLocked: boolean;
  onChange: (draft: Draft) => void;
  onBlurLabel: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Inline editing of a value (UI-028 "Inline-Bearbeitung"): value, "Akku vorhanden" only in the
 * list battery, status, "Speichern" and "Abbrechen" (P-01). Before a rename is saved, the row
 * says that it applies to all records (DER-35-11). Enter in a field saves (DESIGN.md).
 */
function EditRow({
  position,
  editing,
  stored,
  isBatteryList,
  errors,
  saving,
  writesLocked,
  onChange,
  onBlurLabel,
  onSave,
  onCancel,
}: EditRowProps) {
  const { draft } = editing;
  const renamed = editing.id !== null && draft.label.trim() !== stored.label.trim();
  const disabled = saving || writesLocked;
  const onEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSave();
    }
  };

  return (
    <TableRow className="hover:bg-surface">
      <TableCell>
        {/* Number at the place of the number in `OrderControls`. */}
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="invisible">
            ⠿
          </span>
          <span className="min-w-6 text-right">{position}</span>
        </span>
      </TableCell>
      <TableCell className="min-w-32">
        <FormField label={TEXTS.value} required error={errors.label}>
          {(control) => (
            <Input
              {...control}
              autoFocus
              maxLength={100}
              value={draft.label}
              disabled={saving}
              onChange={(event) => onChange({ ...draft, label: event.target.value })}
              onBlur={onBlurLabel}
              onKeyDown={onEnter}
            />
          )}
        </FormField>
        {renamed && <p className="m-0 mt-1 text-label text-text-secondary">{TEXTS.renameHint}</p>}
      </TableCell>
      <TableCell className="whitespace-nowrap [overflow-wrap:normal]">
        <StatusSwitch
          checked={draft.active}
          disabled={saving}
          onChange={(active) => onChange({ ...draft, active })}
        />
      </TableCell>
      {isBatteryList && (
        <TableCell>
          <FormField label={TEXTS.batteryPresent} required error={errors.batteryPresent}>
            {(control) => (
              <select
                {...control}
                value={draft.batteryPresent === null ? '' : String(draft.batteryPresent)}
                disabled={saving}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    batteryPresent:
                      event.target.value === '' ? null : event.target.value === 'true',
                  })
                }
                onKeyDown={onEnter}
                className={cn(
                  'h-control min-w-24 rounded-control border border-border-input bg-surface px-2',
                  'text-body text-text aria-invalid:border-error disabled:bg-bg',
                )}
              >
                <option value="" />
                <option value="true">{TEXTS.yes}</option>
                <option value="false">{TEXTS.no}</option>
              </select>
            )}
          </FormField>
        </TableCell>
      )}
      <TableCell>
        <span className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={disabled || !isChanged(draft, stored)}
            onClick={onSave}
          >
            {saving ? TEXTS.saving : TEXTS.save}
          </Button>
          <Button disabled={saving} onClick={onCancel}>
            {TEXTS.cancel}
          </Button>
        </span>
      </TableCell>
    </TableRow>
  );
}

/** Switch "Status" aktiv/deaktiviert of UI-028. */
function StatusSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-label font-semibold text-text">
        {TEXTS.status}
      </span>
      <div className="flex h-control items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border',
            'disabled:cursor-not-allowed disabled:opacity-60',
            checked ? 'border-primary bg-primary' : 'border-border-input bg-bg',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'inline-block size-5 rounded-full bg-surface shadow transition-transform',
              checked ? 'translate-x-5' : 'translate-x-0.5',
            )}
          />
        </button>
        <span className="text-body">{checked ? TEXTS.active : TEXTS.inactive}</span>
      </div>
    </div>
  );
}
