import type { ReactNode } from 'react';

import type { ApiError } from '../../api/api-client.ts';
import { ConflictBanner } from './ConflictBanner.tsx';
import { bannerClassName, PageBanner } from './PageBanner.tsx';
import { ShuttingDownBanner } from './ShuttingDownBanner.tsx';

/** Banner after a write (Technical Specification 2.0.7). */
export type SaveNotice =
  | { kind: 'success' }
  | { kind: 'error'; error: ApiError }
  | { kind: 'conflict' }
  | { kind: 'shutting-down' }
  | { kind: 'not-found'; message: string };

/**
 * Banner for a failed write that no field takes (addendum MAR-555): P-05, P-07, M-15 or
 * `.error`. An unknown outcome gives none, because P-08 (CU-055) shows itself once the page is
 * locked. The screen maps field errors (`validation`, field-related `rejected` codes) first.
 */
export function noticeOf(error: ApiError): SaveNotice | null {
  switch (error.kind) {
    case 'conflict':
      return { kind: 'conflict' };
    case 'shutting-down':
      return { kind: 'shutting-down' };
    case 'not-found':
      return { kind: 'not-found', message: error.error?.message ?? '' };
    case 'outcome-unknown':
      return null;
    default:
      return { kind: 'error', error };
  }
}

export interface SaveNoticeBannersProps {
  notice: SaveNotice | null;
  /** "×" of the success and error banner, and the end of the 5 s of `.success`. */
  onClose: () => void;
  /** After "Neu laden" of P-05 has loaded the data again (T-1). */
  onReloaded: () => void;
  /** Text of `.success`, e.g. "Gespeichert"; a screen without it shows no success banner. */
  successText?: ReactNode;
  /** Text of `.error` of the screen with the reference number (REQ-073). */
  errorText: (referenceNumber: string | null) => ReactNode;
}

/**
 * Banners of a write (CU-314, addendum MAR-555, FIND-324): `.success`, `.error`, `.conflict`
 * (P-05), `.wird-beendet` (P-07) and the banner M-15 of `not_found`. P-06, P-08 and the banner
 * of a failed read stay in the screen.
 */
export function SaveNoticeBanners({
  notice,
  onClose,
  onReloaded,
  successText,
  errorText,
}: SaveNoticeBannersProps) {
  switch (notice?.kind) {
    case 'success':
      return successText === undefined ? null : (
        <PageBanner variant="success" onClose={onClose}>
          {successText}
        </PageBanner>
      );
    case 'error':
      return (
        <PageBanner variant="error" error={notice.error} onClose={onClose}>
          {errorText}
        </PageBanner>
      );
    case 'conflict':
      return <ConflictBanner onReloaded={onReloaded} />;
    case 'shutting-down':
      return <ShuttingDownBanner />;
    case 'not-found':
      return (
        <div role="alert" className={bannerClassName('warn')}>
          {notice.message}
        </div>
      );
    default:
      return null;
  }
}
