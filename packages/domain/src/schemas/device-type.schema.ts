import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { idSchema, listResponseSchema, versionSchema } from './common.schema.ts';

// Device type (REQ-004; Technical Specification 2.1, 3.1).

/** Longest name of a device type after trimming (2.1, 3.1). */
export const DEVICE_TYPE_NAME_MAX = 50;

/**
 * Name of a device type: 1–50 characters after removing the spaces at the edges; one text for
 * empty and too long (UI-027 "Name: 1 bis 50 Zeichen"). Uniqueness over `name_key` is a rule of
 * the service (`name_taken.device_type`).
 */
export const deviceTypeNameSchema = z
  .string()
  .trim()
  .min(1, FIELD_MESSAGES.deviceTypeName)
  .max(DEVICE_TYPE_NAME_MAX, FIELD_MESSAGES.deviceTypeName);

/** `POST /api/device-types`. */
export const deviceTypeCreateSchema = z.strictObject({
  name: deviceTypeNameSchema,
  active: z.boolean(),
});
export type DeviceTypeCreate = z.infer<typeof deviceTypeCreateSchema>;

/** `PATCH /api/device-types/{id}`: the version last read and the changed fields (2.0.3). */
export const deviceTypeUpdateSchema = z.strictObject({
  version: versionSchema,
  name: deviceTypeNameSchema.optional(),
  active: z.boolean().optional(),
});
export type DeviceTypeUpdate = z.infer<typeof deviceTypeUpdateSchema>;

/** Device type in the answers of `GET`, `POST` and `PATCH` (2.1). */
export const deviceTypeSchema = z.object({
  id: idSchema,
  name: z.string(),
  active: z.boolean(),
  version: versionSchema,
  attributeCount: z.int().nonnegative(),
});
export type DeviceType = z.infer<typeof deviceTypeSchema>;

/** `GET /api/device-types`. */
export const deviceTypeListSchema = listResponseSchema(deviceTypeSchema);
export type DeviceTypeList = z.infer<typeof deviceTypeListSchema>;
