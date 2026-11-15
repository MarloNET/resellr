import { idSchema, pageQuerySchema } from '@resellr/domain/schemas/common.schema';
import {
  type ModelTemplate,
  type ModelTemplateListItem,
  modelTemplateListSchema,
  modelTemplateSchema,
  modelTemplateSearchTermSchema,
} from '@resellr/domain/schemas/model-template.schema';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import type { DB } from '../db/schema.ts';
import { NotFoundError, ValidationError } from '../shared/domain-error.ts';
import {
  createModelTemplateRepository,
  type ModelTemplateRepository,
  type ModelTemplateRow,
} from './model-template-repository.ts';

export interface CatalogRoutesOptions {
  db: Kysely<DB>;
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

function toModelTemplate(row: ModelTemplateRow): ModelTemplate {
  return {
    id: row.id,
    deviceTypeId: row.device_type_id,
    manufacturerId: row.manufacturer_id,
    modelName: row.model_name,
    typeDesignation: row.type_designation,
    mpn: row.mpn,
    mpnUnknown: row.mpn_unknown === 1,
    originalEan: row.original_ean,
    modelValues: JSON.parse(row.model_values) as Record<string, unknown>,
    defaultDeviceValues: JSON.parse(row.default_device_values) as Record<string, unknown>,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Catalog routes (CU-109, Technical Specification 2.4): `GET /api/model-templates` and
 * `GET /api/model-templates/{id}`; creating and changing follow with #177 and #181. The paths
 * `…/{id}/listings`, `…/{id}/device-prefill` and `…/{id}/usage` belong to CU-130. Both routes
 * only read, so they read through the repository CU-106 with the outer `db` (2.0.4).
 */
export const catalogRoutes: FastifyPluginAsyncZod<CatalogRoutesOptions> = async (app, { db }) => {
  const modelTemplates = createModelTemplateRepository(db);

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
};
