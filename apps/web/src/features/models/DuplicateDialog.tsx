import { CONFIRMATION_TITLES, ERROR_MESSAGES } from '@resellr/domain/messages/messages.de';
import type { ModelTemplateMatch } from '@resellr/domain/schemas/model-template.schema';
import { useId } from 'react';

import { Button } from '../../components/ui/Button.tsx';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/Dialog.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/Table.tsx';

// Texts of UI-007 `screen.md` "Dialoge" (UI/UX design v0.6.2, M-27, O-5).
const TEXTS = {
  title: CONFIRMATION_TITLES['confirmation_required.possible_duplicate'],
  text: ERROR_MESSAGES['confirmation_required.possible_duplicate'],
  manufacturer: 'Hersteller',
  modelName: 'Modellbezeichnung',
  mpn: 'Herstellernummer',
  mpnUnknown: 'unbekannt',
  useExisting: 'Vorhandene verwenden',
  createAnyway: 'Trotzdem anlegen',
} as const;

/** Dialog width of P-04 in px (Technical Specification 2.0.10). */
const WIDTH = 480;

export interface DuplicateDialogProps {
  /** `details.matches[]` of `possible_duplicate`; `null` keeps the dialog closed. */
  matches: ModelTemplateMatch[] | null;
  /** "Vorhandene verwenden" of a hit: the inputs are discarded, nothing is created (DER-53-02). */
  onUseExisting: (id: number) => void;
  /** "Trotzdem anlegen": the same request with `confirmDuplicate: true` (DER-53-03). */
  onCreateAnyway: () => void;
  /** Esc: back to the form, nothing is stored (DER-53-01). */
  onClose: () => void;
  /** Disables "Trotzdem anlegen" while writes are locked (P-08). */
  createDisabled?: boolean;
}

/**
 * Dialog UI-007.dublette (CU-114, REQ-011; Technical Specification 2.4, 8.2 M-27): modal after
 * P-04 with title and text of M-27 and the hits with manufacturer, model name and MPN, each with
 * "Vorhandene verwenden" (design interpretation MAR-199), and "Trotzdem anlegen". Esc closes
 * without saving.
 */
export function DuplicateDialog({
  matches,
  onUseExisting,
  onCreateAnyway,
  onClose,
  createDisabled = false,
}: DuplicateDialogProps) {
  const rowId = useId();

  return (
    <Dialog open={matches !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent width={WIDTH}>
        <DialogHeader>
          <DialogTitle>{TEXTS.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <DialogDescription className="m-0">{TEXTS.text}</DialogDescription>
          <Table>
            <TableHeader>
              <tr>
                <TableHead scope="col">{TEXTS.manufacturer}</TableHead>
                <TableHead scope="col">{TEXTS.modelName}</TableHead>
                <TableHead scope="col">{TEXTS.mpn}</TableHead>
                {/* The column of the actions has no heading in the design. */}
                <td />
              </tr>
            </TableHeader>
            <TableBody>
              {(matches ?? []).map(({ id, manufacturer, modelName, mpn }) => (
                <TableRow key={id}>
                  <TableCell>{manufacturer.name}</TableCell>
                  <TableCell id={`${rowId}-${id}`}>{modelName}</TableCell>
                  <TableCell>{mpn ?? TEXTS.mpnUnknown}</TableCell>
                  <TableCell>
                    {/* The model name tells the equally named buttons apart. */}
                    <Button aria-describedby={`${rowId}-${id}`} onClick={() => onUseExisting(id)}>
                      {TEXTS.useExisting}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" disabled={createDisabled} onClick={onCreateAnyway}>
            {TEXTS.createAnyway}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
