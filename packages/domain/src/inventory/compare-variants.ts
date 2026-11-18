import type { AttributeValue, AttributeValues } from '../schemas/attribute-values.schema.ts';

/**
 * The variant data of a device or a model listing (Requirements 6.0; Technical Specification
 * 2.6): condition, visual grade, condition description and the stored device-level values by
 * attribute id.
 */
export interface VariantSpec {
  conditionValueId: number;
  visualGrade: number;
  conditionDescription: string;
  values: AttributeValues;
}

/** A compared item: `condition`, `visualGrade`, `conditionDescription` or an attribute id. */
export type VariantKey = 'condition' | 'visualGrade' | 'conditionDescription' | `${number}`;

/** Condition description as compared: trimmed and in Unicode lower case (2.6). */
export const descriptionKey = (description: string) => description.trim().toLowerCase();

/**
 * A value as compared: a missing value only equals a missing value, multiple entries (ports)
 * are compared as a sorted list (2.6).
 */
function comparable(value: AttributeValue | undefined): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) {
    const entries = value.map(({ count, typeId, positionId }) =>
      JSON.stringify([typeId, positionId, count]),
    );
    return JSON.stringify(entries.sort());
  }
  return JSON.stringify(value);
}

/**
 * Comparison rule of variant data (CU-119, Requirements 6.0; Technical Specification 2.6): the
 * keys in which `a` and `b` differ, empty if they match. Compared are condition, visual grade,
 * the condition description and the value of each attribute in `variantAttributeIds`, the variant
 * set of the device type with active and deactivated attributes (K-03). Other device values,
 * the battery capacity and the WI-Nr are never compared (AC-REQ-018-03).
 */
export function variantDifferences(
  a: VariantSpec,
  b: VariantSpec,
  variantAttributeIds: readonly number[],
): VariantKey[] {
  const differences: VariantKey[] = [];
  if (a.conditionValueId !== b.conditionValueId) differences.push('condition');
  if (a.visualGrade !== b.visualGrade) differences.push('visualGrade');
  if (descriptionKey(a.conditionDescription) !== descriptionKey(b.conditionDescription)) {
    differences.push('conditionDescription');
  }
  for (const id of variantAttributeIds) {
    const key = String(id) as `${number}`;
    if (comparable(a.values[key]) !== comparable(b.values[key])) differences.push(key);
  }
  return differences;
}

/** Whether `a` and `b` have the same variant data after the comparison rule. */
export const variantsMatch = (
  a: VariantSpec,
  b: VariantSpec,
  variantAttributeIds: readonly number[],
) => variantDifferences(a, b, variantAttributeIds).length === 0;
