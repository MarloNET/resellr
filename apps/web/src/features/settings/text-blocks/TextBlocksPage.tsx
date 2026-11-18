import { formatDate } from '@resellr/domain/format/format-value';
import { fixedPlaceholdersFor } from '@resellr/domain/placeholders/placeholder-catalog';
import {
  hasLegalStatus,
  legalCheckIssues,
  TEXT_BLOCK_BODY_MAX,
  TEXT_BLOCK_KIND_LABELS,
  TEXT_BLOCK_KINDS,
  TEXT_BLOCK_LEGAL_STATUS_LABELS,
  TEXT_BLOCK_LEGAL_STATUSES,
  textBlockBodySchema,
  textBlockLegalCheckedBySchema,
  textBlockNameSchema,
  type TextBlock,
  type TextBlockKind,
  type TextBlockLegalStatus,
  type TextBlockSaveResult,
  type TextBlockScope,
  type TextBlockUpdateResult,
} from '@resellr/domain/schemas/text-block.schema';
import { useEffect, useId, useRef, useState } from 'react';

import type { ApiError } from '../../../api/api-client.ts';
import { useChannelsQuery } from '../../../api/channels.api.ts';
import {
  useCreateTextBlockMutation,
  useDeviceTypesQuery,
  useTextBlocksQuery,
  useUpdateTextBlockMutation,
} from '../../../api/settings.api.ts';
import { useWritesLocked } from '../../../api/write-outcome-store.ts';
import {
  FormField,
  type FormFieldControlProps,
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
import { Checkbox } from '../../../components/ui/Checkbox.tsx';
import { cn } from '../../../components/ui/cn.ts';
import { Input } from '../../../components/ui/Input.tsx';
import { Select } from '../../../components/ui/Select.tsx';
import { ImpactDialog, type Impact } from '../ImpactDialog.tsx';

// Texts of UI-030 `screen.md` and of pattern P-01 (UI/UX design v0.6.2).
const TEXTS = {
  title: 'Textbausteine',
  loading: 'Lade Einstellungen …',
  empty: 'Noch keine Textbausteine',
  create: 'Textbaustein anlegen',
  deactivate: 'Deaktivieren',
  save: 'Speichern',
  saving: 'Speichern …',
  cancel: 'Abbrechen',
  saved: 'Gespeichert',
  name: 'Name',
  kind: 'Art',
  body: 'Text',
  placeholders: 'Platzhalter',
  scope: 'Geltungsbereich',
  deviceTypes: 'Gerätearten',
  channels: 'Kanäle',
  allDeviceTypes: 'alle Gerätearten',
  allChannels: 'alle Kanäle',
  active: 'aktiv',
  inactive: 'deaktiviert',
  legalStatus: 'Prüfstatus',
  legalCheckedOn: 'Prüfdatum',
  legalCheckedBy: 'Prüfende Stelle',
  legalStatusReset: 'Prüfstatus wurde auf ‚rechtlich ungeprüft‘ zurückgesetzt',
  /** Column "Prüfstatus" of the list (DER-40-04). */
  legalChip: ({ legalStatus, legalCheckedOn, legalCheckedBy }: TextBlock) =>
    legalStatus === 'checked' && legalCheckedOn !== null
      ? `${TEXT_BLOCK_LEGAL_STATUS_LABELS.checked} am ${formatDate(legalCheckedOn)} durch ${legalCheckedBy ?? ''}`
      : TEXT_BLOCK_LEGAL_STATUS_LABELS.unchecked,
  /** Counter below "Text" (mockup `default.png`). */
  bodyLength: (length: number) =>
    `${length.toLocaleString('de-DE')} / ${TEXT_BLOCK_BODY_MAX.toLocaleString('de-DE')} Zeichen`,
  error: (referenceNumber: string | null) =>
    `Einstellungen konnten nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Placeholders of the detail area: Requirements chapter 9.7 without `{Baustein:Name}`. */
const PLACEHOLDERS = fixedPlaceholdersFor('text_block');

/** Kind of a new text block until the user chooses another. */
const NEW_KIND: TextBlockKind = 'other';

type Field = 'name' | 'body' | 'legalCheckedBy';
/** The scope lists only carry the server's `scope_required` (2.2, addendum MAR-773). */
type ScopeField = 'deviceTypeIds' | 'channelIds';
/**
 * Errors of the form: `legalCheck` is M-24, shown once below "Prüfdatum" and "Prüfende Stelle"
 * and marking both (K-05, DER-40-01).
 */
type FieldErrors = Partial<Record<Field | ScopeField | 'legalCheckedOn' | 'legalCheck', string>>;

const FIELDS_OF_ANSWER: readonly (Field | ScopeField | 'legalCheckedOn')[] = [
  'name',
  'body',
  'legalCheckedOn',
  'legalCheckedBy',
  'deviceTypeIds',
  'channelIds',
];

interface Values extends TextBlockScope {
  name: string;
  kind: TextBlockKind;
  body: string;
  legalStatus: TextBlockLegalStatus;
  /** `YYYY-MM-DD` of the date input, `""` while empty. */
  legalCheckedOn: string;
  legalCheckedBy: string;
}

interface Draft extends Values {
  /** Values the form was opened with; without a change "Speichern" is disabled (DER-39-08). */
  base: Values;
  /**
   * Version of the state the form is based on, taken when it is opened (2.0.3). A background
   * refetch does not change it, so a change from another window leads to `409` and P-05.
   */
  version: number | null;
}

/** `null` while a new text block is entered. */
type Selection = { id: number | null };

function draftOf(textBlock: TextBlock | undefined): Draft {
  const base = {
    name: textBlock?.name ?? '',
    kind: textBlock?.kind ?? NEW_KIND,
    body: textBlock?.body ?? '',
    // A new text block applies to all device types and channels until the user chooses.
    allDeviceTypes: textBlock?.allDeviceTypes ?? true,
    deviceTypeIds: textBlock?.deviceTypeIds ?? [],
    allChannels: textBlock?.allChannels ?? true,
    channelIds: textBlock?.channelIds ?? [],
    // A text block that becomes "Rechtliches" or "Akku-Hinweis" is "rechtlich ungeprüft" (2.2).
    legalStatus: textBlock?.legalStatus ?? 'unchecked',
    legalCheckedOn: textBlock?.legalCheckedOn ?? '',
    legalCheckedBy: textBlock?.legalCheckedBy ?? '',
  };
  return { ...base, base, version: textBlock?.version ?? null };
}

/** Changed check fields; only the kinds "Rechtliches" and "Akku-Hinweis" have them (DER-40-05). */
const legalChanged = (draft: Draft) =>
  hasLegalStatus(draft.kind) &&
  (draft.legalStatus !== draft.base.legalStatus ||
    draft.legalCheckedOn !== draft.base.legalCheckedOn ||
    draft.legalCheckedBy !== draft.base.legalCheckedBy);

const sameIds = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

const deviceTypesChanged = (draft: Draft) =>
  draft.allDeviceTypes !== draft.base.allDeviceTypes ||
  (!draft.allDeviceTypes && !sameIds(draft.deviceTypeIds, draft.base.deviceTypeIds));

const channelsChanged = (draft: Draft) =>
  draft.allChannels !== draft.base.allChannels ||
  (!draft.allChannels && !sameIds(draft.channelIds, draft.base.channelIds));

const changed = (draft: Draft) =>
  draft.name !== draft.base.name ||
  draft.kind !== draft.base.kind ||
  draft.body !== draft.base.body ||
  deviceTypesChanged(draft) ||
  channelsChanged(draft) ||
  legalChanged(draft);

const FIELD_SCHEMAS = {
  name: textBlockNameSchema,
  body: textBlockBodySchema,
  legalCheckedBy: textBlockLegalCheckedBySchema,
};

/** A choice of device types or channels needs one entry; "Speichern" waits for it (UI-030). */
const scopeIncomplete = (draft: Draft) =>
  (!draft.allDeviceTypes && draft.deviceTypeIds.length === 0) ||
  (!draft.allChannels && draft.channelIds.length === 0);

type Named = { id: number; name: string };

/** One part of the scope in the list: "alle …" or the names in their order (mockup). */
function scopePart(all: boolean, allText: string, ids: number[], targets: Named[]) {
  if (all) return allText;
  return targets
    .filter(({ id }) => ids.includes(id))
    .map(({ name }) => name)
    .join(', ');
}

/**
 * Error line below a group of controls, as `FormField` shows it below one control: M-24 below
 * both check fields, and `scope_required` below a scope list. Only a server answer fills the
 * latter; in the browser the rule just disables "Speichern" (2.2).
 */
function GroupError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p className="m-0 flex items-start gap-1 text-label text-error">
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="mt-0.5 size-3 shrink-0"
        fill="currentColor"
      >
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v5h-1.5v-5Zm0 6.25h1.5v1.5h-1.5v-1.5Z" />
      </svg>
      <span id={id} className="min-w-0 [overflow-wrap:anywhere]">
        {error}
      </span>
    </p>
  );
}

/**
 * Entries a choice offers: the active ones and the chosen ones, also when deactivated since,
 * so a stored choice stays visible.
 */
const choosable = <T extends Named & { active: boolean }>(targets: T[], chosen: number[]) =>
  targets.filter(({ id, active }) => active || chosen.includes(id));

/** First message of the Zod check in the browser, the same schemas as on the server (2.0.7). */
function check(field: Field, value: string): string | undefined {
  const result = FIELD_SCHEMAS[field].safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

const berlinDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Check fields in the browser with the rules of the service (2.2): M-31 at "Prüfende Stelle",
 * a date in the future at "Prüfdatum", M-24 once for both. "Today" is the calendar day in
 * Europe/Berlin, as on the server (2.0.1). Only "rechtlich geprüft" has the two fields; for
 * "rechtlich ungeprüft" they are hidden and sent empty, so nothing is checked.
 */
function checkLegal(draft: Draft): FieldErrors {
  if (draft.legalStatus !== 'checked') return {};
  const errors: FieldErrors = { legalCheckedBy: check('legalCheckedBy', draft.legalCheckedBy) };
  const legalCheck = {
    legalStatus: draft.legalStatus,
    legalCheckedOn: draft.legalCheckedOn,
    legalCheckedBy: draft.legalCheckedBy.trim(),
  };
  for (const issue of legalCheckIssues(legalCheck, berlinDate.format(new Date()))) {
    if (issue.code === 'legal_check_required') errors.legalCheck = issue.message;
    else errors[issue.path] ??= issue.message;
  }
  return errors;
}

/** Field of a rejection: `fields[]` of `validation_failed` or a code with a field (2.0.6). */
function fieldErrorsOf(error: ApiError): FieldErrors | null {
  if (error.kind === 'validation') {
    const errors: FieldErrors = {};
    for (const entry of error.error?.fields ?? []) {
      if (entry.code === 'legal_check_required') errors.legalCheck = entry.message;
      else {
        const path = FIELDS_OF_ANSWER.find((field) => field === entry.path);
        if (path) errors[path] = entry.message;
      }
    }
    return Object.keys(errors).length > 0 ? errors : null;
  }
  if (error.kind === 'rejected') {
    switch (error.error?.code) {
      // `name_taken.text_block` "Name ist bereits vergeben" (DER-39-05).
      case 'name_taken':
        return { name: error.error.message };
      // "Unbekannter Platzhalter {…}" and "{Baustein:Name} ist im Textbaustein nicht zulässig"
      // stand at the text (AC-REQ-026-02, DER-39-05; sequence diagram F-08).
      case 'placeholder_not_allowed':
        return { body: error.error.message };
    }
  }
  return null;
}

/**
 * Text blocks of UI-030 (CU-101, REQ-026, REQ-054; Technical Specification 2.2): maintenance
 * list P-01 with name, kind, scope, status and the legal check status, the detail area with
 * name, kind, text, the list of placeholders, the scope ("alle" or a choice of device types and
 * channels, DER-39-09) and the check fields of the kinds "Rechtliches" and "Akku-Hinweis",
 * "Textbaustein anlegen" and the row action "Deaktivieren". There is no deletion (DER-39-13).
 * After "Speichern" dialog UI-043 shows `impact` of the answer (DER-39-10).
 * States after 2.0.7: loading, empty, validation, success, error, disabled, speichert (P-08),
 * conflict (P-05), unreachable (P-06), wird-beendet (P-07), ausgang-unbekannt (P-08).
 */
export function TextBlocksPage() {
  const query = useTextBlocksQuery();
  // Device types and channels name the scope in the list and offer its choice (UI-030).
  const deviceTypesQuery = useDeviceTypesQuery();
  const channelsQuery = useChannelsQuery();
  const deviceTypes = deviceTypesQuery.data?.items ?? [];
  const channels = channelsQuery.data?.items ?? [];
  const createMutation = useCreateTextBlockMutation();
  const updateMutation = useUpdateTextBlockMutation();
  const deactivateMutation = useUpdateTextBlockMutation();
  const writesLocked = useWritesLocked();

  const items = query.data?.items ?? [];
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf(undefined));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // Hint of UI-030 "Speichern" after a change of the text set the status back (DER-40-03).
  const [legalReset, setLegalReset] = useState(false);
  const [impact, setImpact] = useState<Impact | null>(null);
  // After "Neu laden" (P-05) the inputs stay until the reloaded data has arrived (T-1).
  const [takeReloaded, setTakeReloaded] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();
  const placeholdersId = useId();
  const legalCheckErrorId = useId();
  const scopeErrorId = useId();

  const saving = createMutation.isPending || updateMutation.isPending;
  const busy = saving || deactivateMutation.isPending;
  const selectedId = selection?.id ?? null;
  const selected = items.find((item) => item.id === selectedId);

  // The first text block is open once the list has arrived.
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
    setErrors({});
  }, [takeReloaded, query.isFetching, selected]);

  function open(next: Selection | null, textBlock?: TextBlock) {
    blurCheck.cancel();
    setSelection(next);
    setDraft(draftOf(textBlock));
    setErrors({});
    setLegalReset(false);
    if (notice?.kind !== 'success') setNotice(null);
  }

  /** "Abbrechen" (P-01): back to the stored values, or out of "Textbaustein anlegen". */
  function cancel() {
    if (selectedId === null) open(firstItem ? { id: firstItem.id } : null, firstItem);
    else open(selection, selected);
  }

  function showFieldErrors(fieldErrors: FieldErrors) {
    setErrors(fieldErrors);
    focusFirstError();
  }

  function onSaved({
    textBlock,
    impact: saved,
    legalStatusReset = false,
  }: TextBlockSaveResult & Partial<TextBlockUpdateResult>) {
    setSelection({ id: textBlock.id });
    setDraft(draftOf(textBlock));
    setErrors({});
    setLegalReset(legalStatusReset);
    setNotice({ kind: 'success' });
    setImpact(saved);
  }

  function onSaveFailed(error: ApiError) {
    const fieldErrors = fieldErrorsOf(error);
    if (fieldErrors) showFieldErrors(fieldErrors);
    else setNotice(noticeOf(error));
  }

  function checkOnBlur(field: Field) {
    const value = draft[field];
    blurCheck.checkOnBlur(() =>
      setErrors((current) => ({ ...current, [field]: check(field, value) })),
    );
  }

  function save() {
    // The save checks the fields itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    if (!changed(draft) || scopeIncomplete(draft)) return;
    const fieldErrors: FieldErrors = {
      name: check('name', draft.name),
      body: check('body', draft.body),
      ...(legalChanged(draft) && checkLegal(draft)),
    };
    if (Object.values(fieldErrors).some(Boolean)) {
      showFieldErrors(fieldErrors);
      return;
    }
    setErrors({});
    setNotice(null);
    setLegalReset(false);
    const callbacks = { onSuccess: onSaved, onError: onSaveFailed };
    const deviceTypeScope = {
      allDeviceTypes: draft.allDeviceTypes,
      deviceTypeIds: draft.allDeviceTypes ? [] : draft.deviceTypeIds,
    };
    const channelScope = {
      allChannels: draft.allChannels,
      channelIds: draft.allChannels ? [] : draft.channelIds,
    };
    if (selectedId === null) {
      createMutation.mutate(
        {
          name: draft.name,
          kind: draft.kind,
          body: draft.body,
          ...deviceTypeScope,
          ...channelScope,
        },
        callbacks,
      );
    } else if (draft.version !== null) {
      // Only the changed fields are sent; a text block saved unchanged keeps its version.
      updateMutation.mutate(
        {
          id: selectedId,
          version: draft.version,
          ...(draft.name !== draft.base.name && { name: draft.name }),
          ...(draft.kind !== draft.base.kind && { kind: draft.kind }),
          ...(draft.body !== draft.base.body && { body: draft.body }),
          ...(deviceTypesChanged(draft) && deviceTypeScope),
          ...(channelsChanged(draft) && channelScope),
          // The three check fields together; "rechtlich ungeprüft" stores neither date nor body.
          ...(legalChanged(draft) && {
            legalStatus: draft.legalStatus,
            legalCheckedOn: draft.legalStatus === 'checked' ? draft.legalCheckedOn : '',
            legalCheckedBy: draft.legalStatus === 'checked' ? draft.legalCheckedBy : '',
          }),
        },
        callbacks,
      );
    }
  }

  /** Row action "Deaktivieren" (P-01): not in new channel content any more (REQ-026). */
  function deactivate(textBlock: TextBlock) {
    setNotice(null);
    deactivateMutation.mutate(
      { id: textBlock.id, version: textBlock.version, active: false },
      {
        onSuccess: ({ textBlock: saved }) => {
          // An open change of this text block stays and is based on the new version.
          if (saved.id === selectedId) {
            setDraft((current) => ({ ...current, version: saved.version }));
          }
          setNotice({ kind: 'success' });
        },
        onError: (error) => setNotice(noticeOf(error)),
      },
    );
  }

  const formLocked = busy || selection === null;
  const showLegal = hasLegalStatus(draft.kind);
  const checked = showLegal && draft.legalStatus === 'checked';
  /** M-24 marks "Prüfdatum" and "Prüfende Stelle" and stands once below both (K-05). */
  const withLegalCheck = (control: FormFieldControlProps): FormFieldControlProps =>
    errors.legalCheck
      ? {
          ...control,
          'aria-invalid': true,
          'aria-describedby': [control['aria-describedby'], legalCheckErrorId]
            .filter(Boolean)
            .join(' '),
        }
      : control;
  const unchanged = !changed(draft);
  const toggle = (ids: number[], id: number, on: boolean) =>
    on ? [...ids, id] : ids.filter((other) => other !== id);
  const loadFailed =
    [query, deviceTypesQuery, channelsQuery].find((each) => each.isError)?.error ?? null;
  const loading = query.isPending || deviceTypesQuery.isPending || channelsQuery.isPending;

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
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold [overflow-wrap:anywhere]">{item.name}</span>
              <span className="text-label text-text-secondary">
                {TEXT_BLOCK_KIND_LABELS[item.kind]}
              </span>
              <span className="text-label text-text-secondary [overflow-wrap:anywhere]">
                {`${scopePart(item.allDeviceTypes, TEXTS.allDeviceTypes, item.deviceTypeIds, deviceTypes)}, ${scopePart(item.allChannels, TEXTS.allChannels, item.channelIds, channels)}`}
              </span>
              {item.legalStatus !== null && (
                <Badge
                  variant={item.legalStatus === 'checked' ? 'approved' : 'warn'}
                  className="mt-1 self-start [overflow-wrap:anywhere]"
                >
                  {TEXTS.legalChip(item)}
                </Badge>
              )}
            </span>
            <Badge variant={item.active ? 'published' : 'draft'} className="shrink-0">
              {item.active ? TEXTS.active : TEXTS.inactive}
            </Badge>
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
          <FormField label={TEXTS.name} required error={errors.name}>
            {(control) => (
              <Input
                {...control}
                value={draft.name}
                disabled={formLocked}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                onBlur={() => checkOnBlur('name')}
              />
            )}
          </FormField>

          <FormField label={TEXTS.kind} required>
            {(control) => (
              <Select
                {...control}
                value={draft.kind}
                disabled={formLocked}
                onChange={(event) =>
                  setDraft({ ...draft, kind: event.target.value as TextBlockKind })
                }
              >
                {TEXT_BLOCK_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {TEXT_BLOCK_KIND_LABELS[kind]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <div className="flex flex-col gap-1">
            <FormField label={TEXTS.body} required error={errors.body}>
              {(control) => (
                <textarea
                  {...control}
                  rows={6}
                  value={draft.body}
                  disabled={formLocked}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                  onBlur={() => checkOnBlur('body')}
                  // The 1 px input border as an inset ring, as in UI-026: Playwright scrolls a
                  // text area into view without its CSS border.
                  className={cn(
                    'w-full min-w-0 rounded-control bg-surface px-2 py-1 ring-1 ring-border-input ring-inset',
                    'text-body text-text aria-invalid:ring-error disabled:bg-bg',
                  )}
                />
              )}
            </FormField>
            <p className="m-0 self-end text-label text-text-secondary">
              {TEXTS.bodyLength(draft.body.length)}
            </p>
          </div>

          <section aria-labelledby={placeholdersId} className="flex flex-col gap-1">
            <h2 id={placeholdersId} className="m-0 text-label font-semibold text-text">
              {TEXTS.placeholders}
            </h2>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {PLACEHOLDERS.map((placeholder) => (
                <li
                  key={placeholder}
                  className="rounded-chip border border-border bg-bg px-2 font-mono text-label"
                >
                  {placeholder}
                </li>
              ))}
            </ul>
          </section>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1 p-0 text-label font-semibold text-text">
              {TEXTS.scope}
              <span aria-hidden="true"> *</span>
            </legend>
            <div
              role="group"
              aria-label={TEXTS.deviceTypes}
              aria-describedby={errors.deviceTypeIds ? `${scopeErrorId}-device-types` : undefined}
              className="flex flex-col gap-1"
            >
              <Checkbox
                label={TEXTS.allDeviceTypes}
                checked={draft.allDeviceTypes}
                disabled={formLocked}
                onChange={(all) => setDraft({ ...draft, allDeviceTypes: all })}
              />
              {!draft.allDeviceTypes && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 pl-6">
                  {choosable(deviceTypes, draft.deviceTypeIds).map(({ id, name }) => (
                    <Checkbox
                      key={id}
                      label={name}
                      checked={draft.deviceTypeIds.includes(id)}
                      disabled={formLocked}
                      onChange={(on) =>
                        setDraft({ ...draft, deviceTypeIds: toggle(draft.deviceTypeIds, id, on) })
                      }
                    />
                  ))}
                </div>
              )}
              <GroupError id={`${scopeErrorId}-device-types`} error={errors.deviceTypeIds} />
            </div>
            <div
              role="group"
              aria-label={TEXTS.channels}
              aria-describedby={errors.channelIds ? `${scopeErrorId}-channels` : undefined}
              className="flex flex-col gap-1"
            >
              <Checkbox
                label={TEXTS.allChannels}
                checked={draft.allChannels}
                disabled={formLocked}
                onChange={(all) => setDraft({ ...draft, allChannels: all })}
              />
              {!draft.allChannels && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 pl-6">
                  {choosable(channels, draft.channelIds).map(({ id, name }) => (
                    <Checkbox
                      key={id}
                      label={name}
                      checked={draft.channelIds.includes(id)}
                      disabled={formLocked}
                      onChange={(on) =>
                        setDraft({ ...draft, channelIds: toggle(draft.channelIds, id, on) })
                      }
                    />
                  ))}
                </div>
              )}
              <GroupError id={`${scopeErrorId}-channels`} error={errors.channelIds} />
            </div>
          </fieldset>

          {showLegal && (
            <div className="flex flex-col gap-1">
              <FormField label={TEXTS.legalStatus} required>
                {(control) => (
                  <Select
                    {...control}
                    value={draft.legalStatus}
                    // A new text block is "rechtlich ungeprüft" (AC-REQ-054-04).
                    disabled={formLocked || selectedId === null}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        legalStatus: event.target.value as TextBlockLegalStatus,
                      })
                    }
                  >
                    {TEXT_BLOCK_LEGAL_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {TEXT_BLOCK_LEGAL_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              {legalReset && (
                <p role="status" className="m-0 text-label text-text-secondary">
                  {TEXTS.legalStatusReset}
                </p>
              )}
            </div>
          )}

          {checked && (
            <div className="flex flex-col gap-1">
              <FormField label={TEXTS.legalCheckedOn} required error={errors.legalCheckedOn}>
                {(control) => (
                  <Input
                    {...withLegalCheck(control)}
                    type="date"
                    value={draft.legalCheckedOn}
                    disabled={formLocked}
                    onChange={(event) => setDraft({ ...draft, legalCheckedOn: event.target.value })}
                  />
                )}
              </FormField>
              <FormField label={TEXTS.legalCheckedBy} required error={errors.legalCheckedBy}>
                {(control) => (
                  <Input
                    {...withLegalCheck(control)}
                    value={draft.legalCheckedBy}
                    disabled={formLocked}
                    onChange={(event) => setDraft({ ...draft, legalCheckedBy: event.target.value })}
                    onBlur={() => checkOnBlur('legalCheckedBy')}
                  />
                )}
              </FormField>
              <GroupError id={legalCheckErrorId} error={errors.legalCheck} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={formLocked || writesLocked || unchanged || scopeIncomplete(draft)}
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

      <ImpactDialog impact={impact} onClose={() => setImpact(null)} />
    </div>
  );
}
