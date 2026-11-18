import { idSchema } from '@resellr/domain/schemas/common.schema';
import {
  type DeviceSearchItem,
  deviceCreateBodySchema,
  deviceDetailSchema,
  devicePrefillSchema,
  deviceSchema,
  deviceSearchResultSchema,
  deviceSearchQuerySchema,
  toWiNrKey,
} from '@resellr/domain/schemas/device.schema';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import { createCatalogReader } from '../catalog/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { NotFoundError } from '../shared/domain-error.ts';
import { createDevicePrefillQuery } from './device-prefill-query.ts';
import { createDeviceRepository } from './device-repository.ts';
import { createDeviceService, toDevice } from './device-service.ts';
import { createListingRepository } from './listing-repository.ts';

export interface InventoryRoutesOptions {
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const idParams = z.strictObject({ id: z.coerce.number().pipe(idSchema) });

/**
 * Inventory routes (CU-130, Technical Specification 2.5): `POST /api/devices`,
 * `GET /api/devices?wiNr=`, `GET /api/devices/{id}` and
 * `GET /api/model-templates/{id}/device-prefill`; changing (#190), the unassigned devices (#258)
 * and the model listings follow. The reading routes read through the repositories CU-122 and
 * CU-125, the catalog reader CU-108 and the query CU-293 with the outer `db`, the writing one goes
 * through the service CU-121 and its unit of work (2.0.4).
 */
export const inventoryRoutes: FastifyPluginAsyncZod<InventoryRoutesOptions> = async (
  app,
  { db, uow, clock },
) => {
  const devices = createDeviceRepository(db);
  const listings = createListingRepository(db);
  const catalog = createCatalogReader(db);
  const deviceService = createDeviceService({ uow, clock });
  const prefillQuery = createDevicePrefillQuery(db);

  // `201` with the new device (2.0.1). The shape is checked here (`400`), every rule a user can
  // violate by the service, so all field errors come in one `422` (2.5).
  app.post(
    '/api/devices',
    { schema: { body: deviceCreateBodySchema, response: { 201: deviceSchema } } },
    async (request, reply) => reply.code(201).send(await deviceService.create(request.body)),
  );

  /**
   * `modelTemplateLabel` by model template: the model names of the given model templates in one
   * query through CU-108, none without ids (Nachtrag MAR-1030). A device always has its model
   * template (`NOT NULL`, `ON DELETE RESTRICT`), so a missing name is a program error (`500`).
   */
  async function modelTemplateLabels(ids: readonly number[]) {
    const names = new Map(
      (await catalog.listModelTemplateNames([...new Set(ids)])).map((template) => [
        template.id,
        template.modelName,
      ]),
    );
    return (id: number) => {
      const name = names.get(id);
      if (name === undefined) throw new Error(`model template ${id} of a device is missing`);
      return name;
    };
  }

  // The search (REQ-016): one query each for the hits, the titles of their model listings and the
  // names of their model templates, no join (Nachtrag MAR-965, MAR-1030).
  app.get(
    '/api/devices',
    {
      schema: { querystring: deviceSearchQuerySchema, response: { 200: deviceSearchResultSchema } },
    },
    async (request) => {
      const { wiNr, limit, offset } = request.query;
      const rows = await devices.search({ wiNrKey: toWiNrKey(wiNr), limit, offset });
      const listingIds = new Set(rows.flatMap((row) => row.listing_id ?? []));
      const linked = new Map(
        (await listings.listTitles([...listingIds])).map((listing) => [
          listing.id,
          { id: listing.id, title: listing.display_title },
        ]),
      );
      const labelOf = await modelTemplateLabels(rows.map((row) => row.model_template_id));
      const items = rows.map((row): DeviceSearchItem => ({
        id: row.id,
        wiNr: row.wi_nr,
        modelTemplateLabel: labelOf(row.model_template_id),
        listing: (row.listing_id !== null && linked.get(row.listing_id)) || null,
        stockStatus: row.stock_status as DeviceSearchItem['stockStatus'],
        captureStatus: row.capture_status as DeviceSearchItem['captureStatus'],
      }));
      return { items };
    },
  );

  app.get(
    '/api/devices/:id',
    { schema: { params: idParams, response: { 200: deviceDetailSchema } } },
    async (request) => {
      const row = await devices.findById(request.params.id);
      if (row === undefined) throw new NotFoundError();
      const [listing] = await listings.listTitles(row.listing_id === null ? [] : [row.listing_id]);
      const labelOf = await modelTemplateLabels([row.model_template_id]);
      return {
        ...toDevice(row),
        modelTemplateLabel: labelOf(row.model_template_id),
        listing: listing === undefined ? null : { id: listing.id, title: listing.display_title },
      };
    },
  );

  // The prefill of UI-003 after the choice of a model template, with its review flags (2.5).
  app.get(
    '/api/model-templates/:id/device-prefill',
    { schema: { params: idParams, response: { 200: devicePrefillSchema } } },
    async (request) => prefillQuery.find(request.params.id),
  );
};
