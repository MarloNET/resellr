import { ERROR_MESSAGES } from '@resellr/domain/messages/messages.de';
import type { Attribute } from '@resellr/domain/schemas/attribute.schema';
import {
  type AttributeValue,
  type AttributeValues,
  mergeAttributeValues,
} from '@resellr/domain/schemas/attribute-values.schema';
import {
  EAN_MODES,
  type Listing,
  type ListingDetail,
  type ListingUpdateInput,
  listingValuesSchema,
} from '@resellr/domain/schemas/listing.schema';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import type { ApiError } from '../../api/api-client.ts';
import { useUpdateListingMutation } from '../../api/inventory.api.ts';
import {
  usePickListsQuery,
  usePickListValuesQuery,
  useTextBlocksQuery,
} from '../../api/settings.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import {
  AttributeFieldsForm,
  type AttributeInputs,
  attributeListChoices,
  attributeRequestValues,
  attributesOfLevel,
  withoutPickListValues,
} from '../../components/forms/AttributeFieldsForm.tsx';
import { attributeInputOf } from '../../components/forms/AttributeInput.tsx';
import type { AttributeInputValue } from '../../components/forms/AttributeInput.tsx';
import {
  choiceOptions,
  findMissingListChoices,
  type ListChoice,
  type MissingChoice,
} from '../../components/forms/deactivated-choice.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../components/forms/FormField.tsx';
import {
  noticeOf,
  SaveNoticeBanners,
  type SaveNotice,
} from '../../components/patterns/SaveNoticeBanners.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Checkbox } from '../../components/ui/Checkbox.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import {
  droppedAfterReload,
  idOf,
  optionValue,
  portListIds,
  reloadPickListValues,
  TEXT_AREA_CLASS,
  TEXTS as VALUE_TEXTS,
} from '../devices/DeviceIntakePage.tsx';

