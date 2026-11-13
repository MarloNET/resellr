import { z } from 'zod';

import { FIELD_MESSAGES, MESSAGES } from '../messages/messages.de.ts';
import { idSchema, impactSchema, listResponseSchema, versionSchema } from './common.schema.ts';

// Text block (REQ-026; Technical Specification 2.2, 3.1). The scope follows with #163, the
// legal check status with #164.

/** Kinds of a text block (3.1 `text_block.kind`). */
export const TEXT_BLOCK_KINDS = [
  'battery_notice',
  'delivery_scope',
  'pickup_contact',
  'legal',
  'other',
] as const;
export const textBlockKindSchema = z.enum(TEXT_BLOCK_KINDS);
export type TextBlockKind = z.infer<typeof textBlockKindSchema>;

/** Names of the kinds as REQ-026 and UI-030 show them. */
export const TEXT_BLOCK_KIND_LABELS: Record<TextBlockKind, string> = {
  battery_notice: 'Akku-Hinweis',
  delivery_scope: 'Lieferumfang',
  pickup_contact: 'Abholung/Kontakt',
  legal: 'Rechtliches',
  other: 'Sonstiges',
};

/** Longest name of a text block after trimming (3.1). */
export const TEXT_BLOCK_NAME_MAX = 100;

/** Longest text of a text block (3.1). */
export const TEXT_BLOCK_BODY_MAX = 5000;

/**
 * Name of a text block: 1–100 characters after removing the spaces at the edges; one text for
 * empty and too long (M-30, O-3). Uniqueness over `name_key` is a rule of the service (2.2).
 */
export const textBlockNameSchema = z
  .string()
  .trim()
  .min(1, MESSAGES['M-30'])
  .max(TEXT_BLOCK_NAME_MAX, MESSAGES['M-30']);

/**
 * Text of a text block: 1–5,000 characters, stored as entered (UI-030 "Text: 1 bis 5.000
 * Zeichen", 8.2). The placeholders are checked by the service, which knows the attribute
 * labels (Requirements chapter 9.7).
 */
export const textBlockBodySchema = z
  .string()
  .min(1, FIELD_MESSAGES.textBlockBody)
  .max(TEXT_BLOCK_BODY_MAX, FIELD_MESSAGES.textBlockBody);

/** `POST /api/text-blocks`: a new text block is active. */
export const textBlockCreateSchema = z.strictObject({
  name: textBlockNameSchema,
  kind: textBlockKindSchema,
  body: textBlockBodySchema,
});
export type TextBlockCreate = z.infer<typeof textBlockCreateSchema>;

/** `PATCH /api/text-blocks/{id}`: the version last read and the changed fields (2.0.3). */
export const textBlockUpdateSchema = z.strictObject({
  version: versionSchema,
  name: textBlockNameSchema.optional(),
  kind: textBlockKindSchema.optional(),
  body: textBlockBodySchema.optional(),
  active: z.boolean().optional(),
});
export type TextBlockUpdate = z.infer<typeof textBlockUpdateSchema>;

/** Text block in the answers (2.2, 3.1). */
export const textBlockSchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: textBlockKindSchema,
  body: z.string(),
  active: z.boolean(),
  version: versionSchema,
});
export type TextBlock = z.infer<typeof textBlockSchema>;

/** `GET /api/text-blocks`. */
export const textBlockListSchema = listResponseSchema(textBlockSchema);
export type TextBlockList = z.infer<typeof textBlockListSchema>;

/** Answer of `POST` (`201`) and `PATCH /api/text-blocks/{id}`: `{ textBlock, impact }` (2.2). */
export const textBlockSaveResultSchema = z.object({
  textBlock: textBlockSchema,
  impact: impactSchema,
});
export type TextBlockSaveResult = z.infer<typeof textBlockSaveResultSchema>;
