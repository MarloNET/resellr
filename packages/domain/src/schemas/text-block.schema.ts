import { z } from 'zod';

import { FIELD_MESSAGES, MESSAGES } from '../messages/messages.de.ts';
import {
  dateSchema,
  idSchema,
  impactSchema,
  listResponseSchema,
  versionSchema,
} from './common.schema.ts';

// Text block (REQ-026, REQ-054; Technical Specification 2.2, 3.1). The scope follows with #163.

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

/** Legal check status of a text block (3.1 `text_block.legal_status`, REQ-054). */
export const TEXT_BLOCK_LEGAL_STATUSES = ['unchecked', 'checked'] as const;
export const textBlockLegalStatusSchema = z.enum(TEXT_BLOCK_LEGAL_STATUSES);
export type TextBlockLegalStatus = z.infer<typeof textBlockLegalStatusSchema>;

/** Names of the legal check status as UI-030 shows them. */
export const TEXT_BLOCK_LEGAL_STATUS_LABELS: Record<TextBlockLegalStatus, string> = {
  unchecked: 'rechtlich ungeprüft',
  checked: 'rechtlich geprüft',
};

/** Only the kinds "Rechtliches" and "Akku-Hinweis" have a legal check status (2.2, DER-40-05). */
export const hasLegalStatus = (kind: TextBlockKind): boolean =>
  kind === 'legal' || kind === 'battery_notice';

/** Longest checking body after trimming (3.1 `legal_checked_by`). */
export const TEXT_BLOCK_LEGAL_CHECKED_BY_MAX = 100;

/**
 * Check date `YYYY-MM-DD`, `""` while empty (2.0.5 rule (1)). The date input of UI-030 sends
 * only these two forms, so any other is a structural error without a field (rule (4), see
 * `textBlockUpdateSchema`). "Not in the future" needs the day of the server and is a rule of
 * `legalCheckIssues`.
 */
const isCheckDate = (value: string) => value === '' || dateSchema.safeParse(value).success;

/**
 * Checking body, `""` while empty: at most 100 characters after trimming (M-31, O-3). Missing at
 * "rechtlich geprüft" is M-24 of `legalCheckIssues`.
 */
export const textBlockLegalCheckedBySchema = z
  .string()
  .trim()
  .max(TEXT_BLOCK_LEGAL_CHECKED_BY_MAX, MESSAGES['M-31']);

/** Legal check fields of a text block as the form and the service check them together. */
export interface TextBlockLegalCheck {
  legalStatus: TextBlockLegalStatus;
  /** `YYYY-MM-DD` or `""`. */
  legalCheckedOn: string;
  /** Trimmed, or `""`. */
  legalCheckedBy: string;
}

export interface TextBlockLegalIssue {
  path: 'legalCheckedOn' | 'legalCheckedBy';
  code: 'legal_check_required' | 'legal_checked_on_future';
  message: string;
}

/**
 * Rules over the legal check fields (2.2, K-05), used by the service on the state after a change
 * and by UI-030 before saving, each with its own "today" (`YYYY-MM-DD`):
 * - "rechtlich geprüft" needs check date and checking body; one entry per missing field, all
 *   with the one text M-24 (AC-REQ-054-03, DER-40-01);
 * - a check date after today is rejected at the field "Prüfdatum" (DER-40-02).
 * "rechtlich ungeprüft" has no rule; its date and body are not stored.
 */
export function legalCheckIssues(
  { legalStatus, legalCheckedOn, legalCheckedBy }: TextBlockLegalCheck,
  today: string,
): TextBlockLegalIssue[] {
  if (legalStatus !== 'checked') return [];
  const issues: TextBlockLegalIssue[] = [];
  const required = { code: 'legal_check_required', message: MESSAGES['M-24'] } as const;
  if (legalCheckedOn === '') issues.push({ path: 'legalCheckedOn', ...required });
  else if (legalCheckedOn > today) {
    issues.push({
      path: 'legalCheckedOn',
      code: 'legal_checked_on_future',
      message: FIELD_MESSAGES.legalCheckedOnFuture,
    });
  }
  if (legalCheckedBy === '') issues.push({ path: 'legalCheckedBy', ...required });
  return issues;
}

/**
 * `POST /api/text-blocks`: a new text block is active; one of the kinds "Rechtliches" and
 * "Akku-Hinweis" is "rechtlich ungeprüft" (AC-REQ-054-04), so the request has no check fields.
 */
export const textBlockCreateSchema = z.strictObject({
  name: textBlockNameSchema,
  kind: textBlockKindSchema,
  body: textBlockBodySchema,
});
export type TextBlockCreate = z.infer<typeof textBlockCreateSchema>;

/**
 * `PATCH /api/text-blocks/{id}`: the version last read and the changed fields (2.0.3). UI-030
 * sends the three check fields together; the service checks them on the state after the change
 * (`legalCheckIssues`).
 */
export const textBlockUpdateSchema = z
  .strictObject({
    version: versionSchema,
    name: textBlockNameSchema.optional(),
    kind: textBlockKindSchema.optional(),
    body: textBlockBodySchema.optional(),
    active: z.boolean().optional(),
    legalStatus: textBlockLegalStatusSchema.optional(),
    legalCheckedOn: z.string().optional(),
    legalCheckedBy: textBlockLegalCheckedBySchema.optional(),
  })
  .superRefine(({ legalCheckedOn }, context) => {
    if (legalCheckedOn !== undefined && !isCheckDate(legalCheckedOn)) {
      context.addIssue({
        code: 'custom',
        path: [],
        message: '',
        params: { code: 'legal_checked_on_format' },
      });
    }
  });
export type TextBlockUpdate = z.infer<typeof textBlockUpdateSchema>;

/** Text block in the answers (2.2, 3.1). */
export const textBlockSchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: textBlockKindSchema,
  body: z.string(),
  active: z.boolean(),
  /** `null` for the kinds without a legal check status (DER-40-05). */
  legalStatus: textBlockLegalStatusSchema.nullable(),
  /** Only at "rechtlich geprüft". */
  legalCheckedOn: dateSchema.nullable(),
  legalCheckedBy: z.string().nullable(),
  version: versionSchema,
});
export type TextBlock = z.infer<typeof textBlockSchema>;

/** `GET /api/text-blocks`. */
export const textBlockListSchema = listResponseSchema(textBlockSchema);
export type TextBlockList = z.infer<typeof textBlockListSchema>;

/** Answer of `POST /api/text-blocks` (`201`): `{ textBlock, impact }` (2.2). */
export const textBlockSaveResultSchema = z.object({
  textBlock: textBlockSchema,
  impact: impactSchema,
});
export type TextBlockSaveResult = z.infer<typeof textBlockSaveResultSchema>;

/**
 * Answer of `PATCH /api/text-blocks/{id}`: `{ textBlock, impact, legalStatusReset }` (2.2);
 * `legalStatusReset` is true if a change of the text set "rechtlich geprüft" back (DER-40-03).
 */
export const textBlockUpdateResultSchema = textBlockSaveResultSchema.extend({
  legalStatusReset: z.boolean(),
});
export type TextBlockUpdateResult = z.infer<typeof textBlockUpdateResultSchema>;
