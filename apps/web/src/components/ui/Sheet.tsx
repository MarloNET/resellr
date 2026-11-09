import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps } from 'react';

import { cn } from './cn.ts';

/**
 * Side panel below the `full` breakpoint (CU-058, Technical Specification 2.0.10, R-1 (3)):
 * a surface over the content with "Schließen"; focus stays in the panel, Esc closes.
 * From `full` on, screens place their panels next to the content as designed.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;

export interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Title of the panel. */
  title: string;
  /** Design width of the panel in px; never wider than the window minus 16 px. */
  width: number;
}

export function SheetContent({
  title,
  width,
  className,
  style,
  children,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-text/40" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          'fixed inset-y-0 right-0 flex h-dvh flex-col border-l border-border bg-surface',
          'text-body text-text shadow-sm',
          className,
        )}
        style={{ width: `min(${width}px, 100vw - 16px)`, ...style }}
        {...props}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2">
          <DialogPrimitive.Title className="text-section font-semibold">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className={cn(
              'inline-flex h-control items-center rounded-control border border-border-input',
              'bg-surface px-4 text-body font-semibold text-text',
            )}
          >
            Schließen
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 [overflow-wrap:anywhere]">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
