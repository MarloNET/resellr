import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import { createModelTemplateRepository } from './model-template-repository.ts';

/**
 * Read interface of the model templates (CU-108; Technical Specification 4.1, Nachtrag MAR-879):
 * first the model templates of a device type for the check of `inventory` (CU-290), extended
 * by a model template with its device type for the device service CU-121 (#185), the model names
 * for the device search and UI-010 (#187) and the default values for CU-293 (#188). Inside an action pass `tx.db`, outside of one the outer `db`.
 */
export function createCatalogReader(db: Kysely<DB>) {
  const repository = createModelTemplateRepository(db);
  return {
    /** The model templates of a device type with their model name, by `id`. */
    async listModelTemplatesOfDeviceType(
      deviceTypeId: number,
    ): Promise<{ id: number; modelName: string }[]> {
      const rows = await repository.listByDeviceType(deviceTypeId);
      return rows.map((row) => ({ id: row.id, modelName: row.model_name }));
    },

    /**
     * The model names of the given model templates, by `id`; unknown ids are left out (2.5
     * `modelTemplateLabel`, Nachtrag MAR-1030). Without ids there is no query.
     */
    async listModelTemplateNames(
      ids: readonly number[],
    ): Promise<{ id: number; modelName: string }[]> {
      const rows = await repository.listByIds(ids);
      return rows.map((row) => ({ id: row.id, modelName: row.model_name }));
    },

    /**
     * A model template with its device type and its default values, `undefined` if unknown (2.5:
     * the device service checks the values of a new device by the attributes of this device type;
     * the defaults are the prefill of CU-293 and CU-121, stored as they are, unfiltered;
     * Nachtrag MAR-973).
     */
    async findModelTemplate(id: number): Promise<
      | {
          id: number;
          deviceTypeId: number;
          defaultDeviceValues: Record<string, unknown>;
        }
      | undefined
    > {
      const row = await repository.findById(id);
      return (
        row && {
          id: row.id,
          deviceTypeId: row.device_type_id,
          defaultDeviceValues: JSON.parse(row.default_device_values) as Record<string, unknown>,
        }
      );
    },
  };
}

export type CatalogReader = ReturnType<typeof createCatalogReader>;
