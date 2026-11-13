import {
  attributeCreateSchema,
  attributeListSchema,
  attributeOrderSchema,
  attributeSchema,
  attributeUpdateSchema,
} from '@resellr/domain/schemas/attribute.schema';
import { idSchema, versionSchema } from '@resellr/domain/schemas/common.schema';
import {
  conditionCodeCreateSchema,
  conditionCodeEntrySchema,
  conditionCodeListSchema,
  conditionCodeResolutionSchema,
  conditionCodeUpdateSchema,
} from '@resellr/domain/schemas/condition-code.schema';
import {
  deviceTypeCreateSchema,
  deviceTypeListSchema,
  deviceTypeSchema,
  deviceTypeUpdateSchema,
} from '@resellr/domain/schemas/device-type.schema';
import {
  manufacturerCreateResultSchema,
  manufacturerCreateSchema,
  manufacturerListSchema,
  manufacturerUpdateResultSchema,
  manufacturerUpdateSchema,
} from '@resellr/domain/schemas/manufacturer.schema';
import {
  merchantProfileSchema,
  merchantProfileUpdateSchema,
} from '@resellr/domain/schemas/merchant-profile.schema';
import {
  pickListListSchema,
  pickListSchema,
  pickListValueCreateSchema,
  pickListValueListSchema,
  pickListValueOrderSchema,
  pickListValueSchema,
  pickListValueUpdateSchema,
} from '@resellr/domain/schemas/pick-list.schema';
import {
  supplierCreateSchema,
  supplierListSchema,
  supplierSchema,
  supplierUpdateSchema,
} from '@resellr/domain/schemas/supplier.schema';
import {
  textBlockCreateSchema,
  textBlockListSchema,
  textBlockSaveResultSchema,
  textBlockUpdateSchema,
} from '@resellr/domain/schemas/text-block.schema';
import type { Kysely } from 'kysely';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { createConditionCodeService } from './condition-code-service.ts';
import { createDeviceTypeService } from './device-type-service.ts';
import { createManufacturerService } from './manufacturer-service.ts';
import { createMerchantProfileService } from './merchant-profile-service.ts';
import { createPickListService } from './pick-list-service.ts';
import { createSupplierService } from './supplier-service.ts';
import { createTextBlockService } from './text-block-service.ts';

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

/** `?includeInactive=true` adds the deactivated entries to a list (2.2). */
const includeInactiveQuery = pageQuery.extend({
  includeInactive: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

/** `DELETE …?version=`: the version last read (2.0.3). */
const versionQuery = z.strictObject({ version: z.coerce.number().pipe(versionSchema) });

/**
 * `GET /api/condition-codes/resolve?code=&supplierId=`: without `supplierId` (or empty) only the
 * entry without supplier applies (2.2 "Auflösen eines Codes").
 */
const resolveQuery = z.strictObject({
  code: z.string(),
  supplierId: z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : Number(value)))
    .pipe(idSchema.nullable()),
});

/**
 * Settings routes (CU-087, Technical Specification 2.1, 2.2): all paths under
 * `/api/device-types`, `/api/attributes`, `/api/pick-lists`, `/api/merchant-profile`, … Each
 * route calls one service.
 * There is no DELETE route for device types or attributes (REQ-004, REQ-005, DER-33-09),
 * manufacturers (2.2), suppliers (2.2, DER-36-08) or text blocks (2.2, DER-39-13). There is no
 * route to create or delete a pick list and none to delete a value (RQ-07, DER-35-09). Entries
 * of the condition code table can be deleted (2.2, REQ-022).
 */
