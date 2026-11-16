import {
  type ModelTemplateCreateInput,
  modelTemplateCreateSchema,
} from '@resellr/domain/schemas/model-template.schema';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { ApiError } from '../../api/api-client.ts';
import { useCreateModelTemplateMutation } from '../../api/catalog.api.ts';
import { useDeviceTypesQuery, useManufacturersQuery } from '../../api/settings.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
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
import { Checkbox } from '../../components/ui/Checkbox.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';

// Texts of UI-007 `screen.md` and its mockup (UI/UX design v0.6.2, v0.6.3 for the empty MPN,
// v0.6.7 for the placeholder).
const TEXTS = {
  back: 'Zurück zur Modell-Bibliothek',
  title: 'Modellvorlage anlegen',
  loading: 'Lade Modellvorlage …',
  modelData: 'Modelldaten',
  choose: 'Bitte wählen',
  deviceType: 'Geräteart',
  manufacturer: 'Hersteller',
  modelName: 'Modellbezeichnung',
  typeDesignation: 'Typbezeichnung',
  mpn: 'Herstellernummer',
  mpnUnknown: 'unbekannt',
  originalEan: 'Original-EAN',
  cancel: 'Abbrechen',
  save: 'Modellvorlage speichern',
  saving: 'Speichern …',
  saved: 'Modellvorlage gespeichert',
  error: (referenceNumber: string | null) =>
    `Modellvorlage konnte nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** The calling page; UI-007 is opened from UI-006 (the call from UI-003 follows with S4). */
const CALLER_PATH = '/modelle';

/** State a calling page takes over after the save: the success banner of UI-007 (DER-50-02). */
export interface SavedNoticeState {
  savedNotice: string;
}

interface Draft {
  deviceTypeId: number | null;
  manufacturerId: number | null;
  modelName: string;
  typeDesignation: string;
  /** The input of the field; sent as `null` with "unbekannt" (2.4). */
  mpn: string;
  mpnUnknown: boolean;
  originalEan: string;
}

const FIELDS = [
  'deviceTypeId',
  'manufacturerId',
  'modelName',
  'typeDesignation',
  'mpn',
  'originalEan',
] as const;
type Field = (typeof FIELDS)[number];
type FieldErrors = Partial<Record<Field, string>>;

const isField = (path: string): path is Field => (FIELDS as readonly string[]).includes(path);

/** The choices whose entry the server can reject as deactivated (2.0.11). */
type ChoiceField = 'deviceTypeId' | 'manufacturerId';

/** Rejections of a deactivated choice and the field of their `details.path` (2.0.11). */
const DEACTIVATED_CODES: Readonly<Record<string, ChoiceField>> = {
  device_type_deactivated: 'deviceTypeId',
  manufacturer_deactivated: 'manufacturerId',
};

/** Request body of `POST /api/model-templates`: every field, "unbekannt" with `mpn: null`. */
const bodyOf = ({ mpn, mpnUnknown, ...draft }: Draft): ModelTemplateCreateInput => ({
  ...draft,
  mpn: mpnUnknown ? null : mpn,
  mpnUnknown,
});

/**
 * Field errors of the Zod check in the browser, the same schema as on the server (2.0.7): the
 * first message per field (2.0.5).
 */
function checkAll(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of modelTemplateCreateSchema.safeParse(bodyOf(draft)).error?.issues ?? []) {
    const path = issue.path.join('.');
    if (isField(path)) errors[path] ??= issue.message;
  }
  return errors;
}

const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

const optionValue = (id: number | null) => (id === null ? '' : String(id));
const idOf = (value: string) => (value === '' ? null : Number(value));

/**
 * Model template UI-007 for a new model template (CU-114, REQ-008; Technical Specification
 * 2.4): device type, manufacturer, model name, type designation, MPN or "unbekannt" and original
 * EAN, "Modellvorlage speichern" (also Ctrl+S) and "Abbrechen". Device type and manufacturer open
 * with the placeholder "Bitte wählen" (Design v0.6.7). States: default, loading,
 * validation (focus on the first error), speichert and ausgang-unbekannt (P-08), success (banner
 * on the calling page), error, unreachable (P-06) for the reads and wird-beendet (P-07) for the
 * save. The attribute fields (#178), the dialog UI-008 (#179), the duplicate hint (#184) and
 * changing (#181) follow.
 */
export function ModelTemplatePage() {
  const navigate = useNavigate();
  const deviceTypes = useDeviceTypesQuery();
  const manufacturers = useManufacturersQuery();
  const createMutation = useCreateModelTemplateMutation();
  const writesLocked = useWritesLocked();

  // A rejected entry whose list could not be read again counts as missing (2.4, Nachtrag
  // MAR-925): it is no longer offered.
  const [dropped, setDropped] = useState<Partial<Record<ChoiceField, number>>>({});
  const activeDeviceTypes = deviceTypes.data?.items.filter(
    ({ id, active }) => active && id !== dropped.deviceTypeId,
  );
  const activeManufacturers = manufacturers.data?.items.filter(
    ({ id, active }) => active && id !== dropped.manufacturerId,
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // Choices that show the text of a rejection; it stays until the next choice (Design v0.6.7).
  const [rejectionShown, setRejectionShown] = useState<Partial<Record<Field, boolean>>>({});
  const [reloading, setReloading] = useState(false);

  const formId = useId();
  const modelDataId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  // The form opens once the choices have arrived, with nothing chosen (Design v0.6.7).
  const choicesLoaded = activeDeviceTypes !== undefined && activeManufacturers !== undefined;
  useEffect(() => {
    if (draft !== null || !choicesLoaded) return;
    setDraft({
      deviceTypeId: null,
      manufacturerId: null,
      modelName: '',
      typeDesignation: '',
      mpn: '',
      mpnUnknown: false,
      originalEan: '',
    });
  }, [draft, choicesLoaded]);

  const saving = createMutation.isPending;
  // Until the choices are read again after a rejection, a save could send the rejected id.
  const canSave = draft !== null && !saving && !writesLocked && !reloading;

  function change(next: Partial<Draft>) {
    if (draft !== null) setDraft({ ...draft, ...next });
  }

  /** A choice from the list: any entry offered is valid, so the text of the field goes. */
  function choose(field: ChoiceField, value: string) {
    change({ [field]: idOf(value) });
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setRejectionShown((previous) => ({ ...previous, [field]: false }));
  }

  function checkOnBlur(field: Field) {
    if (draft === null) return;
    if (rejectionShown[field]) return;
    const current = draft;
    blurCheck.checkOnBlur(() =>
      setErrors((previous) => ({ ...previous, [field]: checkAll(current)[field] })),
    );
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    focusFirstError();
  }

  function onFailed(error: ApiError) {
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
    // A device type or manufacturer deactivated in another window: the text stands at the field
    // of `details.path`, and both choices are read again without it (2.4, 2.0.11).
    const field = DEACTIVATED_CODES[error.error?.code ?? ''];
    const { path, id } = error.error?.details ?? {};
    if (error.kind === 'rejected' && field !== undefined && path === field) {
      showFieldErrors({ [field]: error.error?.message });
      setRejectionShown({ [field]: true });
      if (typeof id === 'number') void reloadAfterRejection(field, id);
      return;
    }
    setNotice(noticeOf(error));
  }

  /**
   * Reads both choices again. If the rejected entry is missing then, or the read fails, the choice
   * is emptied, so the rejected id is never sent again (2.4 "Auswahl nach der Ablehnung",
   * Nachtrag MAR-925).
   */
  async function reloadAfterRejection(field: ChoiceField, id: number) {
    setReloading(true);
    const [types, makers] = await Promise.all([deviceTypes.refetch(), manufacturers.refetch()]);
    const result = field === 'deviceTypeId' ? types : makers;
    const activeAgain =
      !result.isError && result.data?.items.some((entry) => entry.id === id && entry.active);
    if (!activeAgain) {
      if (result.isError) setDropped((previous) => ({ ...previous, [field]: id }));
      setDraft((previous) =>
        previous?.[field] === id ? { ...previous, [field]: null } : previous,
      );
    }
    setReloading(false);
  }

  function save() {
    // The save checks the fields itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    if (draft === null || !canSave) return;
    const found = checkAll(draft);
    setRejectionShown({});
    if (hasErrors(found)) {
      showFieldErrors(found);
      return;
    }
    setErrors({});
    setNotice(null);
    createMutation.mutate(bodyOf(draft), {
      onSuccess: () => {
        const state: SavedNoticeState = { savedNotice: TEXTS.saved };
        void navigate(CALLER_PATH, { state });
      },
      onError: onFailed,
    });
  }

  // Ctrl+S saves like the primary button (UI-007 "Aktionen").
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      saveRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // A failed read shows P-06 or the error banner; the inputs stay (2.0.7).
  const loadFailed = deviceTypes.error ?? manufacturers.error;
  const loading = draft === null && loadFailed === null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <Link to={CALLER_PATH} className="self-start text-body text-primary no-underline">
          <span aria-hidden="true">← </span>
          {TEXTS.back}
        </Link>
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
          onReloaded={() => setNotice(null)}
          errorText={TEXTS.error}
        />

        {loading && (
          <p role="status" className="m-0 text-body text-text-secondary">
            {TEXTS.loading}
          </p>
        )}

        {draft !== null && (
          <form
            id={formId}
            ref={formRef}
            aria-label={TEXTS.title}
            noValidate
            className="grid grid-cols-1 gap-6 full:grid-cols-2"
            onPointerDown={blurCheck.pressPointer}
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <section
              aria-labelledby={modelDataId}
              className="flex min-w-0 flex-col gap-4 rounded-control border border-border bg-surface p-6"
            >
              <h2
                id={modelDataId}
                className="m-0 border-b border-border pb-4 text-section font-semibold"
              >
                {TEXTS.modelData}
              </h2>

              <FormField label={TEXTS.deviceType} required error={errors.deviceTypeId}>
                {(control) => (
                  <Select
                    {...control}
                    value={optionValue(draft.deviceTypeId)}
                    disabled={saving}
                    onChange={(event) => choose('deviceTypeId', event.target.value)}
                    onBlur={() => checkOnBlur('deviceTypeId')}
                  >
                    <option value="" disabled>
                      {TEXTS.choose}
                    </option>
                    {(activeDeviceTypes ?? []).map(({ id, name }) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              <FormField label={TEXTS.manufacturer} required error={errors.manufacturerId}>
                {(control) => (
                  <Select
                    {...control}
                    value={optionValue(draft.manufacturerId)}
                    disabled={saving}
                    onChange={(event) => choose('manufacturerId', event.target.value)}
                    onBlur={() => checkOnBlur('manufacturerId')}
                  >
                    <option value="" disabled>
                      {TEXTS.choose}
                    </option>
                    {(activeManufacturers ?? []).map(({ id, name }) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              <FormField label={TEXTS.modelName} required error={errors.modelName}>
                {(control) => (
                  <Input
                    {...control}
                    value={draft.modelName}
                    disabled={saving}
                    onChange={(event) => change({ modelName: event.target.value })}
                    onBlur={() => checkOnBlur('modelName')}
                  />
                )}
              </FormField>

              <FormField label={TEXTS.typeDesignation} error={errors.typeDesignation}>
                {(control) => (
                  <Input
                    {...control}
                    value={draft.typeDesignation}
                    disabled={saving}
                    onChange={(event) => change({ typeDesignation: event.target.value })}
                    onBlur={() => checkOnBlur('typeDesignation')}
                  />
                )}
              </FormField>

              <div className="flex flex-col gap-2">
                <FormField label={TEXTS.mpn} required error={errors.mpn}>
                  {(control) => (
                    <Input
                      {...control}
                      value={draft.mpnUnknown ? '' : draft.mpn}
                      // With "unbekannt" the field is emptied and locked (2.4).
                      disabled={saving || draft.mpnUnknown}
                      onChange={(event) => change({ mpn: event.target.value })}
                      onBlur={() => checkOnBlur('mpn')}
                    />
                  )}
                </FormField>
                <Checkbox
                  label={TEXTS.mpnUnknown}
                  checked={draft.mpnUnknown}
                  disabled={saving}
                  onChange={(mpnUnknown) => {
                    change({ mpnUnknown, ...(mpnUnknown && { mpn: '' }) });
                    setErrors((previous) => ({ ...previous, mpn: undefined }));
                  }}
                />
              </div>

              <FormField label={TEXTS.originalEan} error={errors.originalEan}>
                {(control) => (
                  <Input
                    {...control}
                    inputMode="numeric"
                    value={draft.originalEan}
                    disabled={saving}
                    onChange={(event) => change({ originalEan: event.target.value })}
                    onBlur={() => checkOnBlur('originalEan')}
                  />
                )}
              </FormField>
            </section>
          </form>
        )}
      </div>

      {/* The action bar stays visible below the scrolling form (DESIGN.md "Fenstergröße"). */}
      <div className="flex shrink-0 flex-wrap justify-end gap-4 border-t border-border bg-surface px-6 py-4">
        <Button disabled={saving || writesLocked} onClick={() => void navigate(CALLER_PATH)}>
          {TEXTS.cancel}
        </Button>
        <Button type="submit" form={formId} variant="primary" disabled={!canSave}>
          {saving ? TEXTS.saving : TEXTS.save}
        </Button>
      </div>
    </div>
  );
}
