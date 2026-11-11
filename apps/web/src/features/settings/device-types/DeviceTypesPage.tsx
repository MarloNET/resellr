import { deviceTypeNameSchema, type DeviceType } from '@resellr/domain/schemas/device-type.schema';
import { useEffect, useId, useRef, useState } from 'react';

import type { ApiError } from '../../../api/api-client.ts';
import {
  useCreateDeviceTypeMutation,
  useDeviceTypesQuery,
  useUpdateDeviceTypeMutation,
} from '../../../api/settings.api.ts';
import { useWritesLocked } from '../../../api/write-outcome-store.ts';
import { FormField, useFocusFirstError } from '../../../components/forms/FormField.tsx';
import { ConflictBanner } from '../../../components/patterns/ConflictBanner.tsx';
import { MaintenanceTable } from '../../../components/patterns/MaintenanceTable.tsx';
import { OutcomeUnknownBanner } from '../../../components/patterns/OutcomeUnknownBanner.tsx';
import { bannerClassName, PageBanner } from '../../../components/patterns/PageBanner.tsx';
import { ShuttingDownBanner } from '../../../components/patterns/ShuttingDownBanner.tsx';
import { UnreachableBanner } from '../../../components/patterns/UnreachableBanner.tsx';
import { Badge } from '../../../components/ui/Badge.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { cn } from '../../../components/ui/cn.ts';
import { Input } from '../../../components/ui/Input.tsx';

// Texts of UI-027 `screen.md` (UI/UX design v0.6.1).
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
  error: (referenceNumber: string | null) =>
    `Einstellungen konnten nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Banner at the top of the page after a save or a failed load (2.0.7). */
type Notice =
  | { kind: 'success' }
  | { kind: 'error'; error: ApiError }
  | { kind: 'conflict' }
  | { kind: 'shutting-down' }
  | { kind: 'not-found'; message: string };

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
 * unreachable (P-06), wird-beendet (P-07), ausgang-unbekannt (P-08). Renaming opens no impact
 * dialog UI-043 (DER-33-12). The attributes follow with #151.
 */
export function DeviceTypesPage() {
  const query = useDeviceTypesQuery();
  const createMutation = useCreateDeviceTypeMutation();
  const updateMutation = useUpdateDeviceTypeMutation();
  const writesLocked = useWritesLocked();

  const items = query.data?.items ?? [];
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(undefined));
  const [nameError, setNameError] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | null>(null);
  // After "Neu laden" (P-05) the inputs stay until the reloaded data has arrived (T-1).
  const [takeReloaded, setTakeReloaded] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  // A pointer is pressed in the form: the focus leaves "Name" in the middle of a click there.
  const pointerPressed = useRef(false);
  const cancelDeferredCheck = useRef(() => {});

  const saving = createMutation.isPending || updateMutation.isPending;
  const selectedId = selection?.id ?? null;
  const selected = items.find((item) => item.id === selectedId);

  // The first device type is open once the list has arrived.
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

  function open(next: Selection, deviceType?: DeviceType) {
    setSelection(next);
    setDraft(draftOf(deviceType));
    setNameError(undefined);
    if (notice?.kind !== 'success') setNotice(null);
  }

  function showFieldError(message: string) {
    setNameError(message);
    focusFirstError();
  }

  function onSaved(saved: DeviceType) {
    setSelection({ id: saved.id });
    setDraft(draftOf(saved));
    setNameError(undefined);
    setNotice({ kind: 'success' });
  }

  function onFailed(error: ApiError) {
    switch (error.kind) {
      case 'validation': {
        const field = error.error?.fields.find((entry) => entry.path === 'name');
        if (field) showFieldError(field.message);
        return;
      }
      case 'rejected':
        // `name_taken.device_type` "Name ist bereits vergeben" stands at the field.
        if (error.error?.code === 'name_taken') showFieldError(error.error.message);
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

  function pressPointer() {
    pointerPressed.current = true;
    const release = () => {
      pointerPressed.current = false;
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  }

  /**
   * Check on leaving "Name" (2.0.7). During a click in the form the check waits until after the
   * click: a new or vanished error line would move the button or the switch between `mousedown`
   * and `mouseup`, and the browser would drop the click (QA-D1).
   */
  function checkNameOnBlur() {
    const name = draft.name;
    if (!pointerPressed.current) {
      setNameError(checkName(name));
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      cancelDeferredCheck.current();
      // `click` follows `pointerup` in the same task, so the timeout runs after it.
      timer = setTimeout(() => setNameError(checkName(name)));
    };
    window.addEventListener('pointerup', run);
    window.addEventListener('pointercancel', run);
    cancelDeferredCheck.current = () => {
      window.removeEventListener('pointerup', run);
      window.removeEventListener('pointercancel', run);
      clearTimeout(timer);
    };
  }

  function save() {
    // The save checks the name itself; a later check on leaving must not hide its result.
    cancelDeferredCheck.current();
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
          onPointerDown={pressPointer}
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
                  onBlur={checkNameOnBlur}
                />
              )}
            </FormField>
          </div>
          <StatusSwitch
            checked={draft.active}
            disabled={formLocked}
            onChange={(active) => setDraft({ ...draft, active })}
          />
          <Button
            type="submit"
            variant="primary"
            className="full:ml-auto full:mt-6"
            disabled={formLocked || writesLocked}
          >
            {saving ? TEXTS.saving : TEXTS.save}
          </Button>
        </form>
      </MaintenanceTable>
    </div>
  );
}

/** Switch "Status" aktiv/deaktiviert of UI-027. */
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
