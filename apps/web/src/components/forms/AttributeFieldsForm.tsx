import { ERROR_MESSAGES } from '@resellr/domain/messages/messages.de';
import type { Attribute, AttributeLevel } from '@resellr/domain/schemas/attribute.schema';
import type { ReactNode } from 'react';

import {
  AttributeInput,
  type AttributeInputValue,
  attributeRequestValue,
  emptyAttributeInput,
  type PortInput,
} from './AttributeInput.tsx';
import type { ListChoice } from './deactivated-choice.ts';
import { FormField } from './FormField.tsx';

/** The inputs of the attributes of one level by attribute id, as the form holds them. */
export type AttributeInputs = Readonly<Record<string, AttributeInputValue>>;

/** The attributes the form asks for: the active ones of the level, in their order (2.5). */
export function attributesOfLevel<A extends Pick<Attribute, 'level' | 'active' | 'sortOrder'>>(
  attributes: readonly A[],
  level: AttributeLevel,
): A[] {
  return attributes
    .filter((attribute) => attribute.level === level && attribute.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

/**
 * The values of one level as the request sends them: every attribute the form asks for, an
 * empty input as no value (2.0.5 rule (2), 2.5).
 */
export function attributeRequestValues(
  attributes: readonly Attribute[],
  level: AttributeLevel,
  inputs: AttributeInputs,
): Record<string, unknown> {
  return Object.fromEntries(
    attributesOfLevel(attributes, level).map((attribute) => {
      const input = inputs[String(attribute.id)] ?? emptyAttributeInput(attribute);
      return [String(attribute.id), attributeRequestValue(attribute, input)];
    }),
  );
}

/** Ids of the pick list values in a stored value: a choice or the types and positions of ports. */
export function storedPickListIds(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (!Array.isArray(value)) return [];
  return (value as Partial<PortInput>[]).flatMap(({ typeId, positionId }) =>
    [typeId, positionId].filter((id): id is number => typeof id === 'number'),
  );
}

/** Ids of the lists of the port entries, `null` until `GET /api/pick-lists` is read. */
export interface PortListIds {
  type: number | null;
  position: number | null;
}

/**
 * The pick list values chosen in the attribute fields of one level, in form order, with the list
 * they come from (`String(pickListId)`) and the text "<Merkmal>: <Wert> ist deaktiviert" (2.0.11,
 * CU-319). A value held by `stored` (the stored values while changing) is marked stored. The
 * path of a field is `<prefix>.<id>`, e.g. `values.16`.
 */
export function attributeListChoices(
  attributes: readonly Attribute[],
  level: AttributeLevel,
  inputs: AttributeInputs,
  {
    prefix,
    ports,
    stored = {},
  }: {
    prefix: string;
    ports: PortListIds;
    stored?: Readonly<Record<string, unknown>>;
  },
): ListChoice[] {
  return attributesOfLevel(attributes, level).flatMap((attribute) => {
    const path = `${prefix}.${attribute.id}`;
    const storedIds = storedPickListIds(stored[String(attribute.id)]);
    const message = (value: string) =>
      ERROR_MESSAGES['pick_list_value_deactivated.attribute'](attribute.label, value);
    const choice = (id: number, list: number | null): ListChoice => ({
      path,
      id,
      stored: storedIds.includes(id),
      list: String(list),
      message,
    });
    const input = inputs[String(attribute.id)];
    if (attribute.dataType === 'pick') {
      return typeof input === 'number' ? [choice(input, attribute.pickListId)] : [];
    }
    if (attribute.dataType !== 'ports' || !Array.isArray(input)) return [];
    return input.flatMap(({ typeId, positionId }) => [
      ...(typeId === null ? [] : [choice(typeId, ports.type)]),
      ...(positionId === null ? [] : [choice(positionId, ports.position)]),
    ]);
  });
}

/**
 * The input without the pick list values `ids` (2.0.11 "Auswahl nach der Ablehnung"): a choice
 * emptied, the type or position of a port entry emptied, its count kept.
 */
export function withoutPickListValues(
  attribute: Pick<Attribute, 'dataType'>,
  input: AttributeInputValue,
  ids: ReadonlySet<number>,
): AttributeInputValue {
  if (attribute.dataType === 'pick')
    return typeof input === 'number' && ids.has(input) ? null : input;
  if (attribute.dataType !== 'ports' || !Array.isArray(input)) return input;
  return input.map((entry) => ({
    ...entry,
    typeId: entry.typeId !== null && ids.has(entry.typeId) ? null : entry.typeId,
    positionId: entry.positionId !== null && ids.has(entry.positionId) ? null : entry.positionId,
  }));
}

export interface AttributeFieldsFormProps {
  /** All attributes of the device type; the form shows the active ones of `level`. */
  attributes: readonly Attribute[];
  level: AttributeLevel;
  inputs: AttributeInputs;
  /** Field errors by attribute id. */
  errors: Readonly<Record<string, string | undefined>>;
  /** Whether required attributes are required here: "*" and the placeholder "Bitte wählen". */
  withRequired: boolean;
  /** Pick list values that are no longer offered (2.0.11). */
  dropped: ReadonlySet<number>;
  /**
   * The stored values while changing (UI-010): their pick list values stay offered, a
   * deactivated one with "(deaktiviert)" (2.0.11 "Anzeige vorher").
   */
  stored?: Readonly<Record<string, unknown>>;
  disabled?: boolean;
  onChange: (attributeId: number, input: AttributeInputValue) => void;
  onBlur: (attributeId: number) => void;
  /** The review mark of a field (#188), at the end of its label line. */
  reviewMark?: (attribute: Attribute) => ReactNode;
}

/**
 * Attribute fields of a device type (CU-111, LP-4, REQ-076; Technical Specification 2.5): one
 * field per active attribute of the level, built at run time from the definitions, in their
 * order, with "*" at required attributes where the level asks for them, the input of CU-112 and
 * a place for the review mark. Used by UI-007 for the level model and the device defaults, by
 * UI-003 and UI-010 for the device values.
 */
export function AttributeFieldsForm({
  attributes,
  level,
  inputs,
  errors,
  withRequired,
  dropped,
  stored = {},
  disabled,
  onChange,
  onBlur,
  reviewMark,
}: AttributeFieldsFormProps) {
  return attributesOfLevel(attributes, level).map((attribute) => {
    const key = String(attribute.id);
    const required = withRequired && attribute.required;
    return (
      <FormField
        key={key}
        label={attribute.label}
        required={required}
        error={errors[key]}
        aside={reviewMark?.(attribute)}
      >
        {(control) => (
          <AttributeInput
            attribute={attribute}
            value={inputs[key] ?? emptyAttributeInput(attribute)}
            required={required}
            dropped={dropped}
            storedIds={storedPickListIds(stored[key])}
            disabled={disabled}
            control={control}
            onChange={(input) => onChange(attribute.id, input)}
            onBlur={() => onBlur(attribute.id)}
          />
        )}
      </FormField>
    );
  });
}
