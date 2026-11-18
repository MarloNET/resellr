import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { idSchema, versionSchema } from './common.schema.ts';

// Model listing (REQ-019, REQ-088; Technical Specification 2.6, 2.7, 3.3). The detail of
// UI-014 follows with #198, changing with #200.

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
