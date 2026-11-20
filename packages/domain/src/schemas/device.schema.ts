import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { type AttributeValueDefinition, attributeValuesSchema } from './attribute-values.schema.ts';
import {
  dateSchema,
  idSchema,
  pageQuerySchema,
  timestampSchema,
  versionSchema,
} from './common.schema.ts';
import { CONDITION_CODE_MAX } from './condition-code.schema.ts';
import type { BatteryValueFlag } from './pick-list.schema.ts';

// Device (REQ-012 to REQ-015; Technical Specification 2.5, 3.3, 3.4).

/** WI-Nr: 1–20 letters and digits, nothing else, not even spaces (Requirements 9.6, 2.5). */
const WI_NR_PATTERN = /^[A-Za-z0-9]{1,20}$/;

/** Longest condition description after trimming (3.3). */
export const CONDITION_DESCRIPTION_MAX = 1000;

/** Visual grade as entered: digits only, spaces at the edges removed. */
const VISUAL_GRADE_INPUT = /^[0-9]+$/;

/**
 * WI-Nr (2.5, AC-REQ-012-03): one refinement with one text for empty, too long and a wrong
 * character (`wi_nr_format`). Nothing is trimmed, so a WI-Nr with a space is rejected.
 */
export const wiNrSchema = z.string().superRefine((wiNr, context) => {
  if (WI_NR_PATTERN.test(wiNr)) return;
  context.addIssue({
    code: 'custom',
    message: FIELD_MESSAGES.wiNr,
    params: { code: 'wi_nr_format' },
  });
});

/** `device.wi_nr_key` (3.3): the WI-Nr in lower case, unique without regard to case. */
export const toWiNrKey = (wiNr: string) => wiNr.toLowerCase();

/** A required choice: `null` is "nothing chosen" and fails with the text of the field (2.0.5). */
const requiredChoice = (message: string) =>
  idSchema.nullable().refine((id): id is number => id !== null, message);

/**
 * Visual grade (2.5): a whole number 1–5, entered as text or sent as number; one text for
 * missing and wrong (UI-003 `screen.md`). Stored as number.
 */
const visualGradeSchema = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((input, context) => {
    const text = typeof input === 'string' ? input.trim() : null;
    const value = text === null ? input : VISUAL_GRADE_INPUT.test(text) ? Number(text) : null;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
      return value;
    }
    context.addIssue({ code: 'custom', message: FIELD_MESSAGES.visualGrade });
    return z.NEVER;
  });

/** Condition description: 0–1,000 characters after trimming (3.3). */
const conditionDescriptionSchema = z
  .string()
  .trim()
  .max(CONDITION_DESCRIPTION_MAX, FIELD_MESSAGES.conditionDescription);

/**
 * Condition code as entered (REQ-015, 3.3): spaces at the edges removed, empty is no code. Its
 * length is checked with the request (`deviceCreateBodySchema`): UI-003 takes at most 20 characters.
 */
const conditionCodeInputSchema = z
  .string()
  .nullable()
  .optional()
  .transform((code) => {
    const trimmed = code?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
  });

/** Attribute values by attribute id before they are checked against the attribute definitions. */
const anyValuesSchema = z.record(z.string(), z.unknown());

/**
 * Shape of `POST /api/devices` (2.5) as the route checks it: only types, missing and unknown
 * fields (`400 bad_request`, 2.0.5). Every rule the user can violate is left to
 * `deviceCreateSchema`, which the service runs once it knows the attributes of the device type,
 * so all field errors of a request come in one answer (2.5 "Ablehnung"). `web-ui` sends every
 * field, nothing chosen as `null` and an empty input as `""`.
 */
