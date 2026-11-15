import { ERROR_MESSAGES } from '@resellr/domain/messages/messages.de';
import {
  ATTRIBUTE_DATA_TYPES,
  ATTRIBUTE_LEVELS,
  ATTRIBUTE_VALUE_LABELS,
  attributeDefinitionIssues,
  attributeLabelSchemaFor,
  attributeUnitSchema,
  DATASHEET_BLOCKS,
  type AttributeCreateInput,
  type AttributeDataType,
  type AttributeLevel,
  type AttributeSystemRole,
  type AttributeWithUsage,
  type DatasheetBlock,
} from '@resellr/domain/schemas/attribute.schema';
import type { PickList } from '@resellr/domain/schemas/pick-list.schema';
import { useEffect, useId, useRef, useState } from 'react';

import { FormField, useFocusFirstError } from '../../../components/forms/FormField.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { Checkbox } from '../../../components/ui/Checkbox.tsx';
import { Input } from '../../../components/ui/Input.tsx';
import { RadioGroup } from '../../../components/ui/RadioGroup.tsx';
import { Select } from '../../../components/ui/Select.tsx';

// Texts of the panel "Merkmal bearbeiten" in UI-027 `screen.md` (UI/UX design v0.6.1).
export const PANEL_TEXTS = {
  title: 'Merkmal bearbeiten',
  label: 'Bezeichnung',
  dataType: 'Datentyp',
  unit: 'Einheit',
  unitSpacing: 'Schreibweise',
  minValue: 'Mindestwert',
  maxValue: 'Höchstwert',
  pickList: 'Auswahlliste',
  level: 'Ebene',
  variantForming: 'Variantenbildend',
  required: 'Pflichtmerkmal',
  datasheetBlock: 'Datenblatt-Block',
  save: 'Merkmal speichern',
  saving: 'Speichern …',
  cancel: 'Abbrechen',
} as const;

/** Width of the panel in the mockup of UI-027 (`default.png`). */
export const PANEL_WIDTH = 360;

/** Fields of the panel as entered; bounds as typed, `null` for an empty choice. */
export interface AttributeDraft {
  label: string;
  dataType: AttributeDataType;
  unit: string;
  unitSpacing: boolean;
  minValue: string;
  maxValue: string;
  pickListId: number | null;
  level: AttributeLevel;
  variantForming: boolean;
  required: boolean;
  datasheetBlock: DatasheetBlock;
}

export type AttributeFieldErrors = Partial<
  Record<
    | 'label'
    | 'dataType'
    | 'unit'
    | 'minValue'
    | 'maxValue'
    | 'pickListId'
    | 'level'
    | 'variantForming',
    string
  >
>;

/**
 * Reasons of the lock by stored values, inline at the field (`UI-027.disabled`, DER-34-10): the
 * texts of `attribute_has_values` (2.0.6).
 */
const VALUES_LOCK_REASONS = {
  dataType: ERROR_MESSAGES['attribute_has_values.data_type'],
  level: ERROR_MESSAGES['attribute_has_values.level'],
} as const;

/**
 * Reason of a locked field below its control, linked with `aria-describedby`. It is no field
 * error (`aria-invalid` stays unset), so the focus on the first faulty field never lands on the
 * locked control. Shown like a field error, as in the mockup of UI-027.
 */
function LockReason({ id, text }: { id: string; text: string }) {
  return (
    <p className="flex items-start gap-1 text-label text-error">
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="mt-0.5 size-3 shrink-0"
        fill="currentColor"
      >
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v5h-1.5v-5Zm0 6.25h1.5v1.5h-1.5v-1.5Z" />
      </svg>
      <span id={id} className="min-w-0 [overflow-wrap:anywhere]">
        {text}
      </span>
    </p>
  );
}

const NEW_DRAFT: AttributeDraft = {
  label: '',
  dataType: 'text',
  unit: '',
  unitSpacing: true,
  minValue: '',
  maxValue: '',
  pickListId: null,
  level: 'model',
  variantForming: false,
  required: false,
  datasheetBlock: 'technical',
};

