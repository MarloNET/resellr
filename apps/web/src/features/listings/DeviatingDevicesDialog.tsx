import { deviationLine } from '@resellr/domain/inventory/compare-variants';
import { CONFIRMATION_TITLES, ERROR_MESSAGES } from '@resellr/domain/messages/messages.de';
import type { DeviatingDeviceItem } from '@resellr/domain/schemas/listing.schema';
import { useState } from 'react';

import type { ApiError } from '../../api/api-client.ts';
import { useOpsStatusQuery } from '../../api/ops.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import { OutcomeUnknownBanner } from '../../components/patterns/OutcomeUnknownBanner.tsx';
import {
  noticeOf,
  SaveNoticeBanners,
  type SaveNotice,
} from '../../components/patterns/SaveNoticeBanners.tsx';
import { UnreachableBanner } from '../../components/patterns/UnreachableBanner.tsx';
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

// Texts of UI-014 `screen.md`, state `abweichung-bestaetigen` and action "Änderung trotzdem
// speichern" (UI/UX design v0.6.1).
export const TEXTS = {
  title: CONFIRMATION_TITLES['confirmation_required.assigned_devices_deviate'],
  text: (count: number) =>
    ERROR_MESSAGES['confirmation_required.assigned_devices_deviate'](String(count)),
  wiNr: 'WI-Nr',
  attribute: 'Merkmal',
  hint: 'Die Bestätigung wird im Änderungsprotokoll festgehalten.',
  saveAnyway: 'Änderung trotzdem speichern',
  cancel: 'Abbrechen',
  error: (referenceNumber: string | null) =>
    `Speichern nicht möglich. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Dialog width of UI-014 `abweichung-bestaetigen` in px (Technical Specification 2.0.10). */
const WIDTH = 800;

/** Failures of "Änderung trotzdem speichern" that stand in the dialog (DER-64-07, DER-64-09). */
const DIALOG_FAILURES = new Set<ApiError['kind']>([
  'error',
  'conflict',
  'shutting-down',
  'not-found',
  'outcome-unknown',
]);

export interface DeviatingDevicesDialogProps {
  /** `details.devices` of `assigned_devices_deviate`; `null` keeps the dialog closed. */
  devices: DeviatingDeviceItem[] | null;
  /** While the confirmed `PATCH` runs (`UI-014.speichert`). */
  saving: boolean;
  /**
   * "Änderung trotzdem speichern": the calling form sends its request again with
   * `confirmDeviatingDevices: true` and closes the dialog on success.
   */
  onConfirm: (onError: (error: ApiError) => void) => void;
  /** "Abbrechen" and Esc: back to the form with its inputs, nothing is stored (DER-64-03). */
  onCancel: () => void;
  /** A rejection the form shows at its fields (e.g. `validation_failed`); the dialog closes. */
  onRejected: (error: ApiError) => void;
  /** After "Neu laden" of P-05 has read the model listing again; the dialog closes. */
  onReloaded: () => void;
}

/**
 * Dialog "Zugeordnete Geräte weichen ab" (CU-140, REQ-088; Technical Specification 2.7, 2.0.10):
 * `UI-014.abweichung-bestaetigen` opens over the listing values form when "Speichern" answers
 * `confirmation_required`/`assigned_devices_deviate` and names each deviating device with its
 * deviations in the line format "Optik-Note: Gerät 2, Modell-Inserat 3" (AC-REQ-088-03,
 * DER-64-03). "Änderung trotzdem speichern" sends the change again with the confirmation, which
 * the server logs; "Abbrechen" and Esc return to the form. States of the confirmation in the
 * dialog: speichert, error ("Speichern nicht möglich. Referenz: <Nr>", DER-64-07), conflict
 * (P-05), wird-beendet (P-07) and ausgang-unbekannt (P-08) (DER-64-09, 7.3 Grundregel).
 */
export function DeviatingDevicesDialog({ devices, ...props }: DeviatingDevicesDialogProps) {
  const writesLocked = useWritesLocked();
  // Esc and a click outside would hide the dialog while the write runs or after an unknown
  // outcome (P-08).
  const locked = props.saving || writesLocked;

  return (
    <Dialog open={devices !== null} onOpenChange={(open) => !open && props.onCancel()}>
      {/* The content mounts per opening, so each opening starts without banner. */}
      <DialogContent width={WIDTH} dismissible={!locked}>
        {devices !== null && (
          <DeviatingDevicesContent {...props} devices={devices} writesLocked={writesLocked} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DeviatingDevicesContentProps extends Omit<DeviatingDevicesDialogProps, 'devices'> {
  devices: DeviatingDeviceItem[];
  writesLocked: boolean;
}

/** Content of the dialog; mounted per opening. */
function DeviatingDevicesContent({
  devices,
  saving,
  onConfirm,
  onCancel,
  onRejected,
  onReloaded,
  writesLocked,
}: DeviatingDevicesContentProps) {
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // The overlay hides the banners of the frame, so P-06 of its status stands here as well
  // (Nachtrag MAR-395).
  const unreachable = useOpsStatusQuery({ enabled: false }).error?.kind === 'unreachable';
  const busy = saving || writesLocked;

  function confirm() {
    if (busy) return;
    setNotice(null);
    onConfirm((error) => {
      if (DIALOG_FAILURES.has(error.kind)) setNotice(noticeOf(error));
      else onRejected(error);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{TEXTS.title}</DialogTitle>
        <DialogDescription>{TEXTS.text(devices.length)}</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <OutcomeUnknownBanner />
        {unreachable && <UnreachableBanner alwaysShow />}
        <SaveNoticeBanners
          notice={notice}
          onClose={() => setNotice(null)}
          onReloaded={onReloaded}
          errorText={TEXTS.error}
        />
        {/* The scroll container of the table must not shrink in the scrolling body (FM-4). */}
        <div className="shrink-0">
          <Table aria-label={TEXTS.title}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{TEXTS.wiNr}</TableHead>
                <TableHead scope="col">{TEXTS.attribute}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.flatMap(({ wiNr, deviations }) =>
                deviations.map((deviation) => (
                  <TableRow key={`${wiNr}-${deviation.key}`}>
                    <TableHead scope="row" className="text-text">
                      {wiNr}
                    </TableHead>
                    {/* A long condition description wraps (UI-014 "Fenstergröße"). */}
                    <TableCell className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {deviationLine(deviation)}
                    </TableCell>
                  </TableRow>
                )),
              )}
            </TableBody>
          </Table>
        </div>
        <p className="m-0 text-text-secondary">{TEXTS.hint}</p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" disabled={busy} onClick={onCancel}>
          {TEXTS.cancel}
        </Button>
        <Button type="button" variant="primary" disabled={busy} onClick={confirm}>
          {TEXTS.saveAnyway}
        </Button>
      </DialogFooter>
    </>
  );
}
