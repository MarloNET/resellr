import { supplierNameSchema, type Supplier } from '@resellr/domain/schemas/supplier.schema';
import { useEffect, useRef, useState } from 'react';

import type { ApiError } from '../../../api/api-client.ts';
import {
  useCreateSupplierMutation,
  useSuppliersQuery,
  useUpdateSupplierMutation,
} from '../../../api/settings.api.ts';
import { useWritesLocked } from '../../../api/write-outcome-store.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../../components/forms/FormField.tsx';
import { StatusSwitch } from '../../../components/forms/StatusSwitch.tsx';
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

// Texts of UI-032 `screen.md` and of pattern P-01 (UI/UX design v0.6.1).
const TEXTS = {
  title: 'Lieferanten',
  loading: 'Lade Einstellungen …',
  empty: 'Noch keine Lieferanten',
  create: 'Lieferant anlegen',
  save: 'Speichern',
  saving: 'Speichern …',
  cancel: 'Abbrechen',
  saved: 'Gespeichert',
  name: 'Name',
  status: 'Status',
  active: 'aktiv',
  inactive: 'deaktiviert',
  error: (referenceNumber: string | null) =>
    `Einstellungen konnten nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

interface Values {
  name: string;
  active: boolean;
}

interface Draft extends Values {
  /** Values the form was opened with; without a change "Speichern" is disabled (DER-36-07). */
  base: Values;
  /**
   * Version of the state the form is based on, taken when it is opened (2.0.3). A background
   * refetch does not change it, so a change from another window leads to `409` and P-05.
   */
  version: number | null;
}

/** `null` while a new supplier is entered. */
type Selection = { id: number | null };

function draftOf(supplier: Supplier | undefined): Draft {
  const base = { name: supplier?.name ?? '', active: supplier?.active ?? true };
  return { ...base, base, version: supplier?.version ?? null };
}

const changed = (draft: Draft) =>
  draft.name !== draft.base.name || draft.active !== draft.base.active;

/** First message of the Zod check in the browser, the same schema as on the server (2.0.7). */
function checkName(name: string): string | undefined {
  const result = supplierNameSchema.safeParse(name);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/**
 * Suppliers of UI-032 (CU-099, REQ-099; Technical Specification 2.2): maintenance list P-01
 * with name and status, create, rename and the switch active/deactivated. There is no deletion
 * (DER-36-08). States after 2.0.7: loading, empty, validation, success, error, disabled,
 * speichert (P-08), conflict (P-05), unreachable (P-06), wird-beendet (P-07),
 * ausgang-unbekannt (P-08).
 */
export function SuppliersPage() {
  const query = useSuppliersQuery();
  const createMutation = useCreateSupplierMutation();
  const updateMutation = useUpdateSupplierMutation();
  const writesLocked = useWritesLocked();

  const items = query.data?.items ?? [];
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(undefined));
  const [nameError, setNameError] = useState<string | undefined>();
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // After "Neu laden" (P-05) the inputs stay until the reloaded data has arrived (T-1).
  const [takeReloaded, setTakeReloaded] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  const saving = createMutation.isPending || updateMutation.isPending;
  const selectedId = selection?.id ?? null;
  const selected = items.find((item) => item.id === selectedId);

  // The first supplier is open once the list has arrived.
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
    setDraft(draftOf(selected));
    setNameError(undefined);
  }, [takeReloaded, query.isFetching, selected]);

  function open(next: Selection | null, supplier?: Supplier) {
    blurCheck.cancel();
    setSelection(next);
    setDraft(draftOf(supplier));
    setNameError(undefined);
    if (notice?.kind !== 'success') setNotice(null);
  }

  /** "Abbrechen" (P-01): back to the stored values, or out of "Lieferant anlegen". */
  function cancel() {
    if (selectedId === null) open(firstItem ? { id: firstItem.id } : null, firstItem);
    else open(selection, selected);
  }

  function showFieldError(message: string) {
    setNameError(message);
    focusFirstError();
  }

  function onSaved(saved: Supplier) {
    setSelection({ id: saved.id });
    setDraft(draftOf(saved));
    setNameError(undefined);
    setNotice({ kind: 'success' });
  }

  function onFailed(error: ApiError) {
    const field =
      error.kind === 'validation'
        ? error.error?.fields.find((entry) => entry.path === 'name')
        : undefined;
    if (field) {
      showFieldError(field.message);
      return;
    }
    // `name_taken.supplier` "Name ist bereits vergeben" stands at the field.
    if (error.kind === 'rejected' && error.error?.code === 'name_taken') {
      showFieldError(error.error.message);
      return;
    }
    setNotice(noticeOf(error));
  }

  function save() {
    // The save checks the name itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    if (!changed(draft)) return;
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
  const unchanged = !changed(draft);
  const loadFailed = query.isError ? query.error : null;

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

      <MaintenanceTable
        title={TEXTS.title}
        items={items}
        getId={(item) => item.id}
        selectedId={selectedId}
        onSelect={(item) => open({ id: item.id }, item)}
        renderItem={(item) => (
          <span className="flex items-center justify-between gap-2">
            <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{item.name}</span>
            <Badge variant={item.active ? 'published' : 'draft'} className="shrink-0">
              {item.active ? TEXTS.active : TEXTS.inactive}
            </Badge>
          </span>
        )}
        createLabel={TEXTS.create}
        onCreate={() => open({ id: null })}
        disabled={saving || writesLocked}
        emptyText={query.isSuccess ? TEXTS.empty : undefined}
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
          aria-label={TEXTS.title}
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
          <div className="flex flex-wrap gap-2 full:ml-auto full:mt-6">
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
          </div>
        </form>
      </MaintenanceTable>
    </div>
  );
}
