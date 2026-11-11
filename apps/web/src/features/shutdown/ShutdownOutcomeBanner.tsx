import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';

import { PageBanner } from '../../components/patterns/PageBanner.tsx';
import { ShuttingDownBanner } from '../../components/patterns/ShuttingDownBanner.tsx';
import {
  shutdownOutcomeStore,
  useShutdownOutcome,
  type ShutdownOutcomeStore,
} from './shutdown-outcome-store.ts';

export interface ShutdownOutcomeBannerProps {
  store?: ShutdownOutcomeStore;
}

/**
 * Banner after "resellr beenden" in UI-045 (CU-312, Nachtrag MAR-421), at the top of the
 * content area of the frame: `500` → `UI-045.error` (REQ-073) with the reference number and "×",
 * which clears the outcome; `503 shutting_down` → P-07 without "×"; otherwise nothing.
 */
export function ShutdownOutcomeBanner({
  store = shutdownOutcomeStore,
}: ShutdownOutcomeBannerProps) {
  const outcome = useShutdownOutcome(store);

  if (outcome?.kind === 'error') {
    return (
      <PageBanner variant="error" error={outcome.error} onClose={store.clear}>
        {(referenceNumber) => FIXED_TEXTS.shutdownError(referenceNumber ?? '')}
      </PageBanner>
    );
  }
  if (outcome?.kind === 'shutting-down') return <ShuttingDownBanner />;
  return null;
}
