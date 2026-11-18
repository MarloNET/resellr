import type {
  AttributeValue,
  AttributeValueDefinition,
  AttributeValues,
  PortEntry,
} from '../schemas/attribute-values.schema.ts';

/** A review flag (3.4 `device.review_keys`): an attribute id as text, `condition`, `visualGrade`. */
export type ReviewKey = 'condition' | 'visualGrade' | `${number}`;

/** The fields of an attribute definition the prefill needs. */
export type PrefillAttribute = Pick<
  AttributeValueDefinition,
  'id' | 'dataType' | 'systemRole' | 'level' | 'active'
>;

/** The entry of the code translation found for a condition code (2.2, REQ-015). */
export interface ConditionCodeTranslation {
  plainText: string;
  suggestedConditionValueId: number | null;
  suggestedVisualGrade: number | null;
}

export interface DevicePrefillInput {
  /** The default values of the model template, stored as they are (3.4), unfiltered. */
  defaultDeviceValues: Readonly<Record<string, unknown>>;
  /** The attributes of the device type with their status (Nachtrag MAR-605, FIND-351). */
  attributes: readonly PrefillAttribute[];
  /** The entry of the condition code, `null` without a code or for an unknown one. */
  code: ConditionCodeTranslation | null;
  /** The deactivated ones among the prefilled pick list values (Nachtrag MAR-904). */
  deactivatedValueIds: Iterable<number>;
}

/** The answer of `GET /api/model-templates/{id}/device-prefill` (2.5). */
export interface DevicePrefill {
  conditionValueId: number | null;
  visualGrade: number | null;
  conditionDescription: string;
  values: AttributeValues;
  reviewKeys: ReviewKey[];
  codeResult: { found: boolean; plainText: string | null };
}

/** The attributes a device asks for: the active ones of the level device, in their order. */
const deviceAttributes = (attributes: readonly PrefillAttribute[]) =>
  attributes.filter(({ level, active }) => level === 'device' && active);

/** The pick list values a stored value refers to: a choice, or each type and position of ports. */
function pickListValueIdsOf({ dataType, systemRole }: PrefillAttribute, value: unknown): number[] {
  if (systemRole === 'battery_capacity') return [];
  if (dataType === 'pick' && typeof value === 'number') return [value];
  if (dataType === 'ports' && Array.isArray(value)) {
    return (value as PortEntry[]).flatMap(({ typeId, positionId }) =>
      positionId === null ? [typeId] : [typeId, positionId],
    );
  }
  return [];
}

/**
 * The pick list values a prefill would take (2.5 "Nur aktive Listenwerte", Nachtrag MAR-904):
 * those of the defaults of the active attributes of the level device and the suggested condition.
 * CU-293 and CU-121 read their status with `findPickListValues` for `deactivatedValueIds`.
 */
export function prefillPickListValueIds(
  defaultDeviceValues: Readonly<Record<string, unknown>>,
  attributes: readonly PrefillAttribute[],
  code: ConditionCodeTranslation | null,
): number[] {
  const ids = deviceAttributes(attributes).flatMap((attribute) =>
    pickListValueIdsOf(attribute, defaultDeviceValues[String(attribute.id)]),
  );
  const condition = code?.suggestedConditionValueId;
  return [...new Set(condition == null ? ids : [condition, ...ids])];
}

/**
 * Prefill of a device (CU-117, REQ-013, REQ-015; Technical Specification 2.5): the defaults of
 * the model template for the active attributes of the level device and the suggestions of the
 * condition code, each with a review flag; the plain text of the code goes into the condition
 * description without a flag (AC-REQ-015-01). A default that refers to a deactivated pick list
 * value is left out, for ports the whole value, and so is a deactivated suggested condition; the
 * plain text and the suggested visual grade stay (Nachtrag MAR-904). Nothing changes at the model
 * template or the code translation, so the value counts again once it is active again.
 */
export function buildDevicePrefill({
  defaultDeviceValues,
  attributes,
  code,
  deactivatedValueIds,
}: DevicePrefillInput): DevicePrefill {
  const deactivated = new Set(deactivatedValueIds);
  const isActive = (id: number) => !deactivated.has(id);

  const values: AttributeValues = {};
  const attributeKeys: ReviewKey[] = [];
  for (const attribute of deviceAttributes(attributes)) {
    const key = String(attribute.id) as `${number}`;
    const value = defaultDeviceValues[key];
    if (value === undefined || value === null) continue;
    if (!pickListValueIdsOf(attribute, value).every(isActive)) continue;
    values[key] = value as AttributeValue;
    attributeKeys.push(key);
  }

  const suggestedCondition = code?.suggestedConditionValueId ?? null;
  const conditionValueId =
    suggestedCondition !== null && isActive(suggestedCondition) ? suggestedCondition : null;
  const visualGrade = code?.suggestedVisualGrade ?? null;
  const codeKeys: ReviewKey[] = [
    ...(conditionValueId === null ? [] : (['condition'] as const)),
    ...(visualGrade === null ? [] : (['visualGrade'] as const)),
  ];

  return {
    conditionValueId,
    visualGrade,
    conditionDescription: code?.plainText ?? '',
    values,
    reviewKeys: [...codeKeys, ...attributeKeys],
    codeResult: { found: code !== null, plainText: code?.plainText ?? null },
  };
}
