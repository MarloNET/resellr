import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { useEffect, useRef, type ReactNode } from 'react';

import type { ApiError } from '../../api/api-client.ts';
import { cn } from '../ui/cn.ts';

/** Display time of the success banner (design chapter 5 "Feedback"; no loading rule). */
export const PAGE_BANNER_SUCCESS_MS = 5000;

/**
 * Tones of the banners at the top of the content area (DESIGN.md "Farben", "Feedback"):
 * success, flag-warn for P-05 to P-08 and error for `.error`.
 */
export type BannerTone = 'success' | 'warn' | 'error';

const TONES: Record<BannerTone, string> = {
  success: 'bg-status-published-bg text-status-published',
  warn: 'bg-flag-warn-bg text-flag-warn',
  error: 'bg-error-bg text-error',
};

/** Banner classes, shared by the page banner and the banners P-05 to P-08. */
export function bannerClassName(tone: BannerTone, className?: string): string {
  return cn(
    'flex items-start gap-4 rounded-control px-4 py-2 text-body [overflow-wrap:anywhere]',
    TONES[tone],
    className,
  );
}

export type PageBannerProps =
  | {
      /** `.success`: text of the screen; closes after 5 s or with "×". */
      variant: 'success';
      children: ReactNode;
      onClose: () => void;
    }
  | {
      /**
       * `.error` (REQ-073): the text of the screen names the function and the next step and
       * embeds the reference number of the error response (`null` for a `400`, 2.0.5).
       */
      variant: 'error';
      error: ApiError;
      children: (referenceNumber: string | null) => ReactNode;
      /** Shows "×"; the banner never closes by itself. */
      onClose?: () => void;
    };

/** Page banner for success and error (CU-051, Technical Specification 2.0.7). */
export function PageBanner(props: PageBannerProps) {
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;

  // `.success` closes 5 s after its text was shown; a changed text starts the 5 s again, a
  // re-render with the same text does not (#285).
  const autoClose = props.variant === 'success';
  const contentRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<{ id: ReturnType<typeof setTimeout>; text: string } | null>(null);
  useEffect(() => {
    const text = contentRef.current?.textContent ?? '';
    if (autoClose && timerRef.current?.text === text) return;
    if (timerRef.current) clearTimeout(timerRef.current.id);
    timerRef.current = autoClose
      ? { id: setTimeout(() => onCloseRef.current?.(), PAGE_BANNER_SUCCESS_MS), text }
      : null;
  });
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current.id);
      timerRef.current = null;
    },
    [],
  );

  const content =
    props.variant === 'success'
      ? props.children
      : props.children(props.error.error?.referenceNumber ?? null);

  return (
    <div
      role={props.variant === 'success' ? 'status' : 'alert'}
      className={bannerClassName(props.variant)}
    >
      <div ref={contentRef} className="min-w-0 flex-1">
        {content}
      </div>
      {props.onClose && (
        <button
          type="button"
          aria-label={FIXED_TEXTS.closeBanner}
          className={cn(
            'inline-flex min-h-[32px] min-w-[32px] shrink-0 cursor-pointer items-center',
            'justify-center font-semibold',
          )}
          onClick={props.onClose}
        >
          ×
        </button>
      )}
    </div>
  );
}
