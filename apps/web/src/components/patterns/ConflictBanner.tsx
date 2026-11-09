import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { Button } from '../ui/Button.tsx';
import { bannerClassName } from './PageBanner.tsx';

export interface ConflictBannerProps {
  /** Text of the screen where it differs from P-05 (e.g. UI-019 "Bitte neu laden"). */
  children?: ReactNode;
  /** Called once the data of the page has been loaded again, e.g. to hide the banner. */
  onReloaded?: () => void;
}

/**
 * Conflict banner P-05 (CU-052, `.conflict`, Technical Specification 2.0.7, T-1): flag-warn,
 * without "×". "Neu laden" only loads the data again (`invalidateQueries`); the page stays
 * and the inputs stay visible until the screen takes over the reloaded data.
 */
export function ConflictBanner({
  children = FIXED_TEXTS.conflictBanner,
  onReloaded,
}: ConflictBannerProps) {
  const queryClient = useQueryClient();

  async function reload() {
    await queryClient.invalidateQueries();
    onReloaded?.();
  }

  return (
    <div role="alert" className={bannerClassName('warn')}>
      <div className="min-w-0 flex-1">{children}</div>
      <Button className="shrink-0" onClick={() => void reload()}>
        Neu laden
      </Button>
    </div>
  );
}
