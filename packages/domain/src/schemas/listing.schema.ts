import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { isValidEan } from '../validation/ean.ts';
import { type AttributeValueDefinition, attributeValuesSchema } from './attribute-values.schema.ts';
import { centsSchema, dateSchema, idSchema, versionSchema } from './common.schema.ts';
import {
  conditionDescriptionSchema,
  deviceSchema,
  requiredChoice,
  STOCK_STATUSES,
  visualGradeSchema,
} from './device.schema.ts';

// Model listing (REQ-017, REQ-019, REQ-088; Technical Specification 2.6, 2.7, 3.3). Changing
// the listing values with #206; the uniqueness of a changed article number follows with #200.

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
 * devices and stock data come with `GET /api/listings/{id}` (`listingDetailSchema`).
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
 * Shape of `PATCH /api/listings/{id}` for the listing values of UI-014 (2.7) as the route checks
 * it: only types, missing and unknown fields (`400 bad_request`); the model data are not part of
 * it (AC-REQ-088-06). A missing field stays unchanged, `variantValues` and `otherValues` hold
 * changes (a key overwrites, `null` removes; `mergeAttributeValues`). The rules apply to the
 * state after the change (`listingValuesSchema`). `confirmDeviatingDevices` takes effect with #207.
 */
export const listingUpdateBodySchema = z.strictObject({
  version: versionSchema,
  conditionValueId: idSchema.nullable().optional(),
  visualGrade: z.union([z.number(), z.string()]).nullable().optional(),
  conditionDescription: z.string().optional(),
  variantValues: valuesSchema.optional(),
  otherValues: valuesSchema.optional(),
  deliveryScopeTextBlockIds: z.array(idSchema).optional(),
  articleNumber: z.string().optional(),
  eanMode: z.enum(EAN_MODES).optional(),
  ownEan: z.string().nullable().optional(),
  confirmDeviatingDevices: z.boolean().optional(),
});
export type ListingUpdateInput = z.input<typeof listingUpdateBodySchema>;

/**
 * Rules of the listing values (2.7, REQ-088) on the complete state of a model listing after a
 * change: condition, visual grade and condition description as at the device (2.5), the variant
 * values by the variant attributes and the other values by the other attributes of the level
 * device without the battery capacity (CU-067, 2.5 "Geprüft wird der vollständige Stand"), the
 * article number with the text of `POST /api/listings` and the own EAN, required with the marking
 * "eigene" and checked with its GS1 check digit (AC-REQ-088-04); with "Original" it becomes `null`.
 * UI-014 checks its form with it, CU-124 the state after `PATCH /api/listings/{id}`.
 */
export function listingValuesSchema({
  variantAttributes,
  otherAttributes,
}: {
  variantAttributes: readonly AttributeValueDefinition[];
  otherAttributes: readonly AttributeValueDefinition[];
}) {
  return (
    z
      .strictObject({
        conditionValueId: requiredChoice(FIELD_MESSAGES.conditionMissing),
        visualGrade: visualGradeSchema,
        conditionDescription: conditionDescriptionSchema,
        variantValues: attributeValuesSchema(variantAttributes, 'device'),
        otherValues: attributeValuesSchema(otherAttributes, 'device'),
        deliveryScopeTextBlockIds: z.array(idSchema),
        articleNumber: articleNumberSchema,
        eanMode: z.enum(EAN_MODES),
        ownEan: z.string().nullable(),
      })
      // Beside the field errors of the other fields, so all come in one answer (2.5 "Ablehnung").
      .superRefine(
        ({ eanMode, ownEan }, context) => {
          if (eanMode === 'own' && (typeof ownEan !== 'string' || !isValidEan(ownEan))) {
            context.addIssue({ code: 'custom', path: ['ownEan'], message: FIELD_MESSAGES.ownEan });
          }
        },
        { when: () => true },
      )
      .transform((values) => ({
        ...values,
        ownEan: values.eanMode === 'own' ? values.ownEan : null,
      }))
  );
}
export type ListingValues = z.output<ReturnType<typeof listingValuesSchema>>;
export type ListingValuesInput = z.input<ReturnType<typeof listingValuesSchema>>;

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
/** `?includeCancelled=true` adds the cancelled devices of the model listing (2.7, UI-014). */
export const listingDetailQuerySchema = z.strictObject({
  includeCancelled: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

/** Source of a price (2.7): entered by the user or derived by a price rule (from S5). */
export const PRICE_SOURCES = ['manual', 'rule'] as const;

/** The stored battery capacity of a device (3.4): a percentage or "nicht ermittelbar". */
const batteryCapacitySchema = z.union([
  z.object({ percent: z.int().min(0).max(100) }),
  z.object({ notDeterminable: z.literal(true) }),
]);

/**
 * A device in the list "Geräte" of UI-014 (2.7): WI-Nr, inventory status with channel and date of
 * a sale, battery capacity (`null` without value) and capture date.
 */
export const listingDeviceSchema = z.object({
  id: idSchema,
  wiNr: z.string(),
  stockStatus: z.enum(STOCK_STATUSES),
  soldChannelId: idSchema.nullable(),
  soldOn: dateSchema.nullable(),
  batteryCapacity: batteryCapacitySchema.nullable(),
  capturedOn: dateSchema,
});
export type ListingDevice = z.infer<typeof listingDeviceSchema>;

/**
 * `GET /api/listings/{id}` (2.7, CU-292): the model listing with its stock data (2.8.2), its
 * prices by channel, its devices (the cancelled ones only with `includeCancelled`) and its delivery
 * scope as text blocks with their names in their order. Channel contents and photos have reads of
 * their own (FIND-202).
 */
export const listingDetailSchema = listingSchema.extend({
  stock: z.object({
    quantity: z.int().min(0),
    wiNrs: z.array(z.string()),
    batteryText: z.string(),
    stockHash: z.string(),
  }),
  prices: z.array(
    z.object({
      channelId: idSchema,
      amountCents: centsSchema,
      vb: z.boolean(),
      source: z.enum(PRICE_SOURCES),
    }),
  ),
  devices: z.array(listingDeviceSchema),
  deliveryScope: z.array(z.object({ id: idSchema, name: z.string() })),
});
export type ListingDetail = z.infer<typeof listingDetailSchema>;
