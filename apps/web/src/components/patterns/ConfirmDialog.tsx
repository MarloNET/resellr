import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

import { Button } from '../ui/Button.tsx';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog.tsx';

export interface ConfirmDialogProps {
  open: boolean;
  /** Called with `false` on "Abbrechen" and Esc. */
  onOpenChange: (open: boolean) => void;
  /** The action; the screen closes the dialog once the action is done. */
  onConfirm: () => void;
  /** Title = the action (P-04). */
  title: string;
  /** Label of the action button, describing the result. */
  confirmLabel: string;
  /** Text naming the effect of the action. */
  children: ReactNode;
  /** Design width in px (Technical Specification 2.0.10). */
  width: number;
  /** Delete and cancellation: the action is shown as destructive (DESIGN.md "Buttons"). */
  destructive?: boolean;
  /** Disables the action, e.g. while the write runs or writes are locked (P-08). */
  confirmDisabled?: boolean;
  /** Focus target after closing instead of the opening element (`DialogContent`, CU-058). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Text of a running action that cannot be taken back, e.g. "resellr wird beendet …"
   * (UI-045.loading): shown with a progress indicator without percent; both buttons are
   * disabled, and Esc and a click outside do nothing.
   */
  pending?: ReactNode;
}

/** Progress indicator without percent (UI-045.loading). */
function ProgressIndicator() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-primary motion-safe:animate-spin"
    >
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Confirmation dialog P-04 (CU-056, design chapter 5): the title is the action, the content
 * names its effect, "Abbrechen" on the left, the action on the right. Title and action bar stay
 * visible and only the content scrolls (Technical Specification 2.0.10). The content is the
 * description of the dialog (`aria-describedby`). The focus starts on "Abbrechen", the first
 * button, so Enter confirms only when the focus is on the action (UI-045).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  confirmLabel,
  children,
  width,
  destructive = false,
  confirmDisabled = false,
  returnFocusRef,
  pending,
}: ConfirmDialogProps) {
  const isPending = pending !== undefined;
  const contentRef = useRef<HTMLDivElement>(null);
  // The disabled buttons cannot hold the focus; it stays in the dialog instead of `<body>`.
  useEffect(() => {
    if (isPending) contentRef.current?.focus();
  }, [isPending]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        width={width}
        returnFocusRef={returnFocusRef}
        dismissible={!isPending}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <DialogBody>{children}</DialogBody>
        </DialogDescription>
        {isPending && (
          <div role="status" className="flex shrink-0 items-center gap-2 px-6 pt-4">
            <ProgressIndicator />
            {pending}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={isPending}>Abbrechen</Button>
          </DialogClose>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            disabled={confirmDisabled || isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
