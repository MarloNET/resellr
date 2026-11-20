import {
  buildDevicePrefill,
  type ConditionCodeTranslation,
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

/** The condition code of a prefill and the supplier it is resolved for (2.2, REQ-015). */
export interface PrefillCode {
  conditionCode: string | null;
  supplierId: number | null;
}

/**
 * The prefill of a device from a model template (2.5): its defaults, unfiltered from
 * `catalog-reader`, the entry of the condition code for the supplier, the attributes of the device
 * type with their status and the status of the prefilled pick list values from `settings-reader`
 * (Nachtrag MAR-605, MAR-904), formed by CU-117. CU-121 forms the same prefill again on saving,
 * with the entry it resolved for the code and supplier sent.
 */
export async function readDevicePrefill(
  settings: SettingsReader,
  template: ModelTemplateDefaults,
  attributes: readonly AttributeEntry[],
  code: ConditionCodeTranslation | null,
): Promise<DevicePrefill> {
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
 * Prefill query (CU-293, REQ-013, REQ-015; Technical Specification 2.5): serves
 * `GET /api/model-templates/{id}/device-prefill?conditionCode=&supplierId=` with the outer `db`;
 * `not_found` for an unknown model template. Without a supplier only the entry without supplier
 * applies (2.2).
 */
export function createDevicePrefillQuery(db: Kysely<DB>) {
  return {
    async find(
      modelTemplateId: number,
      { conditionCode, supplierId }: PrefillCode,
    ): Promise<DevicePrefill> {
      const template = await createCatalogReader(db).findModelTemplate(modelTemplateId);
      if (template === undefined) throw new NotFoundError();
      const settings = createSettingsReader(db);
      const attributes = await settings.listAttributes(template.deviceTypeId);
      const code =
        conditionCode === null
          ? undefined
          : await settings.resolveConditionCode(conditionCode, supplierId);
      return readDevicePrefill(settings, template, attributes, code ?? null);
    },
  };
}
