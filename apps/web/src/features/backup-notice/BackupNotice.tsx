import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { useId } from 'react';

import { useOpsStatusQuery } from '../../api/ops.api.ts';

/** `sidebar` in the navigation column of AppFrame; the strip of UI-019 narrow follows in #140. */
export type BackupNoticeVariant = 'sidebar';

export interface BackupNoticeProps {
  variant: BackupNoticeVariant;
}

/** Info symbol of the heading, 14 px (Technical Specification 2.17). */
function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="shrink-0 text-primary"
    >
      <circle cx="8" cy="8" r="6.75" />
      <path d="M8 7.25v4" strokeLinecap="round" />
      <circle cx="8" cy="4.75" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Backup notice UI-044 (CU-254, REQ-104, Technical Specification 2.17): fixed texts from
 * `messages.de.ts`, the data folder path from `GET /api/ops/status`. No state, no setting, no
 * "×" and no collapsing; while the status loads, "wird geladen …" stands at the place of the
 * path and the rest is shown at once (`UI-044.loading`); on `500` the text with the reference
 * number stands there instead (`UI-044.error`), the rest stays complete. In the column it has `margin-top: auto`:
 * at the lower edge with enough height, otherwise after the entries.
 * "resellr beenden" opens UI-045 from #142 on; until then it has no effect.
 */
export function BackupNotice({ variant }: BackupNoticeProps) {
  const headingId = useId();
  const { data, error } = useOpsStatusQuery();
  // `UI-044.error` only for `500 internal_error`, the one answer with a reference number (2.0.5);
  // without an answer "wird geladen …" stays and the content area shows P-06 (DG-06).
  const referenceNumber = error?.kind === 'error' ? (error.error?.referenceNumber ?? null) : null;

  return (
    <div data-variant={variant} className="mt-auto shrink-0 px-2 pt-1 pb-2">
      <section
        aria-labelledby={headingId}
        className="flex flex-col gap-0.5 rounded-control border border-l-4 border-primary bg-surface p-2 text-label"
      >
        <h2
          id={headingId}
          className="m-0 mb-0.5 flex items-center gap-1 text-body font-semibold text-text"
        >
          <InfoIcon />
          {FIXED_TEXTS.backupNoticeTitle}
        </h2>
        <p className="m-0">{FIXED_TEXTS.backupNoticeIntro}</p>
        <p className="m-0">{FIXED_TEXTS.backupNoticeStepsLead}</p>
        <p className="m-0">{FIXED_TEXTS.backupNoticeStep1}</p>
        <p className="m-0">{FIXED_TEXTS.backupNoticeStep2}</p>
        <p className="m-0">{FIXED_TEXTS.backupNoticeLocationLead}</p>
        {referenceNumber ? (
          <p data-testid="backup-notice-path" className="m-0">
            {FIXED_TEXTS.backupNoticeError(referenceNumber)}
          </p>
        ) : data === undefined ? (
          <p data-testid="backup-notice-path" className="m-0 text-text-secondary">
            {FIXED_TEXTS.backupNoticeLoading}
          </p>
        ) : (
          <p className="m-0">
            {/* Own element, so a triple click selects only the path (UI-044). */}
            <span data-testid="backup-notice-path" className="break-all">
              {data.dataDirPath}
            </span>
            <span className="select-none">.</span>
          </p>
        )}
        <p className="m-0">{FIXED_TEXTS.backupNoticeWarning}</p>
        {/* Secondary button (DESIGN.md "Buttons"), 28 px high: with the gap 32 px (UI-044). */}
        <button
          type="button"
          className="mt-0.5 inline-flex h-7 w-full items-center justify-center rounded-control border border-border-input bg-surface px-4 text-body font-semibold text-text"
        >
          {FIXED_TEXTS.shutdownAction}
        </button>
      </section>
    </div>
  );
}
