import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import { createModelTemplateRepository } from './model-template-repository.ts';

/**
 * Read interface of the model templates (CU-108; Technical Specification 4.1, Nachtrag MAR-879):
 * first the model templates of a device type for the check of `inventory` (CU-290), extended
 * by the default values for CU-293 (#188). Inside an action pass `tx.db`, outside of one the
 * outer `db`.
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
  };
}

export type CatalogReader = ReturnType<typeof createCatalogReader>;