// Texts of UI-014 `screen.md` (UI/UX design v0.6.1; v0.6.8 for the choice after a rejection for
// deactivation). The fields of UI-003 use its texts (DER-64-01).
export const TEXTS = {
  form: 'Inseratswerte bearbeiten',
  deliveryScope: 'Lieferumfang',
  articleNumber: 'Artikelnummer',
  eanMode: 'EAN-Kennzeichnung',
  eanModes: { original: 'Original', own: 'eigene' },
  ownEan: 'Eigene EAN',
  /** No text block to choose: as an empty delivery scope (UI-014 "empty"). */
  noDeliveryScope: '–',
  save: 'Speichern',
  saving: 'Speichern …',
  cancel: 'Abbrechen',
  saveError: (referenceNumber: string | null) =>
    `Das Modell-Inserat konnte nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** The inputs of `UI-014.edit` (DER-64-01): the fields of UI-003 and the listing's own ones. */
interface ValuesDraft {
  conditionValueId: number | null;
  visualGrade: string;
  conditionDescription: string;
  /** Inputs of the variant and the other attributes by attribute id (CU-111). */
  values: AttributeInputs;
  deliveryScopeTextBlockIds: readonly number[];
  articleNumber: string;
  eanMode: Listing['eanMode'];
  ownEan: string;
}

/** A field error by path: the fixed fields, `variantValues.<id>` and `otherValues.<id>`. */
type FieldErrors = Partial<Record<string, ReactNode>>;

/**
 * The attributes of the listing values (2.5, 2.7): the variant attributes and the other ones of
 * the level device without the battery capacity (A-16), active and deactivated, for the rules.
 */
function listingAttributes(attributes: readonly Attribute[]) {
  const ofDevice = attributes.filter(({ level }) => level === 'device');
  return {
    variantAttributes: ofDevice.filter(({ variantForming }) => variantForming),
    otherAttributes: ofDevice.filter(
      ({ variantForming, systemRole }) => !variantForming && systemRole !== 'battery_capacity',
    ),
  };
}

/** The path of the value of an attribute in the request and its field errors (2.7). */
const valuePath = ({ id, variantForming }: Pick<Attribute, 'id' | 'variantForming'>) =>
  `${variantForming ? 'variantValues' : 'otherValues'}.${id}`;

const VALUE_PATH = /^(variantValues|otherValues)\.(\d+)$/;

/** The stored values of a model listing by attribute id, the variant and the other ones. */
const storedValuesOf = (listing: Listing): Readonly<Record<string, unknown>> => ({
  ...listing.otherValues,
  ...listing.variantValues,
});

/** The inputs of the stored model listing: its values of the attributes the form asks for. */
function draftOf(listing: Listing, attributes: readonly Attribute[]): ValuesDraft {
  const stored = storedValuesOf(listing);
  return {
    conditionValueId: listing.conditionValueId,
    visualGrade: String(listing.visualGrade),
    conditionDescription: listing.conditionDescription,
    values: Object.fromEntries(
      attributesOfLevel(attributes, 'device').flatMap((attribute) => {
        const value = stored[String(attribute.id)];
        return value === undefined
          ? []
          : [[String(attribute.id), attributeInputOf(attribute, value as AttributeValue)]];
      }),
    ),
    deliveryScopeTextBlockIds: listing.deliveryScopeTextBlockIds,
    articleNumber: listing.articleNumber,
    eanMode: listing.eanMode,
    ownEan: listing.ownEan ?? '',
  };
}

/**
 * The body of `PATCH /api/listings/{id}` with the version of the model listing the form shows:
 * every field of the form, the values of every attribute it asks for (2.0.5 rule (2)); values of
 * deactivated attributes are not sent, so they stay stored (REQ-005). With "Original" no own EAN.
 */
function bodyOf(
  draft: ValuesDraft,
  attributes: readonly Attribute[],
  version: number,
): ListingUpdateInput & Required<Pick<ListingUpdateInput, 'variantValues' | 'otherValues'>> {
  const { variantAttributes, otherAttributes } = listingAttributes(attributes);
  return {
    version,
    conditionValueId: draft.conditionValueId,
    visualGrade: draft.visualGrade,
    conditionDescription: draft.conditionDescription,
    variantValues: attributeRequestValues(variantAttributes, 'device', draft.values),
    otherValues: attributeRequestValues(otherAttributes, 'device', draft.values),
    deliveryScopeTextBlockIds: [...draft.deliveryScopeTextBlockIds],
    articleNumber: draft.articleNumber,
    eanMode: draft.eanMode,
    ownEan: draft.eanMode === 'own' ? draft.ownEan : null,
  };
}

/**
 * Field errors of the check in the browser: the same schema on the same state after the change as
 * on the server (2.0.7, 2.7), so the stored values merged with the changes of the request.
 */
function checkAll(draft: ValuesDraft, attributes: readonly Attribute[], stored: Listing) {
  const errors: FieldErrors = {};
  const body = bodyOf(draft, attributes, stored.version);
  const after = {
    conditionValueId: body.conditionValueId,
    visualGrade: body.visualGrade,
    conditionDescription: body.conditionDescription,
    variantValues: mergeAttributeValues(
      stored.variantValues as AttributeValues,
      body.variantValues,
    ),
    otherValues: mergeAttributeValues(stored.otherValues as AttributeValues, body.otherValues),
    deliveryScopeTextBlockIds: body.deliveryScopeTextBlockIds,
    articleNumber: body.articleNumber,
    eanMode: body.eanMode,
    ownEan: body.ownEan,
  };
  const schema = listingValuesSchema(listingAttributes(attributes));
  for (const issue of schema.safeParse(after).error?.issues ?? []) {
    errors[issue.path.join('.')] ??= issue.message;
  }
  return errors;
}

const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

/** The field errors of the attribute fields by attribute id, as CU-111 shows them. */
function attributeErrors(errors: FieldErrors): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(errors).flatMap(([path, error]) => {
      const match = VALUE_PATH.exec(path);
      return match && typeof error === 'string' ? [[match[2], error]] : [];
    }),
  );
}

/** Whether a rejection for a deactivated pick list value belongs to a field of the form. */
const isDeactivatedValueAt = (code: string | undefined, path: unknown): path is string =>
  code === 'pick_list_value_deactivated' &&
  typeof path === 'string' &&
  (path === 'conditionValueId' || VALUE_PATH.test(path));

/**
 * The inputs without the missing choices (2.0.11 "Anzeige"): each emptied (value `null`, the count
 * of a port entry kept); there is no battery capacity in UI-014 (2.0.11 "Abhängige Eingaben").
 */
function withoutMissingChoices(
  draft: ValuesDraft,
  attributes: readonly Attribute[],
  missing: readonly MissingChoice[],
): ValuesDraft {
  const idsAt = (path: string) =>
    new Set(missing.filter((choice) => choice.path === path).map(({ id }) => id));
  return {
    ...draft,
    conditionValueId: idsAt('conditionValueId').size > 0 ? null : draft.conditionValueId,
    values: Object.fromEntries(
      Object.entries(draft.values).map(([key, input]) => {
        const attribute = attributes.find(({ id }) => String(id) === key);
        return [
          key,
          attribute === undefined
            ? input
            : withoutPickListValues(attribute, input, idsAt(valuePath(attribute))),
        ];
      }),
    ),
  };
}

/**
 * The text blocks the delivery scope offers (DER-64-05, 2.7): the active ones of the kind
 * "Lieferumfang" whose scope includes the device type of the model listing, in their order, and
 * the stored ones, so a chosen block never goes unseen.
 */
function deliveryScopeOptions(
  listing: ListingDetail,
  textBlocks: ReturnType<typeof useTextBlocksQuery>['data'],
  deviceTypeId: number,
) {
  const offered = (textBlocks?.items ?? [])
    .filter(
      (block) =>
        block.kind === 'delivery_scope' &&
        block.active &&
        (block.allDeviceTypes || block.deviceTypeIds.includes(deviceTypeId)),
    )
    .map(({ id, name }) => ({ id, name }));
  const stored = listing.deliveryScope.filter(
    ({ id }) => !offered.some((block) => block.id === id),
  );
  return [...offered, ...stored];
}

export interface ListingValuesFormProps {
  listing: ListingDetail;
  /** All attributes of the device type of the model listing. */
  attributes: readonly Attribute[];
  deviceTypeId: number;
  onCancel: () => void;
  onSaved: () => void;
}

/**
 * Listing values form (CU-139, REQ-088; Technical Specification 2.7): `UI-014.edit` with the
 * fields of UI-003 (condition, visual grade, the active attributes of the level device without
 * the battery capacity, condition description) and the delivery scope from the active text blocks
 * of the kind "Lieferumfang" of the device type, article number, EAN marking and own EAN
 * (DER-64-01, DER-64-05); the model data are not here. "Speichern" sends `PATCH
 * /api/listings/{id}` with every input locked and "Speichern …" until the answer (DER-64-02).
 * A stored, deactivated condition or pick list value stays chosen and offered with
 * "(deaktiviert)"; after `pick_list_value_deactivated` every changed choice missing after the
 * reload is emptied with its text, without falling back to the stored value (2.0.11, design
 * v0.6.8, DER-64-10, DER-64-11). States: validation, speichert, error, conflict (P-05),
 * wird-beendet (P-07); ausgang-unbekannt (P-08) and success stand on the page.
 */
export function ListingValuesForm({
  listing,
  attributes,
  deviceTypeId,
  onCancel,
  onSaved,
}: ListingValuesFormProps) {
  const queryClient = useQueryClient();
  const pickLists = usePickListsQuery();
  const conditionListId =
    pickLists.data?.items.find((list) => list.key === 'condition')?.id ?? null;
  const conditions = usePickListValuesQuery(conditionListId);
  const textBlocks = useTextBlocksQuery();
  const updateMutation = useUpdateListingMutation(listing.id);
  const writesLocked = useWritesLocked();

  // The stored model listing the form changes; it changes only with "Neu laden" (P-05), so a read
  // in the background never overwrites the inputs and the version stays the one shown.
  const [stored, setStored] = useState<ListingDetail | null>(listing);
  const storedRef = useRef(stored);
  storedRef.current = stored;
  const [draft, setDraft] = useState<ValuesDraft>(() => draftOf(listing, attributes));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (stored !== null) return;
    setStored(listing);
    setDraft(draftOf(listing, attributes));
  }, [stored, listing, attributes]);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // Choices that show the text of a rejection until the next choice in the field (v0.6.8).
  const [rejectionShown, setRejectionShown] = useState<Partial<Record<string, boolean>>>({});
  // Pick list values rejected as deactivated whose list could not be read again (2.0.11).
  const [droppedValues, setDroppedValues] = useState<ReadonlySet<number>>(new Set());
  const [reloading, setReloading] = useState(false);

  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  const saving = updateMutation.isPending;
  const canSave = !saving && !writesLocked && !reloading && stored !== null;

  // The stored condition stays offered, deactivated with "(deaktiviert)" (2.0.11).
  const storedConditionId = stored?.conditionValueId ?? null;
  const offeredConditions = choiceOptions(conditions.data?.items ?? [], {
    storedId: storedConditionId,
    markDeactivated: true,
  }).filter(({ id }) => !droppedValues.has(id) || id === storedConditionId);
  const shownAttributes = attributesOfLevel(attributes, 'device').filter(
    ({ systemRole }) => systemRole !== 'battery_capacity',
  );
  const scopeOptions = deliveryScopeOptions(listing, textBlocks.data, deviceTypeId);

  function change(next: Partial<ValuesDraft>) {
    setDraft((previous) => ({ ...previous, ...next }));
  }

  function setError(path: string, error: ReactNode) {
    setErrors((previous) => ({ ...previous, [path]: error }));
  }

  /** A new choice in a field ends the text of a rejection there (v0.6.8). */
  function endRejection(path: string) {
    if (!rejectionShown[path]) return;
    setError(path, undefined);
    setRejectionShown((previous) => ({ ...previous, [path]: false }));
  }

  function checkOnBlur(path: string) {
    if (rejectionShown[path]) return;
    const base = storedRef.current;
    if (base === null) return;
    const current = draftRef.current;
    blurCheck.checkOnBlur(() => setError(path, checkAll(current, attributes, base)[path]));
  }

  function changeAttribute(attributeId: number, input: AttributeInputValue) {
    change({ values: { ...draftRef.current.values, [attributeId]: input } });
    const attribute = attributes.find(({ id }) => id === attributeId);
    if (attribute !== undefined) endRejection(valuePath(attribute));
  }

  function toggleDeliveryScope(id: number, chosen: boolean) {
    const current = draftRef.current.deliveryScopeTextBlockIds;
    change({
      deliveryScopeTextBlockIds: chosen
        ? [...current.filter((blockId) => blockId !== id), id]
        : current.filter((blockId) => blockId !== id),
    });
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    focusFirstError();
  }

  /** The pick list values chosen in the form in form order (2.0.11 "Betroffene Felder"). */
  function listChoices(current: ValuesDraft, base: Listing): ListChoice[] {
    const ports = portListIds(pickLists.data?.items);
    const { variantAttributes, otherAttributes } = listingAttributes(attributes);
    const { conditionValueId } = current;
    return [
      ...(conditionValueId === null
        ? []
        : [
            {
              path: 'conditionValueId',
              id: conditionValueId,
              stored: conditionValueId === base.conditionValueId,
              list: String(conditionListId),
              message: ERROR_MESSAGES['pick_list_value_deactivated.condition'],
            },
          ]),
      ...attributeListChoices(variantAttributes, 'device', current.values, {
        prefix: 'variantValues',
        ports,
        stored: base.variantValues,
      }),
      ...attributeListChoices(otherAttributes, 'device', current.values, {
        prefix: 'otherValues',
        ports,
        stored: base.otherValues,
      }),
    ];
  }

  /**
   * Reads the pick lists again and checks every choice with a value that differs from the stored
   * one at the end of the reload, also one made meanwhile (2.0.11 "Erkennen nach dem Neuladen",
   * "Ändern", addendum MAR-963, DER-64-11): a choice the new list no longer offers is emptied,
   * without falling back to the stored value, and carries the text of its usage. If the list of
   * the rejected value cannot be read, only the rejected id counts as missing, and it leaves the
   * choice.
   */
  async function reloadAfterRejection(rejectedPath: string, rejectedId: number) {
    setReloading(true);
    const lists = await reloadPickListValues(queryClient);
    const current = draftRef.current;
    const base = storedRef.current;
    if (base !== null) {
      const missing = findMissingListChoices(listChoices(current, base), lists, {
        path: rejectedPath,
        id: rejectedId,
      });
      const dropped = droppedAfterReload(lists, rejectedId);
      if (dropped.length > 0) setDroppedValues((previous) => new Set([...previous, ...dropped]));
      if (missing.length > 0) {
        const texts: FieldErrors = {};
        for (const { path, message } of missing) texts[path] ??= message;
        setDraft(withoutMissingChoices(current, attributes, missing));
        setErrors((previous) => ({ ...previous, ...texts }));
        setRejectionShown((previous) => ({
          ...previous,
          ...Object.fromEntries(Object.keys(texts).map((path) => [path, true])),
        }));
        focusFirstError();
      }
    }
    setReloading(false);
  }

  function onFailed(error: ApiError) {
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
    // field of `details.path`, and the lists are read again (2.0.11, DER-64-10).
    if (error.kind === 'rejected' && isDeactivatedValueAt(code, path)) {
      showFieldErrors({ [path]: error.error?.message });
      setRejectionShown({ [path]: true });
      if (typeof id === 'number') void reloadAfterRejection(path, id);
      return;
    }
    // The variant data match another model listing (AC-REQ-088-02): a rule of the whole form.
    if (error.kind === 'rejected' && code === 'variant_duplicate') {
      setError('form', error.error?.message);
      return;
    }
    setNotice(noticeOf(error));
  }

  function save() {
    blurCheck.cancel();
    const base = storedRef.current;
    if (!canSave || base === null) return;
    const current = draftRef.current;
    const found = checkAll(current, attributes, base);
    setRejectionShown({});
    if (hasErrors(found)) {
      showFieldErrors(found);
      return;
    }
    setErrors({});
    setNotice(null);
    updateMutation.mutate(bodyOf(current, attributes, base.version), {
      onSuccess: onSaved,
      onError: onFailed,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <SaveNoticeBanners
        notice={notice}
        onClose={() => setNotice(null)}
        onReloaded={() => {
          // "Neu laden" of P-05: the form takes the model listing read again (T-1).
          setNotice(null);
          setStored(null);
          setErrors({});
          setRejectionShown({});
        }}
        errorText={TEXTS.saveError}
      />
      {errors.form && (
        <div role="alert" className="text-body text-error">
          {errors.form}
        </div>
      )}
      <form
        id={formId}
        ref={formRef}
        aria-label={TEXTS.form}
        noValidate
        className="flex min-w-0 flex-col gap-4"
        onPointerDown={blurCheck.pressPointer}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <fieldset disabled={saving} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
          <div className="grid grid-cols-1 gap-4 full:grid-cols-3">
            <FormField label={VALUE_TEXTS.condition} required error={errors.conditionValueId}>
              {(control) => (
                <Select
                  {...control}
                  value={optionValue(draft.conditionValueId)}
                  onChange={(event) => {
                    change({ conditionValueId: idOf(event.target.value) });
                    setError('conditionValueId', undefined);
                    setRejectionShown((previous) => ({ ...previous, conditionValueId: false }));
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
            <FormField label={VALUE_TEXTS.visualGrade} required error={errors.visualGrade}>
              {(control) => (
                <Input
                  {...control}
                  inputMode="numeric"
                  autoComplete="off"
                  value={draft.visualGrade}
                  onChange={(event) => change({ visualGrade: event.target.value })}
                  onBlur={() => checkOnBlur('visualGrade')}
                />
              )}
            </FormField>
            <AttributeFieldsForm
              attributes={shownAttributes}
              level="device"
              inputs={draft.values}
              errors={attributeErrors(errors)}
              withRequired
              dropped={droppedValues}
              stored={stored === null ? {} : storedValuesOf(stored)}
              onChange={changeAttribute}
              onBlur={(attributeId) => {
                const attribute = attributes.find(({ id }) => id === attributeId);
                if (attribute !== undefined) checkOnBlur(valuePath(attribute));
              }}
            />
          </div>
          <FormField label={VALUE_TEXTS.conditionDescription} error={errors.conditionDescription}>
            {(control) => (
              <textarea
                {...control}
                rows={3}
                value={draft.conditionDescription}
                onChange={(event) => change({ conditionDescription: event.target.value })}
                onBlur={() => checkOnBlur('conditionDescription')}
                className={TEXT_AREA_CLASS}
              />
            )}
          </FormField>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-label font-semibold text-text">
              {TEXTS.deliveryScope}
            </legend>
            {scopeOptions.length === 0 ? (
              <p className="m-0 text-body text-text-secondary">{TEXTS.noDeliveryScope}</p>
            ) : (
              scopeOptions.map(({ id, name }) => (
                <Checkbox
                  key={id}
                  label={name}
                  checked={draft.deliveryScopeTextBlockIds.includes(id)}
                  onChange={(chosen) => toggleDeliveryScope(id, chosen)}
                />
              ))
            )}
          </fieldset>
          <div className="grid grid-cols-1 gap-4 full:grid-cols-3">
            <FormField label={TEXTS.articleNumber} required error={errors.articleNumber}>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="off"
                  value={draft.articleNumber}
                  onChange={(event) => change({ articleNumber: event.target.value })}
                  onBlur={() => checkOnBlur('articleNumber')}
                />
              )}
            </FormField>
            <FormField label={TEXTS.eanMode} required error={errors.eanMode}>
              {(control) => (
                <Select
                  {...control}
                  value={draft.eanMode}
                  onChange={(event) => {
                    change({ eanMode: event.target.value as Listing['eanMode'] });
                    setError('ownEan', undefined);
                  }}
                >
                  {EAN_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {TEXTS.eanModes[mode]}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            {draft.eanMode === 'own' && (
              <FormField label={TEXTS.ownEan} required error={errors.ownEan}>
                {(control) => (
                  <Input
                    {...control}
                    inputMode="numeric"
                    autoComplete="off"
                    value={draft.ownEan}
                    onChange={(event) => change({ ownEan: event.target.value })}
                    onBlur={() => checkOnBlur('ownEan')}
                  />
                )}
              </FormField>
            )}
          </div>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" onClick={onCancel} disabled={saving}>
            {TEXTS.cancel}
          </Button>
          <Button variant="primary" type="submit" disabled={!canSave}>
            {saving ? TEXTS.saving : TEXTS.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
