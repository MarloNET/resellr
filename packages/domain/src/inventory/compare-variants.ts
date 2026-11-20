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

/** A variant attribute of the device type as the deviations name it (2.6). */
export interface VariantAttribute {
  id: number;
  label: string;
}

/**
 * The readable variant data of a device or a model listing: the label of the condition and the
 * readable values by attribute label, without the attributes that have no value (3.4).
 */
export interface VariantTexts {
  condition: string;
  values: Readonly<Record<string, string>>;
}

/** One deviating item with formatted values, e.g. RAM 8GB at the device, 16GB at the listing. */
export interface VariantDeviation {
  key: VariantKey;
  label: string;
  deviceValue: string;
  listingValue: string;
}

/**
 * An assigned device that deviates from its model listing after a change of the listing values
 * (REQ-088, AC-REQ-088-03): `details.devices[]` of `assigned_devices_deviate` (2.7).
 */
export interface DeviatingDevice {
  wiNr: string;
  deviations: VariantDeviation[];
}

/** A missing value or an empty condition description in a deviation (2.1, "RAM: Gerät –"). */
export const MISSING_VALUE = '–';

const DEVIATION_LABELS = {
  condition: 'Zustand',
  visualGrade: 'Optik-Note',
  conditionDescription: 'Zustandsbeschreibung',
} as const;

/**
 * The deviations of a device from a model listing after the comparison rule (CU-119, REQ-018;
 * Technical Specification 2.6): one entry `{ key, label, deviceValue, listingValue }` per
 * deviating item in the order condition, visual grade, condition description, variant attributes
 * (active and deactivated, K-03) with formatted values; the condition descriptions both complete
 * (AC-REQ-018-05); a missing value is "–" (DER-59-01). Empty if they match.
 */
export function variantDeviations(
  device: { spec: VariantSpec; texts: VariantTexts },
  listing: { spec: VariantSpec; texts: VariantTexts },
  variantAttributes: readonly VariantAttribute[],
): VariantDeviation[] {
  const labels = new Map(variantAttributes.map(({ id, label }) => [String(id), label]));
  const textOf = (side: { spec: VariantSpec; texts: VariantTexts }, key: VariantKey) => {
    switch (key) {
      case 'condition':
        return side.texts.condition;
      case 'visualGrade':
        return String(side.spec.visualGrade);
      case 'conditionDescription':
        return side.spec.conditionDescription.trim() === ''
          ? MISSING_VALUE
          : side.spec.conditionDescription;
      default:
        return side.texts.values[labels.get(key) ?? ''] ?? MISSING_VALUE;
    }
  };
  return variantDifferences(
    device.spec,
    listing.spec,
    variantAttributes.map(({ id }) => id),
  ).map((key) => ({
    key,
    label:
      key in DEVIATION_LABELS
        ? DEVIATION_LABELS[key as keyof typeof DEVIATION_LABELS]
        : (labels.get(key) ?? key),
    deviceValue: textOf(device, key),
    listingValue: textOf(listing, key),
  }));
}

/**
 * A deviation in one line (UI-005 "Zeilenformat", AC-REQ-018-01), e.g. "Optik-Note: Gerät 4,
 * Modell-Inserat 2"; the audit entry of "trotzdem zuordnen" names the deviations so.
 */
export const deviationLine = ({ label, deviceValue, listingValue }: VariantDeviation) =>
  `${label}: Gerät ${deviceValue}, Modell-Inserat ${listingValue}`;
