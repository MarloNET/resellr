import type { Impact } from '@resellr/domain/schemas/common.schema';

import { Button } from '../../components/ui/Button.tsx';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/Dialog.tsx';

// Texts of UI-043 `screen.md` (UI/UX design v0.6.1).
const TEXTS = {
  title: 'Auswirkung der Änderung',
  empty: 'Keine Kanal-Inhalte betroffen',
  close: 'Schließen',
} as const;

/** Dialog width of UI-043 in px (Technical Specification 2.0.10). */
const WIDTH = 480;

/** Counts of REQ-053 in a save response (2.8.4). */
export type { Impact };

export interface ImpactDialogProps {
  /** `impact` of the save response; `null` keeps the dialog closed. */
  impact: Impact | null;
  /** "Schließen" and Esc: back to the calling screen. */
  onClose: () => void;
}

const isEmpty = ({ updated, rerelease, manualReview }: Impact) =>
  updated === 0 && rerelease === 0 && manualReview === 0;

/**
 * Dialog UI-043 "Auswirkung der Änderung" (CU-103, REQ-053; Technical Specification 2.2,
 * 2.0.10): the counts of `impact` from the save response of UI-030 or UI-031. It has no load of
 * its own, no error state and no reference number (K-5, DER-39-12). Until S5 there is no channel
 * content, so `impact` is `{0, 0, 0}` and the dialog shows `.empty` (4.4.0, QH-1); the three
 * counters and "Zu den betroffenen Inseraten" follow with #162.
 */
export function ImpactDialog({ impact, onClose }: ImpactDialogProps) {
  return (
    <Dialog open={impact !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent width={WIDTH}>
        <DialogHeader>
          <DialogTitle>{TEXTS.title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {impact !== null && isEmpty(impact) && <p className="m-0">{TEXTS.empty}</p>}
        </DialogBody>
        <DialogFooter>
          {/* The only action of `.empty`; the dialog focuses it on opening, so Enter closes. */}
          <Button onClick={onClose}>{TEXTS.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
