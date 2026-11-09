import type { ReactNode } from 'react';

import { Button } from '../ui/Button.tsx';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
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
}

/**
 * Confirmation dialog P-04 (CU-056, design chapter 5): the title is the action, the content
 * names its effect, "Abbrechen" on the left, the action on the right. Title and action bar stay
 * visible and only the content scrolls (Technical Specification 2.0.10).
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
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width={width}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Abbrechen</Button>
          </DialogClose>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
