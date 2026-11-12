import {
  brandNameSchema,
  contactTextSchema,
  type MerchantProfile,
} from '@resellr/domain/schemas/merchant-profile.schema';
import { useEffect, useId, useRef, useState } from 'react';

import type { ApiError } from '../../../api/api-client.ts';
import {
  useMerchantProfileQuery,
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

/**
 * Merchant profile of UI-026 (CU-097, REQ-028; Technical Specification 2.2): name of the brand
 * and contact details, the logo area with the notice on the datasheet. The logo itself (preview,
 * replace, remove) follows with #167. States after 2.0.7: default, loading, validation, success,
 * error, speichert (P-08), conflict (P-05), unreachable (P-06), wird-beendet (P-07),
 * ausgang-unbekannt (P-08). The save reports `SettingsChanged`, but UI-026 shows no counts and
 * no dialog UI-043 (2.2).
 */
export function MerchantProfilePage() {
  const query = useMerchantProfileQuery();
  const saveMutation = useSaveMerchantProfileMutation();
  const writesLocked = useWritesLocked();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // After "Neu laden" (P-05) the inputs stay until the reloaded data has arrived (T-1).
  const [takeReloaded, setTakeReloaded] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();
  const logoHeadingId = useId();

  const profile = query.data;
  const saving = saveMutation.isPending;

  // The form opens with the loaded profile.
  useEffect(() => {
    if (draft === null && profile !== undefined) setDraft(draftOf(profile));
  }, [draft, profile]);

  useEffect(() => {
    if (!takeReloaded || query.isFetching || profile === undefined) return;
    setTakeReloaded(false);
    setDraft(draftOf(profile));
    setErrors({});
  }, [takeReloaded, query.isFetching, profile]);

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

          <section aria-labelledby={logoHeadingId} className="flex flex-col gap-1">
            <h2 id={logoHeadingId} className="m-0 text-label font-semibold text-text">
              {TEXTS.logo}
            </h2>
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
