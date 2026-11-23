import { MESSAGES } from '@resellr/domain/messages/messages.de';
import type { Attribute } from '@resellr/domain/schemas/attribute.schema';
import {
  type AttributeValue,
  type AttributeValues,
  mergeAttributeValues,
} from '@resellr/domain/schemas/attribute-values.schema';
import {
  type Device,
  type DeviceDetail,
  type DeviceUpdateInput,
  deviceValuesSchema,
} from '@resellr/domain/schemas/device.schema';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import type { ApiError } from '../../api/api-client.ts';
import { useModelTemplateQuery } from '../../api/catalog.api.ts';
import {
  useDeviceQuery,
  useUpdateDeviceMutation,
  variantDeviationDetailsOf,
} from '../../api/inventory.api.ts';
import { queryKeys } from '../../api/query-keys.ts';
import {
  useAttributesQuery,
  usePickListsQuery,
  usePickListValuesQuery,
} from '../../api/settings.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import {
  AttributeFieldsForm,
  type AttributeInputs,
  attributeRequestValues,
  attributesOfLevel,
} from '../../components/forms/AttributeFieldsForm.tsx';
import {
  attributeInputOf,
  type AttributeInputValue,
} from '../../components/forms/AttributeInput.tsx';
import {
  choiceOptions,
  findMissingListChoices,
} from '../../components/forms/deactivated-choice.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../components/forms/FormField.tsx';
import { OutcomeUnknownBanner } from '../../components/patterns/OutcomeUnknownBanner.tsx';
import { bannerClassName, PageBanner } from '../../components/patterns/PageBanner.tsx';
import {
  noticeOf,
  SaveNoticeBanners,
  type SaveNotice,
} from '../../components/patterns/SaveNoticeBanners.tsx';
import { UnreachableBanner } from '../../components/patterns/UnreachableBanner.tsx';
import { Badge, type BadgeVariant } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import {
  attributeErrors,
  batteryCapacityShown,
  CARD,
  CARD_HEADING,
  capacityAttribute,
  type DeviceAttributes,
  deviceValueChoices,
  droppedAfterReload,
  idOf,
  isDeactivatedValueAt,
  ModelDataPanel,
  optionValue,
  portListIds,
  reloadPickListValues,
  ReviewMark,
  shownAttributes,
  TEXT_AREA_CLASS,
  TEXTS as VALUE_TEXTS,
  valuePath,
  withCapacityOfBattery,
  withoutMissingChoices,
} from './DeviceIntakePage.tsx';
import { AssignDialog } from './AssignDialog.tsx';
import { CAPTURE_STATUS_LABELS, STOCK_STATUS_LABELS, UNASSIGNED_TEXT } from './DevicesPage.tsx';
import { DeviationDialog, type KeepAssignment } from './DeviationDialog.tsx';

