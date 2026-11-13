import { z } from 'zod';

import { formatNumber } from '../format/format-value.ts';
import { compareDecimal, parseDecimal } from '../format/parse-decimal.ts';
import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import type { Attribute, AttributeLevel } from './attribute.schema.ts';
import { idSchema } from './common.schema.ts';
import type { BatteryValueFlag } from './pick-list.schema.ts';

// Values of the attributes of a device type (CU-067, REQ-005, REQ-076; Technical Specification
// 2.5 "Regeln und Texte je Datentyp", 3.4). The schema is built at run time from the attribute
// definitions, so a new attribute never changes the database structure (REQ-076). The user
// interface and the server use the same schema.

/** The fields of an attribute definition the value rules need. */
export type AttributeValueDefinition = Pick<
  Attribute,
  | 'id'
  | 'label'
  | 'dataType'
  | 'systemRole'
  | 'minValue'
  | 'maxValue'
  | 'level'
  | 'required'
  | 'active'
>;

/** Longest text value after trimming (technical upper limit, 2.5). */
export const ATTRIBUTE_TEXT_VALUE_MAX = 200;

/** A whole number as entered: optional minus and digits, without thousands separators (2.5). */
const INTEGER_INPUT = /^-?[0-9]+$/;

/** One entry of the data type `ports` ("Mehrfachangabe Anzahl × Typ", 3.4). */
export interface PortEntry {
  count: number;
  typeId: number;
  positionId: number | null;
}

/** Value of the role `battery_capacity` (3.4). */
export type BatteryCapacityValue = { percent: number } | { notDeterminable: true };

/** A stored attribute value (3.4). */
export type AttributeValue = string | number | boolean | PortEntry[] | BatteryCapacityValue;

/** Stored values by attribute id; an attribute without a value has no key (3.4). */
export type AttributeValues = Record<string, AttributeValue>;

type Context = z.RefinementCtx;

const fail = (context: Context, message: string, code: string) => {
  context.addIssue({ code: 'custom', message, params: { code } });
  return z.NEVER;
};

