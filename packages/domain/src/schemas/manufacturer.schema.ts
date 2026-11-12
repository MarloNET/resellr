import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { idSchema, impactSchema, listResponseSchema, versionSchema } from './common.schema.ts';

// Manufacturer (REQ-100, REQ-101; Technical Specification 2.2, 3.1). The GPSR fields, `gpsr`
// and `gpsrMissing[]` follow with #165.

/** Longest name of a manufacturer after trimming (3.1). */
export const MANUFACTURER_NAME_MAX = 50;

/**
 * Name of a manufacturer: 1–50 characters after removing the spaces at the edges; one text for
 * empty and too long (UI-008 "Name: 1 bis 50 Zeichen", AC-REQ-100-03). Uniqueness over
 * `name_key` is a rule of the service (2.2).
 */
export const manufacturerNameSchema = z
  .string()
  .trim()
  .min(1, FIELD_MESSAGES.manufacturerName)
  .max(MANUFACTURER_NAME_MAX, FIELD_MESSAGES.manufacturerName);

/** `POST /api/manufacturers`: a new manufacturer is always active (AC-REQ-100-01). */
export const manufacturerCreateSchema = z.strictObject({
  name: manufacturerNameSchema,
});
export type ManufacturerCreate = z.infer<typeof manufacturerCreateSchema>;

/** `PATCH /api/manufacturers/{id}`: the version last read and the changed fields (2.0.3). */
export const manufacturerUpdateSchema = z.strictObject({
  version: versionSchema,
  name: manufacturerNameSchema.optional(),
  active: z.boolean().optional(),
});
export type ManufacturerUpdate = z.infer<typeof manufacturerUpdateSchema>;

/** Manufacturer in the answers (2.2); `gpsrComplete` gives the chip of UI-031 (DER-37-08). */
export const manufacturerSchema = z.object({
  id: idSchema,
  name: z.string(),
  active: z.boolean(),
  gpsrComplete: z.boolean(),
  version: versionSchema,
});
export type Manufacturer = z.infer<typeof manufacturerSchema>;

/** `GET /api/manufacturers`. */
export const manufacturerListSchema = listResponseSchema(manufacturerSchema);
export type ManufacturerList = z.infer<typeof manufacturerListSchema>;

/**
 * Answer of `POST /api/manufacturers`: `201` with `existing: false` for a new manufacturer,
 * `200` with `existing: true` and the active manufacturer that already has the name
 * (AC-REQ-100-02).
 */
export const manufacturerCreateResultSchema = manufacturerSchema.extend({
  existing: z.boolean(),
});
export type ManufacturerCreateResult = z.infer<typeof manufacturerCreateResultSchema>;

/** Answer of `PATCH /api/manufacturers/{id}`: `{ manufacturer, impact }` (2.2). */
export const manufacturerUpdateResultSchema = z.object({
  manufacturer: manufacturerSchema,
  impact: impactSchema,
});
export type ManufacturerUpdateResult = z.infer<typeof manufacturerUpdateResultSchema>;