// Texts of UI-010 `screen.md` (UI/UX design v0.6.1); "geladen" for opening (DER-54-10). The
// device values use the texts of UI-003, as UI-010 shows the same form (DER-56-01).
const TEXTS = {
  title: 'Gerät',
  head: 'Gerätekopf',
  modelTemplate: 'Modellvorlage',
  listing: 'Modell-Inserat',
  stockStatus: 'Bestandsstatus',
  captureStatus: 'Erfassungsstatus',
  loading: 'Lade Gerät …',
  loadError: (referenceNumber: string | null) =>
    `Gerät konnte nicht geladen werden. Referenz: ${referenceNumber ?? '–'}`,
  save: 'Gerätewerte speichern',
  saving: 'Speichern …',
  saved: 'Gerät gespeichert',
  saveError: (referenceNumber: string | null) =>
    `Gerät konnte nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
  readOnly: 'Werte schreibgeschützt',
  rebook: 'Umbuchen',
} as const;

const STOCK_STATUS_CHIPS: Record<DeviceDetail['stockStatus'], BadgeVariant> = {
  available: 'published',
  sold: 'approved',
  cancelled: 'draft',
};

const CAPTURE_STATUS_CHIPS: Record<DeviceDetail['captureStatus'], BadgeVariant> = {
  checked: 'published',
  review_pending: 'warn',
};

/** The id of the address, `null` for one that is no id (then the server is not asked). */
function deviceIdOf(param: string | undefined): number | null {
  const id = Number(param);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Head of UI-010: WI-Nr, model template, model listing as link or "nicht zugeordnet", chips. */
function DeviceHead({ device }: { device: DeviceDetail }) {
  return (
    <dl aria-label={TEXTS.head} className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
      <dt className="text-label text-text-secondary">{TEXTS.modelTemplate}</dt>
      <dd className="m-0 text-body">{device.modelTemplateLabel}</dd>
      <dt className="text-label text-text-secondary">{TEXTS.listing}</dt>
      <dd className="m-0 text-body">
        {device.listing === null ? (
          UNASSIGNED_TEXT
        ) : (
          <Link to={`/inserate/${device.listing.id}`} className="text-primary">
            {device.listing.title}
          </Link>
        )}
      </dd>
      <dt className="text-label text-text-secondary">{TEXTS.stockStatus}</dt>
      <dd className="m-0">
        <Badge variant={STOCK_STATUS_CHIPS[device.stockStatus]}>
          {STOCK_STATUS_LABELS[device.stockStatus]}
        </Badge>
      </dd>
      <dt className="text-label text-text-secondary">{TEXTS.captureStatus}</dt>
      <dd className="m-0">
        <Badge variant={CAPTURE_STATUS_CHIPS[device.captureStatus]}>
          {CAPTURE_STATUS_LABELS[device.captureStatus]}
        </Badge>
      </dd>
    </dl>
  );
}

/** The inputs of the device values (DER-56-01): the form of UI-003 without WI-Nr and supplier. */
interface ValuesDraft {
  conditionValueId: number | null;
  visualGrade: string;
  conditionDescription: string;
  values: AttributeInputs;
  /** The review flags the user lifted by "Bestätigen" or by changing the value (REQ-013). */
  confirmedKeys: readonly string[];
}

/** A field error by path: the fixed fields and `values.<id>` (2.0.5). */
type FieldErrors = Partial<Record<string, ReactNode>>;

/** The inputs of the stored device: its values of the active attributes of the level device. */
function draftOf(device: Device, attributes: readonly Attribute[]): ValuesDraft {
  return {
    conditionValueId: device.conditionValueId,
    visualGrade: String(device.visualGrade),
    conditionDescription: device.conditionDescription,
    values: Object.fromEntries(
      attributesOfLevel(attributes, 'device').flatMap((attribute) => {
        const stored = device.values[String(attribute.id)];
        return stored === undefined
          ? []
          : [[String(attribute.id), attributeInputOf(attribute, stored as AttributeValue)]];
      }),
    ),
    confirmedKeys: [],
  };
}

/**
 * The values of the request: every attribute the form asks for (2.0.5 rule (2)); without the
 * field "Akkukapazität" `null`, which removes a stored value (2.5 "Merkmalswerte bei `PATCH`
 * sind Änderungen", 2.0.11 "Abhängige Eingaben"). Values of deactivated attributes are not
 * sent, so they stay stored (REQ-005).
 */
function requestValues(device: DeviceAttributes, values: AttributeInputs) {
  const capacity = capacityAttribute(device);
  return {
    ...attributeRequestValues(device.attributes, 'device', values),
    ...(capacity !== undefined &&
      !batteryCapacityShown(device, values) && { [String(capacity.id)]: null }),
  };
}

/** The body of `PATCH /api/devices/{id}` with the version of the device the form shows. */
const bodyOf = (
  draft: ValuesDraft,
  device: DeviceAttributes,
  version: number,
): DeviceUpdateInput => ({
  version,
  conditionValueId: draft.conditionValueId,
  visualGrade: draft.visualGrade,
  conditionDescription: draft.conditionDescription,
  values: requestValues(device, draft.values),
  confirmedKeys: [...draft.confirmedKeys],
});

/**
 * Field errors of the check in the browser: the same schema on the same state after the change as
 * on the server (2.0.7, 2.5), so the stored values merged with the changes of the request.
 */
function checkAll(draft: ValuesDraft, device: DeviceAttributes, stored: Device): FieldErrors {
  const errors: FieldErrors = {};
  const schema = deviceValuesSchema(device.attributes, { batteryValues: device.batteryValues });
  const after = {
    conditionValueId: draft.conditionValueId,
    visualGrade: draft.visualGrade,
    conditionDescription: draft.conditionDescription,
    values: mergeAttributeValues(
      stored.values as AttributeValues,
      requestValues(device, draft.values),
    ),
  };
  for (const issue of schema.safeParse(after).error?.issues ?? []) {
    errors[issue.path.join('.')] ??= issue.message;
  }
  return errors;
}

const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

/**
 * The card "Gerätewerte" of UI-010 (DER-56-01): the form of UI-003 without WI-Nr, with condition,
 * visual grade, the attributes of the level device (CU-111), the battery capacity only with a
 * battery value carrying "Akku vorhanden" (DER-56-03) and the condition description, each with
 * its review mark; "Gerätewerte speichern" sends `PATCH /api/devices/{id}`. A stored,
 * deactivated condition or pick list value stays chosen and offered with "(deaktiviert)"; after
 * `pick_list_value_deactivated` every changed choice missing after the reload is emptied with
 * its text, without falling back to the stored value (2.0.11, design v0.6.8, DER-56-08,
 * DER-56-11). A sold or cancelled device is read only (DER-56-02). If the changed variant data of
 * an assigned device deviate from its model listing, UI-005 Kontext B opens with the answer and
 * the inputs stay; "Zuordnung behalten" stores them (2.5, DER-56-04, DER-56-05), a rejection of
 * it shows at the form. States: validation, success, error, conflict (P-05), wird-beendet (P-07),
 * ausgang-unbekannt (P-08, DER-56-07), disabled.
 */
function DeviceValuesCard({ device }: { device: DeviceDetail }) {
  const queryClient = useQueryClient();
  const templateQuery = useModelTemplateQuery(device.modelTemplateId);
  const deviceTypeId = templateQuery.data?.deviceTypeId ?? null;
  const attributesQuery = useAttributesQuery(deviceTypeId);
  const pickLists = usePickListsQuery();
  const conditionListId =
    pickLists.data?.items.find((list) => list.key === 'condition')?.id ?? null;
  const conditions = usePickListValuesQuery(conditionListId);
  const batteryListId =
    attributesQuery.data?.items.find(({ systemRole }) => systemRole === 'battery')?.pickListId ??
    null;
  const batteryValuesQuery = usePickListValuesQuery(batteryListId);
  const updateMutation = useUpdateDeviceMutation(device.id);
  const navigate = useNavigate();
  const writesLocked = useWritesLocked();

  const attributesDevice: DeviceAttributes | null =
    attributesQuery.data === undefined
      ? null
      : {
          attributes: attributesQuery.data.items,
          batteryValues: batteryValuesQuery.data?.items ?? [],
        };
  const deviceRef = useRef(attributesDevice);
  deviceRef.current = attributesDevice;

  // The stored device the form changes; it changes only with a save or "Neu laden" (P-05), so a
  // read in the background never overwrites the inputs and the version stays the one shown.
  const [stored, setStored] = useState<Device | null>(null);
  const storedRef = useRef(stored);
  storedRef.current = stored;
  const [draft, setDraft] = useState<ValuesDraft | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    const attributes = attributesQuery.data?.items;
    if (stored !== null || attributes === undefined) return;
    // After "Neu laden" the cache already holds the device read again, while this render may
    // still carry the previous one: the query notifies its observers only afterwards (T-1).
    const current =
      queryClient.getQueryData<DeviceDetail>(queryKeys.inventory.device(device.id)) ?? device;
    setStored(current);
    setDraft(draftOf(current, attributes));
  }, [stored, device, attributesQuery.data, queryClient]);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  // Choices that show the text of a rejection until the next choice in the field (v0.6.8).
  const [rejectionShown, setRejectionShown] = useState<Partial<Record<string, boolean>>>({});
  // Pick list values rejected as deactivated whose list could not be read again (2.0.11).
  const [droppedValues, setDroppedValues] = useState<ReadonlySet<number>>(new Set());
  const [reloading, setReloading] = useState(false);
  // The answer `variant_deviation` of an assigned device and the request sent; UI-005 Kontext B is
  // open while set (2.5).
  const [deviation, setDeviation] = useState<Pick<KeepAssignment, 'details' | 'body'> | null>(null);

  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  const readOnly = device.stockStatus !== 'available';
  const saving = updateMutation.isPending;
  const disabled = readOnly || saving;
  const canSave = !readOnly && !saving && !writesLocked && !reloading && draft !== null;

  // The stored condition stays offered, deactivated with "(deaktiviert)" (2.0.11).
  const storedConditionId = stored?.conditionValueId ?? null;
  const offeredConditions = choiceOptions(conditions.data?.items ?? [], {
    storedId: storedConditionId,
    markDeactivated: true,
  }).filter(({ id }) => !droppedValues.has(id) || id === storedConditionId);

  function change(next: Partial<ValuesDraft>) {
    setDraft((previous) => (previous === null ? previous : { ...previous, ...next }));
  }

  function setError(path: string, error: ReactNode) {
    setErrors((previous) => ({ ...previous, [path]: error }));
  }

  /** The draft with a review flag lifted; a key without a flag is not recorded. */
  function confirmed(keys: readonly string[]): Pick<ValuesDraft, 'confirmedKeys'> {
    const current = draftRef.current?.confirmedKeys ?? [];
    const lifted = keys.filter((key) => storedRef.current?.reviewKeys.includes(key));
    return { confirmedKeys: [...new Set([...current, ...lifted])] };
  }

  /** A new choice in a field ends the text of a rejection there (v0.6.8). */
  function endRejection(path: string) {
    if (!rejectionShown[path]) return;
    setError(path, undefined);
    setRejectionShown((previous) => ({ ...previous, [path]: false }));
  }

  function checkOnBlur(path: string) {
    if (rejectionShown[path]) return;
    const current = draftRef.current;
    const definitions = deviceRef.current;
    const base = storedRef.current;
    if (current === null || definitions === null || base === null) return;
    blurCheck.checkOnBlur(() => setError(path, checkAll(current, definitions, base)[path]));
  }

  /** The input of an attribute; the battery capacity goes with a battery value without it. */
  function changeAttribute(attributeId: number, input: AttributeInputValue) {
    const current = draftRef.current;
    if (current === null || attributesDevice === null) return;
    const entered = { ...current.values, [attributeId]: input };
    const values = withCapacityOfBattery(attributesDevice, entered);
    const changed = [String(attributeId)];
    const capacity = capacityAttribute(attributesDevice);
    if (capacity !== undefined && values !== entered) {
      setError(valuePath(capacity.id), undefined);
      changed.push(String(capacity.id));
    }
    change({ values, ...confirmed(changed) });
    endRejection(valuePath(attributeId));
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    focusFirstError();
  }

  function onFailed(error: ApiError, body?: DeviceUpdateInput) {
    // The changed variant data of an assigned device deviate from its model listing: UI-005
    // Kontext B decides, the inputs stay (2.5, DER-56-04).
    const details = variantDeviationDetailsOf(error);
    if (details !== null && body !== undefined) {
      setDeviation({ details, body });
      return;
    }
    if (error.kind === 'validation') {
      const next: FieldErrors = {};
      for (const { path, message } of error.error?.fields ?? []) next[path] ??= message;
      if (hasErrors(next)) {
        showFieldErrors(next);
        return;
      }
    }
    const code = error.error?.code;
    const { path, id } = error.error?.details ?? {};
    // A condition or pick list value deactivated in another window: the text stands at the
    // field of `details.path`, and the lists are read again (2.0.11, DER-56-08).
    if (error.kind === 'rejected' && isDeactivatedValueAt(code, path)) {
      showFieldErrors({ [path]: error.error?.message });
      setRejectionShown({ [path]: true });
      if (typeof id === 'number') void reloadAfterRejection(path, id);
      return;
    }
    // Sold or cancelled meanwhile: the values become read only (DER-56-02).
    if (error.kind === 'rejected' && code === 'device_not_available') {
      setUnavailable(error.error?.message ?? TEXTS.readOnly);
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.device(device.id) });
      return;
    }
    setNotice(noticeOf(error));
  }

  /**
   * Reads the pick lists again and checks every choice with a value that differs from the stored
   * one at the end of the reload, also one made meanwhile (2.0.11 "Erkennen nach dem Neuladen",
   * "Ändern", addendum MAR-963, DER-56-11): a choice the new list no longer offers is emptied,
   * without falling back to the stored value, and carries the text of its usage; a stored value
   * is never missing, as it stays offered. If the list of the rejected value cannot be read, only
   * the rejected id counts as missing, and it leaves the choice.
   */
  async function reloadAfterRejection(rejectedPath: string, rejectedId: number) {
    setReloading(true);
    const lists = await reloadPickListValues(queryClient);
    const current = draftRef.current;
    const definitions = deviceRef.current;
    const base = storedRef.current;
    if (current !== null && definitions !== null && base !== null) {
      const missing = findMissingListChoices(
        deviceValueChoices(definitions, current, {
          conditionListId,
          ports: portListIds(pickLists.data?.items),
          stored: base,
        }),
        lists,
        { path: rejectedPath, id: rejectedId },
      );
      const dropped = droppedAfterReload(lists, rejectedId);
      if (dropped.length > 0) setDroppedValues((previous) => new Set([...previous, ...dropped]));
      const texts: FieldErrors = {};
      for (const { path, message } of missing) texts[path] ??= message;
      if (missing.length > 0) {
        const next = withoutMissingChoices(definitions, current, missing);
        const capacity = capacityAttribute(definitions);
        if (capacity !== undefined && !batteryCapacityShown(definitions, next.values)) {
          texts[valuePath(capacity.id)] = undefined;
        }
        setDraft(next);
        setErrors((previous) => ({ ...previous, ...texts }));
        setRejectionShown((previous) => ({
          ...previous,
          ...Object.fromEntries(
            Object.entries(texts).flatMap(([path, text]) => (text ? [[path, true]] : [])),
          ),
        }));
        focusFirstError();
      }
    }
    setReloading(false);
  }

  /** The form takes the stored device of "Gerätewerte speichern" or "Zuordnung behalten". */
  function onSaved(saved: Device) {
    if (attributesDevice === null) return;
    setStored(saved);
    setDraft(draftOf(saved, attributesDevice.attributes));
    setNotice({ kind: 'success' });
  }

  /** "Neu laden" of P-05 at the form or in UI-005: the form takes the device read again (T-1). */
  function takeReloaded() {
    setDeviation(null);
    setNotice(null);
    setStored(null);
    setErrors({});
    setRejectionShown({});
  }

  function save() {
    blurCheck.cancel();
    const current = draftRef.current;
    const base = storedRef.current;
    if (!canSave || current === null || base === null || attributesDevice === null) return;
    const found = checkAll(current, attributesDevice, base);
    setRejectionShown({});
    setUnavailable(null);
    if (hasErrors(found)) {
      showFieldErrors(found);
      return;
    }
    setErrors({});
    setNotice(null);
    const body = bodyOf(current, attributesDevice, base.version);
    updateMutation.mutate(body, {
      onSuccess: onSaved,
      onError: (error) => onFailed(error, body),
    });
  }

  // A failed read shows P-06 or the error banner (2.0.7).
  const readErrors = [
    templateQuery.error,
    attributesQuery.error,
    pickLists.error,
    conditions.error,
    batteryValuesQuery.error,
  ];
  const unreachable = readErrors.some((error) => error?.kind === 'unreachable');
  const readFailed = readErrors.find((error) => error !== null && error.kind !== 'unreachable');

  const openKeys = (stored?.reviewKeys ?? []).filter((key) => !draft?.confirmedKeys.includes(key));
  const reviewMark = (key: string, field: string) =>
    openKeys.includes(key) ? (
      <ReviewMark field={field} disabled={disabled} onConfirm={() => change(confirmed([key]))} />
    ) : null;
  const attributeFields =
    attributesDevice === null || draft === null
      ? []
      : shownAttributes(attributesDevice, draft.values);

  return (
    <div className="flex flex-col gap-4">
      <OutcomeUnknownBanner />
      {unreachable && <UnreachableBanner />}
      {readFailed && (
        <PageBanner variant="error" error={readFailed}>
          {TEXTS.loadError}
        </PageBanner>
      )}
      <SaveNoticeBanners
        notice={notice}
        onClose={() => setNotice(null)}
        onReloaded={takeReloaded}
        successText={TEXTS.saved}
        errorText={TEXTS.saveError}
      />
      {unavailable !== null && (
        <div role="alert" className={bannerClassName('error')}>
          {unavailable}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 full:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label={VALUE_TEXTS.deviceValues} className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className={CARD_HEADING}>{VALUE_TEXTS.deviceValues}</h2>
            {!readOnly && (
              <Button variant="primary" type="submit" form={formId} disabled={!canSave}>
                {saving ? TEXTS.saving : TEXTS.save}
              </Button>
            )}
          </div>
          {readOnly && <p className="m-0 text-body text-text-secondary">{TEXTS.readOnly}</p>}
          {draft === null || attributesDevice === null ? (
            <p role="status" className="m-0 text-body text-text-secondary">
              {VALUE_TEXTS.loadingValues}
            </p>
          ) : (
            <form
              id={formId}
              ref={formRef}
              aria-label={VALUE_TEXTS.deviceValues}
              noValidate
              className="flex min-w-0 flex-col gap-4"
              onPointerDown={blurCheck.pressPointer}
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
            >
              <div className="grid grid-cols-1 gap-4 full:grid-cols-3">
                <FormField
                  label={VALUE_TEXTS.condition}
                  required
                  error={errors.conditionValueId}
                  aside={reviewMark('condition', VALUE_TEXTS.condition)}
                >
                  {(control) => (
                    <Select
                      {...control}
                      value={optionValue(draft.conditionValueId)}
                      disabled={disabled}
                      onChange={(event) => {
                        change({
                          conditionValueId: idOf(event.target.value),
                          ...confirmed(['condition']),
                        });
                        setError('conditionValueId', undefined);
                        setRejectionShown((previous) => ({
                          ...previous,
                          conditionValueId: false,
                        }));
                      }}
                      onBlur={() => checkOnBlur('conditionValueId')}
                    >
                      <option value="" disabled>
                        {VALUE_TEXTS.choose}
                      </option>
                      {offeredConditions.map(({ id, label }) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <FormField
                  label={VALUE_TEXTS.visualGrade}
                  required
                  error={errors.visualGrade}
                  aside={reviewMark('visualGrade', VALUE_TEXTS.visualGrade)}
                >
                  {(control) => (
                    <Input
                      {...control}
                      inputMode="numeric"
                      autoComplete="off"
                      value={draft.visualGrade}
                      disabled={disabled}
                      onChange={(event) =>
                        change({ visualGrade: event.target.value, ...confirmed(['visualGrade']) })
                      }
                      onBlur={() => checkOnBlur('visualGrade')}
                    />
                  )}
                </FormField>
                <AttributeFieldsForm
                  attributes={attributeFields}
                  level="device"
                  inputs={draft.values}
                  errors={attributeErrors(errors)}
                  withRequired
                  dropped={droppedValues}
                  stored={stored?.values}
                  disabled={disabled}
                  onChange={changeAttribute}
                  onBlur={(attributeId) => checkOnBlur(valuePath(attributeId))}
                  reviewMark={({ id, label }) => reviewMark(String(id), label)}
                />
              </div>
              <FormField
                label={VALUE_TEXTS.conditionDescription}
                error={errors.conditionDescription}
              >
                {(control) => (
                  <textarea
                    {...control}
                    rows={3}
                    value={draft.conditionDescription}
                    disabled={disabled}
                    onChange={(event) => change({ conditionDescription: event.target.value })}
                    onBlur={() => checkOnBlur('conditionDescription')}
                    className={TEXT_AREA_CLASS}
                  />
                )}
              </FormField>
            </form>
          )}
        </section>
        {deviceTypeId !== null && (
          <ModelDataPanel templateId={device.modelTemplateId} deviceTypeId={deviceTypeId} />
        )}
      </div>
      {stored !== null && (
        <DeviationDialog
          device={stored}
          keep={
            deviation && {
              ...deviation,
              onKept: (saved) => {
                setDeviation(null);
                onSaved(saved);
              },
              // "Neues Modell-Inserat anlegen" (#201): UI-014 of the new model listing.
              onListingCreated: ({ listingId }) => void navigate(`/inserate/${listingId}`),
              onRejected: (error) => {
                setDeviation(null);
                onFailed(error);
              },
              onReloaded: takeReloaded,
            }
          }
          onClose={() => setDeviation(null)}
        />
      )}
    </div>
  );
}

/**
 * Device UI-010 (CU-137, REQ-014, REQ-016; Technical Specification 2.5, 7.3): the head with
 * WI-Nr, model template, model listing as link or "nicht zugeordnet" and the chips of inventory
 * and capture status, with the states loading, error ("geladen", DER-54-10) and P-06 above the
 * page (DER-54-13), the card "Gerätewerte" (#190) and the action "Umbuchen" (#202, REQ-020) of an
 * available, assigned device, which opens UI-004 in the mode "umbuchen" (DER-61-01). The other
 * actions follow with S8 and S9.
 */
export function DevicePage() {
  const id = deviceIdOf(useParams().deviceId);
  const query = useDeviceQuery(id);
  const device = query.data;
  const [rebooking, setRebooking] = useState(false);
  const error = query.error;
  // An address without a valid id names no device, like `404 not_found` (M-15, 2.0.5).
  const notFound = id === null || error?.kind === 'not-found';

  return (
    <div className="flex flex-col gap-4 p-6">
      {error?.kind === 'unreachable' && <UnreachableBanner />}
      {notFound && (
        <div role="alert" className={bannerClassName('error')}>
          {MESSAGES['M-15']}
        </div>
      )}
      {error && error.kind !== 'unreachable' && error.kind !== 'not-found' && (
        <PageBanner variant="error" error={error}>
          {TEXTS.loadError}
        </PageBanner>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-page-title font-semibold">
          {device ? `${TEXTS.title} ${device.wiNr}` : TEXTS.title}
        </h1>
        {/* "Umbuchen (Should)": only for an available, assigned device (UI-010 "Aktionen"). */}
        {device && device.stockStatus === 'available' && device.listing !== null && (
          <Button type="button" onClick={() => setRebooking(true)}>
            {TEXTS.rebook}
          </Button>
        )}
      </div>

      {id !== null && query.isPending && (
        <p role="status" className="m-0 text-body text-text-secondary">
          {TEXTS.loading}
        </p>
      )}
      {device && <DeviceHead device={device} />}
      {device && <DeviceValuesCard device={device} />}
      {device && device.listing !== null && (
        <AssignDialog
          open={rebooking}
          onOpenChange={setRebooking}
          mode="rebook"
          device={{ ...device, listingId: device.listing.id }}
        />
      )}
    </div>
  );
}
