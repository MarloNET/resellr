import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import type { ReactNode } from 'react';

import { bannerClassName } from './PageBanner.tsx';

export interface ShuttingDownBannerProps {
  /** Text of the screen where it differs from P-07. */
  children?: ReactNode;
}

/**
 * Banner P-07 (CU-054, `.wird-beendet`, Technical Specification 2.0.7): the server refused a
 * write with `503 shutting_down`. Flag-warn, without "×", without reference number (no
 * error log entry) and without button; it does not disappear by itself, and the inputs of
 * the page stay visible and editable.
 */
export function ShuttingDownBanner({
  children = FIXED_TEXTS.shuttingDownBanner,
}: ShuttingDownBannerProps) {
  return (
    <div role="alert" className={bannerClassName('warn')}>
      {children}
    </div>
  );
}
