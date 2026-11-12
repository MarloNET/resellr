import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import type { RefObject } from 'react';

import { useShutdownMutation } from '../../api/ops.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import { ConfirmDialog } from '../../components/patterns/ConfirmDialog.tsx';
import { shutdownOutcomeStore } from './shutdown-outcome-store.ts';

/** Design width of UI-045 in px. */
const SHUTDOWN_DIALOG_WIDTH = 480;

export interface ShutdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Focus target after closing: "resellr beenden" in the backup notice. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Question "resellr beenden" UI-045 (CU-255, REQ-105, Technical Specification 2.17), pattern
 * P-04: opens without a server call with the focus on "Abbrechen"; "Abbrechen" and Esc close
 * it and nothing happens. "resellr beenden" sends `POST /api/ops/shutdown` with the time limit
 * of 30 s (CU-050); while it runs, the dialog shows "resellr wird beendet …", both buttons are
 * disabled and Esc does nothing (`UI-045.loading`). An error answer closes the dialog and
 * leaves its outcome in CU-311 for the banner of the frame (CU-312, Nachtrag MAR-421):
 * `503 shutting_down` → P-07, any other (`500`) → `UI-045.error`; resellr keeps running. The
 * waiting state stays after `200` and without an answer: UI-046 replaces the frame (CU-257).
 * While all writes of the page are locked until reload (P-08, CU-049), the action is disabled.
 */
export function ShutdownDialog({ open, onOpenChange, returnFocusRef }: ShutdownDialogProps) {
  const shutdown = useShutdownMutation();
  const writesLocked = useWritesLocked();

  function confirm() {
    shutdownOutcomeStore.clear();
    shutdown.mutate(undefined, {
      onError: (error) => {
        // Without an answer the outcome is unknown: UI-046.unknown follows (CU-257).
        if (error.status === null) return;
        shutdownOutcomeStore.set(
          error.kind === 'shutting-down' ? { kind: 'shutting-down' } : { kind: 'error', error },
        );
        shutdown.reset();
        onOpenChange(false);
      },
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={confirm}
      title={FIXED_TEXTS.shutdownAction}
      confirmLabel={FIXED_TEXTS.shutdownAction}
      width={SHUTDOWN_DIALOG_WIDTH}
      returnFocusRef={returnFocusRef}
      confirmDisabled={writesLocked}
      pending={shutdown.isIdle ? undefined : FIXED_TEXTS.shutdownPending}
    >
      {FIXED_TEXTS.shutdownQuestion}
    </ConfirmDialog>
  );
}
