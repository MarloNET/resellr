import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { idSchema, versionSchema } from './common.schema.ts';
import { deviceSchema } from './device.schema.ts';

// Model listing (REQ-017, REQ-019, REQ-088; Technical Specification 2.6, 2.7, 3.3). The detail
// of UI-014 follows with #198, changing with #200.

/** Article number: 1–30 letters, digits and "-" (2.7, 3.3). */
const ARTICLE_NUMBER_PATTERN = /^[A-Za-z0-9-]{1,30}$/;

/** Article number as entered in UI-004 (2.6, 2.7). */
export const articleNumberSchema = z
  .string()
  .regex(ARTICLE_NUMBER_PATTERN, { message: FIELD_MESSAGES.articleNumber });

/** `listing.article_number_key` (3.3): the article number in lower case, unique without case. */
export const toArticleNumberKey = (articleNumber: string) => articleNumber.toLowerCase();

/**
 * `POST /api/listings` (2.6): a new model listing from a checked device of the version the user
 * saw. Without `articleNumber` the WI-Nr of the device becomes the article number; UI-004 only
 * sends one after `article_number_taken` (DER-60-04).
 */
export const listingCreateBodySchema = z.strictObject({
  fromDeviceId: idSchema,
  deviceVersion: versionSchema,
  articleNumber: articleNumberSchema.optional(),
});
export type ListingCreateInput = z.input<typeof listingCreateBodySchema>;

/** EAN marking of a model listing (3.3): the original EAN of the model template or an own one. */
export const EAN_MODES = ['original', 'own'] as const;

/** Values of the attributes of the level device by attribute id (3.4). */
const valuesSchema = z.record(z.string(), z.unknown());

/**
 * A model listing in the answer of `POST /api/listings` and `PATCH /api/listings/{id}` (2.6, 3.3,
 * Nachtrag MAR-1053): the fields of the `PATCH` request with the display title, the quantity and
 * the version; the delivery scope as text block ids in their order, empty after creating. Prices,
 * devices and stock data come with `GET /api/listings/{id}` (#198).
 */
export const listingSchema = z.object({
  id: idSchema,
  modelTemplateId: idSchema,
  conditionValueId: idSchema,
  visualGrade: z.int(),
  conditionDescription: z.string(),
  variantValues: valuesSchema,
  otherValues: valuesSchema,
  deliveryScopeTextBlockIds: z.array(idSchema),
  articleNumber: z.string(),
  eanMode: z.enum(EAN_MODES),
  ownEan: z.string().nullable(),
  displayTitle: z.string(),
  quantity: z.int().min(0),
  version: versionSchema,
});
export type Listing = z.infer<typeof listingSchema>;

/**
 * The variant data of a model listing as UI-004 lists them (2.6, 2.14 `variantSummary`):
 * condition, visual grade, condition description and the variant attributes with their readable
 * values in the order of the attributes.
 */
export const variantSummarySchema = z.object({
  conditionLabel: z.string(),
  visualGrade: z.int(),
  conditionDescription: z.string(),
  variantValues: z.array(z.object({ label: z.string(), value: z.string() })),
});
export type VariantSummary = z.infer<typeof variantSummarySchema>;

/**
 * A deviating item of the variant data of a device from a model listing with formatted values
 * (CU-119, REQ-018; 2.6), e.g. `RAM`, `8GB`, `16GB`; "–" for a missing value.
 */
export const variantDeviationSchema = z.object({
  key: z.string(),
  label: z.string(),
  deviceValue: z.string(),
  listingValue: z.string(),
});
export type VariantDeviationItem = z.infer<typeof variantDeviationSchema>;

/** `?deviceId=` of `GET /api/model-templates/{id}/listings` (2.6): the device to compare with. */
export const listingChoiceQuerySchema = z.strictObject({
  deviceId: z.coerce.number().pipe(idSchema).optional(),
});

/**
 * `GET /api/model-templates/{id}/listings` (2.6, CU-294): the model listings of a model template
 * to choose from in UI-004, by `id`; with `deviceId` each with its deviations to that device
 * (UI-004, UI-005; empty = matches).
 */
export const listingChoiceSchema = z.object({
  items: z.array(
    z.object({
      id: idSchema,
      displayTitle: z.string(),
      variantSummary: variantSummarySchema,
      quantity: z.int().min(0),
      deviations: z.array(variantDeviationSchema).optional(),
    }),
  ),
});
export type ListingChoice = z.infer<typeof listingChoiceSchema>;
export type ListingChoiceItem = ListingChoice['items'][number];

/**
 * `POST /api/devices/{id}/assignment` (2.6, REQ-017): the version of the device the user saw and
 * the chosen model listing; `confirmDeviation` confirms deviating variant data (REQ-018).
 */
export const deviceAssignmentBodySchema = z.strictObject({
  version: versionSchema,
  listingId: idSchema,
  confirmDeviation: z.boolean().default(false),
});
export type DeviceAssignmentInput = z.input<typeof deviceAssignmentBodySchema>;

/**
 * `details` of `422 confirmation_required` with `kind: variant_deviation` (2.6, REQ-018): the
 * deviations of the device from the chosen model listing that UI-005 shows.
 */
export const variantDeviationDetailsSchema = z.object({
  kind: z.literal('variant_deviation'),
  deviations: z.array(variantDeviationSchema),
});

/**
 * The answer of an assignment (2.6): the device, the new quantity of its model listing and the
 * channels whose published content now carries "Bestand auf Kanal anpassen" (channel ids,
 * Nachtrag MAR-263; empty until S5).
 */
export const deviceAssignmentSchema = z.object({
  device: deviceSchema,
  listing: z.object({ id: idSchema, quantity: z.int().min(0) }),
  adjustStockChannels: z.array(idSchema),
});
export type DeviceAssignment = z.infer<typeof deviceAssignmentSchema>;
