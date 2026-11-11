import { z } from 'zod';

import { MESSAGES } from '../messages/messages.de.ts';
import { idSchema, versionSchema } from './common.schema.ts';

// Attribute of a device type (REQ-005; Technical Specification 2.1, 3.1). The request schemas
// of `POST /api/device-types/{id}/attributes` and `PATCH /api/attributes/{id}` follow with the
// attribute endpoints (#151); this file holds the values, the label rule and the answer.

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

/** Longest label of an attribute after trimming (2.1, 3.1). */
export const ATTRIBUTE_LABEL_MAX = 100;

/**
 * Label of an attribute: 1–100 characters after trimming (M-02), without `{` and `}` (M-03).
 * One refinement, so a field gets exactly one message in the order length, characters (2.0.5).
 * Uniqueness per device type and the fixed placeholder names (M-04) are rules of the service.
 */
export const attributeLabelSchema = z
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
    }
  });

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
