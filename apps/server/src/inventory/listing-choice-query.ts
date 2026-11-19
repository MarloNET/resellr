import type { AttributeValues } from '@resellr/domain/schemas/attribute-values.schema';
import type { ListingChoice } from '@resellr/domain/schemas/listing.schema';
import type { Kysely } from 'kysely';

import { createCatalogReader } from '../catalog/index.ts';
import type { DB } from '../db/schema.ts';
import { createSettingsReader } from '../settings/index.ts';
import { NotFoundError } from '../shared/domain-error.ts';
import { readableValues } from './device-service.ts';
import { createListingRepository } from './listing-repository.ts';

/**
 * Listing choice (CU-294, REQ-017, REQ-019; Technical Specification 2.6): serves
 * `GET /api/model-templates/{id}/listings` with the outer `db`: the model listings of the model
 * template by `id` with their display title, variant data and quantity for UI-004; `not_found`
 * for an unknown model template. The variant data are condition, visual grade, condition
 * description and the variant attributes (active and deactivated, K-03) with readable values in
 * the order of the attributes. The deviations to a device (`deviceId`) follow with #196.
 */
export function createListingChoiceQuery(db: Kysely<DB>) {
  return {
    async list(modelTemplateId: number): Promise<ListingChoice> {
      const template = await createCatalogReader(db).findModelTemplate(modelTemplateId);
      if (template === undefined) throw new NotFoundError();
      const rows = await createListingRepository(db).listVariantData([template.id]);
      if (rows.length === 0) return { items: [] };

      const settings = createSettingsReader(db);
      const variantAttributes = (await settings.listAttributes(template.deviceTypeId)).filter(
        (attribute) => attribute.level === 'device' && attribute.variantForming,
      );
      const items = [];
      for (const row of rows) {
        const readable = await readableValues(
          settings,
          variantAttributes,
          row.condition_value_id,
          JSON.parse(row.variant_values) as AttributeValues,
        );
        items.push({
          id: row.id,
          displayTitle: row.display_title,
          variantSummary: {
            conditionLabel: readable.condition,
            visualGrade: row.visual_grade,
            conditionDescription: row.condition_description,
            variantValues: Object.entries(readable.values).map(([label, value]) => ({
              label,
              value,
            })),
          },
          quantity: row.quantity,
        });
      }
      return { items };
    },
  };
}
