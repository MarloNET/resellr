import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { useOpsHealthQuery } from '../../api/ops.api.ts';
import { Button } from '../ui/Button.tsx';
import { bannerClassName } from './PageBanner.tsx';

export interface UnreachableBannerProps {
  /** Text of the screen where it differs from P-06. */
  children?: ReactNode;
}

/**
 * Banner P-06 (CU-053, `.unreachable`, Technical Specification 2.0.7, DG-06): permanent,
 * flag-warn, without "×" and without reference number; it stands above the page and never
 * replaces it. "Erneut versuchen" checks `GET /api/ops/health` and only after an answer
 * loads the data of the page again, including the data folder path of UI-044. The screen
 * hides the banner once its data has arrived.
 */
export function UnreachableBanner({
  children = FIXED_TEXTS.unreachableBanner,
}: UnreachableBannerProps) {
  const queryClient = useQueryClient();
  const health = useOpsHealthQuery();
  const [checking, setChecking] = useState(false);

  async function retry() {
    setChecking(true);
    try {
      const result = await health.refetch();
      if (result.isSuccess) await queryClient.invalidateQueries();
    } finally {
      setChecking(false);
    }
  }

  return (
    <div role="alert" className={bannerClassName('warn')}>
      <div className="min-w-0 flex-1">{children}</div>
      <Button className="shrink-0" disabled={checking} onClick={() => void retry()}>
        Erneut versuchen
      </Button>
    </div>
  );
}
