import { z } from 'zod';

import { FIELD_MESSAGES, MESSAGES } from '../messages/messages.de.ts';
import { toKey } from '../text/normalize-key.ts';
import { isValidEan } from '../validation/ean.ts';
import { type AttributeValueDefinition, attributeValuesSchema } from './attribute-values.schema.ts';
import { idSchema, listResponseSchema, timestampSchema, versionSchema } from './common.schema.ts';

// Model template (REQ-008 to REQ-010; Technical Specification 2.4, 3.3).

/** Shortest search term of UI-006 after trimming (REQ-009, AC-REQ-009-04). */
export const MODEL_TEMPLATE_SEARCH_MIN = 2;

/** Search term `q` of `GET /api/model-templates`: from 2 characters after trimming (2.4). */
export const modelTemplateSearchTermSchema = z
  .string()
  .trim()
  .min(MODEL_TEMPLATE_SEARCH_MIN, FIELD_MESSAGES.searchTermMinLength);

/**
 * `model_template.search_key` (3.3): model name, type designation and MPN, each as comparison
 * key (`toKey`), one per line, so a partial match stays inside one field. The manufacturer name
 * is not part of it; the search joins `manufacturer.name_key`, so a rename needs no update
 * (2.4 "Suche").
 */
export function modelTemplateSearchKey({
  modelName,
  typeDesignation,
  mpn,
}: {
  modelName: string;
  typeDesignation: string | null;
  mpn: string | null;
}): string {
  return [modelName, typeDesignation, mpn]
    .filter((value): value is string => value !== null && value.trim() !== '')
    .map(toKey)
    .join('\n');
}

/** Device type or manufacturer of a model template in a list answer. */
export const modelTemplateReferenceSchema = z.object({ id: idSchema, name: z.string() });
export type ModelTemplateReference = z.infer<typeof modelTemplateReferenceSchema>;

/**
 * A model template in `details.matches[]` of `confirmation_required` (2.4): `possible_duplicate`
 * (REQ-011) names manufacturer, model name and MPN of each hit; with MPN "unbekannt" `mpn` is
 * null (3.3).
 */
export const modelTemplateMatchSchema = z.object({
  id: idSchema,
  manufacturer: modelTemplateReferenceSchema,
  modelName: z.string(),
  mpn: z.string().nullable(),
});
export type ModelTemplateMatch = z.infer<typeof modelTemplateMatchSchema>;

/**
 * Hit of `GET /api/model-templates` (2.4): device type, manufacturer, model name, type
 * designation and MPN; with MPN "unbekannt" `mpn` is null and `mpnUnknown` true (3.3).
 */
export const modelTemplateListItemSchema = z.object({
  id: idSchema,
  deviceType: modelTemplateReferenceSchema,
  manufacturer: modelTemplateReferenceSchema,
  modelName: z.string(),
  typeDesignation: z.string().nullable(),
  mpn: z.string().nullable(),
  mpnUnknown: z.boolean(),
});
export type ModelTemplateListItem = z.infer<typeof modelTemplateListItemSchema>;

/** `GET /api/model-templates`. */
export const modelTemplateListSchema = listResponseSchema(modelTemplateListItemSchema);
export type ModelTemplateList = z.infer<typeof modelTemplateListSchema>;

/** Attribute values by attribute id (3.3 `model_values`, `default_device_values`). */
const storedAttributeValuesSchema = z.record(z.string(), z.unknown());

/**
 * `GET /api/model-templates/{id}`: the model template of 3.3 without the internal keys
 * `model_name_key` and `search_key`.
 */
