import type { ModelTemplateUsage } from '@resellr/domain/schemas/model-template.schema';
import type { Kysely } from 'kysely';

import { createCatalogReader } from '../catalog/index.ts';
import type { DB } from '../db/schema.ts';
import { NotFoundError } from '../shared/domain-error.ts';
import { createDeviceRepository } from './device-repository.ts';
import { createListingRepository } from './listing-repository.ts';

/**
 * Usage of a model template (CU-295, REQ-010, REQ-095; Technical Specification 2.4): serves
 * `GET /api/model-templates/{id}/usage` with the outer `db`; `not_found` for an unknown model
 * template. UI-007 locks "Geräteart" with `deviceCount > 0` (`UI-007.disabled`). The model
 * template is read through `catalog-reader` (CU-108), the devices through CU-122 and the model
 * listings through CU-125. `deleteBlockedReason` follows the order of the reasons (2.4: model
 * listings before devices); its tests come with #266.
 */
export function createModelTemplateUsageQuery(db: Kysely<DB>) {
  return {
    async find(modelTemplateId: number): Promise<ModelTemplateUsage> {
      if ((await createCatalogReader(db).findModelTemplate(modelTemplateId)) === undefined) {
        throw new NotFoundError();
      }
      const deviceCount = await createDeviceRepository(db).countByModelTemplate(modelTemplateId);
      const listingCount = await createListingRepository(db).countByModelTemplate(modelTemplateId);
      const deleteBlockedReason =
        listingCount > 0 ? 'listings_reference' : deviceCount > 0 ? 'devices_reference' : null;
      return { deviceCount, listingCount, deleteBlockedReason };
    },
  };
}
