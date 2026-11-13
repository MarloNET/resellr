import {
  ATTRIBUTE_VALUE_LABELS,
  type Attribute,
  type AttributeWithUsage,
} from '@resellr/domain/schemas/attribute.schema';
import { deviceTypeNameSchema, type DeviceType } from '@resellr/domain/schemas/device-type.schema';
import { useEffect, useRef, useState } from 'react';

import type { ApiError } from '../../../api/api-client.ts';
import {
  useAttributesQuery,
  useCreateAttributeMutation,
  useCreateDeviceTypeMutation,
  useDeviceTypesQuery,
  usePickListsQuery,
  useReorderAttributesMutation,
  useUpdateAttributeMutation,
  useUpdateDeviceTypeMutation,
} from '../../../api/settings.api.ts';
import { useWritesLocked } from '../../../api/write-outcome-store.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../../components/forms/FormField.tsx';
import { StatusSwitch } from '../../../components/forms/StatusSwitch.tsx';
import {
  MaintenanceTable,
  moveEntry,
  OrderControls,
  useDragOrder,
} from '../../../components/patterns/MaintenanceTable.tsx';
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
import {
  AttributePanel,
  PANEL_TEXTS,
  PANEL_WIDTH,
  requestOf,
  type AttributeDraft,
  type AttributeFieldErrors,
} from './AttributePanel.tsx';

