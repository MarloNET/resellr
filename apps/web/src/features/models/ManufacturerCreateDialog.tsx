import {
  manufacturerNameSchema,
  type ManufacturerCreateResult,
} from '@resellr/domain/schemas/manufacturer.schema';
import { useRef, useState } from 'react';

import type { ApiError } from '../../api/api-client.ts';
import { useOpsStatusQuery } from '../../api/ops.api.ts';
import { useCreateManufacturerMutation } from '../../api/settings.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../components/forms/FormField.tsx';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/Dialog.tsx';
import { Input } from '../../components/ui/Input.tsx';

// Texts of UI-008 `screen.md` (UI/UX design v0.6.1).
const TEXTS = {
  title: 'Hersteller anlegen',
  name: 'Name des Herstellers',
  create: 'Hersteller anlegen',
  cancel: 'Abbrechen',
  existing: (name: string) => `${name} gibt es bereits und wird verwendet`,
  error: (referenceNumber: string | null) =>
    `Hersteller konnte nicht angelegt werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** Dialog width of UI-008 in px (Technical Specification 2.0.10). */
const WIDTH = 480;

export interface ManufacturerCreateDialogProps {
  open: boolean;
  /** Called with `false` on "Abbrechen" and Esc. */
  onOpenChange: (open: boolean) => void;
  /**
   * Answer of `POST /api/manufacturers`. With `existing: false` the caller closes the dialog and
   * chooses the new manufacturer; with `existing: true` the dialog stays open with its hint, and
   * the caller chooses the existing one (AC-REQ-100-02, DER-37-12).
   */
  onCreated: (result: ManufacturerCreateResult) => void;
}

/** First message of the Zod check in the browser, the same schema as on the server (2.0.7). */
function checkName(name: string): string | undefined {
  const result = manufacturerNameSchema.safeParse(name);
  return result.success ? undefined : result.error.issues[0]?.message;
}

/**
 * Dialog UI-008 "Hersteller anlegen" (CU-115, REQ-100; Technical Specification 2.2, 2.0.10):
 * the name of the new manufacturer. Opened from UI-031 (#158, Q-7) and from UI-007 with
 * "Neuen Hersteller anlegen" (#179, DER-50-06). States: validation, error, speichert and ausgang-unbekannt (P-08),
 * conflict (P-05), wird-beendet (P-07) (DER-37-13, DER-50-16). The inputs stay visible in each of them.
 */
export function ManufacturerCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: ManufacturerCreateDialogProps) {
  const createMutation = useCreateManufacturerMutation();
  const writesLocked = useWritesLocked();
  // Esc, a click outside and "Abbrechen" would hide the inputs while the write runs or after
  // an unknown outcome (P-08).
  const locked = createMutation.isPending || writesLocked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The content mounts per opening; the focus starts in the field. */}
      <DialogContent width={WIDTH} dismissible={!locked}>
        <CreateForm
          pending={createMutation.isPending}
          writesLocked={writesLocked}
          onCancel={() => onOpenChange(false)}
          onSubmit={(name, callbacks) => createMutation.mutate({ name }, callbacks)}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  );
}

interface CreateFormProps {
  pending: boolean;
  writesLocked: boolean;
  onCancel: () => void;
  onSubmit: (
    name: string,
    callbacks: {
      onSuccess: (result: ManufacturerCreateResult) => void;
      onError: (error: ApiError) => void;
    },
  ) => void;
  onCreated: (result: ManufacturerCreateResult) => void;
}

/** Content of the dialog; mounted per opening, so each opening starts empty. */
function CreateForm({ pending, writesLocked, onCancel, onSubmit, onCreated }: CreateFormProps) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [existingName, setExistingName] = useState<string | null>(null);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // The overlay hides the banners of the frame, so P-06 stands in the dialog as well
  // (addendum MAR-555, Nachtrag MAR-395). It only reads the status of the frame: a request of its
  // own would reset a status without data to loading.
  const unreachable = useOpsStatusQuery({ enabled: false }).error?.kind === 'unreachable';

  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  function showFieldError(message: string) {
    setNameError(message);
    focusFirstError();
  }

  function onFailed(error: ApiError) {
    const field =
      error.kind === 'validation'
        ? error.error?.fields.find((entry) => entry.path === 'name')
        : undefined;
    if (field) {
      showFieldError(field.message);
      return;
    }
    // "Hersteller <Name> ist deaktiviert" stands at the field (UI-008, DER-37-09).
    if (error.kind === 'rejected' && error.error?.code === 'manufacturer_deactivated') {
      showFieldError(error.error.message);
      return;
    }
    setNotice(noticeOf(error));
  }

  function submit() {
    blurCheck.cancel();
    const message = checkName(name);
    if (message) {
      showFieldError(message);
      return;
    }
    setNameError(undefined);
    setExistingName(null);
    setNotice(null);
    onSubmit(name, {
      onSuccess: (result) => {
        if (result.existing) setExistingName(result.name);
        onCreated(result);
      },
      onError: onFailed,
    });
  }

  return (
    <form
      ref={formRef}
      noValidate
      aria-label={TEXTS.title}
      className="flex min-h-0 flex-1 flex-col"
      onPointerDown={blurCheck.pressPointer}
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
        <FormField label={TEXTS.name} required error={nameError}>
          {(control) => (
            <Input
              {...control}
              // "Fokus im Feld" (UI-008), also when P-06 or P-08 with a button stands above it.
              autoFocus
              value={name}
              disabled={pending}
              onChange={(event) => {
                setName(event.target.value);
                setExistingName(null);
              }}
              onBlur={() => {
                const value = name;
                blurCheck.checkOnBlur(() => setNameError(checkName(value)));
              }}
            />
          )}
        </FormField>
        {existingName !== null && (
          <p role="status" className="m-0 text-body text-text-secondary">
            {TEXTS.existing(existingName)}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" disabled={pending || writesLocked} onClick={onCancel}>
          {TEXTS.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={pending || writesLocked}>
          {TEXTS.create}
        </Button>
      </DialogFooter>
    </form>
  );
}
