import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { toKey } from '../text/normalize-key.ts';
import { idSchema, listResponseSchema, timestampSchema, versionSchema } from './common.schema.ts';

// Model template (REQ-008 to REQ-010; Technical Specification 2.4, 3.3). The field rules for
// creating and changing follow with #177 and #181.

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