export function draftOf(attribute: AttributeWithUsage | null): AttributeDraft {
  if (attribute === null) return NEW_DRAFT;
  return {
    label: attribute.label,
    dataType: attribute.dataType,
    unit: attribute.unit ?? '',
    unitSpacing: attribute.unitSpacing,
    minValue: attribute.minValue ?? '',
    maxValue: attribute.maxValue ?? '',
    pickListId: attribute.pickListId,
    level: attribute.level,
    variantForming: attribute.variantForming,
    required: attribute.required,
    datasheetBlock: attribute.datasheetBlock,
  };
}

const isNumberType = (dataType: AttributeDataType) =>
  dataType === 'integer' || dataType === 'decimal';

/**
 * The request fields of a draft (2.1): bounds only for numbers, the pick list only for data type
 * pick and the flag only where UI-027 offers it, so a hidden field never sends an old value.
 */
export function requestOf(
  draft: AttributeDraft,
  systemRole: AttributeSystemRole | null,
): Omit<AttributeCreateInput, 'active'> {
  const numbers = isNumberType(draft.dataType);
  // As entered; the server turns it into the canonical form (2.1, CU-013).
  const bound = (value: string) => (numbers && value.trim() !== '' ? value : null);
  return {
    label: draft.label,
    dataType: draft.dataType,
    unit: draft.unit,
    unitSpacing: draft.unitSpacing,
    minValue: bound(draft.minValue),
    maxValue: bound(draft.maxValue),
    pickListId: draft.dataType === 'pick' ? draft.pickListId : null,
    level: draft.level,
    variantForming: offersVariantFlag(draft.level, systemRole) && draft.variantForming,
    required: draft.required,
    datasheetBlock: draft.datasheetBlock,
  };
}

/** The flag "variantenbildend" exists at level device, but never for the role battery_capacity. */
const offersVariantFlag = (level: AttributeLevel, systemRole: AttributeSystemRole | null) =>
  level === 'device' && systemRole !== 'battery_capacity';

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? undefined : result.error?.issues[0]?.message;

/** The label rule alone, for the check on leaving the field (2.0.7). */
export function checkLabel(label: string, systemRole: AttributeSystemRole | null) {
  return firstMessage(attributeLabelSchemaFor(systemRole).safeParse(label));
}

/**
 * The field rules of 2.1 in the browser with the schemas of the server (2.0.7): label, unit,
 * minimum and maximum (format, minimum ≤ maximum) and the pick list for data type pick.
 */
export function checkDraft(
  draft: AttributeDraft,
  systemRole: AttributeSystemRole | null,
): AttributeFieldErrors {
  const errors: AttributeFieldErrors = {
    label: checkLabel(draft.label, systemRole),
    unit: firstMessage(attributeUnitSchema.safeParse(draft.unit)),
  };
  for (const issue of attributeDefinitionIssues({ ...requestOf(draft, systemRole), systemRole })) {
    if (issue.path !== undefined) errors[issue.path] ??= issue.message;
  }
  return errors;
}

export const hasErrors = (errors: AttributeFieldErrors) =>
  Object.values(errors).some((message) => message !== undefined);

export interface AttributePanelProps {
  /** The attribute to change; `null` for a new one. */
  attribute: AttributeWithUsage | null;
  pickLists: readonly PickList[];
  errors: AttributeFieldErrors;
  /** Counts the field errors of the server; each new count moves the focus to the first one. */
  errorFocusRequest: number;
  /** `UI-027.speichert`: inputs and buttons locked, the save button shows "Speichern …" (P-08). */
  saving: boolean;
  /**
   * Another write of the page runs (`UI-027.aktiviert-speichert`): inputs and buttons are locked,
   * the inputs stay and the save button keeps its label.
   */
  locked?: boolean;
  /** Writes are locked after an unknown outcome (P-08). */
  writesLocked: boolean;
  onErrors: (errors: AttributeFieldErrors) => void;
  onSave: (draft: AttributeDraft) => void;
  onCancel: () => void;
}

