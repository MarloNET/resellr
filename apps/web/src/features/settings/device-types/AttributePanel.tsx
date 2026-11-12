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
import { useId, useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react';

import {
  FormField,
  useFocusFirstError,
  type FormFieldControlProps,
} from '../../../components/forms/FormField.tsx';
import { Button } from '../../../components/ui/Button.tsx';
import { cn } from '../../../components/ui/cn.ts';
import { Input } from '../../../components/ui/Input.tsx';

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
  Record<'label' | 'unit' | 'minValue' | 'maxValue' | 'pickListId', string>
>;

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
  /** `UI-027.speichert`: inputs and buttons locked, the save button shows "Speichern …" (P-08). */
  saving: boolean;
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
 * battery_capacity (AC-REQ-005-06, AC-REQ-005-07); minimum and maximum exist only for numbers
 * (DER-34-03), the pick list only for data type pick (DER-34-04). The status changes with the
 * row action "Merkmal deaktivieren".
 */
export function AttributePanel({
  attribute,
  pickLists,
  errors,
  saving,
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
  const locked = saving || writesLocked;
  const change = (next: Partial<AttributeDraft>) => setDraft({ ...draft, ...next });

  function save() {
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
            onBlur={() => onErrors({ ...errors, label: checkLabel(draft.label, systemRole) })}
          />
        )}
      </FormField>

      <FormField label={PANEL_TEXTS.dataType} required>
        {(control) => (
          <Select
            {...control}
            value={draft.dataType}
            disabled={locked || roleLocked}
            onChange={(event) => change({ dataType: event.target.value as AttributeDataType })}
          >
            {ATTRIBUTE_DATA_TYPES.map((dataType) => (
              <option key={dataType} value={dataType}>
                {ATTRIBUTE_VALUE_LABELS.dataType[dataType]}
              </option>
            ))}
          </Select>
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
              onErrors({ ...errors, unit: firstMessage(attributeUnitSchema.safeParse(draft.unit)) })
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

      <FormField label={PANEL_TEXTS.level} required>
        {(control) => (
          <Select
            {...control}
            value={draft.level}
            disabled={locked || roleLocked}
            onChange={(event) => change({ level: event.target.value as AttributeLevel })}
          >
            {ATTRIBUTE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {ATTRIBUTE_VALUE_LABELS.level[level]}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      {draft.level === 'device' && (
        <Checkbox
          label={PANEL_TEXTS.variantForming}
          checked={offersVariantFlag(draft.level, systemRole) && draft.variantForming}
          disabled={locked || !offersVariantFlag(draft.level, systemRole)}
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
        <Button disabled={saving} onClick={onCancel}>
          {PANEL_TEXTS.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={locked}>
          {saving ? PANEL_TEXTS.saving : PANEL_TEXTS.save}
        </Button>
      </div>
    </form>
  );
}

function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & Partial<FormFieldControlProps>) {
  return (
    <select
      className={cn(
        'h-control w-full min-w-0 rounded-control border border-border-input bg-surface px-2',
        'text-body text-text aria-invalid:border-error disabled:bg-bg',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

function Checkbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-body text-text">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function RadioGroup({
  legend,
  value,
  options,
  disabled,
  onChange,
}: {
  legend: string;
  value: string;
  options: { value: string; label: ReactNode }[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-1 p-0 text-label font-semibold text-text">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-body text-text">
          <input
            type="radio"
            name={name}
            className="size-4 accent-primary"
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
