import type { Kysely, Selectable } from 'kysely';

import type { DB, ManufacturerTable } from '../db/schema.ts';

export type ManufacturerRow = Selectable<ManufacturerTable>;

export interface ManufacturerInsert {
  name: string;
  nameKey: string;
  at: string;
}

export interface ManufacturerChange {
  name?: string;
  nameKey?: string;
  active?: boolean;
  version: number;
  at: string;
}

export interface ManufacturerListQuery {
  /** `false`: only the active manufacturers, the choice for new model templates (AC-REQ-101-02). */
  includeInactive: boolean;
  limit: number;
  offset: number;
}

/**
 * Queries on `manufacturer` (CU-079). Inside an action pass `tx.db`, outside of one the outer
 * `db` (2.0.4, MAR-263).
 */
export function createManufacturerRepository(db: Kysely<DB>) {
  const filtered = (includeInactive: boolean) => {
    const query = db.selectFrom('manufacturer');
    return includeInactive ? query : query.where('active', '=', 1);
  };

  return {
    /** Manufacturers by name (case-insensitive key, then id), with the total of the filter. */
    async list({ includeInactive, limit, offset }: ManufacturerListQuery) {
      const rows = await filtered(includeInactive)
        .selectAll()
        .orderBy('name_key')
        .orderBy('id')
        .limit(limit)
        .offset(offset)
        .execute();
      const { total } = await filtered(includeInactive)
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .executeTakeFirstOrThrow();
      return { rows, total };
    },

    async findById(id: number): Promise<ManufacturerRow | undefined> {
      return db.selectFrom('manufacturer').selectAll().where('id', '=', id).executeTakeFirst();
    },

    /** The manufacturer that already has this name key, active or not (REQ-100). */
    async findByNameKey(nameKey: string): Promise<ManufacturerRow | undefined> {
      return db
        .selectFrom('manufacturer')
        .selectAll()
        .where('name_key', '=', nameKey)
        .executeTakeFirst();
    },

    /** Inserts an active manufacturer without GPSR details; returns its id. */
    async insert({ name, nameKey, at }: ManufacturerInsert): Promise<number> {
      const { id } = await db
        .insertInto('manufacturer')
        .values({
          name,
          name_key: nameKey,
          active: 1,
          gpsr_complete: 0,
          version: 1,
          created_at: at,
          updated_at: at,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    /** Stores the changed fields with the new version. */
    async update(id: number, { name, nameKey, active, version, at }: ManufacturerChange) {
      await db
        .updateTable('manufacturer')
        .set({
          ...(name !== undefined && { name }),
          ...(nameKey !== undefined && { name_key: nameKey }),
          ...(active !== undefined && { active: active ? 1 : 0 }),
          version,
          updated_at: at,
        })
        .where('id', '=', id)
        .execute();
    },
  };
}

export type ManufacturerRepository = ReturnType<typeof createManufacturerRepository>;
