import { CONFIRMATION_TITLES, ERROR_MESSAGES } from '@resellr/domain/messages/messages.de';
import type {
  DeviceAssignment,
  VariantDeviationItem,
} from '@resellr/domain/schemas/listing.schema';
import { useState } from 'react';

import type { ApiError } from '../../api/api-client.ts';
import { useAssignDeviceMutation, useListingDeviationsQuery } from '../../api/inventory.api.ts';
import { useOpsStatusQuery } from '../../api/ops.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import { OutcomeUnknownBanner } from '../../components/patterns/OutcomeUnknownBanner.tsx';
import { bannerClassName, PageBanner } from '../../components/patterns/PageBanner.tsx';
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

// Texts of UI-005 `screen.md` and `default.png` (UI/UX design v0.6.1), the loading and error texts
// as in UI-004.
const TEXTS = {
  title: CONFIRMATION_TITLES['confirmation_required.variant_deviation'],
  hint: ERROR_MESSAGES['confirmation_required.variant_deviation'],
  attribute: 'Merkmal',
  deviceValue: 'Wert am Gerät',
  listingValue: 'Wert am Modell-Inserat',
  conditionDescription: 'Zustandsbeschreibung',
  device: 'Gerät',
  listing: 'Modell-Inserat',
  loading: 'Lade Modell-Inserate …',
  assignAnyway: 'Trotzdem zuordnen',
  newListing: 'Neues Modell-Inserat anlegen',
  cancel: 'Abbrechen',
  error: (referenceNumber: string | null) =>
    `Zuordnung fehlgeschlagen. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Dialog width of UI-005 in px (Technical Specification 2.0.10). */
const WIDTH = 800;

/** Rejections of "Trotzdem zuordnen" that UI-005 shows with their text, as UI-004 does (2.6). */
const DIALOG_REJECTIONS = new Set([
  'device_not_available',
  'already_assigned',
  'other_model_template',
]);

/** The device of UI-004 the dialog assigns. */
export interface DeviationDialogDevice {
  id: number;
  /** Version the user saw (2.0.3). */
  version: number;
  modelTemplateId: number;
}

export interface DeviationDialogProps {
  /** `details.deviations` of `variant_deviation`; `null` keeps the dialog closed. */
  deviations: VariantDeviationItem[] | null;
  device: DeviationDialogDevice;
  /** The model listing chosen in UI-004. */
  listingId: number;
  /** "Abbrechen" and Esc: back to UI-004, nothing is stored (DER-59-02). */
  onClose: () => void;
  /** After "Trotzdem zuordnen" (`200`): the calling screen closes UI-004 and shows the banner. */
  onAssigned: (assignment: DeviceAssignment) => void;
  /**
   * "Neues Modell-Inserat anlegen" (#201); without it the action is shown but not available.
   * Available only when the device deviates from every model listing of the model template.
   */
  onCreateListing?: () => void;
}

/**
 * Dialog UI-005 Kontext A "Abweichungen bei Zuordnung" (CU-135, REQ-018; Technical Specification
 * 2.6, 2.0.10): opens over UI-004 when "Zuordnen" answers `confirmation_required`/
 * `variant_deviation` and shows the hint, the deviations of that answer as table (Merkmal, Wert am
 * Gerät, Wert am Modell-Inserat) and both condition descriptions complete side by side.
 * "Trotzdem zuordnen" sends the assignment again with `confirmDeviation: true`; "Abbrechen" and
 * Esc return to UI-004. It reads the model listings with their deviations to the device
 * (`?deviceId=`), the data of UI-005 for "Neues Modell-Inserat anlegen". States: default,
 * loading and error as UI-004, conflict (P-05), unreachable (P-06), wird-beendet (P-07) and
 * ausgang-unbekannt (P-08). Kontext B (#191), "Umbuchen" (#202, #203) and the action
 * "Neues Modell-Inserat anlegen" (#201) follow.
 */
export function DeviationDialog({ deviations, ...props }: DeviationDialogProps) {
  const writesLocked = useWritesLocked();
  const assignMutation = useAssignDeviceMutation();
  // Esc and a click outside would hide the dialog while the write runs or after an unknown
  // outcome (P-08).
  const locked = assignMutation.isPending || writesLocked;

  return (
    <Dialog open={deviations !== null} onOpenChange={(open) => !open && props.onClose()}>
      {/* The content mounts per opening, so each opening starts without banner. */}
      <DialogContent width={WIDTH} dismissible={!locked}>
        {deviations !== null && (
          <DeviationContent
            {...props}
            deviations={deviations}
            writesLocked={writesLocked}
            pending={assignMutation.isPending}
            onAssign={(callbacks) =>
              assignMutation.mutate(
                {
                  deviceId: props.device.id,
                  body: {
                    version: props.device.version,
                    listingId: props.listingId,
                    confirmDeviation: true,
                  },
                },
                callbacks,
              )
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DeviationContentProps extends Omit<DeviationDialogProps, 'deviations'> {
  deviations: VariantDeviationItem[];
  writesLocked: boolean;
  pending: boolean;
  onAssign: (callbacks: {
    onSuccess: (assignment: DeviceAssignment) => void;
    onError: (error: ApiError) => void;
  }) => void;
}

/** Content of the dialog; mounted per opening. */
function DeviationContent({
  deviations,
  device,
  onClose,
  onAssigned,
  onCreateListing,
  writesLocked,
  pending,
  onAssign,
}: DeviationContentProps) {
  const targets = useListingDeviationsQuery(device.modelTemplateId, device.id);
  const [rejection, setRejection] = useState<string | null>(null);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // The overlay hides the banners of the frame and of UI-004, so P-06 stands in this dialog as
  // well (Nachtrag MAR-395): for the status of the frame, which it only reads, and its own list.
  const opsUnreachable = useOpsStatusQuery({ enabled: false }).error?.kind === 'unreachable';
  const unreachable = opsUnreachable || targets.error?.kind === 'unreachable';
  const readFailed = targets.error?.kind === 'unreachable' ? null : targets.error;
  const busy = pending || writesLocked;

  const description = deviations.find(({ key }) => key === 'conditionDescription');
  const rows = deviations.filter(({ key }) => key !== 'conditionDescription');
  // "Neues Modell-Inserat anlegen" needs variant data that differ from every model listing.
  const differsFromAll =
    targets.isSuccess && targets.data.items.every((item) => (item.deviations ?? []).length > 0);

  function assign() {
    if (busy) return;
    setRejection(null);
    setNotice(null);
    onAssign({
      onSuccess: onAssigned,
      onError: (error) => {
        if (error.kind === 'rejected' && DIALOG_REJECTIONS.has(error.error?.code ?? '')) {
          setRejection(error.error?.message ?? '');
          return;
        }
        setNotice(noticeOf(error));
      },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{TEXTS.title}</DialogTitle>
        <DialogDescription>{TEXTS.hint}</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <OutcomeUnknownBanner />
        {unreachable && <UnreachableBanner alwaysShow />}
        {readFailed && (
          <PageBanner variant="error" error={readFailed}>
            {TEXTS.error}
          </PageBanner>
        )}
        <SaveNoticeBanners
          notice={notice}
          onClose={() => setNotice(null)}
          onReloaded={() => setNotice(null)}
          errorText={TEXTS.error}
        />
        {rejection !== null && (
          <div role="alert" className={bannerClassName('error')}>
            {rejection}
          </div>
        )}
        {targets.isPending && !unreachable && (
          <p role="status" className="m-0 text-text-secondary">
            {TEXTS.loading}
          </p>
        )}
        {rows.length > 0 && (
          <Table aria-label={TEXTS.hint}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{TEXTS.attribute}</TableHead>
                <TableHead scope="col">{TEXTS.deviceValue}</TableHead>
                <TableHead scope="col">{TEXTS.listingValue}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((deviation) => (
                <TableRow key={deviation.key}>
                  <TableHead scope="row" className="text-text">
                    {deviation.label}
                  </TableHead>
                  <TableCell>{deviation.deviceValue}</TableCell>
                  <TableCell>{deviation.listingValue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {description && (
          <section aria-label={TEXTS.conditionDescription} className="flex flex-col gap-2">
            <h3 className="m-0 text-label font-semibold uppercase text-text-secondary">
              {TEXTS.conditionDescription}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                [TEXTS.device, description.deviceValue],
                [TEXTS.listing, description.listingValue],
              ].map(([label, text]) => (
                <div
                  key={label}
                  className="flex flex-col gap-1 rounded-control border border-border bg-bg p-3"
                >
                  <span className="text-label text-text-secondary">{label}</span>
                  {/* A long condition description wraps (UI-005 "Fenstergröße und Bedienung"). */}
                  <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" disabled={busy} onClick={onClose}>
          {TEXTS.cancel}
        </Button>
        <Button
          type="button"
          disabled={busy || onCreateListing === undefined || !differsFromAll}
          onClick={onCreateListing}
        >
          {TEXTS.newListing}
        </Button>
        <Button type="button" variant="primary" disabled={busy} onClick={assign}>
          {TEXTS.assignAnyway}
        </Button>
      </DialogFooter>
    </>
  );
}
