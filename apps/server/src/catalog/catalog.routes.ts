import { idSchema, pageQuerySchema } from '@resellr/domain/schemas/common.schema';
import {
  type ModelTemplateListItem,
  modelTemplateCreateSchema,
  modelTemplateListSchema,
  modelTemplateSchema,
  modelTemplateSearchTermSchema,
} from '@resellr/domain/schemas/model-template.schema';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { NotFoundError, ValidationError } from '../shared/domain-error.ts';
import {
  createModelTemplateRepository,
  type ModelTemplateRepository,
} from './model-template-repository.ts';
import { createModelTemplateService, toModelTemplate } from './model-template-service.ts';

export interface CatalogRoutesOptions {
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const idParams = z.strictObject({ id: z.coerce.number().pipe(idSchema) });

/**
 * `GET /api/model-templates?q=&deviceTypeId=&limit=&offset=` (2.4). `q` is checked in the
 * handler, because a search term with 1 character is a user input (`422 validation_failed`,
 * AC-REQ-009-04), while a wrong shape of the query string stays `400 bad_request` (2.0.5).
 */
const listQuery = pageQuerySchema.extend({
  q: z.string().optional(),
  deviceTypeId: z.coerce.number().pipe(idSchema).optional(),
});

/** The search term, `undefined` for no or a blank one; 1 character fails without a search. */
function searchTermOf(q: string | undefined): string | undefined {
  if (q === undefined || q.trim() === '') return undefined;
  const result = modelTemplateSearchTermSchema.safeParse(q);
  if (result.success) return result.data;
  const [issue] = result.error.issues;
  throw new ValidationError([
    { path: 'q', code: issue?.code ?? 'too_small', message: issue?.message ?? '' },
  ]);
}

type ListRow = Awaited<ReturnType<ModelTemplateRepository['list']>>['rows'][number];

function toListItem(row: ListRow): ModelTemplateListItem {
  return {
    id: row.id,
    deviceType: { id: row.device_type_id, name: row.device_type_name },
    manufacturer: { id: row.manufacturer_id, name: row.manufacturer_name },
    modelName: row.model_name,
    typeDesignation: row.type_designation,
    mpn: row.mpn,
    mpnUnknown: row.mpn_unknown === 1,
  };
}

/**
 * Catalog routes (CU-109, Technical Specification 2.4): `GET /api/model-templates`,
 * `GET /api/model-templates/{id}` and `POST /api/model-templates`; changing follows with #181.
 * The paths `…/{id}/listings`, `…/{id}/device-prefill` and `…/{id}/usage` belong to CU-130. The
 * reading routes read through the repository CU-106 with the outer `db`, the writing one goes
 * through the service CU-105 and its unit of work (2.0.4).
 */
export const catalogRoutes: FastifyPluginAsyncZod<CatalogRoutesOptions> = async (
  app,
  { db, uow, clock },
) => {
  const modelTemplates = createModelTemplateRepository(db);
  const modelTemplateService = createModelTemplateService({ uow, clock });

  app.get(
    '/api/model-templates',
    { schema: { querystring: listQuery, response: { 200: modelTemplateListSchema } } },
    async (request) => {
      const { q, ...query } = request.query;
      const { rows, total } = await modelTemplates.list({ ...query, q: searchTermOf(q) });
      return { items: rows.map(toListItem), total };
    },
  );

  app.get(
    '/api/model-templates/:id',
    { schema: { params: idParams, response: { 200: modelTemplateSchema } } },
    async (request) => {
      const row = await modelTemplates.findById(request.params.id);
      if (row === undefined) throw new NotFoundError();
      return toModelTemplate(row);
    },
  );

  // `201` with the new model template (2.0.1); the field rules of CU-104 give
  // `422 validation_failed`, "unbekannt" with a value `400 bad_request` (2.4); a possible
  // duplicate without `confirmDuplicate: true` gives `422 confirmation_required` (CU-107).
  app.post(
    '/api/model-templates',
    { schema: { body: modelTemplateCreateSchema, response: { 201: modelTemplateSchema } } },
    async (request, reply) => reply.code(201).send(await modelTemplateService.create(request.body)),
  );
};
