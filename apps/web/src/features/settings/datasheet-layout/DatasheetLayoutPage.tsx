import {
  ATTRIBUTE_VALUE_LABELS,
  type AttributeWithUsage,
  type DatasheetBlock,
} from '@resellr/domain/schemas/attribute.schema';
import {
  headerLabelSchema,
  type AttributeOrderMap,
  type DatasheetLayout,
} from '@resellr/domain/schemas/datasheet-layout.schema';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import type { ApiError } from '../../../api/api-client.ts';
import {
  useAttributesQuery,
  useDatasheetLayoutQuery,
  useDeviceTypesQuery,
  useSaveDatasheetLayoutMutation,
} from '../../../api/settings.api.ts';
import { useWritesLocked } from '../../../api/write-outcome-store.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../../components/forms/FormField.tsx';
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
import { Button } from '../../../components/ui/Button.tsx';
import { cn } from '../../../components/ui/cn.ts';
import { Input } from '../../../components/ui/Input.tsx';

// Texts of UI-039 `screen.md` (UI/UX design v0.6.1); the loading text of the settings screens.
// The success text is the result of "Speichern" (decision of the Product Owner, #253).
const TEXTS = {
  title: 'Datenblatt-Layout',
  loading: 'Lade Einstellungen …',
  headerLabels: 'Kopfzeilentexte',
  headerLabel: (position: number) => `Kopfzeilentext ${position}`,
  blockOrder: 'Blockreihenfolge',
  attributeOrder: 'Merkmalsreihenfolge',
  deviceTypes: 'Gerätearten',
  empty: 'Für diese Geräteart sind noch keine Merkmale einem Datenblatt-Block zugeordnet',
  toAttributes: 'Zu den Merkmalen (UI-027)',
  preview: 'Vorschau am Beispielgerät',
  save: 'Speichern',
  saving: 'Speichern …',
  saved: 'Datenblatt-Layout gespeichert',
  error: (referenceNumber: string | null) =>
    `Einstellungen konnten nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Route of UI-027, where attributes get their datasheet block (Technical Specification 4.2). */
const ATTRIBUTES_PATH = '/einstellungen/geraetearten';

type Draft = Omit<DatasheetLayout, 'version'> & {
  /**
   * Version of the state the form is based on (2.0.3). A background refetch does not change
   * it, so a change from another window leads to `409` and P-05.
   */
  version: number;
};

/** Field errors of the header labels by position. */
type FieldErrors = Record<number, string | undefined>;

const draftOf = (layout: DatasheetLayout): Draft => ({ ...layout });

const checkLabel = (value: string) => headerLabelSchema.safeParse(value).error?.issues[0]?.message;

const checkAll = (draft: Draft): FieldErrors =>
  Object.fromEntries(draft.headerLabels.map((label, index) => [index, checkLabel(label)]));

const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

const sameList = <T,>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((entry, index) => entry === b[index]);

function sameOrders(a: AttributeOrderMap, b: AttributeOrderMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => sameList(a[key] ?? [], b[key] ?? []));
}

/**
 * The attribute orders the user changed. Only these are sent: an unchanged order from the
 * loaded layout may meanwhile lack an attribute created in UI-027 and would lead to `409`.
 */
function changedOrders(draft: AttributeOrderMap, base: AttributeOrderMap): AttributeOrderMap {
  return Object.fromEntries(
    Object.entries(draft).filter(([key, ids]) => !sameList(ids, base[key] ?? [])),
  );
}

/** Whether the form differs from the layout it is based on (UI-039 `.disabled`). */
function isChanged(draft: Draft, base: DatasheetLayout): boolean {
  return (
    !sameList(draft.headerLabels, base.headerLabels) ||
    !sameList(draft.blockOrder, base.blockOrder) ||
    !sameOrders(draft.attributeOrder, base.attributeOrder)
  );
}

/**
 * Attribute order of a device type: the stored order, attributes without a place at the end in
 * the order of UI-027; without a stored order the order of UI-027 (Technical Specification 2.2).
 */
function orderOf(
  stored: readonly number[] | undefined,
  attributes: readonly AttributeWithUsage[],
): number[] {
  const all = attributes.map((attribute) => attribute.id);
  if (stored === undefined) return all;
  const known = new Set(all);
  const kept = stored.filter((id) => known.has(id));
  const keptIds = new Set(kept);
  return [...kept, ...all.filter((id) => !keptIds.has(id))];
}

/**
 * Datasheet layout of UI-039 (CU-102, REQ-051; Technical Specification 2.2): header labels,
 * block order and attribute order per device type, each order by dragging or with "Hoch" and
 * "Runter" (P-01). Each device type shows its active attributes per block in the block order;
 * the order moves an attribute only within its block. The preview link stays disabled until
 * UI-023 exists (S8, Technical Specification 4.4.0) and requests nothing. States after 2.0.7:
 * default, loading, empty, validation, success, error, disabled, speichert (P-08), conflict
 * (P-05), unreachable (P-06), wird-beendet (P-07), ausgang-unbekannt (P-08).
 */
export function DatasheetLayoutPage() {
  const query = useDatasheetLayoutQuery();
  const deviceTypesQuery = useDeviceTypesQuery();
  const saveMutation = useSaveDatasheetLayoutMutation();
  const writesLocked = useWritesLocked();
  const navigate = useNavigate();

  const [base, setBase] = useState<DatasheetLayout | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const [chosenId, setChosenId] = useState<number | null>(null);
  // After "Neu laden" (P-05) the inputs stay until the reloaded data has arrived (T-1).
  const [takeReloaded, setTakeReloaded] = useState(false);
  // Counts the results of "Speichern" that show a banner; each one brings the banners into view.
  const [results, setResults] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);
  const bannersRef = useRef<HTMLDivElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  const layout = query.data;
  const deviceTypes = deviceTypesQuery.data?.items ?? [];
  const selectedId = chosenId ?? deviceTypes[0]?.id ?? null;
  const attributesQuery = useAttributesQuery(selectedId);
  const saving = saveMutation.isPending;

  // The form opens with the loaded layout.
  useEffect(() => {
    if (draft === null && layout !== undefined) {
      setBase(layout);
      setDraft(draftOf(layout));
    }
  }, [draft, layout]);

  useEffect(() => {
    if (!takeReloaded || query.isFetching || layout === undefined) return;
    setTakeReloaded(false);
    setBase(layout);
    setDraft(draftOf(layout));
    setErrors({});
  }, [takeReloaded, query.isFetching, layout]);

  // "Speichern" is at the end of a long page, the banners at its top (QA-R2-01): the result of a
  // save is scrolled into view and gets the focus, so "Neu laden" of P-05 is the next stop.
  useEffect(() => {
    const banners = bannersRef.current;
    if (results === 0 || banners === null || !banners.hasChildNodes()) return;
    banners.focus({ preventScroll: true });
    banners.scrollIntoView({ block: 'nearest' });
  }, [results]);

  function changeLabel(position: number, value: string) {
    if (draft === null) return;
    setDraft({
      ...draft,
      headerLabels: draft.headerLabels.map((label, index) => (index === position ? value : label)),
    });
  }

  function checkOnBlur(position: number) {
    if (draft === null) return;
    const value = draft.headerLabels[position] ?? '';
    blurCheck.checkOnBlur(() =>
      setErrors((current) => ({ ...current, [position]: checkLabel(value) })),
    );
  }

  function moveBlock(from: number, to: number) {
    if (draft !== null) setDraft({ ...draft, blockOrder: moveEntry(draft.blockOrder, from, to) });
  }

  /** Stores the new order of a device type; the order of UI-027 needs no entry of its own. */
  function changeAttributeOrder(deviceTypeId: number, order: number[], uiOrder: number[]) {
    if (draft === null || base === null) return;
    const key = String(deviceTypeId);
    const attributeOrder = { ...draft.attributeOrder, [key]: order };
    if (base.attributeOrder[key] === undefined && sameList(order, uiOrder)) {
      delete attributeOrder[key];
    }
    setDraft({ ...draft, attributeOrder });
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    focusFirstError();
  }

  function onSaved(saved: DatasheetLayout) {
    setBase(saved);
    setDraft(draftOf(saved));
    setErrors({});
    setNotice({ kind: 'success' });
    setResults((count) => count + 1);
  }

  function onFailed(error: ApiError) {
    if (error.kind === 'validation') {
      const next: FieldErrors = {};
      for (const { path, message } of error.error?.fields ?? []) {
        const match = /^headerLabels\.(\d+)$/.exec(path);
        if (match) next[Number(match[1])] ??= message;
      }
      if (hasErrors(next)) {
        showFieldErrors(next);
        return;
      }
    }
    // An unknown outcome sets no notice; P-08 shows itself once the page is locked.
    setNotice(noticeOf(error));
    setResults((count) => count + 1);
  }

  function save() {
    // The save checks the fields itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    if (draft === null || base === null) return;
    const found = checkAll(draft);
    if (hasErrors(found)) {
      showFieldErrors(found);
      return;
    }
    setErrors({});
    setNotice(null);
    saveMutation.mutate(
      {
        version: draft.version,
        headerLabels: draft.headerLabels,
        blockOrder: draft.blockOrder,
        attributeOrder: changedOrders(draft.attributeOrder, base.attributeOrder),
      },
      { onSuccess: onSaved, onError: onFailed },
    );
  }

  const formLocked = saving || draft === null;
  const orderLocked = formLocked || writesLocked;
  const changed = draft !== null && base !== null && isChanged(draft, base);
  const attributesLoadFailed =
    selectedId !== null && attributesQuery.isError ? attributesQuery.error : null;
  const loadFailed =
    (query.isError ? query.error : null) ??
    (deviceTypesQuery.isError ? deviceTypesQuery.error : null) ??
    attributesLoadFailed;

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="m-0 text-page-title font-semibold">{TEXTS.title}</h1>

      <div ref={bannersRef} tabIndex={-1} className="flex flex-col gap-4 outline-none empty:hidden">
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
      </div>

      {query.isPending && (
        <p role="status" className="m-0 text-body text-text-secondary">
          {TEXTS.loading}
        </p>
      )}

      {draft !== null && (
        <form
          ref={formRef}
          aria-label={TEXTS.title}
          noValidate
          className="flex flex-col gap-4"
          onPointerDown={blurCheck.pressPointer}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <section
            aria-label={TEXTS.headerLabels}
            className="flex max-w-2xl flex-col gap-4 rounded-control border border-border bg-surface p-4"
          >
            <h2 className="m-0 text-section font-semibold">{TEXTS.headerLabels}</h2>
            {draft.headerLabels.map((label, index) => (
              <FormField key={index} label={TEXTS.headerLabel(index + 1)} error={errors[index]}>
                {(control) => (
                  <Input
                    {...control}
                    value={label}
                    disabled={formLocked}
                    onChange={(event) => changeLabel(index, event.target.value)}
                    onBlur={() => checkOnBlur(index)}
                  />
                )}
              </FormField>
            ))}
          </section>

          <section
            aria-label={TEXTS.blockOrder}
            className="flex max-w-2xl flex-col gap-2 rounded-control border border-border bg-surface p-4"
          >
            <h2 className="m-0 text-section font-semibold">{TEXTS.blockOrder}</h2>
            <OrderedList
              labels={draft.blockOrder.map((block) => ATTRIBUTE_VALUE_LABELS.datasheetBlock[block])}
              label={TEXTS.blockOrder}
              disabled={orderLocked}
              onMove={moveBlock}
            />
          </section>

          <section aria-label={TEXTS.attributeOrder} className="flex flex-col gap-2">
            <h2 className="m-0 text-section font-semibold">{TEXTS.attributeOrder}</h2>
            <MaintenanceTable
              title={TEXTS.deviceTypes}
              items={deviceTypes}
              getId={(item) => item.id}
              selectedId={selectedId}
              onSelect={(item) => setChosenId(item.id)}
              renderItem={(item) => (
                <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{item.name}</span>
              )}
              showCount={false}
              disabled={saving}
              placeholder={
                deviceTypesQuery.isPending ? (
                  <p role="status" className="m-0 px-4 py-2 text-body text-text-secondary">
                    {TEXTS.loading}
                  </p>
                ) : undefined
              }
            >
              {selectedId !== null && (
                <AttributeOrder
                  key={selectedId}
                  blockOrder={draft.blockOrder}
                  attributes={attributesQuery.data?.items ?? null}
                  stored={draft.attributeOrder[String(selectedId)]}
                  disabled={orderLocked}
                  onChange={(order, uiOrder) => changeAttributeOrder(selectedId, order, uiOrder)}
                  onOpenAttributes={() => void navigate(ATTRIBUTES_PATH)}
                />
              )}
            </MaintenanceTable>
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              variant="primary"
              disabled={formLocked || writesLocked || !changed}
            >
              {saving ? TEXTS.saving : TEXTS.save}
            </Button>
            {/* Until UI-023 exists the link leads nowhere (S8, Technical Specification 4.4.0). */}
            <a role="link" aria-disabled="true" className="cursor-not-allowed text-text-secondary">
              {TEXTS.preview}
            </a>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Rows in their order with number, grip, "Hoch" and "Runter" (P-01); the rows can be dragged
 * onto each other.
 */
function OrderedList({
  labels,
  label,
  disabled,
  onMove,
}: {
  labels: readonly string[];
  /** Name of the list, e.g. "Blockreihenfolge" or the name of a block. */
  label: string;
  disabled: boolean;
  onMove: (from: number, to: number) => void;
}) {
  const dragProps = useDragOrder({ disabled, onMove });
  return (
    <ol aria-label={label} className="m-0 flex list-none flex-col gap-1 p-0">
      {labels.map((text, index) => (
        <li
          key={text}
          {...dragProps(index)}
          className={cn(
            'flex items-center gap-2 rounded-control border border-border px-2 py-1',
            dragProps(index).draggable && 'cursor-grab',
          )}
        >
          <OrderControls index={index} count={labels.length} disabled={disabled} onMove={onMove} />
          <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Active attributes of the chosen device type per block, in the block order (UI-039 "je
 * Geräteart Merkmalsreihenfolge innerhalb eines Blocks"). Moving an attribute changes only the
 * places of the shown attributes of its block in the whole order; deactivated attributes keep
 * their place.
 */
function AttributeOrder({
  blockOrder,
  attributes,
  stored,
  disabled,
  onChange,
  onOpenAttributes,
}: {
  blockOrder: readonly DatasheetBlock[];
  /** `null` while the attributes load. */
  attributes: readonly AttributeWithUsage[] | null;
  stored: readonly number[] | undefined;
  disabled: boolean;
  onChange: (order: number[], uiOrder: number[]) => void;
  onOpenAttributes: () => void;
}) {
  if (attributes === null) {
    return (
      <p role="status" className="m-0 text-body text-text-secondary">
        {TEXTS.loading}
      </p>
    );
  }

  const order = orderOf(stored, attributes);
  const byId = new Map(attributes.map((attribute) => [attribute.id, attribute]));
  const shown = (block: DatasheetBlock) =>
    order.filter((id) => {
      const attribute = byId.get(id);
      return attribute?.active === true && attribute.datasheetBlock === block;
    });

  if (attributes.every((attribute) => !attribute.active)) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-control border border-border bg-surface px-4 py-8 text-center">
        <p className="m-0 text-body">{TEXTS.empty}</p>
        <Button variant="primary" onClick={onOpenAttributes}>
          {TEXTS.toAttributes}
        </Button>
      </div>
    );
  }

  function move(block: DatasheetBlock, from: number, to: number) {
    const ids = shown(block);
    const moved = moveEntry(ids, from, to);
    const places = new Set(ids);
    let next = 0;
    const result = order.map((id) => (places.has(id) ? (moved[next++] ?? id) : id));
    onChange(result, orderOf(undefined, attributes ?? []));
  }

  return (
    <div className="flex flex-col gap-4 rounded-control border border-border bg-surface p-4">
      {blockOrder.map((block) => {
        const ids = shown(block);
        if (ids.length === 0) return null;
        const name = ATTRIBUTE_VALUE_LABELS.datasheetBlock[block];
        return (
          <section key={block} aria-label={name} className="flex flex-col gap-2">
            <h3 className="m-0 text-label font-semibold">{name}</h3>
            <OrderedList
              labels={ids.map((id) => byId.get(id)?.label ?? '')}
              label={name}
              disabled={disabled}
              onMove={(from, to) => move(block, from, to)}
            />
          </section>
        );
      })}
    </div>
  );
}