export const settingsRoutes: FastifyPluginAsyncZod<SettingsRoutesOptions> = async (
  app,
  { db, uow, clock },
) => {
  const deviceTypes = createDeviceTypeService({ db, uow, clock });
  const pickLists = createPickListService({ db, uow, clock });
  const manufacturers = createManufacturerService({ db, uow, clock });
  const suppliers = createSupplierService({ db, uow, clock });
  const merchantProfile = createMerchantProfileService({ db, uow, clock });
  const conditionCodes = createConditionCodeService({ db, uow, clock });
  const textBlocks = createTextBlockService({ db, uow, clock });

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
    '/api/device-types/:id/attributes',
    { schema: { params: idParams, response: { 200: attributeListSchema } } },
    async (request) => deviceTypes.listAttributes(request.params.id),
  );

  app.post(
    '/api/device-types/:id/attributes',
    {
      schema: {
        params: idParams,
        body: attributeCreateSchema,
        response: { 201: attributeSchema },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await deviceTypes.createAttribute(request.params.id, request.body)),
  );

  app.patch(
    '/api/attributes/:id',
    {
      schema: {
        params: idParams,
        body: attributeUpdateSchema,
        response: { 200: attributeSchema },
      },
    },
    async (request) => deviceTypes.updateAttribute(request.params.id, request.body),
  );

  app.put(
    '/api/device-types/:id/attribute-order',
    {
      schema: {
        params: idParams,
        body: attributeOrderSchema,
        response: { 200: deviceTypeSchema },
      },
    },
    async (request) => deviceTypes.reorderAttributes(request.params.id, request.body),
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

  app.get(
    '/api/manufacturers',
    { schema: { querystring: includeInactiveQuery, response: { 200: manufacturerListSchema } } },
    async (request) => manufacturers.list(request.query),
  );

  // `201` for a new manufacturer, `200` with `existing: true` for an active one with the name
  // (AC-REQ-100-02).
  app.post(
    '/api/manufacturers',
    {
      schema: {
        body: manufacturerCreateSchema,
        response: { 200: manufacturerCreateResultSchema, 201: manufacturerCreateResultSchema },
      },
    },
    async (request, reply) => {
      const { manufacturer, existing } = await manufacturers.create(request.body);
      return reply.code(existing ? 200 : 201).send({ ...manufacturer, existing });
    },
  );

  app.patch(
    '/api/manufacturers/:id',
    {
      schema: {
        params: idParams,
        body: manufacturerUpdateSchema,
        response: { 200: manufacturerUpdateResultSchema },
      },
    },
    async (request) => manufacturers.update(request.params.id, request.body),
  );

  app.get(
    '/api/suppliers',
    { schema: { querystring: includeInactiveQuery, response: { 200: supplierListSchema } } },
    async (request) => suppliers.list(request.query),
  );

  app.post(
    '/api/suppliers',
    { schema: { body: supplierCreateSchema, response: { 201: supplierSchema } } },
    async (request, reply) => reply.code(201).send(await suppliers.create(request.body)),
  );

  app.patch(
    '/api/suppliers/:id',
    {
      schema: { params: idParams, body: supplierUpdateSchema, response: { 200: supplierSchema } },
    },
    async (request) => suppliers.update(request.params.id, request.body),
  );

  app.get(
    '/api/text-blocks',
    { schema: { querystring: pageQuery, response: { 200: textBlockListSchema } } },
    async (request) => textBlocks.list(request.query),
  );

  app.post(
    '/api/text-blocks',
    { schema: { body: textBlockCreateSchema, response: { 201: textBlockSaveResultSchema } } },
    async (request, reply) => reply.code(201).send(await textBlocks.create(request.body)),
  );

  app.patch(
    '/api/text-blocks/:id',
    {
      schema: {
        params: idParams,
        body: textBlockUpdateSchema,
        response: { 200: textBlockSaveResultSchema },
      },
    },
    async (request) => textBlocks.update(request.params.id, request.body),
  );

  app.get(
    '/api/merchant-profile',
    { schema: { response: { 200: merchantProfileSchema } } },
    async () => merchantProfile.get(),
  );

  app.put(
    '/api/merchant-profile',
    { schema: { body: merchantProfileUpdateSchema, response: { 200: merchantProfileSchema } } },
    async (request) => merchantProfile.update(request.body),
  );

  app.get(
    '/api/condition-codes',
    { schema: { querystring: pageQuery, response: { 200: conditionCodeListSchema } } },
    async (request) => conditionCodes.list(request.query),
  );

  app.get(
    '/api/condition-codes/resolve',
    { schema: { querystring: resolveQuery, response: { 200: conditionCodeResolutionSchema } } },
    async (request) => conditionCodes.resolve(request.query.code, request.query.supplierId),
  );

  app.post(
    '/api/condition-codes',
    { schema: { body: conditionCodeCreateSchema, response: { 201: conditionCodeEntrySchema } } },
    async (request, reply) => reply.code(201).send(await conditionCodes.create(request.body)),
  );

  app.patch(
    '/api/condition-codes/:id',
    {
      schema: {
        params: idParams,
        body: conditionCodeUpdateSchema,
        response: { 200: conditionCodeEntrySchema },
      },
    },
    async (request) => conditionCodes.update(request.params.id, request.body),
  );

  app.delete(
    '/api/condition-codes/:id',
    { schema: { params: idParams, querystring: versionQuery } },
    async (request, reply) => {
      await conditionCodes.delete(request.params.id, request.query.version);
      return reply.code(204).send();
    },
  );
};
