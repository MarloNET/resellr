import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { idSchema, listResponseSchema, versionSchema } from './common.schema.ts';

// Entry of the condition code table (REQ-022, REQ-015; Technical Specification 2.2, 3.1).

/** Longest condition code after trimming (3.1). */
export const CONDITION_CODE_MAX = 20;

/** Longest plain text after trimming (3.1). */
export const CONDITION_CODE_PLAIN_TEXT_MAX = 500;

/**
 * Condition code: 1–20 characters after removing the spaces at the edges (UI-033 "Zustandscode:
 * 1 bis 20 Zeichen"). Uniqueness of code (without regard to case) and supplier is a rule of the
 * service (`name_taken.condition_code`).
 */
export const conditionCodeSchema = z
  .string()
  .trim()
  .min(1, FIELD_MESSAGES.conditionCode)
  .max(CONDITION_CODE_MAX, FIELD_MESSAGES.conditionCode);

/**
 * Plain text: 1–500 characters after trimming; one text for empty and too long (design v0.6.2
 * O-2: "Klartext: 1 bis 500 Zeichen", no "Klartext fehlt").
 */
export const conditionCodePlainTextSchema = z
  .string()
  .trim()
  .min(1, FIELD_MESSAGES.conditionCodePlainText)
  .max(CONDITION_CODE_PLAIN_TEXT_MAX, FIELD_MESSAGES.conditionCodePlainText);

/**
 * Suggested visual grade: whole number 1–5 or none (REQ-022, Requirements "Optik-Note"). A number
 * that is not whole is a rule violation with the field text, not a structural error (`custom`
 * instead of `invalid_type`, 2.0.5).
 */
export const suggestedVisualGradeSchema = z
  .number()
  .refine(Number.isInteger, FIELD_MESSAGES.visualGrade)
  .min(1, FIELD_MESSAGES.visualGrade)
  .max(5, FIELD_MESSAGES.visualGrade)
  .nullable();

/** `POST /api/condition-codes`: the entry without `id`; `null` = without supplier/suggestion. */
export const conditionCodeCreateSchema = z.strictObject({
  code: conditionCodeSchema,
  supplierId: idSchema.nullable().default(null),
  plainText: conditionCodePlainTextSchema,
  suggestedConditionValueId: idSchema.nullable().default(null),
  suggestedVisualGrade: suggestedVisualGradeSchema.default(null),
});
export type ConditionCodeCreate = z.input<typeof conditionCodeCreateSchema>;

/** `PATCH /api/condition-codes/{id}`: the version last read and the changed fields (2.0.3). */
export const conditionCodeUpdateSchema = z.strictObject({
  version: versionSchema,
  code: conditionCodeSchema.optional(),
  supplierId: idSchema.nullable().optional(),
  plainText: conditionCodePlainTextSchema.optional(),
  suggestedConditionValueId: idSchema.nullable().optional(),
  suggestedVisualGrade: suggestedVisualGradeSchema.optional(),
});
export type ConditionCodeUpdate = z.infer<typeof conditionCodeUpdateSchema>;

/** Entry in the answers of `GET`, `POST` and `PATCH` (2.2). */
export const conditionCodeEntrySchema = z.object({
  id: idSchema,
  code: z.string(),
  supplierId: idSchema.nullable(),
  plainText: z.string(),
  suggestedConditionValueId: idSchema.nullable(),
  suggestedVisualGrade: z.int().nullable(),
  version: versionSchema,
});
export type ConditionCodeEntry = z.infer<typeof conditionCodeEntrySchema>;

/** `GET /api/condition-codes`. */
export const conditionCodeListSchema = listResponseSchema(conditionCodeEntrySchema);
export type ConditionCodeList = z.infer<typeof conditionCodeListSchema>;

/** Answer of `GET /api/condition-codes/resolve` (2.2 "Auflösen eines Codes", REQ-015). */
export const conditionCodeResolutionSchema = z.object({
  found: z.boolean(),
  plainText: z.string().nullable(),
  suggestedConditionValueId: idSchema.nullable(),
  suggestedVisualGrade: z.int().nullable(),
});
export type ConditionCodeResolution = z.infer<typeof conditionCodeResolutionSchema>;
