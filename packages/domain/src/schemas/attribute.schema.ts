import { z } from 'zod';

import { compareDecimal, parseDecimal } from '../format/parse-decimal.ts';
import { FIELD_MESSAGES, MESSAGES } from '../messages/messages.de.ts';
import { isFixedPlaceholderName } from '../placeholders/placeholder-catalog.ts';
import { toKey } from '../text/normalize-key.ts';
import { idSchema, listResponseSchema, versionSchema } from './common.schema.ts';

// Attribute of a device type (REQ-005; Technical Specification 2.1, 3.1): values, field rules,
// requests and answers of the attribute endpoints.

export const ATTRIBUTE_DATA_TYPES = [
  'text',
  'integer',
  'decimal',
  'boolean',
  'pick',
  'ports',
] as const;
export const attributeDataTypeSchema = z.enum(ATTRIBUTE_DATA_TYPES);
export type AttributeDataType = z.infer<typeof attributeDataTypeSchema>;

export const ATTRIBUTE_SYSTEM_ROLES = [
  'keyboard_layout',
  'power_supply',
  'battery',
  'battery_capacity',
] as const;
export const attributeSystemRoleSchema = z.enum(ATTRIBUTE_SYSTEM_ROLES);
export type AttributeSystemRole = z.infer<typeof attributeSystemRoleSchema>;

export const ATTRIBUTE_LEVELS = ['model', 'device'] as const;
export const attributeLevelSchema = z.enum(ATTRIBUTE_LEVELS);
export type AttributeLevel = z.infer<typeof attributeLevelSchema>;

export const DATASHEET_BLOCKS = [
  'identification',
  'condition',
  'delivery_scope',
  'technical',
  'ports',
  'software',
] as const;
export const datasheetBlockSchema = z.enum(DATASHEET_BLOCKS);
export type DatasheetBlock = z.infer<typeof datasheetBlockSchema>;

/**
 * Display names of the values, worded as in UI-027 `screen.md`; the panel shows them and the
 * audit entries use them as readable values (2.0.9).
 */
export const ATTRIBUTE_VALUE_LABELS = {
  dataType: {
    text: 'Text',
    integer: 'Ganzzahl',
    decimal: 'Dezimalzahl',
    boolean: 'Ja/Nein',
    pick: 'Auswahl aus Liste',
    ports: 'Mehrfachangabe Anzahl × Typ',
  },
  level: { model: 'Modell', device: 'Gerät' },
  datasheetBlock: {
    identification: 'Identifikation',
    condition: 'Zustand',
    delivery_scope: 'Lieferumfang',
    technical: 'Technik',
    ports: 'Anschlüsse',
    software: 'Software',
  },
  unitSpacing: { true: 'mit Leerzeichen', false: 'ohne Leerzeichen' },
} as const satisfies {
  dataType: Record<AttributeDataType, string>;
  level: Record<AttributeLevel, string>;
  datasheetBlock: Record<DatasheetBlock, string>;
  unitSpacing: Record<'true' | 'false', string>;
};

/** Longest label of an attribute after trimming (2.1, 3.1). */
export const ATTRIBUTE_LABEL_MAX = 100;

/** Longest unit of an attribute after trimming (2.1, 3.1). */
export const ATTRIBUTE_UNIT_MAX = 20;

/** The attribute with the role `battery_capacity` is the stock placeholder of its label (2.1). */
const BATTERY_CAPACITY_KEY = toKey('Akkukapazität');

/**
 * Label rule of an attribute with the given system role (2.1): 1–100 characters after trimming
 * (M-02), without `{` and `}` (M-03), not taken by a fixed placeholder of the catalog CU-068
 * (M-04, compared without regard to case), except "Akkukapazität" for the role
 * `battery_capacity`. M-04 names the label after trimming. One refinement, so a field gets one
 * message in the order length, characters, placeholder (2.0.5). Uniqueness per device type is a
 * rule of the service (`name_taken.attribute`).
 */
export function attributeLabelSchemaFor(systemRole: AttributeSystemRole | null) {
  return z
    .string()
    .trim()
    .superRefine((label, context) => {
      if (label.length < 1 || label.length > ATTRIBUTE_LABEL_MAX) {
        context.addIssue({
          code: 'custom',
          message: MESSAGES['M-02'],
          params: { code: 'attribute_label_length' },
        });
      } else if (/[{}]/u.test(label)) {
        context.addIssue({
          code: 'custom',
          message: MESSAGES['M-03'],
          params: { code: 'attribute_label_braces' },
        });
      } else if (
        isFixedPlaceholderName(label) &&
        !(systemRole === 'battery_capacity' && toKey(label) === BATTERY_CAPACITY_KEY)
      ) {
        context.addIssue({
          code: 'custom',
          message: MESSAGES['M-04'](label),
          params: { code: 'attribute_label_placeholder' },
        });
      }
    });
}

