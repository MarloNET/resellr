import {
  buildDevicePrefill,
  type DevicePrefill,
  prefillPickListValueIds,
} from '@resellr/domain/inventory/device-prefill';
import type { Kysely } from 'kysely';

import { type CatalogReader, createCatalogReader } from '../catalog/index.ts';
import type { DB } from '../db/schema.ts';
import {
  type AttributeEntry,
  createSettingsReader,
  type SettingsReader,
} from '../settings/index.ts';
import { NotFoundError } from '../shared/domain-error.ts';

type ModelTemplateDefaults = NonNullable<Awaited<ReturnType<CatalogReader['findModelTemplate']>>>;

/**
 * The prefill of a device from a model template (2.5): its defaults, unfiltered from
 * `catalog-reader`, the attributes of the device type with their status and the status of the
 * prefilled pick list values from `settings-reader` (Nachtrag MAR-605, MAR-904), formed by CU-117.
 * The condition code is no source yet (#193). CU-121 forms the same prefill again on saving.
 */
export async function readDevicePrefill(
  settings: SettingsReader,
  template: ModelTemplateDefaults,
  attributes: readonly AttributeEntry[],
): Promise<DevicePrefill> {
  const code = null;
  const ids = prefillPickListValueIds(template.defaultDeviceValues, attributes, code);
  const deactivatedValueIds = (await settings.findPickListValues(ids))
    .filter(({ active }) => !active)
    .map(({ id }) => id);
  return buildDevicePrefill({
    defaultDeviceValues: template.defaultDeviceValues,
    attributes,
    code,
    deactivatedValueIds,
  });
}

/**
 * Prefill query (CU-293, REQ-013; Technical Specification 2.5): serves
 * `GET /api/model-templates/{id}/device-prefill` with the outer `db`; `not_found` for an unknown
 * model template.
 */
export function createDevicePrefillQuery(db: Kysely<DB>) {
  return {
    async find(modelTemplateId: number): Promise<DevicePrefill> {
      const template = await createCatalogReader(db).findModelTemplate(modelTemplateId);
      if (template === undefined) throw new NotFoundError();
      const settings = createSettingsReader(db);
      const attributes = await settings.listAttributes(template.deviceTypeId);
      return readDevicePrefill(settings, template, attributes);
    },
  };
}