export const modelTemplateSchema = z.object({
  id: idSchema,
  deviceTypeId: idSchema,
  manufacturerId: idSchema,
  modelName: z.string(),
  typeDesignation: z.string().nullable(),
  mpn: z.string().nullable(),
  mpnUnknown: z.boolean(),
  originalEan: z.string().nullable(),
  modelValues: storedAttributeValuesSchema,
  defaultDeviceValues: storedAttributeValuesSchema,
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type ModelTemplate = z.infer<typeof modelTemplateSchema>;

/** Longest model name after trimming (3.3, REQ-008). */
export const MODEL_NAME_MAX = 100;
/** Longest type designation after trimming (3.3, REQ-008). */
export const TYPE_DESIGNATION_MAX = 50;
/** Longest MPN in Unicode code points after trimming (2.4 "Herstellernummer"). */
export const MPN_MAX = 40;
/** Allowed characters of an MPN (2.4, RQ-19). */
const MPN_PATTERN = /^[A-Za-z0-9./-]+$/;

/** Model name: 1–100 characters after trimming. */
export const modelNameSchema = z
  .string()
  .trim()
  .min(1, FIELD_MESSAGES.modelName)
  .max(MODEL_NAME_MAX, FIELD_MESSAGES.modelName);

/** Type designation: 0–50 characters after trimming; empty is stored as `null` (3.3). */
export const typeDesignationSchema = z
  .string()
  .trim()
  .max(TYPE_DESIGNATION_MAX, FIELD_MESSAGES.typeDesignation)
  .transform((value) => (value === '' ? null : value));

/**
 * MPN without "unbekannt" (2.4 "Herstellernummer", DER-50-17): trimmed, then one refinement in
 * the order empty (`mpn_required`), more than 40 code points (`mpn_too_long`, M-25), a character
 * outside `^[A-Za-z0-9./-]+$` (`mpn_invalid_chars`, M-26), so the field gets exactly one
 * message (2.0.5). The trimmed value is stored; case stays as entered.
 */
export const mpnSchema = z
  .string()
  .trim()
  .superRefine((mpn, context) => {
    if (mpn === '') {
      context.addIssue({
        code: 'custom',
        message: FIELD_MESSAGES.mpnRequired,
        params: { code: 'mpn_required' },
      });
    } else if ([...mpn].length > MPN_MAX) {
      context.addIssue({
        code: 'custom',
        message: MESSAGES['M-25'],
        params: { code: 'mpn_too_long' },
      });
    } else if (!MPN_PATTERN.test(mpn)) {
      context.addIssue({
        code: 'custom',
        message: MESSAGES['M-26'],
        params: { code: 'mpn_invalid_chars' },
      });
    }
  });

/**
 * Original EAN: optional, otherwise 8 or 13 digits with a valid GS1 check digit (CU-016,
 * AC-REQ-008-04); empty is stored as `null`.
 */
export const originalEanSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || isValidEan(value), FIELD_MESSAGES.originalEan)
  .transform((value) => (value === '' ? null : value));

/**
 * `POST /api/model-templates` (2.4): the model template without `id`. `web-ui` sends every
 * field, an empty input as `''` and no device type or manufacturer as `null` (2.0.5 rule (2));
 * the attribute values by attribute id, checked against the attribute definitions of the device
 * type by `modelTemplateValuesSchema` (2.4, 2.5);
 * `null` is a field error ("Geräteart und Hersteller Pflicht", Nachtrag MAR-925). With
 * "unbekannt" it sends `mpn: null`; a value together with `mpnUnknown: true`, or `null` without
 * it, is a program error of the user interface and fails without a field path, i.e.
 * `400 bad_request` (2.0.5 rule (4)). The check runs although other fields failed, so the
 * field errors of a request never hide it, but not on a wrong type.
 */
export const modelTemplateCreateSchema = z
  .strictObject({
    deviceTypeId: idSchema
      .nullable()
      .refine((id): id is number => id !== null, FIELD_MESSAGES.deviceTypeMissing),
    manufacturerId: idSchema
      .nullable()
      .refine((id): id is number => id !== null, FIELD_MESSAGES.manufacturerMissing),
    modelName: modelNameSchema,
    typeDesignation: typeDesignationSchema,
    mpn: mpnSchema.nullable(),
    mpnUnknown: z.boolean(),
    originalEan: originalEanSchema,
    modelValues: storedAttributeValuesSchema,
    defaultDeviceValues: storedAttributeValuesSchema,
    /** "Trotzdem anlegen" of UI-007.dublette: no question about a possible duplicate (2.4). */
    confirmDuplicate: z.boolean().optional(),
  })
  .superRefine(
    ({ mpn, mpnUnknown }, context) => {
      if (mpnUnknown === (mpn === null)) return;
      context.addIssue({
        code: 'custom',
        message: 'mpn must be null exactly with mpnUnknown',
        path: [],
      });
    },
    { when: ({ issues }) => issues.every((issue) => issue.code !== 'invalid_type') },
  );
export type ModelTemplateCreateInput = z.input<typeof modelTemplateCreateSchema>;
export type ModelTemplateCreate = z.output<typeof modelTemplateCreateSchema>;

/**
 * `PATCH /api/model-templates/{id}` (2.4): the `version` last read and the changes, with the
 * field rules of `POST`. A missing field stays unchanged, `null` for device type or manufacturer
 * is a field error (Nachtrag MAR-925); `modelValues` and `defaultDeviceValues` hold changes (a
 * key overwrites, `null` removes; `mergeAttributeValues`, 2.5). "unbekannt" and the MPN are
 * checked by CU-105 on the state after the change, as one of them may be missing.
 */
export const modelTemplateUpdateSchema = z.strictObject({
  version: versionSchema,
  deviceTypeId: modelTemplateCreateSchema.shape.deviceTypeId.optional(),
  manufacturerId: modelTemplateCreateSchema.shape.manufacturerId.optional(),
  modelName: modelNameSchema.optional(),
  typeDesignation: typeDesignationSchema.optional(),
  mpn: mpnSchema.nullable().optional(),
  mpnUnknown: z.boolean().optional(),
  originalEan: originalEanSchema.optional(),
  modelValues: storedAttributeValuesSchema.optional(),
  defaultDeviceValues: storedAttributeValuesSchema.optional(),
});
export type ModelTemplateUpdateInput = z.input<typeof modelTemplateUpdateSchema>;
export type ModelTemplateUpdate = z.output<typeof modelTemplateUpdateSchema>;

/**
 * Attribute values of a model template built at run time from the attributes of its device type
 * (2.4 "Regeln", 2.5; CU-067): `modelValues` by the attributes of the level model, an active
 * required one without a value is "<Merkmal> fehlt" (AC-REQ-008-05); `defaultDeviceValues` by
 * those of the level device, optional but typed. The field paths are `modelValues.<id>` and
 * `defaultDeviceValues.<id>`. UI-007 checks the form with it, CU-105 the request.
 */
export function modelTemplateValuesSchema(attributes: readonly AttributeValueDefinition[]) {
  const optional = attributes.map((attribute) => ({ ...attribute, required: false }));
  return z.strictObject({
    modelValues: attributeValuesSchema(attributes, 'model'),
    defaultDeviceValues: attributeValuesSchema(optional, 'device'),
  });
}
