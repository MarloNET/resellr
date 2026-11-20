import {
  type VariantDeviation,
  variantDeviations,
  type VariantSpec,
} from '@resellr/domain/inventory/compare-variants';
import { formatWithUnit } from '@resellr/domain/format/format-value';
import type { AttributeValues } from '@resellr/domain/schemas/attribute-values.schema';
import type { ListingChoice } from '@resellr/domain/schemas/listing.schema';
import type { Kysely } from 'kysely';

import { createCatalogReader } from '../catalog/index.ts';
import type { DB } from '../db/schema.ts';
import {
  type AttributeEntry,
  createSettingsReader,
  type SettingsReader,
} from '../settings/index.ts';
import { BadRequestError, NotFoundError } from '../shared/domain-error.ts';
import { createDeviceRepository, type DeviceRow } from './device-repository.ts';
import { readableValues } from './device-service.ts';
import { createListingRepository, type ListingRow } from './listing-repository.ts';

type ListingVariantRow = Pick<
  ListingRow,
  | 'condition_value_id'
  | 'visual_grade'
  | 'condition_description'
  | 'variant_values'
  | 'other_device_values'
>;

const parseValues = (json: string) => JSON.parse(json) as AttributeValues;

/** Number values with the unit of their attribute, e.g. RAM "8GB" (2.6, AC-REQ-018-04). */
function withUnits(attributes: readonly AttributeEntry[], values: Record<string, string>) {
  const formatted = { ...values };
  for (const { label, dataType, unit, unitSpacing } of attributes) {
    const value = formatted[label];
    if (value === undefined || unit === null) continue;
    if (dataType === 'integer' || dataType === 'decimal') {
      formatted[label] = formatWithUnit(value, unit, unitSpacing);
    }
  }
  return formatted;
}

/**
 * The deviations of a device from a model listing with readable values (CU-119, REQ-018; 2.6):
 * `variantAttributes` is the variant set of the device type, active and deactivated (K-03). The
 * values of the listing are its device-level values, variant and other ones (2.1). Used by CU-294
 * for each listing and by CU-123 for the chosen one (`variant_deviation`).
 */
export async function listingDeviations(
  settings: SettingsReader,
  variantAttributes: readonly AttributeEntry[],
  device: Pick<
    DeviceRow,
    'condition_value_id' | 'visual_grade' | 'condition_description' | 'device_values'
  >,
  listing: ListingVariantRow,
): Promise<VariantDeviation[]> {
  const side = async (spec: VariantSpec) => {
    const readable = await readableValues(
      settings,
      variantAttributes,
      spec.conditionValueId,
      spec.values,
    );
    return { spec, texts: { ...readable, values: withUnits(variantAttributes, readable.values) } };
  };
  return variantDeviations(
    await side({
      conditionValueId: device.condition_value_id,
      visualGrade: device.visual_grade,
      conditionDescription: device.condition_description,
      values: parseValues(device.device_values),
    }),
    await side({
      conditionValueId: listing.condition_value_id,
      visualGrade: listing.visual_grade,
      conditionDescription: listing.condition_description,
      values: {
        ...parseValues(listing.other_device_values),
        ...parseValues(listing.variant_values),
      },
    }),
    variantAttributes,
  );
}

/** The variant set of a device type: attributes of the level device with the flag (2.6, K-03). */
export async function listVariantAttributes(settings: SettingsReader, deviceTypeId: number) {
  return (await settings.listAttributes(deviceTypeId)).filter(
    (attribute) => attribute.level === 'device' && attribute.variantForming,
  );
}

/**
 * Listing choice (CU-294, REQ-017 to REQ-019; Technical Specification 2.6): serves
 * `GET /api/model-templates/{id}/listings` with the outer `db`: the model listings of the model
 * template by `id` with their display title, variant data and quantity for UI-004; `not_found`
 * for an unknown model template. The variant data are condition, visual grade, condition
 * description and the variant attributes (active and deactivated, K-03) with readable values in
 * the order of the attributes. With `deviceId` each model listing carries its deviations to that
 * device (UI-004, UI-005); an unknown device is a wrong id of the user interface (`400`).
 */
export function createListingChoiceQuery(db: Kysely<DB>) {
  return {
    async list(modelTemplateId: number, deviceId?: number): Promise<ListingChoice> {
      const template = await createCatalogReader(db).findModelTemplate(modelTemplateId);
      if (template === undefined) throw new NotFoundError();
      const device =
        deviceId === undefined ? undefined : await createDeviceRepository(db).findById(deviceId);
      if (deviceId !== undefined && device === undefined) {
        throw new BadRequestError('deviceId unknown');
      }
      const rows = await createListingRepository(db).listVariantData([template.id]);
      if (rows.length === 0) return { items: [] };

      const settings = createSettingsReader(db);
      const variantAttributes = await listVariantAttributes(settings, template.deviceTypeId);
      const items = [];
      for (const row of rows) {
        const readable = await readableValues(
          settings,
          variantAttributes,
          row.condition_value_id,
          parseValues(row.variant_values),
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
          ...(device !== undefined && {
            deviations: await listingDeviations(settings, variantAttributes, device, row),
          }),
        });
      }
      return { items };
    },
  };
}