/**
 * Panel "Merkmal bearbeiten" of UI-027 (CU-095, REQ-005; Technical Specification 2.1). Data
 * type, level and pick list of an attribute with a system role are locked (DER-34-08); the flag
 * "variantenbildend" exists only at level device and stays "Nein" for the role
 * battery_capacity (AC-REQ-005-06, AC-REQ-005-07). Once values are stored (`hasValues`), data type
 * and level are locked with the reason inline at the field (DER-34-10); minimum and maximum exist
 * only for numbers
 * (DER-34-03), the pick list only for data type pick (DER-34-04). The panel has no status: it
 * changes only with the row actions "Deaktivieren" and "Wieder aktivieren", and the panel of a
 * deactivated attribute is editable like that of an active one (DER-34-16, design v0.6.4).
 */
export function AttributePanel({
  attribute,
  pickLists,
  errors,
  errorFocusRequest,
  saving,
  locked: otherWriteRunning = false,
  writesLocked,
  onErrors,
  onSave,
  onCancel,
}: AttributePanelProps) {
  const [draft, setDraft] = useState(() => draftOf(attribute));
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const systemRole = attribute?.systemRole ?? null;
  const roleLocked = systemRole !== null;
  const valuesLocked = attribute?.hasValues ?? false;
  const lockReasonId = useId();
  const lockReason = (field: keyof typeof VALUES_LOCK_REASONS) => `${lockReasonId}-${field}`;
  const locked = saving || otherWriteRunning || writesLocked;
  const change = (next: Partial<AttributeDraft>) => setDraft({ ...draft, ...next });
  const pointerPressed = useRef(false);
  const cancelDeferredCheck = useRef(() => {});

  // Field errors of the server get the focus like those of the browser (2.0.7 `.validation`).
  useEffect(() => {
    if (errorFocusRequest > 0) focusFirstError();
  }, [errorFocusRequest, focusFirstError]);

  useEffect(() => () => cancelDeferredCheck.current(), []);

  function pressPointer() {
    pointerPressed.current = true;
    const release = () => {
      pointerPressed.current = false;
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  }

  /**
   * Check of one field on leaving it (2.0.7). During a click in the panel the check waits until
   * after the click: a new or vanished error line would move "Merkmal speichern" between
   * `mousedown` and `mouseup`, and the browser would drop the click (Q-1, as QA-D1 in the form of
   * the device type).
   */
  function checkOnBlur(field: 'label' | 'unit', message: string | undefined) {
    const apply = () => onErrors({ ...errors, [field]: message });
    if (!pointerPressed.current) {
      apply();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      cancelDeferredCheck.current();
      // `click` follows `pointerup` in the same task, so the timeout runs after it.
      timer = setTimeout(apply);
    };
    window.addEventListener('pointerup', run);
    window.addEventListener('pointercancel', run);
    cancelDeferredCheck.current = () => {
      window.removeEventListener('pointerup', run);
      window.removeEventListener('pointercancel', run);
      clearTimeout(timer);
    };
  }

  function save() {
    // The save checks all fields itself; a later check on leaving must not change its result.
    cancelDeferredCheck.current();
    const checked = checkDraft(draft, systemRole);
    if (hasErrors(checked)) {
      onErrors(checked);
      focusFirstError();
      return;
    }
    onErrors({});
    onSave(draft);
  }

  return (
    <form
      ref={formRef}
      aria-label={PANEL_TEXTS.title}
      noValidate
      className="flex flex-col gap-4"
      onPointerDown={pressPointer}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <FormField label={PANEL_TEXTS.label} required error={errors.label}>
        {(control) => (
          <Input
            {...control}
            value={draft.label}
            disabled={locked}
            onChange={(event) => change({ label: event.target.value })}
            onBlur={() => checkOnBlur('label', checkLabel(draft.label, systemRole))}
          />
        )}
      </FormField>

      <FormField label={PANEL_TEXTS.dataType} required error={errors.dataType}>
        {(control) => (
          <>
            <Select
              {...control}
              {...(valuesLocked && { 'aria-describedby': lockReason('dataType') })}
              value={draft.dataType}
              disabled={locked || roleLocked || valuesLocked}
              onChange={(event) => change({ dataType: event.target.value as AttributeDataType })}
            >
              {ATTRIBUTE_DATA_TYPES.map((dataType) => (
                <option key={dataType} value={dataType}>
                  {ATTRIBUTE_VALUE_LABELS.dataType[dataType]}
                </option>
              ))}
            </Select>
            {valuesLocked && (
              <LockReason id={lockReason('dataType')} text={VALUES_LOCK_REASONS.dataType} />
            )}
          </>
        )}
      </FormField>

      {draft.dataType === 'pick' && (
        <FormField label={PANEL_TEXTS.pickList} required error={errors.pickListId}>
          {(control) => (
            <Select
              {...control}
              value={draft.pickListId ?? ''}
              disabled={locked || roleLocked}
              onChange={(event) =>
                change({
                  pickListId: event.target.value === '' ? null : Number(event.target.value),
                })
              }
            >
              <option value="" />
              {pickLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}

      <FormField label={PANEL_TEXTS.unit} error={errors.unit}>
        {(control) => (
          <Input
            {...control}
            value={draft.unit}
            disabled={locked}
            onChange={(event) => change({ unit: event.target.value })}
            onBlur={() =>
              checkOnBlur('unit', firstMessage(attributeUnitSchema.safeParse(draft.unit)))
            }
          />
        )}
      </FormField>

      <RadioGroup
        legend={PANEL_TEXTS.unitSpacing}
        value={String(draft.unitSpacing)}
        disabled={locked}
        options={(['true', 'false'] as const).map((value) => ({
          value,
          label: ATTRIBUTE_VALUE_LABELS.unitSpacing[value],
        }))}
        onChange={(value) => change({ unitSpacing: value === 'true' })}
      />

      {isNumberType(draft.dataType) && (
        <div className="grid grid-cols-2 gap-2">
          <FormField label={PANEL_TEXTS.minValue} error={errors.minValue}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={draft.minValue}
                disabled={locked}
                onChange={(event) => change({ minValue: event.target.value })}
              />
            )}
          </FormField>
          <FormField label={PANEL_TEXTS.maxValue} error={errors.maxValue}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={draft.maxValue}
                disabled={locked}
                onChange={(event) => change({ maxValue: event.target.value })}
              />
            )}
          </FormField>
        </div>
      )}

      <FormField label={PANEL_TEXTS.level} required error={errors.level}>
        {(control) => (
          <>
            <Select
              {...control}
              {...(valuesLocked && { 'aria-describedby': lockReason('level') })}
              value={draft.level}
              disabled={locked || roleLocked || valuesLocked}
              onChange={(event) => change({ level: event.target.value as AttributeLevel })}
            >
              {ATTRIBUTE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {ATTRIBUTE_VALUE_LABELS.level[level]}
                </option>
              ))}
            </Select>
            {valuesLocked && (
              <LockReason id={lockReason('level')} text={VALUES_LOCK_REASONS.level} />
            )}
          </>
        )}
      </FormField>

      {draft.level === 'device' && (
        <Checkbox
          label={PANEL_TEXTS.variantForming}
          checked={offersVariantFlag(draft.level, systemRole) && draft.variantForming}
          disabled={locked || !offersVariantFlag(draft.level, systemRole)}
          error={errors.variantForming}
          onChange={(variantForming) => change({ variantForming })}
        />
      )}
      <Checkbox
        label={PANEL_TEXTS.required}
        checked={draft.required}
        disabled={locked}
        onChange={(required) => change({ required })}
      />

      <FormField label={PANEL_TEXTS.datasheetBlock} required>
        {(control) => (
          <Select
            {...control}
            value={draft.datasheetBlock}
            disabled={locked}
            onChange={(event) => change({ datasheetBlock: event.target.value as DatasheetBlock })}
          >
            {DATASHEET_BLOCKS.map((block) => (
              <option key={block} value={block}>
                {ATTRIBUTE_VALUE_LABELS.datasheetBlock[block]}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button disabled={saving || otherWriteRunning} onClick={onCancel}>
          {PANEL_TEXTS.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={locked}>
          {saving ? PANEL_TEXTS.saving : PANEL_TEXTS.save}
        </Button>
      </div>
    </form>
  );
}
