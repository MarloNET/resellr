import { idSchema } from '@resellr/domain/schemas/common.schema';
import {
  deviceCreateBodySchema,
  deviceDetailSchema,
  devicePrefillSchema,
  deviceSchema,
} from '@resellr/domain/schemas/device.schema';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import { z } from 'zod';

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
 * `GET /api/devices/{id}` and `GET /api/model-templates/{id}/device-prefill`; the search (#187),
 * changing (#190) and the model listings follow. The reading routes read through the
 * repositories CU-122 and CU-125 and the query CU-293 with the outer `db`, the writing one goes
 * through the service CU-121 and its unit of work (2.0.4).
 */
export const inventoryRoutes: FastifyPluginAsyncZod<InventoryRoutesOptions> = async (
  app,
  { db, uow, clock },
) => {
  const devices = createDeviceRepository(db);
  const listings = createListingRepository(db);
  const deviceService = createDeviceService({ uow, clock });
  const prefillQuery = createDevicePrefillQuery(db);

  // `201` with the new device (2.0.1). The shape is checked here (`400`), every rule a user can
  // violate by the service, so all field errors come in one `422` (2.5).
  app.post(
    '/api/devices',
    { schema: { body: deviceCreateBodySchema, response: { 201: deviceSchema } } },
    async (request, reply) => reply.code(201).send(await deviceService.create(request.body)),
  );

  app.get(
    '/api/devices/:id',
    { schema: { params: idParams, response: { 200: deviceDetailSchema } } },
    async (request) => {
      const row = await devices.findById(request.params.id);
      if (row === undefined) throw new NotFoundError();
      const [listing] = await listings.listTitles(row.listing_id === null ? [] : [row.listing_id]);
      return {
        ...toDevice(row),
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