// Texts of UI-027 `screen.md` (UI/UX design v0.6.4).
const TEXTS = {
  title: 'Gerätearten und Merkmale',
  list: 'Gerätearten',
  loading: 'Lade Gerätearten …',
  create: 'Geräteart anlegen',
  save: 'Geräteart speichern',
  saving: 'Speichern …',
  saved: 'Geräteart gespeichert',
  name: 'Name',
  status: 'Status',
  active: 'aktiv',
  inactive: 'deaktiviert',
  attributes: (count: number) => `${count} ${count === 1 ? 'Merkmal' : 'Merkmale'}`,
  attributeSection: 'Merkmale',
  attributeEmpty: 'Noch keine Merkmale. Legen Sie das erste Merkmal an.',
  attributeCreate: 'Merkmal anlegen',
  attributeSaved: 'Merkmal gespeichert',
  attributeDeactivate: 'Deaktivieren',
  attributeReactivate: 'Wieder aktivieren',
  attributeActivated: 'Merkmal aktiviert',
  order: 'Reihenfolge',
  label: 'Bezeichnung',
  dataType: 'Datentyp',
  unit: 'Einheit',
  level: 'Ebene',
  variantForming: 'variantenbildend',
  required: 'Pflicht',
  datasheetBlock: 'Datenblatt-Block',
  yes: 'Ja',
  no: 'Nein',
  notApplicable: '–',
  error: (referenceNumber: string | null) =>
    `Einstellungen konnten nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

interface Draft {
  name: string;
  active: boolean;
  /**
   * Version of the state the form is based on, taken when it is opened (2.0.3). A background
   * refetch does not change it, so a change from another window leads to `409` and P-05.
   */
  version: number | null;
}

/** `null` while a new device type is entered. */
type Selection = { id: number | null };

/**
 * Open panel "Merkmal bearbeiten": `id` `null` for a new attribute. `version` is the state the
 * panel is based on, taken when it is opened (2.0.3); `round` remounts the panel with the
 * reloaded state after "Neu laden" (P-05).
 */
type AttributeEditing = { id: number | null; version: number | null; round: number };

const draftOf = (deviceType: DeviceType | undefined): Draft => ({
  name: deviceType?.name ?? '',
  active: deviceType?.active ?? true,
  version: deviceType?.version ?? null,
});

/** First message of the Zod check in the browser, the same schema as on the server (2.0.7). */
function checkName(name: string): string | undefined {
  const result = deviceTypeNameSchema.safeParse(name);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/**
 * Device types of UI-027 (CU-095, REQ-004; Technical Specification 2.1): list with name and
 * status, create, rename and the switch active/deactivated. There is no deletion (AC-REQ-004-04).
 * States after 2.0.7: loading, validation, success, error, speichert (P-08), conflict (P-05),
 * unreachable (P-06), wird-beendet (P-07), ausgang-unbekannt (P-08). Below the device type stand
 * its attributes with the panel "Merkmal bearbeiten" (REQ-005, `AttributePanel`). Saving opens
 * no impact dialog UI-043 (DER-33-12, DER-34-12).
 */
export function DeviceTypesPage() {
  const query = useDeviceTypesQuery();
  const createMutation = useCreateDeviceTypeMutation();
  const updateMutation = useUpdateDeviceTypeMutation();
  const writesLocked = useWritesLocked();
  const createAttributeMutation = useCreateAttributeMutation();
  const updateAttributeMutation = useUpdateAttributeMutation();
  const reorderAttributesMutation = useReorderAttributesMutation();
  // Own instance: only "Wieder aktivieren" shows "Speichern …" in its row (UI-027.aktiviert-speichert).
  const activateAttributeMutation = useUpdateAttributeMutation();

  const items = query.data?.items ?? [];
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(undefined));
  const [nameError, setNameError] = useState<string | undefined>();
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // Text of `.success`: the device type or an attribute was saved.
  const [successText, setSuccessText] = useState<string>(TEXTS.saved);
  // After "Neu laden" (P-05) the inputs stay until the reloaded data has arrived (T-1).
  const [takeReloaded, setTakeReloaded] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  const attributeSaving =
    createAttributeMutation.isPending ||
    updateAttributeMutation.isPending ||
    reorderAttributesMutation.isPending ||
    activateAttributeMutation.isPending;
  const activatingId = activateAttributeMutation.isPending
    ? (activateAttributeMutation.variables?.id ?? null)
    : null;
  const deviceTypeSaving = createMutation.isPending || updateMutation.isPending;
  // Every write locks the whole page; only the triggering save button shows "Speichern …" (P-08).
  const saving = deviceTypeSaving || attributeSaving;
  const selectedId = selection?.id ?? null;
  const selected = items.find((item) => item.id === selectedId);

  const attributesQuery = useAttributesQuery(selectedId);
  const attributes = selectedId === null ? [] : (attributesQuery.data?.items ?? []);
  const pickListsQuery = usePickListsQuery();
  const [editing, setEditing] = useState<AttributeEditing | null>(null);
  const [attributeErrors, setAttributeErrors] = useState<AttributeFieldErrors>({});
  const [attributeErrorFocus, setAttributeErrorFocus] = useState(0);
  // Row whose action gets the focus once the table is unlocked again (after "Wieder aktivieren").
  const [actionFocusId, setActionFocusId] = useState<number | null>(null);

  // The first device type is open once the list has arrived.
  const firstItem = items[0];
  useEffect(() => {
    if (selection === null && firstItem !== undefined) {
      setSelection({ id: firstItem.id });
      setDraft(draftOf(firstItem));
    }
  }, [selection, firstItem]);

  useEffect(() => {
    if (!takeReloaded || query.isFetching || attributesQuery.isFetching) return;
    setTakeReloaded(false);
    setDraft(draftOf(selected));
    setNameError(undefined);
    setAttributeErrors({});
    setEditing((current) => {
      if (current === null || current.id === null) return current;
      const reloaded = attributes.find((attribute) => attribute.id === current.id);
      return reloaded
        ? { id: reloaded.id, version: reloaded.version, round: current.round + 1 }
        : null;
    });
  }, [takeReloaded, query.isFetching, attributesQuery.isFetching, selected, attributes]);

  function open(next: Selection, deviceType?: DeviceType) {
    blurCheck.cancel();
    setSelection(next);
    setDraft(draftOf(deviceType));
    setNameError(undefined);
    setEditing(null);
    setAttributeErrors({});
    if (notice?.kind !== 'success') setNotice(null);
  }

  function openAttribute(attribute: AttributeWithUsage | null) {
    setEditing({ id: attribute?.id ?? null, version: attribute?.version ?? null, round: 0 });
    setAttributeErrors({});
    if (notice?.kind !== 'success') setNotice(null);
  }

  function showFieldError(message: string) {
    setNameError(message);
    focusFirstError();
  }

  function showSaved(text: string) {
    setSuccessText(text);
    setNotice({ kind: 'success' });
  }

  function onSaved(saved: DeviceType) {
    setSelection({ id: saved.id });
    setDraft(draftOf(saved));
    setNameError(undefined);
    showSaved(TEXTS.saved);
  }

  /**
   * Field errors of an attribute stand at their field in the panel (`UI-027.validation`);
   * `attribute_has_values` at the locked field the save changed (`lockedField`).
   */
  function onAttributeFailed(error: ApiError, lockedField: 'dataType' | 'level' = 'level') {
    if (error.kind === 'validation') {
      const fieldMessage = (path: keyof AttributeFieldErrors) =>
        error.error?.fields.find((entry) => entry.path === path)?.message;
      setAttributeErrors({
        label: fieldMessage('label'),
        unit: fieldMessage('unit'),
        minValue: fieldMessage('minValue'),
        maxValue: fieldMessage('maxValue'),
        pickListId: fieldMessage('pickListId'),
      });
      setAttributeErrorFocus((count) => count + 1);
      return;
    }
    // `name_taken.attribute` "Bezeichnung ist bei dieser Geräteart bereits vergeben" (DER-34-05).
    if (error.kind === 'rejected' && error.error?.code === 'name_taken') {
      setAttributeErrors({ label: error.error.message });
      setAttributeErrorFocus((count) => count + 1);
      return;
    }
    // Values were stored after the list was read (2.1): the panel still offered the field.
    if (error.kind === 'rejected' && error.error?.code === 'attribute_has_values') {
      setAttributeErrors({ [lockedField]: error.error.message });
      setAttributeErrorFocus((count) => count + 1);
      return;
    }
    setNotice(noticeOf(error));
  }

  const onAttributeSaved = () => {
    setEditing(null);
    setAttributeErrors({});
    showSaved(TEXTS.attributeSaved);
  };

  function saveAttribute(attributeDraft: AttributeDraft) {
    if (selectedId === null || editing === null) return;
    setNotice(null);
    const callbacks = {
      onSuccess: onAttributeSaved,
      onError: (error: ApiError) => onAttributeFailed(error),
    };
    if (editing.id === null) {
      createAttributeMutation.mutate(
        { deviceTypeId: selectedId, ...requestOf(attributeDraft, null), active: true },
        callbacks,
      );
    } else if (editing.version !== null) {
      const attribute = attributes.find((item) => item.id === editing.id);
      const request = requestOf(attributeDraft, attribute?.systemRole ?? null);
      // The server checks the data type before the level (2.1).
      const lockedField = attributeDraft.dataType !== attribute?.dataType ? 'dataType' : 'level';
      updateAttributeMutation.mutate(
        { id: editing.id, version: editing.version, ...request },
        { ...callbacks, onError: (error) => onAttributeFailed(error, lockedField) },
      );
    }
  }

  function deactivateAttribute(attribute: Attribute) {
    setNotice(null);
    updateAttributeMutation.mutate(
      { id: attribute.id, version: attribute.version, active: false },
      {
        onSuccess: () => showSaved(TEXTS.attributeSaved),
        onError: (error: ApiError) => setNotice(noticeOf(error)),
      },
    );
  }

  /**
   * "Wieder aktivieren" (REQ-005, AC-REQ-005-11; Technical Specification 2.1): exactly
   * `{ version, active: true }` without dialog, never rejected; only the general states P-05 to
   * P-08 and `.error`, in which the row keeps "deaktiviert". An open panel of the attribute stays
   * open with its inputs; if it is based on the version the activation started from, it continues
   * from the new one, because the activation changes only `active` and the panel has no status.
   */
  function activateAttribute(attribute: Attribute) {
    setNotice(null);
    activateAttributeMutation.mutate(
      { id: attribute.id, version: attribute.version, active: true },
      {
        onSuccess: (saved) => {
          setEditing((current) =>
            current?.id === saved.id && current.version === attribute.version
              ? { ...current, version: saved.version }
              : current,
          );
          setActionFocusId(saved.id);
          showSaved(TEXTS.attributeActivated);
        },
        onError: (error: ApiError) => setNotice(noticeOf(error)),
      },
    );
  }

  function reorderAttributes(from: number, to: number) {
    if (selected === undefined || from === to) return;
    setNotice(null);
    const attributeIds = moveEntry(
      attributes.map((attribute) => attribute.id),
      from,
      to,
    );
    reorderAttributesMutation.mutate(
      { deviceTypeId: selected.id, version: selected.version, attributeIds },
      {
        // The order is guarded by the version of the device type (2.0.3); the form of the
        // device type continues from it.
        onSuccess: (saved) => {
          setDraft((current) => ({ ...current, version: saved.version }));
          showSaved(TEXTS.attributeSaved);
        },
        onError: (error: ApiError) => setNotice(noticeOf(error)),
      },
    );
  }

  function onFailed(error: ApiError) {
    if (error.kind === 'validation') {
      const field = error.error?.fields.find((entry) => entry.path === 'name');
      if (field) showFieldError(field.message);
      return;
    }
    // `name_taken.device_type` "Name ist bereits vergeben" stands at the field.
    if (error.kind === 'rejected' && error.error?.code === 'name_taken') {
      showFieldError(error.error.message);
      return;
    }
    setNotice(noticeOf(error));
  }

  function save() {
    // The save checks the name itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    const message = checkName(draft.name);
    if (message) {
      showFieldError(message);
      return;
    }
    setNameError(undefined);
    setNotice(null);
    const callbacks = { onSuccess: onSaved, onError: onFailed };
    if (selectedId === null) {
      createMutation.mutate({ name: draft.name, active: draft.active }, callbacks);
    } else if (draft.version !== null) {
      updateMutation.mutate(
        { id: selectedId, version: draft.version, name: draft.name, active: draft.active },
        callbacks,
      );
    }
  }

  const formLocked = saving || selection === null;
  const attributesLoadFailed =
    selectedId !== null && attributesQuery.isError ? attributesQuery.error : null;
  const loadFailed = (query.isError ? query.error : null) ?? attributesLoadFailed;
  const orderLocked = saving || writesLocked || editing !== null;
  const dragProps = useDragOrder({ disabled: orderLocked, onMove: reorderAttributes });
  const editedAttribute =
    editing?.id == null ? null : (attributes.find((item) => item.id === editing.id) ?? null);

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
        successText={successText}
        errorText={TEXTS.error}
      />

      <MaintenanceTable
        title={TEXTS.list}
        items={items}
        getId={(item) => item.id}
        selectedId={selectedId}
        onSelect={(item) => open({ id: item.id }, item)}
        renderItem={(item) => (
          <>
            <span className="flex items-center justify-between gap-2">
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{item.name}</span>
              <Badge variant={item.active ? 'published' : 'draft'} className="shrink-0">
                {item.active ? TEXTS.active : TEXTS.inactive}
              </Badge>
            </span>
            <span className="text-label text-text-secondary">
              {TEXTS.attributes(item.attributeCount)}
            </span>
          </>
        )}
        createLabel={TEXTS.create}
        onCreate={() => open({ id: null })}
        disabled={saving || writesLocked}
        panel={
          editing === null || selectedId === null
            ? null
            : {
                title: PANEL_TEXTS.title,
                width: PANEL_WIDTH,
                onClose: () => {
                  if (!attributeSaving) setEditing(null);
                },
                content: (
                  <AttributePanel
                    key={`${editing.id ?? 'new'}-${editing.round}`}
                    attribute={editedAttribute}
                    pickLists={pickListsQuery.data?.items ?? []}
                    errors={attributeErrors}
                    errorFocusRequest={attributeErrorFocus}
                    saving={attributeSaving && activatingId === null}
                    locked={activatingId !== null}
                    writesLocked={writesLocked}
                    onErrors={setAttributeErrors}
                    onSave={saveAttribute}
                    onCancel={() => setEditing(null)}
                  />
                ),
              }
        }
        placeholder={
          query.isPending ? (
            <p role="status" className="m-0 px-4 py-2 text-body text-text-secondary">
              {TEXTS.loading}
            </p>
          ) : undefined
        }
      >
        <form
          ref={formRef}
          aria-label={TEXTS.list}
          noValidate
          className="flex flex-col gap-4 rounded-control border border-border bg-surface p-4 full:flex-row full:flex-wrap full:items-start"
          onPointerDown={blurCheck.pressPointer}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="full:w-80">
            <FormField label={TEXTS.name} required error={nameError}>
              {(control) => (
                <Input
                  {...control}
                  value={draft.name}
                  disabled={formLocked}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  onBlur={() => {
                    const name = draft.name;
                    blurCheck.checkOnBlur(() => setNameError(checkName(name)));
                  }}
                />
              )}
            </FormField>
          </div>
          <StatusSwitch
            checked={draft.active}
            disabled={formLocked}
            onChange={(active) => setDraft({ ...draft, active })}
            label={TEXTS.status}
            activeText={TEXTS.active}
            inactiveText={TEXTS.inactive}
          />
          <Button
            type="submit"
            variant="primary"
            // Beside the open panel the column is narrow (UI-027): the label wraps instead of
            // running under the panel.
            className="h-auto! min-h-control py-1 whitespace-normal! full:ml-auto full:mt-6"
            disabled={formLocked || writesLocked}
          >
            {deviceTypeSaving ? TEXTS.saving : TEXTS.save}
          </Button>
        </form>
        {selected !== undefined && (
          <AttributeTable
            attributes={attributes}
            loading={attributesQuery.isPending}
            locked={saving || writesLocked}
            orderLocked={orderLocked}
            editingId={editing?.id ?? null}
            activatingId={activatingId}
            actionFocusId={actionFocusId}
            onActionFocused={() => setActionFocusId(null)}
            dragProps={dragProps}
            onOpen={openAttribute}
            onDeactivate={deactivateAttribute}
            onActivate={activateAttribute}
            onMove={reorderAttributes}
          />
        )}
      </MaintenanceTable>
    </div>
  );
}

const yesNo = (value: boolean) => (value ? TEXTS.yes : TEXTS.no);

/**
 * Attribute table of UI-027 (DER-34-01, DER-34-06, DER-34-07, DER-34-13): order by dragging or
 * with "Hoch"/"Runter" (P-01), a click on the label opens the panel. The row action at the same
 * place is "Deaktivieren" for an active attribute and "Wieder aktivieren" for a deactivated one,
 * whose row keeps its place with a muted label (design v0.6.4).
 */
function AttributeTable({
  attributes,
  loading,
  locked,
  orderLocked,
  editingId,
  activatingId,
  actionFocusId,
  onActionFocused,
  dragProps,
  onOpen,
  onDeactivate,
  onActivate,
  onMove,
}: {
  attributes: readonly AttributeWithUsage[];
  loading: boolean;
  locked: boolean;
  orderLocked: boolean;
  editingId: number | null;
  /** `UI-027.aktiviert-speichert`: this row shows "Speichern …" at its action. */
  activatingId: number | null;
  /** The action of this row gets the focus as soon as the table is unlocked. */
  actionFocusId: number | null;
  onActionFocused: () => void;
  dragProps: ReturnType<typeof useDragOrder>;
  onOpen: (attribute: AttributeWithUsage | null) => void;
  onDeactivate: (attribute: Attribute) => void;
  onActivate: (attribute: Attribute) => void;
  onMove: (from: number, to: number) => void;
}) {
  const empty = !loading && attributes.length === 0;
  const sectionRef = useRef<HTMLElement>(null);

  // The action was disabled during the request and lost the focus; it gets it back once enabled.
  useEffect(() => {
    if (actionFocusId === null || locked) return;
    sectionRef.current
      ?.querySelector<HTMLButtonElement>(`[data-row-action="${actionFocusId}"]`)
      ?.focus();
    onActionFocused();
  }, [actionFocusId, locked, onActionFocused]);

  return (
    <section
      ref={sectionRef}
      aria-label={TEXTS.attributeSection}
      className="mt-4 flex flex-col gap-2 rounded-control border border-border bg-surface p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-section font-semibold">{TEXTS.attributeSection}</h2>
        {!loading && !empty && (
          <Button
            disabled={locked}
            className="h-auto! min-h-control py-1 whitespace-normal!"
            onClick={() => onOpen(null)}
          >
            <span aria-hidden="true">+</span>
            {TEXTS.attributeCreate}
          </Button>
        )}
      </header>
      {loading && (
        <p role="status" className="m-0 text-body text-text-secondary">
          {TEXTS.loading}
        </p>
      )}
      {empty && (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="m-0 text-body">{TEXTS.attributeEmpty}</p>
          <Button variant="primary" disabled={locked} onClick={() => onOpen(null)}>
            {TEXTS.attributeCreate}
          </Button>
        </div>
      )}
      {!loading && !empty && (
        <Table>
          <TableHeader>
            <TableRow className="whitespace-nowrap">
              <TableHead>{TEXTS.order}</TableHead>
              <TableHead>{TEXTS.label}</TableHead>
              <TableHead>{TEXTS.dataType}</TableHead>
              <TableHead>{TEXTS.unit}</TableHead>
              <TableHead>{TEXTS.level}</TableHead>
              <TableHead>{TEXTS.variantForming}</TableHead>
              <TableHead>{TEXTS.required}</TableHead>
              <TableHead>{TEXTS.datasheetBlock}</TableHead>
              <TableHead>{TEXTS.status}</TableHead>
              {/* The row action has no column heading in UI-027. */}
              <TableCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {attributes.map((attribute, index) => (
              <TableRow
                key={attribute.id}
                {...dragProps(index)}
                aria-current={attribute.id === editingId ? 'true' : undefined}
                className={cn(
                  dragProps(index).draggable && 'cursor-grab',
                  attribute.id === editingId && 'bg-bg',
                )}
              >
                <TableCell>
                  <OrderControls
                    index={index}
                    count={attributes.length}
                    disabled={orderLocked}
                    onMove={onMove}
                  />
                </TableCell>
                <TableCell className="min-w-32 [overflow-wrap:break-word]">
                  {/* Scrolled into view, the label stays beside the fixed first column (2.0.10). */}
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => onOpen(attribute)}
                    className={cn(
                      'scroll-ml-44 cursor-pointer text-left font-semibold disabled:cursor-not-allowed',
                      // Muted in addition to the status text, never by colour alone.
                      attribute.active ? 'text-primary' : 'text-text-secondary',
                    )}
                  >
                    {attribute.label}
                  </button>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {ATTRIBUTE_VALUE_LABELS.dataType[attribute.dataType]}
                </TableCell>
                <TableCell>{attribute.unit ?? ''}</TableCell>
                <TableCell>{ATTRIBUTE_VALUE_LABELS.level[attribute.level]}</TableCell>
                <TableCell>
                  {attribute.level === 'device'
                    ? yesNo(attribute.variantForming)
                    : TEXTS.notApplicable}
                </TableCell>
                <TableCell>{yesNo(attribute.required)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {ATTRIBUTE_VALUE_LABELS.datasheetBlock[attribute.datasheetBlock]}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={attribute.active ? 'published' : 'draft'}>
                    {attribute.active ? TEXTS.active : TEXTS.inactive}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button
                    data-row-action={attribute.id}
                    disabled={locked}
                    onClick={() =>
                      attribute.active ? onDeactivate(attribute) : onActivate(attribute)
                    }
                  >
                    {attribute.id === activatingId
                      ? TEXTS.saving
                      : attribute.active
                        ? TEXTS.attributeDeactivate
                        : TEXTS.attributeReactivate}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