/** A whole number from the input or the stored number; `null` for a format error. */
function wholeNumber(input: string | number): number | null {
  if (typeof input === 'number') return Number.isSafeInteger(input) ? input : null;
  const trimmed = input.trim();
  if (!INTEGER_INPUT.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

/** Whether `value` lies within the bounds of the attribute, bounds included, exactly. */
function inRange({ minValue, maxValue }: AttributeValueDefinition, value: string): boolean {
  return (
    (minValue === null || compareDecimal(value, minValue) >= 0) &&
    (maxValue === null || compareDecimal(value, maxValue) <= 0)
  );
}

function numberMessage(attribute: AttributeValueDefinition, kind: 'integer' | 'decimal') {
  const bound = (value: string | null) => (value === null ? null : formatNumber(value));
  return FIELD_MESSAGES.attributeValueNumber(
    attribute.label,
    kind,
    bound(attribute.minValue),
    bound(attribute.maxValue),
  );
}

/** Whether a value counts as missing: `null`, text empty after trimming, ports `[]` (2.5). */
const isEmpty = (input: unknown) =>
  input === null ||
  input === undefined ||
  (typeof input === 'string' && input.trim() === '') ||
  (Array.isArray(input) && input.length === 0);

/**
 * Schema of the value of one attribute: the input type, then one refinement with the rules in
 * the order required, format, length or range, so a wrong input such as "3 bis 4" stays a field
 * error and an input of another JSON type is a structural error (2.0.5 rule (1), 2.5). Returns
 * the stored form, `undefined` for no value.
 */
function valueSchema(attribute: AttributeValueDefinition): z.ZodType<AttributeValue | undefined> {
  const { label } = attribute;
  // A deactivated attribute is no longer asked for; its stored value stays valid (REQ-005).
  const mandatory = attribute.active && attribute.required;
  /** No value: "<Merkmal> fehlt" for a required attribute, else nothing is stored. */
  const missing = (context: Context) =>
    mandatory
      ? fail(context, FIELD_MESSAGES.attributeValueMissing(label), 'value_missing')
      : undefined;
  const empty = <T>(input: T | null): input is null => isEmpty(input);

  if (attribute.systemRole === 'battery_capacity') {
    return z
      .union([
        z.strictObject({ percent: z.union([z.string(), z.number()]) }),
        z.strictObject({ notDeterminable: z.literal(true) }),
      ])
      .nullable()
      .transform((input, context): BatteryCapacityValue | undefined => {
        // Whether a value is required depends on the battery value (`batteryCapacityRule`).
        if (input === null) return undefined;
        if ('notDeterminable' in input) return input;
        const percent = wholeNumber(input.percent);
        if (percent === null || percent < 0 || percent > 100) {
          return fail(context, FIELD_MESSAGES.batteryCapacityFormat, 'battery_capacity_format');
        }
        return { percent };
      });
  }

  switch (attribute.dataType) {
    case 'text':
      return z
        .string()
        .nullable()
        .transform((input, context) => {
          if (empty(input)) return missing(context);
          const text = input.trim();
          if (text.length > ATTRIBUTE_TEXT_VALUE_MAX) {
            return fail(context, FIELD_MESSAGES.attributeValueTextLength(label), 'value_length');
          }
          return text;
        });
    case 'integer':
      return z
        .union([z.string(), z.number()])
        .nullable()
        .transform((input, context) => {
          if (empty(input)) return missing(context);
          const value = wholeNumber(input);
          if (value === null || !inRange(attribute, String(value))) {
            return fail(context, numberMessage(attribute, 'integer'), 'value_integer');
          }
          return value;
        });
    case 'decimal':
      return z
        .string()
        .nullable()
        .transform((input, context) => {
          if (empty(input)) return missing(context);
          // Comma or point, never a date (AC-REQ-005-02); stored in canonical form (2.0.1).
          const value = parseDecimal(input);
          if (value === null || !inRange(attribute, value)) {
            return fail(context, numberMessage(attribute, 'decimal'), 'value_decimal');
          }
          return value;
        });
    case 'boolean':
      return z
        .boolean()
        .nullable()
        .transform((input, context) => (input === null ? missing(context) : input));
    case 'pick':
      return idSchema
        .nullable()
        .transform((input, context) => (input === null ? missing(context) : input));
    case 'ports':
      return z
        .array(
          z.strictObject({
            count: z.union([z.string(), z.number()]),
            typeId: idSchema.nullable(),
            positionId: idSchema.nullable(),
          }),
        )
        .nullable()
        .transform((input, context) => {
          if (empty(input)) return missing(context);
          const entries: PortEntry[] = [];
          // Per entry in list order: count first, then type (2.5).
          for (const entry of input) {
            const count = wholeNumber(entry.count);
            if (count === null || count < 1) {
              return fail(context, FIELD_MESSAGES.attributeValuePortCount(label), 'port_count');
            }
            if (entry.typeId === null) {
              return fail(context, FIELD_MESSAGES.attributeValuePortType(label), 'port_type');
            }
            entries.push({ count, typeId: entry.typeId, positionId: entry.positionId });
          }
          return entries;
        });
  }
}

/**
 * Rule of the role `battery_capacity` (2.5, FIND-353): a value is required exactly when the
 * attribute is active and the chosen value of the active attribute with the role `battery`
 * carries the flag "Akku vorhanden", whatever its label (DER-35-12). `undefined` without both
 * attributes at the level.
 */
function batteryCapacityRule(
  attributes: readonly AttributeValueDefinition[],
  batteryValues: readonly BatteryValueFlag[],
) {
  const battery = attributes.find(({ systemRole }) => systemRole === 'battery');
  const capacity = attributes.find(({ systemRole }) => systemRole === 'battery_capacity');
  if (battery === undefined || capacity === undefined) return undefined;
  const present = new Set(
    batteryValues.filter((value) => value.batteryPresent).map(({ id }) => id),
  );
  return (values: Record<string, unknown>, context: Context) => {
    if (!battery.active || !capacity.active) return;
    const chosen = values[String(battery.id)];
    if (typeof chosen !== 'number' || !present.has(chosen)) return;
    if (values[String(capacity.id)] !== undefined) return;
    context.addIssue({
      code: 'custom',
      message: FIELD_MESSAGES.attributeValueMissing(capacity.label),
      params: { code: 'value_missing' },
      path: [String(capacity.id)],
    });
  };
}

/**
 * Schema of the values of one level ("Modell" for model templates, "Gerät" for devices) built
 * from the attributes of the device type (2.5): one optional key per attribute of the level, the
 * attribute id as string (3.4). An active required attribute without a value is rejected with
 * "<Merkmal> fehlt"; a deactivated attribute is no longer asked for, but a stored value of it
 * stays valid (REQ-005). The battery capacity is required by the flag "Akku vorhanden" of the
 * chosen value among `batteryValues`, the values of the list battery; without them it is never
 * required. Each attribute has at most one field error, at its id. The output holds only the
 * attributes with a value, in their stored form.
 */
export function attributeValuesSchema(
  attributes: readonly AttributeValueDefinition[],
  level: AttributeLevel,
  { batteryValues = [] }: { batteryValues?: readonly BatteryValueFlag[] } = {},
) {
  const ofLevel = attributes.filter((attribute) => attribute.level === level);
  const shape = Object.fromEntries(
    ofLevel.map((attribute) => [String(attribute.id), valueSchema(attribute)]),
  );
  // A missing key is no value; it reaches the rule of its attribute as `null`, so a required
  // one is reported beside the field errors of the others.
  const withAllKeys = (input: unknown) =>
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? { ...Object.fromEntries(ofLevel.map(({ id }) => [String(id), null])), ...input }
      : input;
  const batteryCapacity = batteryCapacityRule(ofLevel, batteryValues);
  // The cross-field rule runs beside the field errors of the other attributes, but not after a
  // structural error (2.0.5 rule (4)).
  const object =
    batteryCapacity === undefined
      ? z.strictObject(shape)
      : z.strictObject(shape).superRefine(batteryCapacity, {
          when: ({ issues }) => issues.every((issue) => issue.code === 'custom'),
        });
  return z.preprocess(withAllKeys, object).transform((values) => {
    const stored: AttributeValues = {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) stored[key] = value as AttributeValue;
    }
    return stored;
  });
}
