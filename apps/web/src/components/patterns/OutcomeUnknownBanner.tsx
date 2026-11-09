import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import type { ReactNode } from 'react';

import {
  useWritesLocked,
  writeOutcomeStore,
  type WriteOutcomeStore,
} from '../../api/write-outcome-store.ts';
import { bannerClassName } from './PageBanner.tsx';

export interface OutcomeUnknownBannerProps {
  /** Addition of the screen where it differs from P-08; the core text always stays. */
  children?: ReactNode;
  store?: WriteOutcomeStore;
}

/**
 * Banner P-08 (CU-055, `.ausgang-unbekannt`, Technical Specification 2.0.7, K-6): shown as
 * soon as the page is "gesperrt bis Neuladen" (CU-049), i.e. a write ended without an HTTP
 * answer. Permanent, flag-warn, without "×", button or reference number. The lock itself
 * blocks every further write in the API client; write triggers disable themselves with
 * `useWritesLocked`. Only a reload of the page ends the state. The fixed core "Ausgang
 * unbekannt, bitte neu laden." is shown in every case.
 */
export function OutcomeUnknownBanner({
  children = FIXED_TEXTS.outcomeUnknownHint,
  store = writeOutcomeStore,
}: OutcomeUnknownBannerProps) {
  const locked = useWritesLocked(store);
  if (!locked) return null;

  return (
    <div role="alert" className={bannerClassName('warn')}>
      <p>
        <strong className="font-semibold">{FIXED_TEXTS.outcomeUnknownBanner}</strong> {children}
      </p>
    </div>
  );
}
