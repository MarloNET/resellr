import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { idSchema, listResponseSchema, versionSchema } from './common.schema.ts';

// Supplier (REQ-099; Technical Specification 2.2, 3.1). Manufacturer (#158) and condition code
// (#160) add their own files of CU-065.

/** Longest name of a supplier after trimming (3.1). */
export const SUPPLIER_NAME_MAX = 100;

/**
 * Name of a supplier: 1–100 characters after removing the spaces at the edges; one text for
 * empty and too long (UI-032 "Name: 1 bis 100 Zeichen"). Uniqueness over `name_key` is a rule of
 * the service (`name_taken.supplier`).
 */
export const supplierNameSchema = z
  .string()
  .trim()
  .min(1, FIELD_MESSAGES.supplierName)
  .max(SUPPLIER_NAME_MAX, FIELD_MESSAGES.supplierName);

/** `POST /api/suppliers`. */
export const supplierCreateSchema = z.strictObject({
  name: supplierNameSchema,
  active: z.boolean(),
});
export type SupplierCreate = z.infer<typeof supplierCreateSchema>;

/** `PATCH /api/suppliers/{id}`: the version last read and the changed fields (2.0.3). */
export const supplierUpdateSchema = z.strictObject({
  version: versionSchema,
  name: supplierNameSchema.optional(),
  active: z.boolean().optional(),
});
export type SupplierUpdate = z.infer<typeof supplierUpdateSchema>;

/** Supplier in the answers of `GET`, `POST` and `PATCH` (2.2). */
export const supplierSchema = z.object({
  id: idSchema,
  name: z.string(),
  active: z.boolean(),
  version: versionSchema,
});
export type Supplier = z.infer<typeof supplierSchema>;

/** `GET /api/suppliers`. */
export const supplierListSchema = listResponseSchema(supplierSchema);
export type SupplierList = z.infer<typeof supplierListSchema>;
