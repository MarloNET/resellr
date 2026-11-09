import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps, HTMLAttributes } from 'react';

import { cn } from './cn.ts';

/**
 * Modal dialog (CU-058, Technical Specification 2.0.10, DESIGN.md "Dialoge"): width
 * `min(<design width>, 100vw − 16px)`, height at most `100dvh − 16px`; a column of title,
 * scrolling content and action bar, so title and actions always stay visible. Esc closes.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Design width of the dialog in px, e.g. 720 for UI-004, 800 for UI-005. */
  width: number;
}

export function DialogContent({ width, className, style, children, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-text/40" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          'fixed top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col',
          'rounded-control border border-border bg-surface text-body text-text shadow-sm',
          className,
        )}
        style={{
          width: `min(${width}px, 100vw - 16px)`,
          maxHeight: 'calc(100dvh - 16px)',
          ...style,
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shrink-0 px-6 pt-6 pb-4', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn('text-section font-semibold', className)} {...props} />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-body', className)} {...props} />;
}

/** Scrolling content between title and action bar. */
export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-dialog-body=""
      className={cn('min-h-0 flex-1 overflow-y-auto px-6 [overflow-wrap:anywhere]', className)}
      {...props}
    />
  );
}

/** Action bar, actions right-aligned with the primary action rightmost; buttons wrap. */
export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex shrink-0 flex-wrap justify-end gap-2 px-6 pt-4 pb-6', className)}
      {...props}
    />
  );
}
