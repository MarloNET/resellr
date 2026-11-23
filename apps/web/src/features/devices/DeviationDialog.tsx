import { CONFIRMATION_TITLES, ERROR_MESSAGES } from '@resellr/domain/messages/messages.de';
import {
  articleNumberSchema,
  type Device,
  type DeviceUpdateInput,
} from '@resellr/domain/schemas/device.schema';
import type {
  DeviceAssignment,
  DeviceRebooking,
  ListingChoiceItem,
  VariantDeviationDetails,
  VariantDeviationItem,
} from '@resellr/domain/schemas/listing.schema';
import { useRef, useState } from 'react';

import type { ApiError } from '../../api/api-client.ts';
import {
  useAssignDeviceMutation,
  useListingDeviationsQuery,
  useRebookDeviceMutation,
  useUpdateDeviceMutation,
} from '../../api/inventory.api.ts';
import { useOpsStatusQuery } from '../../api/ops.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import { FormField, useFocusFirstError } from '../../components/forms/FormField.tsx';
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
import { Input } from '../../components/ui/Input.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/Table.tsx';
import { RadioGroup } from '../../components/ui/RadioGroup.tsx';
import { ListingOption } from './AssignDialog.tsx';

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
  keepAssignment: 'Zuordnung behalten',
  rebook: 'Umbuchen',
  newListing: 'Neues Modell-Inserat anlegen',
  rebookTargets: 'Anderes Modell-Inserat derselben Modellvorlage',
  noOtherListing: 'Kein anderes Modell-Inserat dieser Modellvorlage',
  articleNumber: 'Artikelnummer',
  cancel: 'Abbrechen',
  error: (referenceNumber: string | null) =>
    `Zuordnung fehlgeschlagen. Referenz: ${referenceNumber ?? '–'}`,
  saveError: (referenceNumber: string | null) =>
    `Speichern nicht möglich. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Dialog width of UI-005 in px (Technical Specification 2.0.10). */
const WIDTH = 800;

/** Rejections of "Trotzdem zuordnen" that UI-005 shows with their text, as UI-004 does (2.6). */
const DIALOG_REJECTIONS = new Set([
  'device_not_available',
  'device_not_assigned',
  'already_assigned',
  'other_model_template',
]);

/** The device of UI-004 the dialog assigns. */
export interface DeviationDialogDevice {
  id: number;
  /** First value of the field "Artikelnummer" after `article_number_taken` (Kontext B, 2.5). */
  wiNr: string;
  /** Version the user saw (2.0.3). */
  version: number;
  modelTemplateId: number;
}

interface CommonProps {
  device: DeviationDialogDevice;
  /** "Abbrechen" and Esc: back to the calling screen, nothing is stored (DER-59-02). */
  onClose: () => void;
}

/** Kontext A: "Zuordnen" of UI-004 answered `variant_deviation` (REQ-018). */
interface AssignmentProps extends CommonProps {
  /** `details.deviations` of `variant_deviation`; `null` keeps the dialog closed. */
  deviations: VariantDeviationItem[] | null;
  /** The model listing chosen in UI-004. */
  listingId: number;
  /** After "Trotzdem zuordnen" (`200`): the calling screen closes UI-004 and shows the banner. */
  onAssigned: (assignment: DeviceAssignment) => void;
  /**
   * The model listing of an already assigned device: then "Umbuchen" (REQ-020) offers the other
   * model listings of the model template; without it the device is not assigned and the action is
   * not shown.
   */
  assignedListingId?: number;
  /** After "Umbuchen" (`200`): the calling screen opens UI-014 of the target (DER-61-06). */
  onRebooked?: (rebooking: DeviceRebooking) => void;
  /**
   * "Neues Modell-Inserat anlegen" (#201): the calling dialog closes UI-005 and creates the model
   * listing as UI-004, with its rejections, and opens it in UI-014 (UI-005 "wie UI-004"). Without
   * it the action is shown but not available; available only when the device deviates from every
   * model listing of the model template (`variant_duplicate` otherwise, AC-REQ-019-02).
   */
  onCreateListing?: () => void;
  keep?: never;
}

/**
 * Kontext B: "Gerätewerte speichern" of an assigned device answered `variant_deviation` (REQ-014;
 * 2.5); `null` keeps the dialog closed.
 */
export interface KeepAssignment {
  /** `details` of the answer: the deviations and the rebook targets. */
  details: VariantDeviationDetails;
  /** The request of "Gerätewerte speichern", sent again with `deviationDecision: keep`. */
  body: DeviceUpdateInput;
  /** After "Zuordnung behalten" (`200`): the calling screen takes the stored device. */
  onKept: (device: Device) => void;
  /**
   * After "Neues Modell-Inserat anlegen" (`200`, `deviationDecision: new_listing`): the device is
   * assigned to the new model listing, which the calling screen opens in UI-014 (#201).
   */
  onListingCreated: (device: Device) => void;
  /**
   * A rejection the form of the calling screen shows (field rules, deactivated values, sold
   * meanwhile): the dialog closes and hands it over.
   */
  onRejected: (error: ApiError) => void;
  /**
   * After "Neu laden" of P-05 in the dialog has loaded the data again: the calling screen closes
   * the dialog and takes the device read again (T-1), as Kontext A shows P-05 in the dialog.
   */
  onReloaded: () => void;
}

interface KeepProps extends CommonProps {
  keep: KeepAssignment | null;
  deviations?: never;
  listingId?: never;
  onAssigned?: never;
  assignedListingId?: never;
  onRebooked?: never;
  onCreateListing?: never;
}

export type DeviationDialogProps = AssignmentProps | KeepProps;

/**
 * Errors of "Zuordnung behalten" the form of the calling screen shows (2.5); P-05 stays in the
 * dialog as in Kontext A.
 */
const FORM_ERRORS = new Set<ApiError['kind']>(['validation', 'rejected']);

/** First message of the Zod check in the browser, the same schema as on the server (2.0.7). */
function checkArticleNumber(articleNumber: string): string | undefined {
  const result = articleNumberSchema.safeParse(articleNumber);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/**
 * Dialog UI-005 "Abweichungen bei Zuordnung" (CU-135, REQ-018, REQ-014; Technical Specification
 * 2.5, 2.6, 2.0.10) shows the hint, the deviations of the answer as table (Merkmal, Wert am
 * Gerät, Wert am Modell-Inserat) and both condition descriptions complete side by side.
 * Kontext A opens over UI-004 when "Zuordnen" answers `confirmation_required`/
 * `variant_deviation`: "Trotzdem zuordnen" sends the assignment again with
 * `confirmDeviation: true`; it reads the model listings with their deviations to the device
 * (`?deviceId=`), the data of UI-005 for "Neues Modell-Inserat anlegen", loading and error as
 * UI-004. Kontext B opens over UI-010 when "Gerätewerte speichern" of an assigned device answers
 * so: "Zuordnung behalten" sends the same request with `deviationDecision: keep`, a technical
 * error shows "Speichern nicht möglich. Referenz: <Nr>" (DER-56-05); the data for "Neues
 * Modell-Inserat anlegen" and "Umbuchen" are the rebook targets of the answer, as the stored
 * device differs from the changed one; "Neues Modell-Inserat anlegen" sends the same request with
 * `deviationDecision: new_listing` and hands the device assigned to the new model listing over
 * (#201); after `article_number_taken` the field "Artikelnummer" shows below the table as in
 * UI-004 and the action sends `articleNumber` with it (2.5, DG-22, Nachtrag MAR-1248). In Kontext A that action goes to `onCreateListing` of UI-004. "Abbrechen" and Esc return
 * to the calling screen. States: default, error, conflict (P-05), unreachable (P-06),
 * wird-beendet (P-07) and ausgang-unbekannt (P-08). In Kontext A for an already assigned device
 * "Umbuchen" (#202, REQ-020) opens in the dialog the choice of the other model listings of the
 * model template (title, variant data, quantity) with the button "Umbuchen", which sends
 * `POST /api/devices/{id}/rebooking` without confirmation; without another model listing the
 * action is not available and the hint "Kein anderes Modell-Inserat dieser Modellvorlage" shows
 * (DER-61-02). "Umbuchen" in Kontext B and the second step of "Umbuchen" (#203) follow.
 */
export function DeviationDialog(props: DeviationDialogProps) {
  const writesLocked = useWritesLocked();
  const assignMutation = useAssignDeviceMutation();
  const updateMutation = useUpdateDeviceMutation(props.device.id);
  const rebookMutation = useRebookDeviceMutation();
  const pending = assignMutation.isPending || updateMutation.isPending || rebookMutation.isPending;
  // Esc and a click outside would hide the dialog while the write runs or after an unknown
  // outcome (P-08).
  const locked = pending || writesLocked;
  const deviations = props.keep === undefined ? props.deviations : props.keep?.details.deviations;
  const open = deviations !== null && deviations !== undefined;

  function confirm(callbacks: Callbacks) {
    if (props.keep === undefined) {
      const { device, listingId, onAssigned } = props;
      assignMutation.mutate(
        {
          deviceId: device.id,
          body: { version: device.version, listingId, confirmDeviation: true },
        },
        {
          onSuccess: onAssigned,
          onError: (error) => {
            if (error.kind === 'rejected' && DIALOG_REJECTIONS.has(error.error?.code ?? '')) {
              callbacks.onRejection(error.error?.message ?? '');
              return;
            }
            callbacks.onError(error);
          },
        },
      );
      return;
    }
    decide('keep', callbacks);
  }

  /**
   * Kontext B: the second `PATCH` with the decision of UI-005 (2.5). For `new_listing` UI-005 shows
   * the rejections of the creation as UI-004 (2.6, UI-005 "Ablehnung wie UI-004"):
   * `variant_duplicate` with its text, `article_number_taken` and a field error of the server at
   * `articleNumber` at the field "Artikelnummer" (Nachtrag MAR-1248); the other errors go as for
   * "Zuordnung behalten".
   */
  function decide(decision: 'keep' | 'new_listing', callbacks: Callbacks, articleNumber?: string) {
    const keep = props.keep;
    if (keep === null || keep === undefined) return;
    updateMutation.mutate(
      {
        ...keep.body,
        deviationDecision: decision,
        ...(articleNumber !== undefined && { articleNumber }),
      },
      {
        onSuccess: decision === 'keep' ? keep.onKept : keep.onListingCreated,
        onError: (error) => {
          if (decision === 'new_listing') {
            const code = error.kind === 'rejected' ? error.error?.code : undefined;
            if (code === 'variant_duplicate') {
              callbacks.onRejection(error.error?.message ?? '');
              return;
            }
            const field =
              error.kind === 'validation'
                ? error.error?.fields.find((entry) => entry.path === 'articleNumber')
                : undefined;
            if (code === 'article_number_taken' || field) {
              callbacks.onArticleNumberError?.(field?.message ?? error.error?.message ?? '');
              return;
            }
          }
          if (FORM_ERRORS.has(error.kind)) {
            keep.onRejected(error);
            return;
          }
          callbacks.onError(error);
        },
      },
    );
  }

  function rebook(targetListingId: number, callbacks: Callbacks) {
    if (props.keep !== undefined) return;
    const { device, onRebooked } = props;
    rebookMutation.mutate(
      {
        deviceId: device.id,
        body: { version: device.version, targetListingId, confirmDeviation: false },
      },
      {
        onSuccess: (rebooking) => onRebooked?.(rebooking),
        onError: (error) => {
          // A deviating target (`target_deviation`) shows its text until the second step (#203).
          if (
            (error.kind === 'rejected' && DIALOG_REJECTIONS.has(error.error?.code ?? '')) ||
            (error.kind === 'confirmation-required' &&
              error.error?.details?.kind === 'target_deviation')
          ) {
            callbacks.onRejection(error.error?.message ?? '');
            return;
          }
          callbacks.onError(error);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && props.onClose()}>
      {/* The content mounts per opening, so each opening starts without banner. */}
      <DialogContent width={WIDTH} dismissible={!locked}>
        {open &&
          (props.keep === undefined ? (
            <AssignmentContent
              deviations={deviations}
              device={props.device}
              onClose={props.onClose}
              onCreateListing={props.onCreateListing && (() => props.onCreateListing?.())}
              wiNr={props.device.wiNr}
              assignedListingId={props.assignedListingId}
              busy={locked}
              onConfirm={confirm}
              onRebook={rebook}
            />
          ) : (
            <DeviationContent
              context="device_values"
              deviations={deviations}
              onClose={props.onClose}
              onCreateListing={(callbacks, articleNumber) =>
                decide('new_listing', callbacks, articleNumber)
              }
              wiNr={props.device.wiNr}
              // The changed device against every model listing: the assigned one deviates.
              differsFromAll={(props.keep?.details.rebookTargets ?? []).every(
                (target) => target.deviations.length > 0,
              )}
              busy={locked}
              onConfirm={confirm}
              onReloaded={props.keep?.onReloaded}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}

interface Callbacks {
  /** A rejection the dialog shows with its text (Kontext A, as UI-004). */
  onRejection: (message: string) => void;
  /** Any other error: the banners of P-05 to P-07 or `.error`. */
  onError: (error: ApiError) => void;
  /** `article_number_taken` or a field error at `articleNumber` (Kontext B, Nachtrag MAR-1248). */
  onArticleNumberError?: (message: string) => void;
}

/** Kontext A: the deviations and the model listings with their deviations to the stored device. */
function AssignmentContent({
  device,
  assignedListingId,
  onRebook,
  ...props
}: Omit<DeviationContentProps, 'context' | 'differsFromAll' | 'readState' | 'rebook'> & {
  device: DeviationDialogDevice;
  assignedListingId?: number;
  onRebook: (targetListingId: number, callbacks: Callbacks) => void;
}) {
  const targets = useListingDeviationsQuery(device.modelTemplateId, device.id);
  return (
    <DeviationContent
      {...props}
      context="assignment"
      readState={targets}
      // "Neues Modell-Inserat anlegen" needs variant data that differ from every model listing.
      differsFromAll={
        targets.isSuccess && targets.data.items.every((item) => (item.deviations ?? []).length > 0)
      }
      // "Umbuchen" only for an assigned device, to another model listing of the model template.
      rebook={
        assignedListingId === undefined
          ? undefined
          : {
              targets: (targets.data?.items ?? []).filter(({ id }) => id !== assignedListingId),
              loaded: targets.isSuccess,
              onRebook,
            }
      }
    />
  );
}

interface DeviationContentProps {
  context: 'assignment' | 'device_values';
  deviations: VariantDeviationItem[];
  onClose: () => void;
  /**
   * "Neues Modell-Inserat anlegen" with the article number of the field, once shown; without it
   * the action is shown but not available.
   */
  onCreateListing?: (callbacks: Callbacks, articleNumber?: string) => void;
  /** The WI-Nr of the device, the article number sent first. */
  wiNr: string;
  /** The list read for Kontext A (loading, error, P-06); none in Kontext B. */
  readState?: Pick<ReturnType<typeof useListingDeviationsQuery>, 'isPending' | 'error'>;
  differsFromAll: boolean;
  busy: boolean;
  onConfirm: (callbacks: Callbacks) => void;
  /** After "Neu laden" of P-05 (Kontext B); without it the dialog only hides the banner. */
  onReloaded?: () => void;
  /** "Umbuchen" of an assigned device (Kontext A); without it the action is not shown. */
  rebook?: {
    /** The other model listings of the model template. */
    targets: ListingChoiceItem[];
    /** Whether the list is read, so an empty list means no other model listing. */
    loaded: boolean;
    onRebook: (targetListingId: number, callbacks: Callbacks) => void;
  };
}

/** Content of the dialog; mounted per opening. */
function DeviationContent({
  context,
  deviations,
  onClose,
  onCreateListing,
  wiNr,
  readState,
  differsFromAll,
  busy,
  onConfirm,
  onReloaded,
  rebook,
}: DeviationContentProps) {
  const [rejection, setRejection] = useState<string | null>(null);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // `null` until the article number sent is taken (Kontext B); then UI-005 shows the field
  // "Artikelnummer" as UI-004 until it closes (2.5, DG-22, Nachtrag MAR-1248).
  const [articleNumber, setArticleNumber] = useState<string | null>(null);
  const [articleNumberError, setArticleNumberError] = useState<string | undefined>();
  const fieldRef = useRef<HTMLDivElement>(null);
  const focusFirstError = useFocusFirstError(fieldRef);
  // The overlay hides the banners of the frame and of the calling screen, so P-06 stands in this
  // dialog as well (Nachtrag MAR-395): for the status of the frame, which it only reads, and its
  // own list.
  const opsUnreachable = useOpsStatusQuery({ enabled: false }).error?.kind === 'unreachable';
  const unreachable = opsUnreachable || readState?.error?.kind === 'unreachable';
  const readFailed = readState?.error?.kind === 'unreachable' ? null : readState?.error;
  const errorText = context === 'assignment' ? TEXTS.error : TEXTS.saveError;

  const description = deviations.find(({ key }) => key === 'conditionDescription');
  const rows = deviations.filter(({ key }) => key !== 'conditionDescription');
  const otherListings = rebook?.targets ?? [];
  const noOtherListing = rebook !== undefined && rebook.loaded && otherListings.length === 0;
  // The choice of the target opens with "Umbuchen" in the footer.
  const [choosingTarget, setChoosingTarget] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);

  /** Sends an action of the dialog; its rejection or error replaces the previous banner. */
  function send(action: (callbacks: Callbacks) => void) {
    if (busy) return;
    setRejection(null);
    setNotice(null);
    action({ onRejection: setRejection, onError: (error) => setNotice(noticeOf(error)) });
  }

  /** "Neues Modell-Inserat anlegen": with the field, its rule is checked before sending. */
  function create() {
    if (busy || onCreateListing === undefined || !differsFromAll) return;
    if (articleNumber !== null) {
      const message = checkArticleNumber(articleNumber);
      if (message) {
        setArticleNumberError(message);
        focusFirstError();
        return;
      }
    }
    const sent = articleNumber ?? wiNr;
    setArticleNumberError(undefined);
    send((callbacks) =>
      onCreateListing(
        {
          ...callbacks,
          onArticleNumberError: (message) => {
            setArticleNumber(sent);
            setArticleNumberError(message);
            focusFirstError();
          },
        },
        articleNumber ?? undefined,
      ),
    );
  }

  function rebookTo() {
    if (busy || rebook === undefined || targetId === null) return;
    setRejection(null);
    setNotice(null);
    rebook.onRebook(targetId, {
      onRejection: setRejection,
      onError: (error) => setNotice(noticeOf(error)),
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
          onReloaded={() => {
            setNotice(null);
            onReloaded?.();
          }}
          errorText={errorText}
        />
        {rejection !== null && (
          <div role="alert" className={bannerClassName('error')}>
            {rejection}
          </div>
        )}
        {readState?.isPending && !unreachable && (
          <p role="status" className="m-0 text-text-secondary">
            {TEXTS.loading}
          </p>
        )}
        {rows.length > 0 && (
          // The scroll container of the table must not shrink in the scrolling body (FM-4).
          <div className="shrink-0">
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
          </div>
        )}
        {description && (
          <section aria-label={TEXTS.conditionDescription} className="flex flex-col gap-2">
            <h3 className="m-0 text-label font-semibold uppercase text-text-secondary">
              {TEXTS.conditionDescription}
            </h3>
            <div className="grid grid-cols-1 gap-4 full:grid-cols-2">
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
        {articleNumber !== null && (
          <div ref={fieldRef}>
            <FormField label={TEXTS.articleNumber} required error={articleNumberError}>
              {(control) => (
                <Input
                  {...control}
                  value={articleNumber}
                  disabled={busy}
                  onChange={(event) => {
                    setArticleNumber(event.target.value);
                    setArticleNumberError(undefined);
                  }}
                  // Enter = "Neues Modell-Inserat anlegen" (2.5); the field is in no form of its own.
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    create();
                  }}
                />
              )}
            </FormField>
          </div>
        )}
        {choosingTarget && (
          <section aria-label={TEXTS.rebookTargets} className="flex flex-col gap-3">
            <RadioGroup
              legend={TEXTS.rebookTargets}
              value={targetId === null ? '' : String(targetId)}
              options={otherListings.map((item) => ({
                value: String(item.id),
                label: <ListingOption item={item} />,
              }))}
              disabled={busy}
              onChange={(value) => setTargetId(Number(value))}
            />
            <Button
              type="button"
              variant="primary"
              className="self-end"
              disabled={busy || targetId === null}
              onClick={rebookTo}
            >
              {TEXTS.rebook}
            </Button>
          </section>
        )}
        {noOtherListing && <p className="m-0 text-text-secondary">{TEXTS.noOtherListing}</p>}
      </DialogBody>
      <DialogFooter>
        {rebook !== undefined && !choosingTarget && (
          // A secondary button at the left of the footer (`screen.md`, position as in `default.png`);
          // not available without another model listing of the model template (DER-61-02).
          <Button
            type="button"
            className="mr-auto"
            disabled={busy || otherListings.length === 0}
            title={noOtherListing ? TEXTS.noOtherListing : undefined}
            onClick={() => setChoosingTarget(true)}
          >
            {TEXTS.rebook}
          </Button>
        )}
        <Button type="button" disabled={busy} onClick={onClose}>
          {TEXTS.cancel}
        </Button>
        {context === 'device_values' && (
          // "Umbuchen" with the rebook targets follows with #203; until then not available.
          <Button type="button" disabled>
            {TEXTS.rebook}
          </Button>
        )}
        <Button
          type="button"
          disabled={busy || onCreateListing === undefined || !differsFromAll}
          onClick={create}
        >
          {TEXTS.newListing}
        </Button>
        <Button type="button" variant="primary" disabled={busy} onClick={() => send(onConfirm)}>
          {context === 'assignment' ? TEXTS.assignAnyway : TEXTS.keepAssignment}
        </Button>
      </DialogFooter>
    </>
  );
}
