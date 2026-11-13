import { toKey } from '@resellr/domain/text/normalize-key';
import { type Kysely, type Selectable, sql } from 'kysely';

import type { DB, ModelTemplateTable } from '../db/schema.ts';

export type ModelTemplateRow = Selectable<ModelTemplateTable>;

export interface ModelTemplateListQuery {
  /** Search term, already checked for at least 2 characters; without it the latest created. */
  q?: string;
  deviceTypeId?: number;
  limit: number;
  offset: number;
}

/**
 * Queries and search on `model_template` (CU-106, REQ-009). Inside an action pass `tx.db`,
 * outside of one the outer `db` (2.0.4, MAR-263).
 */
export function createModelTemplateRepository(db: Kysely<DB>) {
  /**
   * Model templates with the names of device type and manufacturer, filtered by device type and
   * search term. The search is a partial match without case in `search_key` or in the
   * manufacturer's `name_key` (2.4 "Suche"); both hold lower-case keys, so the term is compared
   * as `toKey` with `instr`, which takes `%` and `_` literally.
   */
  const filtered = ({ q, deviceTypeId }: Pick<ModelTemplateListQuery, 'q' | 'deviceTypeId'>) => {
    let query = db
      .selectFrom('model_template as mt')
      .innerJoin('device_type as dt', 'dt.id', 'mt.device_type_id')
      .innerJoin('manufacturer as m', 'm.id', 'mt.manufacturer_id');
    if (deviceTypeId !== undefined) query = query.where('mt.device_type_id', '=', deviceTypeId);
    if (q !== undefined) {
      const key = toKey(q);
      query = query.where((eb) =>
        eb.or([
          eb(sql<number>`instr(mt.search_key, ${key})`, '>', 0),
          eb(sql<number>`instr(m.name_key, ${key})`, '>', 0),
        ]),
      );
    }
    return query;
  };

  return {
    /**
     * Hits of UI-006, the latest created first (without a search term "die 50 zuletzt
     * angelegten", 2.4), with the total of the filter.
     */
    async list({ limit, offset, ...filter }: ModelTemplateListQuery) {
      const rows = await filtered(filter)
        .selectAll('mt')
        .select(['dt.name as device_type_name', 'm.name as manufacturer_name'])
        .orderBy('mt.created_at', 'desc')
        .orderBy('mt.id', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();
      const { total } = await filtered(filter)
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .executeTakeFirstOrThrow();
      return { rows, total };
    },

    async findById(id: number): Promise<ModelTemplateRow | undefined> {
      return db.selectFrom('model_template').selectAll().where('id', '=', id).executeTakeFirst();
    },
  };
}

export type ModelTemplateRepository = ReturnType<typeof createModelTemplateRepository>;
