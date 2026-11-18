import {
  brandNameSchema,
  contactTextSchema,
  type MerchantProfile,
} from '@resellr/domain/schemas/merchant-profile.schema';
import { useEffect, useId, useRef, useState } from 'react';

import type { ApiError } from '../../../api/api-client.ts';
import {
  useMerchantProfileQuery,
  useRemoveLogoMutation,
  useReplaceLogoMutation,
  useSaveMerchantProfileMutation,
} from '../../../api/settings.api.ts';
import { useWritesLocked } from '../../../api/write-outcome-store.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../../components/forms/FormField.tsx';
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

// Texts of UI-026 `screen.md` (UI/UX design v0.6.1); the loading text of the settings screens.
const TEXTS = {
  title: 'Händlermarke',
  loading: 'Lade Einstellungen …',
  brandName: 'Name der Händlermarke',
  logo: 'Logo',
  logoNotice: 'Das Logo erscheint auf dem Datenblatt. Die Druckqualität stellt der Händler sicher.',
  noLogo: 'Kein Logo. Ohne Logo kann kein Datenblatt erzeugt werden.',
  replaceLogo: 'Logo ersetzen',
  removeLogo: 'Logo entfernen',
  contactText: 'Kontaktangaben',
  save: 'Speichern',
  saving: 'Speichern …',
  saved: 'Händlermarke gespeichert',
  error: (referenceNumber: string | null) =>
    `Händlermarke konnte nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

interface Draft {
  brandName: string;
  contactText: string;
  /**
   * Version of the state the form is based on (2.0.3). A background refetch does not change
   * it, so a change from another window leads to `409` and P-05.
   */
  version: number;
}

type Field = 'brandName' | 'contactText';
type FieldErrors = Partial<Record<Field, string>>;

const draftOf = ({ brandName, contactText, version }: MerchantProfile): Draft => ({
  brandName,
  contactText,
  version,
});

/** First message of the Zod check in the browser, the same schemas as on the server (2.0.7). */
const CHECKS: Record<Field, (value: string) => string | undefined> = {
  brandName: (value) => brandNameSchema.safeParse(value).error?.issues[0]?.message,
  contactText: (value) => contactTextSchema.safeParse(value).error?.issues[0]?.message,
};

const checkAll = (draft: Draft): FieldErrors => ({
  brandName: CHECKS.brandName(draft.brandName),
  contactText: CHECKS.contactText(draft.contactText),
});

const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

/** Types the file dialog offers; the server checks the content (2.11). */
const LOGO_TYPES = 'image/png,image/jpeg';

/**
 * Merchant profile of UI-026 (CU-097, REQ-028; Technical Specification 2.2): name of the brand
 * and contact details, the logo with preview, "Logo ersetzen" and "Logo entfernen" and the
 * notice on the datasheet. States after 2.0.7: default, empty (no logo), loading, validation,
 * success, error, speichert (P-08), conflict (P-05), unreachable (P-06), wird-beendet (P-07),
 * ausgang-unbekannt (P-08). The save reports `SettingsChanged`, but UI-026 shows no counts and
 * no dialog UI-043 (2.2). A logo change is saved at once and keeps unsaved name and contact
 * details; only the version of the form follows it.
 */
export function MerchantProfilePage() {
  const query = useMerchantProfileQuery();
  const saveMutation = useSaveMerchantProfileMutation();
  const replaceLogoMutation = useReplaceLogoMutation();
  const removeLogoMutation = useRemoveLogoMutation();
  const writesLocked = useWritesLocked();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [logoError, setLogoError] = useState<string | null>(null);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // After "Neu laden" (P-05) the inputs stay until the reloaded data has arrived (T-1).
  const [takeReloaded, setTakeReloaded] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();
  const logoHeadingId = useId();
  const logoErrorId = useId();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const replaceLogoId = useId();

  const profile = query.data;
  const saving =
    saveMutation.isPending || replaceLogoMutation.isPending || removeLogoMutation.isPending;

  // The form opens with the loaded profile.
  useEffect(() => {
    if (draft === null && profile !== undefined) setDraft(draftOf(profile));
  }, [draft, profile]);

  useEffect(() => {
    if (!takeReloaded || query.isFetching || profile === undefined) return;
    setTakeReloaded(false);
    setDraft(draftOf(profile));
    setErrors({});
    setLogoError(null);
  }, [takeReloaded, query.isFetching, profile]);

  // The focus goes to "Logo ersetzen", which the error text describes (2.0.7 `.validation`).
  useEffect(() => {
    if (logoError !== null) document.getElementById(replaceLogoId)?.focus();
  }, [logoError, replaceLogoId]);

  function change(field: Field, value: string) {
    if (draft !== null) setDraft({ ...draft, [field]: value });
  }

  function checkOnBlur(field: Field) {
    if (draft === null) return;
    const value = draft[field];
    blurCheck.checkOnBlur(() =>
      setErrors((current) => ({ ...current, [field]: CHECKS[field](value) })),
    );
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    focusFirstError();
  }

  function onSaved(saved: MerchantProfile) {
    setDraft(draftOf(saved));
    setErrors({});
    setNotice({ kind: 'success' });
  }

  function onFailed(error: ApiError) {
    if (error.kind === 'validation') {
      const next: FieldErrors = {};
      for (const { path, message } of error.error?.fields ?? []) {
        if (path === 'brandName' || path === 'contactText') next[path] ??= message;
      }
      if (hasErrors(next)) {
        showFieldErrors(next);
        return;
      }
    }
    setNotice(noticeOf(error));
  }

  function onLogoSaved(saved: MerchantProfile) {
    setDraft((current) => (current === null ? current : { ...current, version: saved.version }));
  }

  function onLogoFailed(error: ApiError) {
    // `413 file_too_large` and `415 unsupported_media_type` are file errors at the logo (2.2).
    if (error.kind === 'validation' && error.error !== null && error.status !== 422) {
      setLogoError(error.error.message);
      return;
    }
    setNotice(noticeOf(error));
  }

  function changeLogo(write: (version: number) => void) {
    if (draft === null) return;
    setLogoError(null);
    setNotice(null);
    write(draft.version);
  }

  function replaceLogo(file: File) {
    changeLogo((version) =>
      replaceLogoMutation.mutate(
        { version, file },
        { onSuccess: onLogoSaved, onError: onLogoFailed },
      ),
    );
  }

  function removeLogo() {
    changeLogo((version) =>
      removeLogoMutation.mutate({ version }, { onSuccess: onLogoSaved, onError: onLogoFailed }),
    );
  }

  function save() {
    // The save checks the fields itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    if (draft === null) return;
    const found = checkAll(draft);
    if (hasErrors(found)) {
      showFieldErrors(found);
      return;
    }
    setErrors({});
    setNotice(null);
    saveMutation.mutate(
      { version: draft.version, brandName: draft.brandName, contactText: draft.contactText },
      { onSuccess: onSaved, onError: onFailed },
    );
  }

  const formLocked = saving || draft === null;
  const logo = profile?.logo ?? null;
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
          className="flex max-w-2xl flex-col gap-4 rounded-control border border-border bg-surface p-4"
          onPointerDown={blurCheck.pressPointer}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <FormField label={TEXTS.brandName} required error={errors.brandName}>
            {(control) => (
              <Input
                {...control}
                value={draft.brandName}
                disabled={formLocked}
                onChange={(event) => change('brandName', event.target.value)}
                onBlur={() => checkOnBlur('brandName')}
              />
            )}
          </FormField>

          <section aria-labelledby={logoHeadingId} className="flex flex-col gap-2">
            <h2 id={logoHeadingId} className="m-0 text-label font-semibold text-text">
              {TEXTS.logo}
            </h2>
            {logo === null ? (
              <p className="m-0 text-body text-text">{TEXTS.noLogo}</p>
            ) : (
              <img
                src={logo.url}
                alt={TEXTS.logo}
                className="max-h-24 max-w-xs self-start rounded-control border border-border object-contain"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                id={replaceLogoId}
                disabled={formLocked || writesLocked}
                aria-describedby={logoError === null ? undefined : logoErrorId}
                onClick={() => logoInputRef.current?.click()}
              >
                {TEXTS.replaceLogo}
              </Button>
              {logo !== null && (
                <Button
                  variant="destructive"
                  disabled={formLocked || writesLocked}
                  onClick={removeLogo}
                >
                  {TEXTS.removeLogo}
                </Button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept={LOGO_TYPES}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Empty again, so choosing the same file once more is a new change.
                event.target.value = '';
                if (file !== undefined) replaceLogo(file);
              }}
            />
            {logoError !== null && (
              <p className="m-0 flex items-start gap-1 text-label text-error">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="mt-0.5 size-3 shrink-0"
                  fill="currentColor"
                >
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v5h-1.5v-5Zm0 6.25h1.5v1.5h-1.5v-1.5Z" />
                </svg>
                <span id={logoErrorId}>{logoError}</span>
              </p>
            )}
            <p className="m-0 text-body text-text-secondary">{TEXTS.logoNotice}</p>
          </section>

          <FormField label={TEXTS.contactText} error={errors.contactText}>
            {(control) => (
              <textarea
                {...control}
                rows={5}
                value={draft.contactText}
                disabled={formLocked}
                onChange={(event) => change('contactText', event.target.value)}
                onBlur={() => checkOnBlur('contactText')}
                // The 1 px input border as an inset ring: Playwright scrolls a text area into
                // view without its CSS border, which the reachability check (6.3) would count as
                // 1 px outside the viewport.
                className={cn(
                  'w-full min-w-0 rounded-control bg-surface px-2 py-1 ring-1 ring-border-input ring-inset',
                  'text-body text-text aria-invalid:ring-error disabled:bg-bg',
                )}
              />
            )}
          </FormField>

          <div>
            <Button type="submit" variant="primary" disabled={formLocked || writesLocked}>
              {saving ? TEXTS.saving : TEXTS.save}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