/** Label of an attribute without system role, e.g. of a new one. */
export const attributeLabelSchema = attributeLabelSchemaFor(null);

/** Unit: optional, 0–20 characters after trimming; empty is stored as `null` (3.1). */
export const attributeUnitSchema = z
  .string()
  .trim()
  .max(ATTRIBUTE_UNIT_MAX, FIELD_MESSAGES.attributeUnit)
  .nullable()
  .transform((unit) => (unit === '' ? null : unit));

/**
 * Minimum or maximum as entered (2.1): a decimal with comma or point, turned into the canonical
 * string by `canonicalBound`; `""` and `null` mean no bound. Its rules depend on the data type,
 * so `attributeDefinitionIssues` checks them.
 */
export const attributeBoundSchema = z.string().nullable();

/** A bound as entered in its canonical form (CU-013), `null` for none or a format error. */
export function canonicalBound(input: string | null): string | null {
  return input === null || input.trim() === '' ? null : parseDecimal(input);
}

const hasBound = (input: string | null) => input !== null && input.trim() !== '';

/** The definition of an attribute as far as the cross-field rules of 2.1 need it. */
export interface AttributeDefinition {
  dataType: AttributeDataType;
  systemRole: AttributeSystemRole | null;
  /** As entered or stored. */
  minValue: string | null;
  maxValue: string | null;
  pickListId: number | null;
  level: AttributeLevel;
  variantForming: boolean;
}

/** A violated cross-field rule; without `path` it is a structural error (`400`, 2.1). */
export interface AttributeDefinitionIssue {
  path?: 'minValue' | 'maxValue' | 'pickListId';
  code: string;
  message: string;
}

const BOUND_MESSAGES = {
  minValue: {
    decimal: FIELD_MESSAGES.attributeMinValueNumber,
    integer: FIELD_MESSAGES.attributeMinValueInteger,
  },
  maxValue: {
    decimal: FIELD_MESSAGES.attributeMaxValueNumber,
    integer: FIELD_MESSAGES.attributeMaxValueInteger,
  },
} as const;

/**
 * Cross-field rules of an attribute (2.1), used by the create schema, by the service on the
 * state after a change and by UI-027 before saving:
 * - minimum and maximum only for integer and decimal: a number, for integer a whole number, and
 *   minimum ≤ maximum at the field "Mindestwert" (DER-34-03);
 * - pick list required for data type `pick` (DER-34-04) and only there;
 * - "variantenbildend" only at level device and never for the role `battery_capacity`
 *   (AC-REQ-005-06, AC-REQ-005-07).
 * UI-027 offers neither bounds outside numbers, a pick list outside `pick`, nor the flag at
 * level model or for `battery_capacity`; those rules are structural errors without a field.
 */
export function attributeDefinitionIssues(
  definition: AttributeDefinition,
): AttributeDefinitionIssue[] {
  const issues: AttributeDefinitionIssue[] = [];
  const { dataType, pickListId } = definition;
  if (dataType === 'integer' || dataType === 'decimal') {
    const canonical = { minValue: null as string | null, maxValue: null as string | null };
    for (const field of ['minValue', 'maxValue'] as const) {
      const input = definition[field];
      if (!hasBound(input)) continue;
      const value = canonicalBound(input);
      if (value === null || (dataType === 'integer' && value.includes('.'))) {
        issues.push({
          path: field,
          code: 'attribute_bound_format',
          message: BOUND_MESSAGES[field][dataType],
        });
      } else {
        canonical[field] = value;
      }
    }
    const { minValue, maxValue } = canonical;
    if (minValue !== null && maxValue !== null && compareDecimal(minValue, maxValue) > 0) {
      issues.push({
        path: 'minValue',
        code: 'attribute_min_above_max',
        message: FIELD_MESSAGES.attributeMinAboveMax,
      });
    }
  } else if (hasBound(definition.minValue) || hasBound(definition.maxValue)) {
    issues.push({ code: 'attribute_bounds_not_allowed', message: '' });
  }
  if (dataType === 'pick') {
    if (pickListId === null) {
      issues.push({
        path: 'pickListId',
        code: 'attribute_pick_list_missing',
        message: FIELD_MESSAGES.attributePickListMissing,
      });
    }
  } else if (pickListId !== null) {
    issues.push({ code: 'attribute_pick_list_not_allowed', message: '' });
  }
  if (definition.variantForming) {
    if (definition.level !== 'device') {
      issues.push({ code: 'attribute_variant_flag_not_allowed', message: '' });
    } else if (definition.systemRole === 'battery_capacity') {
      issues.push({ code: 'attribute_variant_flag_battery_capacity', message: '' });
    }
  }
  return issues;
}