export const deviceCreateBodySchema = z.strictObject({
  wiNr: z.string(),
  supplierId: idSchema.nullable(),
  // UI-003 takes at most 20 characters (screen.md "Eingaben"); the text of the code (3.1).
  conditionCode: z
    .string()
    .max(CONDITION_CODE_MAX, FIELD_MESSAGES.conditionCode)
    .nullable()
    .optional(),
  modelTemplateId: idSchema.nullable(),
  conditionValueId: idSchema.nullable(),
  visualGrade: z.union([z.number(), z.string()]).nullable(),
  conditionDescription: z.string(),
  values: anyValuesSchema,
  confirmedKeys: z.array(z.string()),
});
export type DeviceCreateInput = z.input<typeof deviceCreateBodySchema>;

/**
 * Rules of `POST /api/devices` (2.5): WI-Nr, model template, condition, visual grade, condition
 * description and the values of the level device, built at run time from the attributes of the
 * device type of the model template (CU-067) with the values of the list battery for the rule of
 * the battery capacity. Without attributes (`null`: no model template chosen yet) the values are
 * not checked. UI-003 checks the form with it, CU-121 the request.
 */
export function deviceCreateSchema(
  attributes: readonly AttributeValueDefinition[] | null,
  { batteryValues = [] }: { batteryValues?: readonly BatteryValueFlag[] } = {},
) {
  return z.strictObject({
    wiNr: wiNrSchema,
    supplierId: idSchema.nullable(),
    conditionCode: conditionCodeInputSchema,
    modelTemplateId: requiredChoice(FIELD_MESSAGES.modelTemplateMissing),
    conditionValueId: requiredChoice(FIELD_MESSAGES.conditionMissing),
    visualGrade: visualGradeSchema,
    conditionDescription: conditionDescriptionSchema,
    values:
      attributes === null
        ? anyValuesSchema
        : attributeValuesSchema(attributes, 'device', { batteryValues }),
    confirmedKeys: z.array(z.string()),
  });
}
export type DeviceCreate = z.output<ReturnType<typeof deviceCreateSchema>>;

/**
 * Shape of `PATCH /api/devices/{id}` for the device values of UI-010 (2.5) as the route checks
 * it: a missing field stays unchanged, `values` holds changes (a key overwrites, `null` removes;
 * `mergeAttributeValues`). The rules apply to the state after the change (`deviceValuesSchema`).
 * `deviationDecision` decides on the deviation of an assigned device from its model listing (2.5,
 * UI-005 Kontext B): `keep` stores the values and keeps the assignment; `new_listing` (#201) and
 * `rebook` with `targetListingId` and `confirmTargetDeviation` (#202) follow.
 */
export const deviceUpdateBodySchema = z.strictObject({
  version: versionSchema,
  conditionValueId: idSchema.nullable().optional(),
  visualGrade: z.union([z.number(), z.string()]).nullable().optional(),
  conditionDescription: z.string().optional(),
  values: anyValuesSchema.optional(),
  confirmedKeys: z.array(z.string()),
  deviationDecision: z.enum(['keep']).optional(),
});
export type DeviceUpdateInput = z.input<typeof deviceUpdateBodySchema>;

/**
 * Rules of the device values (2.5) on the complete state of a device after a change: condition,
 * visual grade, condition description and the values of the level device by the attributes of
 * its device type (CU-067), the battery capacity by the values of the list battery. UI-010
 * checks its form with it, CU-121 the state after `PATCH /api/devices/{id}`.
 */
export function deviceValuesSchema(
  attributes: readonly AttributeValueDefinition[],
  { batteryValues = [] }: { batteryValues?: readonly BatteryValueFlag[] } = {},
) {
  return z.strictObject({
    conditionValueId: requiredChoice(FIELD_MESSAGES.conditionMissing),
    visualGrade: visualGradeSchema,
    conditionDescription: conditionDescriptionSchema,
    values: attributeValuesSchema(attributes, 'device', { batteryValues }),
  });
}
export type DeviceValues = z.output<ReturnType<typeof deviceValuesSchema>>;
export type DeviceValuesInput = z.input<ReturnType<typeof deviceValuesSchema>>;

