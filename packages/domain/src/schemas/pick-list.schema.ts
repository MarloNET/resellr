import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { idSchema, listResponseSchema, versionSchema } from './common.schema.ts';

// Pick lists and their values (REQ-007; Technical Specification 2.1, 3.1).

/** Keys of the nine pick lists of the initial settings (3.1); there are no others (RQ-07). */
export const PICK_LIST_KEYS = [
  'condition',
  'keyboard_layout',
  'power_supply',
  'battery',
  'storage_type',
  'display_surface',
  'operating_system',
  'port_type',
  'port_position',
] as const;
export type PickListKey = (typeof PICK_LIST_KEYS)[number];

/** Longest value after trimming (3.1). */
export const PICK_LIST_VALUE_LABEL_MAX = 100;

/**
 * Value of a list: 1–100 characters after removing the spaces at the edges. Uniqueness per list
 * without regard to case is a rule of the service (`name_taken.pick_list_value`, AC-REQ-007-02).
 */
export const pickListValueLabelSchema = z
  .string()
  .trim()
  .min(1, FIELD_MESSAGES.pickListValueLabel)
  .max(PICK_LIST_VALUE_LABEL_MAX, FIELD_MESSAGES.pickListValueLabel);

/**
 * Flag "Akku vorhanden" of a value of the list battery: required there (REQ-007, DER-35-10).
 * Requests carry `null` for an empty choice (2.0.5 rule (1)); the service applies this schema
 * only to the list battery, because only it knows the list.
 */
export const batteryPresentRequiredSchema = z
  .boolean()
  .nullable()
  .refine((value) => value !== null, {
    message: FIELD_MESSAGES.batteryPresentMissing,
    params: { code: 'battery_present_missing' },
  });

/** `POST /api/pick-lists/{id}/values`; `batteryPresent` only in the list battery. */
export const pickListValueCreateSchema = z.strictObject({
  label: pickListValueLabelSchema,
  active: z.boolean(),
  batteryPresent: z.boolean().nullable().optional(),
});
export type PickListValueCreate = z.infer<typeof pickListValueCreateSchema>;

/** `PATCH /api/pick-list-values/{id}`: the version last read and the changed fields (2.0.3). */
export const pickListValueUpdateSchema = z.strictObject({
  version: versionSchema,
  label: pickListValueLabelSchema.optional(),
  active: z.boolean().optional(),
  batteryPresent: z.boolean().nullable().optional(),
});
export type PickListValueUpdate = z.infer<typeof pickListValueUpdateSchema>;

/** `PUT /api/pick-lists/{id}/value-order`: the version of the list and all its value ids. */
export const pickListValueOrderSchema = z.strictObject({
  version: versionSchema,
  valueIds: z.array(idSchema),
});
export type PickListValueOrder = z.infer<typeof pickListValueOrderSchema>;

/** Pick list in the answers of `GET /api/pick-lists` and of the value order (2.1). */
export const pickListSchema = z.object({
  id: idSchema,
  key: z.enum(PICK_LIST_KEYS),
  name: z.string(),
  isBatteryList: z.boolean(),
  /** Version of the order of its values (3.1, 2.0.3). */
  version: versionSchema,
});
export type PickList = z.infer<typeof pickListSchema>;

/** `GET /api/pick-lists`. */
export const pickListListSchema = listResponseSchema(pickListSchema);
export type PickListList = z.infer<typeof pickListListSchema>;

/** Value in the answers of `GET`, `POST` and `PATCH` (2.1); `batteryPresent` is `null` outside the list battery. */
export const pickListValueSchema = z.object({
  id: idSchema,
  label: z.string(),
  active: z.boolean(),
  batteryPresent: z.boolean().nullable(),
  sortOrder: z.int().positive(),
  version: versionSchema,
});
export type PickListValue = z.infer<typeof pickListValueSchema>;

/** `GET /api/pick-lists/{id}/values`. */
export const pickListValueListSchema = listResponseSchema(pickListValueSchema);
export type PickListValueList = z.infer<typeof pickListValueListSchema>;
