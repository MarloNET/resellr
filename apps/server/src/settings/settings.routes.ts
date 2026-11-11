import { idSchema } from '@resellr/domain/schemas/common.schema';
import {
  deviceTypeCreateSchema,
  deviceTypeListSchema,
  deviceTypeSchema,
  deviceTypeUpdateSchema,
} from '@resellr/domain/schemas/device-type.schema';
import {
  pickListListSchema,
  pickListSchema,
  pickListValueCreateSchema,
  pickListValueListSchema,
  pickListValueOrderSchema,
  pickListValueSchema,
  pickListValueUpdateSchema,
} from '@resellr/domain/schemas/pick-list.schema';
import type { Kysely } from 'kysely';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { createDeviceTypeService } from './device-type-service.ts';
import { createPickListService } from './pick-list-service.ts';

export interface SettingsRoutesOptions {
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const idParams = z.strictObject({ id: z.coerce.number().pipe(idSchema) });

/** Paging of lists (Technical Specification 2.0.1): `limit` 50 by default, at most 200. */
const pageQuery = z.strictObject({
  limit: z.coerce.number().pipe(z.int().min(1).max(200)).default(50),
  offset: z.coerce.number().pipe(z.int().nonnegative()).default(0),
});

/**
 * Settings routes (CU-087, Technical Specification 2.1, 2.2): all paths under
 * `/api/device-types`, `/api/attributes`, `/api/pick-lists`, … Each route calls one service.
 * There is no DELETE route for device types (REQ-004, DER-33-09). There is no route to create or
 * delete a pick list and none to delete a value (RQ-07,
 * DER-35-09).
 */
export const settingsRoutes: FastifyPluginAsyncZod<SettingsRoutesOptions> = async (
  app,
  { db, uow, clock },
) => {
  const deviceTypes = createDeviceTypeService({ db, uow, clock });
  const pickLists = createPickListService({ db, uow, clock });

  app.get(
    '/api/device-types',
    { schema: { querystring: pageQuery, response: { 200: deviceTypeListSchema } } },
    async (request) => deviceTypes.list(request.query),
  );

  app.post(
    '/api/device-types',
    { schema: { body: deviceTypeCreateSchema, response: { 201: deviceTypeSchema } } },
    async (request, reply) => reply.code(201).send(await deviceTypes.create(request.body)),
  );

  app.patch(
    '/api/device-types/:id',
    {
      schema: {
        params: idParams,
        body: deviceTypeUpdateSchema,
        response: { 200: deviceTypeSchema },
      },
    },
    async (request) => deviceTypes.update(request.params.id, request.body),
  );

  app.get(
    '/api/pick-lists',
    { schema: { querystring: pageQuery, response: { 200: pickListListSchema } } },
    async (request) => pickLists.list(request.query),
  );

  app.get(
    '/api/pick-lists/:id/values',
    {
      schema: {
        params: idParams,
        querystring: pageQuery,
        response: { 200: pickListValueListSchema },
      },
    },
    async (request) => pickLists.listValues(request.params.id, request.query),
  );

  app.post(
    '/api/pick-lists/:id/values',
    {
      schema: {
        params: idParams,
        body: pickListValueCreateSchema,
        response: { 201: pickListValueSchema },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await pickLists.createValue(request.params.id, request.body)),
  );

  app.patch(
    '/api/pick-list-values/:id',
    {
      schema: {
        params: idParams,
        body: pickListValueUpdateSchema,
        response: { 200: pickListValueSchema },
      },
    },
    async (request) => pickLists.updateValue(request.params.id, request.body),
  );

  app.put(
    '/api/pick-lists/:id/value-order',
    {
      schema: {
        params: idParams,
        body: pickListValueOrderSchema,
        response: { 200: pickListSchema },
      },
    },
    async (request) => pickLists.reorderValues(request.params.id, request.body),
  );
};