/** Inventory status of a device (3.5). */
export const STOCK_STATUSES = ['available', 'sold', 'cancelled'] as const;
/** Capture status: `review_pending` while review flags remain (REQ-013). */
export const CAPTURE_STATUSES = ['checked', 'review_pending'] as const;

/**
 * Device in the answers of `POST /api/devices` and `GET /api/devices/{id}` (2.5, 3.3): without
 * `listingId` it is "nicht zugeordnet". Sale and cancellation follow with their tasks (S9).
 */
export const deviceSchema = z.object({
  id: idSchema,
  wiNr: z.string(),
  modelTemplateId: idSchema,
  listingId: idSchema.nullable(),
  supplierId: idSchema.nullable(),
  conditionCode: z.string().nullable(),
  conditionValueId: idSchema,
  visualGrade: z.int(),
  conditionDescription: z.string(),
  values: anyValuesSchema,
  reviewKeys: z.array(z.string()),
  captureStatus: z.enum(CAPTURE_STATUSES),
  stockStatus: z.enum(STOCK_STATUSES),
  capturedAt: timestampSchema,
  capturedOn: dateSchema,
  version: versionSchema,
  updatedAt: timestampSchema,
});
export type Device = z.infer<typeof deviceSchema>;

/** The model listing of a device by its display title, `null` for "nicht zugeordnet" (2.5). */
const deviceListingSchema = z.object({ id: idSchema, title: z.string() }).nullable();

/**
 * `GET /api/model-templates/{id}/device-prefill?conditionCode=&supplierId=` (2.5, CU-293): the
 * prefill of CU-117 with its review flags and the result of the condition code (`found: false`
 * without a code or for an unknown one).
 */
export const devicePrefillSchema = z.object({
  conditionValueId: idSchema.nullable(),
  visualGrade: z.int().nullable(),
  conditionDescription: z.string(),
  values: anyValuesSchema,
  reviewKeys: z.array(z.string()),
  codeResult: z.object({ found: z.boolean(), plainText: z.string().nullable() }),
});
export type DevicePrefillAnswer = z.infer<typeof devicePrefillSchema>;

/**
 * `GET /api/devices/{id}` (2.5): the device with the name of its model template (head of UI-010,
 * #187) and its model listing (display title) or `null` for "nicht zugeordnet". The other model
 * data, sale and cancellation follow with #190 and S9.
 */
export const deviceDetailSchema = deviceSchema.extend({
  modelTemplateLabel: z.string(),
  listing: deviceListingSchema,
});
export type DeviceDetail = z.infer<typeof deviceDetailSchema>;

/**
 * Query of the device search `GET /api/devices?wiNr=&limit=&offset=` (2.5, REQ-016): a part of
 * the WI-Nr with at least 1 character, paged after 2.0.1. The user interface never sends an
 * empty term, so a missing or empty one is a wrong request (`400 bad_request`, 2.0.5).
 */
export const deviceSearchQuerySchema = pageQuerySchema.extend({ wiNr: z.string().min(1) });

/**
 * A hit of the device search (2.5): every inventory status, a cancelled device with its status
 * (AC-REQ-012-05); `listing` is `null` for "nicht zugeordnet".
 */
export const deviceSearchItemSchema = z.object({
  id: idSchema,
  wiNr: z.string(),
  modelTemplateLabel: z.string(),
  listing: deviceListingSchema,
  stockStatus: z.enum(STOCK_STATUSES),
  captureStatus: z.enum(CAPTURE_STATUSES),
});
export type DeviceSearchItem = z.infer<typeof deviceSearchItemSchema>;

/** Answer of the device search (2.5): the hits of the page, without `total` (Nachtrag MAR-1030). */
export const deviceSearchResultSchema = z.object({ items: z.array(deviceSearchItemSchema) });
export type DeviceSearchResult = z.infer<typeof deviceSearchResultSchema>;
