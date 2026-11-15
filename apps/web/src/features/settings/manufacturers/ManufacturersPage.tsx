import { FIELD_MESSAGES } from '@resellr/domain/messages/messages.de';
import {
  EMPTY_GPSR,
  GPSR_FIELDS,
  GPSR_LABELS,
  gpsrSchema,
  manufacturerNameSchema,
  type Gpsr,
  type GpsrField,
  type Manufacturer,
  type ManufacturerCreateResult,
  type ManufacturerUpdateResult,
} from '@resellr/domain/schemas/manufacturer.schema';
import { useEffect, useRef, useState } from 'react';

import type { ApiError } from '../../../api/api-client.ts';
import { useManufacturersQuery, useUpdateManufacturerMutation } from '../../../api/settings.api.ts';
import { useWritesLocked } from '../../../api/write-outcome-store.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../../components/forms/FormField.tsx';
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
import { cn } from '../../../components/ui/cn.ts';
import { ManufacturerCreateDialog } from '../../models/ManufacturerCreateDialog.tsx';
import { ImpactDialog, type Impact } from '../ImpactDialog.tsx';

// Texts of UI-031 and UI-008 `screen.md` and of pattern P-01 (UI/UX design v0.6.1).
const TEXTS = {
  title: 'Hersteller und GPSR',
  list: 'Hersteller',
  loading: 'Lade Einstellungen …',
  empty: 'Noch keine Hersteller',
  create: 'Hersteller anlegen',
  deactivate: 'Deaktivieren',
  save: 'Speichern',
  saving: 'Speichern …',
  cancel: 'Abbrechen',
  saved: 'Gespeichert',
  name: 'Name',
  /** "Herstellername (rechtlich)"; its texts use "Herstellername" (M-05). */
  legalName: 'Herstellername (rechtlich)',
  postalAddress: 'Postanschrift',
  euRp: 'Verantwortliche Person in der EU',
  active: 'aktiv',
  inactive: 'deaktiviert',
  gpsrComplete: 'GPSR vollständig',
  gpsrIncomplete: 'GPSR unvollständig',
  /** "Umbenennung wirkt auf alle Modellvorlagen des Herstellers (Hinweis vor Speichern)". */
  renameHint: 'Umbenennung wirkt auf alle Modellvorlagen des Herstellers',
  /** UI-008 after creating, from UI-031 without the link to UI-031 (DER-37-12, Q-7). */
  createdHint:
    'Hersteller angelegt. GPSR-Herstellerangaben fehlen noch; ohne sie ist keine Freigabe möglich.',
  error: (referenceNumber: string | null) =>
    `Einstellungen konnten nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

interface Draft {
  name: string;
  /** Stored name; without a change "Speichern" is disabled (DER-37-07). */
  base: string;
  gpsr: Gpsr;
  /** Stored GPSR details, the base of the change like `base`. */
  baseGpsr: Gpsr;
  /**
   * Version of the state the form is based on, taken when it is opened (2.0.3). A background
   * refetch does not change it, so a change from another window leads to `409` and P-05.
   */
  version: number | null;
}

function draftOf(manufacturer: Manufacturer | undefined): Draft {
  const name = manufacturer?.name ?? '';
  const gpsr = manufacturer?.gpsr ?? EMPTY_GPSR;
  return { name, base: name, gpsr, baseGpsr: gpsr, version: manufacturer?.version ?? null };
}

/** Field of the form, the path of `fields[]` in a `validation_failed` (2.0.5). */
type Field = 'name' | `gpsr.${GpsrField}`;
type FieldErrors = Partial<Record<Field, string>>;

const gpsrPath = (field: GpsrField): Field => `gpsr.${field}`;

const isField = (path: string): path is Field =>
  path === 'name' || GPSR_FIELDS.some((field) => gpsrPath(field) === path);

/** First message of the Zod check in the browser, the same schema as on the server (2.0.7). */
function checkName(name: string): string | undefined {
  const result = manufacturerNameSchema.safeParse(name);
  return result.success ? undefined : result.error.issues[0]?.message;
}

const checkGpsrField = (field: GpsrField, value: string) =>
  gpsrSchema.shape[field].safeParse(value).error?.issues[0]?.message;

/** Field errors of the name and of every GPSR field, in the order of the form. */
function checkAll(draft: Draft): FieldErrors {
  const errors: FieldErrors = { name: checkName(draft.name) };
  for (const field of GPSR_FIELDS)
    errors[gpsrPath(field)] = checkGpsrField(field, draft.gpsr[field]);
  return errors;
}

const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

const gpsrChanged = (draft: Draft) =>
  GPSR_FIELDS.some((field) => draft.gpsr[field] !== draft.baseGpsr[field]);

/** Text area for the multi-line address of the responsible person (3.1 "mehrzeilig"). */
const TEXT_AREA_CLASS = cn(
  'w-full min-w-0 rounded-control bg-surface px-2 py-1 ring-1 ring-border-input ring-inset',
  'text-body text-text aria-invalid:ring-error disabled:bg-bg',
);

/**
 * Manufacturers of UI-031 (CU-098, REQ-100, REQ-101; Technical Specification 2.2): maintenance
 * list P-01 with name, status and GPSR chip, "Hersteller anlegen" through dialog UI-008
 * (CU-115), rename with the hint before saving and the row action "Deaktivieren". There is no
 * deletion. The detail area keeps the GPSR details with the responsible person in the EU
 * (REQ-027); saving is allowed while incomplete, each missing part shows "<Teil> fehlt" at its
 * field (DER-41-03). After "Speichern" dialog UI-043 shows `impact` of the answer (DER-41-04).
 * States after 2.0.7: loading, empty, validation, success, error, disabled, speichert (P-08),
 * conflict (P-05), unreachable (P-06), wird-beendet (P-07), ausgang-unbekannt (P-08).
 */
export function ManufacturersPage() {
  const query = useManufacturersQuery();
  const saveMutation = useUpdateManufacturerMutation();
  const deactivateMutation = useUpdateManufacturerMutation();
  const writesLocked = useWritesLocked();

  const items = query.data?.items ?? [];
  // `null` until the list has arrived and the first manufacturer is open.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(undefined));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // The manufacturer just created through UI-008, with its hint until another is chosen.
  const [createdId, setCreatedId] = useState<number | null>(null);
  // After "Neu laden" (P-05) the inputs stay until the reloaded data has arrived (T-1).
  const [takeReloaded, setTakeReloaded] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  const saving = saveMutation.isPending;
  const busy = saving || deactivateMutation.isPending;
  const selected = items.find((item) => item.id === selectedId);

  // The first manufacturer is open once the list has arrived.
  const firstItem = items[0];
  useEffect(() => {
    if (selectedId === null && firstItem !== undefined) {
      setSelectedId(firstItem.id);
      setDraft(draftOf(firstItem));
    }
  }, [selectedId, firstItem]);

  useEffect(() => {
    if (!takeReloaded || query.isFetching) return;
    setTakeReloaded(false);
    setDraft(draftOf(selected));
    setErrors({});
  }, [takeReloaded, query.isFetching, selected]);

  function open(manufacturer: Manufacturer) {
    blurCheck.cancel();
    setSelectedId(manufacturer.id);
    setDraft(draftOf(manufacturer));
    setErrors({});
    if (manufacturer.id !== createdId) setCreatedId(null);
    if (notice?.kind !== 'success') setNotice(null);
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    focusFirstError();
  }

  function checkOnBlur(field: Field, check: () => string | undefined) {
    blurCheck.checkOnBlur(() => setErrors((current) => ({ ...current, [field]: check() })));
  }

  /** Answer of UI-008: the new or the existing manufacturer is chosen (DER-37-12, Q-7). */
  function onCreated({ existing, ...manufacturer }: ManufacturerCreateResult) {
    open(manufacturer);
    if (existing) return;
    setDialogOpen(false);
    setCreatedId(manufacturer.id);
    setNotice({ kind: 'success' });
  }

  function onSaveFailed(error: ApiError) {
    if (error.kind === 'validation') {
      const next: FieldErrors = {};
      for (const { path, message } of error.error?.fields ?? []) {
        if (isField(path)) next[path] ??= message;
      }
      if (hasErrors(next)) {
        showFieldErrors(next);
        return;
      }
    }
    // `name_taken.manufacturer` "Name ist bereits vergeben" stands at the field (DER-37-04).
    if (error.kind === 'rejected' && error.error?.code === 'name_taken') {
      showFieldErrors({ name: error.error.message });
      return;
    }
    setNotice(noticeOf(error));
  }

  /** "Gespeichert", then UI-043 with `impact` of the answer (DER-41-04, DER-41-05). */
  function onSaved({ manufacturer, impact: saved }: ManufacturerUpdateResult) {
    setDraft(draftOf(manufacturer));
    setNotice({ kind: 'success' });
    setImpact(saved);
  }

  function save() {
    // The save checks the fields itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    const renamed = draft.name !== draft.base;
    const gpsrSent = gpsrChanged(draft);
    if ((!renamed && !gpsrSent) || selectedId === null || draft.version === null) return;
    const next = checkAll(draft);
    if (hasErrors(next)) {
      showFieldErrors(next);
      return;
    }
    setErrors({});
    setNotice(null);
    saveMutation.mutate(
      {
        id: selectedId,
        version: draft.version,
        ...(renamed && { name: draft.name }),
        ...(gpsrSent && { gpsr: draft.gpsr }),
      },
      { onSuccess: onSaved, onError: onSaveFailed },
    );
  }

  /** Row action "Deaktivieren" (P-01): not for new model templates any more (AC-REQ-101-02). */
  function deactivate(manufacturer: Manufacturer) {
    setNotice(null);
    deactivateMutation.mutate(
      { id: manufacturer.id, version: manufacturer.version, active: false },
      {
        onSuccess: ({ manufacturer: saved }) => {
          // An open rename of this manufacturer stays and is based on the new version.
          if (saved.id === selectedId) {
            setDraft((current) => ({ ...current, base: saved.name, version: saved.version }));
          }
          setNotice({ kind: 'success' });
        },
        onError: (error) => setNotice(noticeOf(error)),
      },
    );
  }

  const formLocked = busy || selectedId === null;
  const renamed = selectedId !== null && draft.name.trim() !== draft.base;
  const unchanged = draft.name === draft.base && !gpsrChanged(draft);
  const loadFailed = query.isError ? query.error : null;

  // While an input is faulty only its errors show, so the focus and the reading go to them.
  const inputFaulty = hasErrors(errors);

  /**
   * Error of a GPSR field: the check of the input, else "<Teil> fehlt" for a part the stored
   * details miss while the field is still empty (DER-41-03).
   */
  const gpsrError = (field: GpsrField) =>
    errors[gpsrPath(field)] ??
    (!inputFaulty &&
    selected?.gpsrMissing.some((part) => part === field) &&
    draft.gpsr[field].trim() === ''
      ? FIELD_MESSAGES.gpsrMissing(GPSR_LABELS[field])
      : undefined);

  function gpsrField(field: GpsrField, label: string, required: boolean) {
    const multiLine = field === 'euRpAddress';
    return (
      <FormField key={field} label={label} required={required} error={gpsrError(field)}>
        {(control) => {
          const props = {
            ...control,
            value: draft.gpsr[field],
            disabled: formLocked,
            onChange: (event: { target: { value: string } }) =>
              setDraft({ ...draft, gpsr: { ...draft.gpsr, [field]: event.target.value } }),
            onBlur: () => {
              const value = draft.gpsr[field];
              checkOnBlur(gpsrPath(field), () => checkGpsrField(field, value));
            },
          };
          return multiLine ? (
            <textarea {...props} rows={3} className={TEXT_AREA_CLASS} />
          ) : (
            <Input {...props} />
          );
        }}
      </FormField>
    );
  }

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
        title={TEXTS.list}
        items={items}
        getId={(item) => item.id}
        selectedId={selectedId}
        onSelect={open}
        renderItem={(item) => (
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{item.name}</span>
            <span className="flex min-w-0 flex-wrap gap-1">
              <Badge variant={item.active ? 'published' : 'draft'}>
                {item.active ? TEXTS.active : TEXTS.inactive}
              </Badge>
              <Badge variant={item.gpsrComplete ? 'published' : 'warn'}>
                {item.gpsrComplete ? TEXTS.gpsrComplete : TEXTS.gpsrIncomplete}
              </Badge>
            </span>
          </span>
        )}
        renderActions={(item) =>
          item.active && (
            <Button
              aria-label={`${TEXTS.deactivate}: ${item.name}`}
              className="shrink-0"
              disabled={busy || writesLocked}
              onClick={() => deactivate(item)}
            >
              {TEXTS.deactivate}
            </Button>
          )
        }
        createLabel={TEXTS.create}
        onCreate={() => setDialogOpen(true)}
        disabled={busy || writesLocked}
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
          aria-label={TEXTS.list}
          noValidate
          className="flex flex-col gap-4 rounded-control border border-border bg-surface p-4 full:flex-row full:flex-wrap full:items-start"
          onPointerDown={blurCheck.pressPointer}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="flex flex-col gap-1 full:w-80">
            <FormField label={TEXTS.name} required error={errors.name}>
              {(control) => (
                <Input
                  {...control}
                  value={draft.name}
                  disabled={formLocked}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  onBlur={() => {
                    const name = draft.name;
                    checkOnBlur('name', () => checkName(name));
                  }}
                />
              )}
            </FormField>
            {renamed && <p className="m-0 text-label text-text-secondary">{TEXTS.renameHint}</p>}
          </div>
          <div className="flex w-full flex-col gap-4">
            <div className="full:w-80">{gpsrField('legalName', TEXTS.legalName, true)}</div>
            <fieldset className="m-0 grid gap-3 border-0 p-0 full:grid-cols-2">
              <legend className="mb-1 p-0 text-label font-semibold text-text">
                {TEXTS.postalAddress}
              </legend>
              {(['street', 'postalCode', 'city', 'country'] as const).map((field) =>
                gpsrField(field, GPSR_LABELS[field], true),
              )}
            </fieldset>
            <div className="full:w-80">{gpsrField('contact', GPSR_LABELS.contact, true)}</div>
            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
              <legend className="mb-1 p-0 text-label font-semibold text-text">{TEXTS.euRp}</legend>
              {(['euRpName', 'euRpAddress', 'euRpContact'] as const).map((field) =>
                gpsrField(field, GPSR_LABELS[field], false),
              )}
            </fieldset>
          </div>
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
              disabled={formLocked || writesLocked || unchanged}
              onClick={() => selected && open(selected)}
            >
              {TEXTS.cancel}
            </Button>
          </div>
          {createdId !== null && createdId === selectedId && (
            <p role="note" className="m-0 w-full text-body text-text-secondary">
              {TEXTS.createdHint}
            </p>
          )}
        </form>
      </MaintenanceTable>

      <ManufacturerCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={onCreated}
      />
      <ImpactDialog impact={impact} onClose={() => setImpact(null)} />
    </div>
  );
}
