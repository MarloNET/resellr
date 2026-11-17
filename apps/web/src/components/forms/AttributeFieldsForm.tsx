import type { Attribute, AttributeLevel } from '@resellr/domain/schemas/attribute.schema';
import type { ReactNode } from 'react';

import {
  AttributeInput,
  type AttributeInputValue,
  attributeRequestValue,
  emptyAttributeInput,
} from './AttributeInput.tsx';
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
 * a place for the review mark. Used by UI-007 for the level model and the device defaults.
 */
export function AttributeFieldsForm({
  attributes,
  level,
  inputs,
  errors,
  withRequired,
  dropped,
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
