import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { useOpsHealthQuery, useOpsStatusQuery } from '../../api/ops.api.ts';
import { Button } from '../ui/Button.tsx';
import { bannerClassName } from './PageBanner.tsx';

export interface UnreachableBannerProps {
  /** Text of the screen where it differs from P-06. */
  children?: ReactNode;
  /**
   * Shows the banner even while `GET /api/ops/status` is unreachable; only the frame (CU-044)
   * and modal dialogs set it, because then the frame shows its own P-06 (Nachtrag MAR-395).
   */
  alwaysShow?: boolean;
}

/**
 * Banner P-06 (CU-053, `.unreachable`, Technical Specification 2.0.7, DG-06): permanent,
 * flag-warn, without "×" and without reference number; it stands above the page and never
 * replaces it. "Erneut versuchen" checks `GET /api/ops/health` and only after an answer
 * loads the data of the page again, including the data folder path of UI-044. The screen
 * hides the banner once its data has arrived. At most one P-06 per content area: without
 * `alwaysShow` it renders nothing while `GET /api/ops/status` is unreachable, because the frame
 * shows P-06 then (Nachtrag MAR-395).
 */
export function UnreachableBanner({
  children = FIXED_TEXTS.unreachableBanner,
  alwaysShow = false,
}: UnreachableBannerProps) {
  const queryClient = useQueryClient();
  const health = useOpsHealthQuery();
  // Without `alwaysShow` the status is requested again on showing, so a lost server moves P-06
  // from the page into the frame. With it, a request would reset a status without data to
  // loading and hide the frame's own banner again, so it only reads the cache.
  const status = useOpsStatusQuery({ enabled: !alwaysShow });
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

  if (!alwaysShow && status.error?.kind === 'unreachable') return null;

  return (
    <div role="alert" className={bannerClassName('warn')}>
      <div className="min-w-0 flex-1">{children}</div>
      <Button className="shrink-0" disabled={checking} onClick={() => void retry()}>
        Erneut versuchen
      </Button>
    </div>
  );
}