/** Fields of an attribute a request sets (2.1: the attribute without `id` and `version`). */
const attributeInputShape = {
  label: attributeLabelSchema,
  dataType: attributeDataTypeSchema,
  unit: attributeUnitSchema,
  unitSpacing: z.boolean(),
  minValue: attributeBoundSchema,
  maxValue: attributeBoundSchema,
  pickListId: idSchema.nullable(),
  level: attributeLevelSchema,
  variantForming: z.boolean(),
  required: z.boolean(),
  datasheetBlock: datasheetBlockSchema,
  active: z.boolean(),
};

/**
 * `POST /api/device-types/{id}/attributes`. The device type is the path, the order is the end of
 * the list, and a system role exists only in the initial settings (2.1.1), so none of them is a
 * field of the request.
 */
export const attributeCreateSchema = z
  .strictObject(attributeInputShape)
  .superRefine((attribute, context) => {
    for (const issue of attributeDefinitionIssues({ ...attribute, systemRole: null })) {
      context.addIssue({
        code: 'custom',
        path: issue.path ? [issue.path] : [],
        message: issue.message,
        params: { code: issue.code },
      });
    }
  })
  .transform((attribute) => ({
    ...attribute,
    minValue: canonicalBound(attribute.minValue),
    maxValue: canonicalBound(attribute.maxValue),
  }));
export type AttributeCreate = z.infer<typeof attributeCreateSchema>;
export type AttributeCreateInput = z.input<typeof attributeCreateSchema>;

/**
 * `PATCH /api/attributes/{id}`: the version last read and the changed fields (2.0.3). The label
 * rule depends on the system role and the cross-field rules on the stored fields, so the service
 * checks them on the merged state (`attributeLabelSchemaFor`, `attributeDefinitionIssues`).
 */
export const attributeUpdateSchema = z.strictObject({
  version: versionSchema,
  label: z.string().optional(),
  dataType: attributeDataTypeSchema.optional(),
  unit: attributeUnitSchema.optional(),
  unitSpacing: z.boolean().optional(),
  minValue: attributeBoundSchema.optional(),
  maxValue: attributeBoundSchema.optional(),
  pickListId: idSchema.nullable().optional(),
  level: attributeLevelSchema.optional(),
  variantForming: z.boolean().optional(),
  required: z.boolean().optional(),
  datasheetBlock: datasheetBlockSchema.optional(),
  active: z.boolean().optional(),
});
export type AttributeUpdate = z.infer<typeof attributeUpdateSchema>;
export type AttributeUpdateInput = z.input<typeof attributeUpdateSchema>;

/** `PUT /api/device-types/{id}/attribute-order`: the version of the device type and all ids. */
export const attributeOrderSchema = z.strictObject({
  version: versionSchema,
  attributeIds: z.array(idSchema),
});
export type AttributeOrder = z.infer<typeof attributeOrderSchema>;

/** Attribute in the answers of the attribute endpoints (2.1, fields of 3.1). */
export const attributeSchema = z.object({
  id: idSchema,
  deviceTypeId: idSchema,
  label: z.string(),
  dataType: attributeDataTypeSchema,
  systemRole: attributeSystemRoleSchema.nullable(),
  unit: z.string().nullable(),
  unitSpacing: z.boolean(),
  /** Canonical decimal string (2.0.1), only for `integer` and `decimal`. */
  minValue: z.string().nullable(),
  maxValue: z.string().nullable(),
  pickListId: idSchema.nullable(),
  level: attributeLevelSchema,
  variantForming: z.boolean(),
  required: z.boolean(),
  datasheetBlock: datasheetBlockSchema,
  sortOrder: z.int(),
  active: z.boolean(),
  version: versionSchema,
});
export type Attribute = z.infer<typeof attributeSchema>;

/** Item of `GET /api/device-types/{id}/attributes`: `hasValues` locks data type and level. */
export const attributeWithUsageSchema = attributeSchema.extend({ hasValues: z.boolean() });
export type AttributeWithUsage = z.infer<typeof attributeWithUsageSchema>;

/** `GET /api/device-types/{id}/attributes`. */
export const attributeListSchema = listResponseSchema(attributeWithUsageSchema);
export type AttributeList = z.infer<typeof attributeListSchema>;
