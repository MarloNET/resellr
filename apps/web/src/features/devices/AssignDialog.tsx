import { articleNumberSchema, type Listing } from '@resellr/domain/schemas/listing.schema';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import type { ApiError } from '../../api/api-client.ts';
import { useCreateListingMutation } from '../../api/inventory.api.ts';
import { useOpsStatusQuery } from '../../api/ops.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import { FormField, useFocusFirstError } from '../../components/forms/FormField.tsx';
import { OutcomeUnknownBanner } from '../../components/patterns/OutcomeUnknownBanner.tsx';
import { bannerClassName } from '../../components/patterns/PageBanner.tsx';
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

// Texts of UI-004 `screen.md` (UI/UX design v0.6.1).
const TEXTS = {
  title: 'Modell-Inserat wählen',
  device: 'Gerät',
  modelTemplate: 'Modellvorlage',
  empty: 'Für diese Modellvorlage gibt es noch kein Modell-Inserat.',
  articleNumber: 'Artikelnummer',
  newListing: 'Neues Modell-Inserat anlegen',
  cancel: 'Abbrechen',
  error: (referenceNumber: string | null) =>
    `Zuordnung fehlgeschlagen. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Dialog width of UI-004 in px (Technical Specification 2.0.10). */
const WIDTH = 720;

/** Rejections of `POST /api/listings` that UI-004 shows with their text in the dialog (2.6). */
const DIALOG_REJECTIONS = new Set([
  'variant_duplicate',
  'device_not_available',
  'already_assigned',
]);

/** The checked device the dialog works on (UI-004 "Gerät": WI-Nr and model template). */
export interface AssignDialogDevice {
  id: number;
  /** Version the user saw (2.0.3). */
  version: number;
  wiNr: string;
  /** Model name of the model template (`modelTemplateLabel`, Nachtrag MAR-1030). */
  modelTemplateLabel: string;
}

export interface AssignDialogProps {
  open: boolean;
  /** Called with `false` on "Abbrechen" and Esc: the device stays unassigned. */
  onOpenChange: (open: boolean) => void;
  device: AssignDialogDevice;
}

/** First message of the Zod check in the browser, the same schema as on the server (2.0.7). */
function checkArticleNumber(articleNumber: string): string | undefined {
  const result = articleNumberSchema.safeParse(articleNumber);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/**
 * Dialog UI-004 "Modell-Inserat wählen" (CU-134, REQ-017, REQ-019; Technical Specification 2.6,
 * 2.0.10) with the action "Neues Modell-Inserat anlegen" (#197): creates a model listing from the
 * checked device and opens it in UI-014. States: default and empty (no model listing of the model
 * template yet), validation (field "Artikelnummer" after `article_number_taken`, DER-60-04),
 * error, success (UI-014). The list of model listings and "Zuordnen" (#194), the rejection with
 * open review flags (#189) and the mode "umbuchen" (#202) follow.
 */
export function AssignDialog({ open, onOpenChange, device }: AssignDialogProps) {
  const createMutation = useCreateListingMutation();
  const writesLocked = useWritesLocked();
  const navigate = useNavigate();
  // Esc, a click outside and "Abbrechen" would hide the dialog while the write runs or after an
  // unknown outcome (P-08).
  const locked = createMutation.isPending || writesLocked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The content mounts per opening, so each opening starts without the field. */}
      <DialogContent width={WIDTH} dismissible={!locked}>
        <AssignForm
          device={device}
          pending={createMutation.isPending}
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
        />
      </DialogContent>
    </Dialog>
  );
}

interface AssignFormProps {
  device: AssignDialogDevice;
  pending: boolean;
  writesLocked: boolean;
  onCancel: () => void;
  onCreate: (
    articleNumber: string | undefined,
    callbacks: { onSuccess: (listing: Listing) => void; onError: (error: ApiError) => void },
  ) => void;
  onCreated: (listing: Listing) => void;
}

/** Content of the dialog; mounted per opening. */
function AssignForm({
  device,
  pending,
  writesLocked,
  onCancel,
  onCreate,
  onCreated,
}: AssignFormProps) {
  // `null` until the WI-Nr is taken as article number; then UI-004 shows the field (DER-60-04).
  const [articleNumber, setArticleNumber] = useState<string | null>(null);
  const [articleNumberError, setArticleNumberError] = useState<string | undefined>();
  const [rejection, setRejection] = useState<string | null>(null);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // The overlay hides the banners of the frame, so P-06 stands in the dialog as well (Nachtrag
  // MAR-395). It only reads the status of the frame.
  const unreachable = useOpsStatusQuery({ enabled: false }).error?.kind === 'unreachable';

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);

  function onFailed(error: ApiError, sent: string) {
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
    if (error.kind === 'rejected' && DIALOG_REJECTIONS.has(error.error?.code ?? '')) {
      setRejection(error.error?.message ?? '');
      return;
    }
    setNotice(noticeOf(error));
  }

  function submit() {
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
      onError: (error) => onFailed(error, articleNumber ?? device.wiNr),
    });
  }

  return (
    <form
      ref={formRef}
      noValidate
      aria-label={TEXTS.title}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{TEXTS.title}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <OutcomeUnknownBanner />
        {unreachable && <UnreachableBanner alwaysShow />}
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
        <p className="m-0 text-text-secondary">{TEXTS.empty}</p>
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
        <Button type="button" disabled={pending || writesLocked} onClick={onCancel}>
          {TEXTS.cancel}
        </Button>
        <Button type="submit" disabled={pending || writesLocked}>
          {TEXTS.newListing}
        </Button>
      </DialogFooter>
    </form>
  );
}
