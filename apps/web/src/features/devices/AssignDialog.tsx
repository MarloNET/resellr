import {
  articleNumberSchema,
  type DeviceAssignment,
  type Listing,
  type ListingChoiceItem,
  type VariantSummary,
} from '@resellr/domain/schemas/listing.schema';
import { type RefObject, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import type { ApiError } from '../../api/api-client.ts';
import {
  useAssignDeviceMutation,
  useCreateListingMutation,
  useListingChoiceQuery,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/Dialog.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { RadioGroup } from '../../components/ui/RadioGroup.tsx';

// Texts of UI-004 `screen.md` (UI/UX design v0.6.1).
const TEXTS = {
  title: 'Modell-Inserat wählen',
  device: 'Gerät',
  modelTemplate: 'Modellvorlage',
  listings: 'Modell-Inserat',
  loading: 'Lade Modell-Inserate …',
  empty: 'Für diese Modellvorlage gibt es noch kein Modell-Inserat.',
  condition: 'Zustand',
  visualGrade: 'Optik-Note',
  conditionDescription: 'Zustandsbeschreibung',
  quantity: (quantity: number) => `Stückzahl ${quantity}`,
  articleNumber: 'Artikelnummer',
  assign: 'Zuordnen',
  chooseListing: 'Bitte ein Modell-Inserat wählen',
  newListing: 'Neues Modell-Inserat anlegen',
  cancel: 'Abbrechen',
  error: (referenceNumber: string | null) =>
    `Zuordnung fehlgeschlagen. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Banner of UI-004.success in the calling screen (UI-003, DER-58-04). */
export const assignedText = (wiNr: string, quantity: number) =>
  `Gerät ${wiNr} zugeordnet (Stückzahl ${quantity})`;

/** Dialog width of UI-004 in px (Technical Specification 2.0.10). */
const WIDTH = 720;

/**
 * Rejections of `POST /api/listings` and `POST /api/devices/{id}/assignment` that UI-004 shows
 * with their text in the dialog (2.6).
 */
const DIALOG_REJECTIONS = new Set([
  'variant_duplicate',
  'device_not_available',
  'already_assigned',
  'review_pending',
  'other_model_template',
]);

/**
 * Text of a rejection in the dialog; `review_pending` names the flagged values of `details.keys`
 * after "Erst Werte prüfen" (2.0.6, 7.3, AC-REQ-013-03), as UI-003 names them.
 */
function rejectionText(error: NonNullable<ApiError['error']>, fieldLabel: (key: string) => string) {
  const keys = error.details.keys;
  if (error.code !== 'review_pending' || !Array.isArray(keys) || keys.length === 0) {
    return error.message;
  }
  return `${error.message}: ${keys.map((key) => fieldLabel(String(key))).join(', ')}`;
}

/** The checked device the dialog works on (UI-004 "Gerät": WI-Nr and model template). */
export interface AssignDialogDevice {
  id: number;
  /** Version the user saw (2.0.3). */
  version: number;
  wiNr: string;
  /** The model template whose model listings UI-004 offers (REQ-017). */
  modelTemplateId: number;
  /** Model name of the model template (`modelTemplateLabel`, Nachtrag MAR-1030). */
  modelTemplateLabel: string;
}

export interface AssignDialogProps {
  open: boolean;
  /** Called with `false` on "Abbrechen" and Esc: the device stays unassigned. */
  onOpenChange: (open: boolean) => void;
  device: AssignDialogDevice;
  /**
   * Label of a review key (`condition`, `visualGrade` or an attribute ID) as the calling screen
   * names the field; names the flagged values of `review_pending` (AC-REQ-013-03).
   */
  fieldLabel: (key: string) => string;
  /**
   * After "Zuordnen" (`200`), before the dialog closes: the calling screen shows
   * `assignedText` with the new quantity (UI-004.success, DER-58-04).
   */
  onAssigned: (assignment: DeviceAssignment) => void;
  /**
   * Focus target after closing when the dialog opens only after a write of the calling screen,
   * which moved the focus to `<body>` meanwhile (CU-058, "Speichern und zuordnen" in UI-003).
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** The variant data of a model listing in one line (UI-004 "Liste Modell-Inserate"). */
function summaryText(summary: VariantSummary): string {
  return [
    `${TEXTS.condition}: ${summary.conditionLabel}`,
    `${TEXTS.visualGrade}: ${summary.visualGrade}`,
    ...(summary.conditionDescription === ''
      ? []
      : [`${TEXTS.conditionDescription}: ${summary.conditionDescription}`]),
    ...summary.variantValues.map(({ label, value }) => `${label}: ${value}`),
  ].join(' · ');
}

function ListingOption({ item }: { item: ListingChoiceItem }) {
  return (
    <span className="flex min-w-0 flex-col py-1">
      <span className="font-semibold">{item.displayTitle}</span>
      <span className="text-text-secondary [overflow-wrap:anywhere]">
        {summaryText(item.variantSummary)}
      </span>
      <span>{TEXTS.quantity(item.quantity)}</span>
    </span>
  );
}

/** First message of the Zod check in the browser, the same schema as on the server (2.0.7). */
function checkArticleNumber(articleNumber: string): string | undefined {
  const result = articleNumberSchema.safeParse(articleNumber);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/**
 * Dialog UI-004 "Modell-Inserat wählen" (CU-134, REQ-017, REQ-019; Technical Specification 2.6,
 * 2.0.10): lists the model listings of the model template of the checked device to choose by
 * radio button and assigns the device with "Zuordnen" (#194), or creates a model listing from it
 * and opens it in UI-014 (#197). States: loading, default, empty (no model listing of the model
 * template yet, only "Neues Modell-Inserat anlegen"), disabled ("Zuordnen" without a choice),
 * validation (field "Artikelnummer" after `article_number_taken`, DER-60-04), error, success
 * (`onAssigned`, UI-014), conflict (P-05), unreachable (P-06), wird-beendet (P-07) and
 * ausgang-unbekannt (P-08). A device with open review flags is rejected with "Erst Werte prüfen"
 * and the flagged values in the dialog (#189). The deviation dialog (#196) and the mode
 * "umbuchen" (#202) follow.
 */
export function AssignDialog({
  open,
  onOpenChange,
  device,
  fieldLabel,
  onAssigned,
  returnFocusRef,
}: AssignDialogProps) {
  const createMutation = useCreateListingMutation();
  const assignMutation = useAssignDeviceMutation();
  const writesLocked = useWritesLocked();
  const navigate = useNavigate();
  const pending = createMutation.isPending || assignMutation.isPending;
  // Esc, a click outside and "Abbrechen" would hide the dialog while the write runs or after an
  // unknown outcome (P-08).
  const locked = pending || writesLocked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The content mounts per opening, so each opening starts without choice and field. */}
      <DialogContent width={WIDTH} dismissible={!locked} returnFocusRef={returnFocusRef}>
        <AssignForm
          device={device}
          fieldLabel={fieldLabel}
          pending={pending}
          writesLocked={writesLocked}
          onCancel={() => onOpenChange(false)}
          onCreate={(articleNumber, callbacks) =>
            createMutation.mutate(
              {
                fromDeviceId: device.id,
                deviceVersion: device.version,
                ...(articleNumber !== undefined && { articleNumber }),
              },
              callbacks,
            )
          }
          onCreated={(listing) => {
            onOpenChange(false);
            void navigate(`/inserate/${listing.id}`);
          }}
          onAssign={(listingId, callbacks) =>
            assignMutation.mutate(
              {
                deviceId: device.id,
                body: { version: device.version, listingId, confirmDeviation: false },
              },
              callbacks,
            )
          }
          onAssigned={(assignment) => {
            onAssigned(assignment);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface Callbacks<T> {
  onSuccess: (result: T) => void;
  onError: (error: ApiError) => void;
}

interface AssignFormProps {
  device: AssignDialogDevice;
  fieldLabel: (key: string) => string;
  pending: boolean;
  writesLocked: boolean;
  onCancel: () => void;
  onCreate: (articleNumber: string | undefined, callbacks: Callbacks<Listing>) => void;
  onCreated: (listing: Listing) => void;
  onAssign: (listingId: number, callbacks: Callbacks<DeviceAssignment>) => void;
  onAssigned: (assignment: DeviceAssignment) => void;
}

/** Content of the dialog; mounted per opening. */
function AssignForm({
  device,
  fieldLabel,
  pending,
  writesLocked,
  onCancel,
  onCreate,
  onCreated,
  onAssign,
  onAssigned,
}: AssignFormProps) {
  const choice = useListingChoiceQuery(device.modelTemplateId);
  const items = choice.data?.items ?? [];
  const [listingId, setListingId] = useState<number | null>(null);
  // `null` until the WI-Nr is taken as article number; then UI-004 shows the field (DER-60-04).
  const [articleNumber, setArticleNumber] = useState<string | null>(null);
  const [articleNumberError, setArticleNumberError] = useState<string | undefined>();
  const [rejection, setRejection] = useState<string | null>(null);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // The overlay hides the banners of the frame, so P-06 stands in the dialog as well (Nachtrag
  // MAR-395): for the status of the frame, which it only reads, and for the list of the dialog.
  const opsUnreachable = useOpsStatusQuery({ enabled: false }).error?.kind === 'unreachable';
  const unreachable = opsUnreachable || choice.error?.kind === 'unreachable';
  const readFailed = choice.error?.kind === 'unreachable' ? null : choice.error;

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const busy = pending || writesLocked;

  function showRejection(error: ApiError) {
    if (error.kind === 'rejected' && error.error && DIALOG_REJECTIONS.has(error.error.code)) {
      setRejection(rejectionText(error.error, fieldLabel));
      return;
    }
    setNotice(noticeOf(error));
  }

  function onCreateFailed(error: ApiError, sent: string) {
    if (error.kind === 'rejected' && error.error?.code === 'article_number_taken') {
      setArticleNumber(sent);
      setArticleNumberError(error.error.message);
      focusFirstError();
      return;
    }
    const field =
      error.kind === 'validation'
        ? error.error?.fields.find((entry) => entry.path === 'articleNumber')
        : undefined;
    if (field) {
      setArticleNumberError(field.message);
      focusFirstError();
      return;
    }
    showRejection(error);
  }

  function create() {
    if (busy) return;
    if (articleNumber !== null) {
      const message = checkArticleNumber(articleNumber);
      if (message) {
        setArticleNumberError(message);
        focusFirstError();
        return;
      }
    }
    setArticleNumberError(undefined);
    setRejection(null);
    setNotice(null);
    onCreate(articleNumber ?? undefined, {
      onSuccess: onCreated,
      onError: (error) => onCreateFailed(error, articleNumber ?? device.wiNr),
    });
  }

  function assign() {
    // "Zuordnen" is deactivated without a choice (UI-004.disabled).
    if (busy || listingId === null) return;
    setRejection(null);
    setNotice(null);
    onAssign(listingId, { onSuccess: onAssigned, onError: showRejection });
  }

  // Enter = "Zuordnen" (UI-004 "Fenstergröße und Bedienung"); in the empty state and once the
  // field "Artikelnummer" of the creation shows, Enter creates the model listing.
  const enterAssigns = items.length > 0 && articleNumber === null;
  const assignReason = listingId === null ? TEXTS.chooseListing : undefined;

  return (
    <form
      ref={formRef}
      noValidate
      aria-label={TEXTS.title}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (enterAssigns) assign();
        else create();
      }}
    >
      <DialogHeader>
        <DialogTitle>{TEXTS.title}</DialogTitle>
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
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-label font-semibold">{TEXTS.device}</dt>
          <dd className="m-0">{device.wiNr}</dd>
          <dt className="text-label font-semibold">{TEXTS.modelTemplate}</dt>
          <dd className="m-0">{device.modelTemplateLabel}</dd>
        </dl>
        {choice.isPending ? (
          !unreachable && (
            <p role="status" className="m-0 text-text-secondary">
              {TEXTS.loading}
            </p>
          )
        ) : items.length > 0 ? (
          <RadioGroup
            legend={TEXTS.listings}
            value={listingId === null ? '' : String(listingId)}
            options={items.map((item) => ({
              value: String(item.id),
              label: <ListingOption item={item} />,
            }))}
            disabled={busy}
            onChange={(value) => setListingId(Number(value))}
          />
        ) : (
          choice.isSuccess && <p className="m-0 text-text-secondary">{TEXTS.empty}</p>
        )}
        {articleNumber !== null && (
          <FormField label={TEXTS.articleNumber} required error={articleNumberError}>
            {(control) => (
              <Input
                {...control}
                value={articleNumber}
                disabled={pending}
                onChange={(event) => {
                  setArticleNumber(event.target.value);
                  setArticleNumberError(undefined);
                }}
              />
            )}
          </FormField>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" disabled={busy} onClick={onCancel}>
          {TEXTS.cancel}
        </Button>
        <Button
          type={enterAssigns ? 'button' : 'submit'}
          disabled={busy}
          onClick={enterAssigns ? create : undefined}
        >
          {TEXTS.newListing}
        </Button>
        {items.length > 0 && (
          // Deactivated without a choice, with the reason as tooltip (UI-004.disabled, 2.0.7).
          <span title={assignReason}>
            <Button
              type={enterAssigns ? 'submit' : 'button'}
              variant="primary"
              disabled={busy || listingId === null}
              title={assignReason}
              onClick={enterAssigns ? undefined : assign}
            >
              {TEXTS.assign}
            </Button>
          </span>
        )}
      </DialogFooter>
    </form>
  );
}
