import type { Kysely, Selectable } from 'kysely';

import type { DB, SupplierTable } from '../db/schema.ts';

export type SupplierRow = Selectable<SupplierTable>;

export interface SupplierInsert {
  name: string;
  nameKey: string;
  active: boolean;
  at: string;
}

export interface SupplierChange {
  name?: string;
  nameKey?: string;
  active?: boolean;
  version: number;
  at: string;
}

export interface SupplierListQuery {
  /** `false`: only the active suppliers, the choice for new entries (AC-REQ-099-03). */
  includeInactive: boolean;
  limit: number;
  offset: number;
}

/**
 * Queries on `supplier` (CU-300, FIND-223). Inside an action pass `tx.db`, outside of one the
 * outer `db` (2.0.4, MAR-263).
 */
export function createSupplierRepository(db: Kysely<DB>) {
  const filtered = (includeInactive: boolean) => {
    const query = db.selectFrom('supplier');
    return includeInactive ? query : query.where('active', '=', 1);
  };

  return {
    /** Suppliers by name (case-insensitive key, then id), with the total of the filter. */
    async list({ includeInactive, limit, offset }: SupplierListQuery) {
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

    async findById(id: number): Promise<SupplierRow | undefined> {
      return db.selectFrom('supplier').selectAll().where('id', '=', id).executeTakeFirst();
    },

    /** The supplier that already has this name key, if any (uniqueness, AC-REQ-099-02). */
    async findIdByNameKey(nameKey: string): Promise<number | undefined> {
      const row = await db
        .selectFrom('supplier')
        .select('id')
        .where('name_key', '=', nameKey)
        .executeTakeFirst();
      return row?.id;
    },

    /** Inserts a supplier; returns its id. */
    async insert({ name, nameKey, active, at }: SupplierInsert): Promise<number> {
      const { id } = await db
        .insertInto('supplier')
        .values({
          name,
          name_key: nameKey,
          active: active ? 1 : 0,
          version: 1,
          created_at: at,
          updated_at: at,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    /** Stores the changed fields with the new version. */
    async update(id: number, { name, nameKey, active, version, at }: SupplierChange) {
      await db
        .updateTable('supplier')
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

export type SupplierRepository = ReturnType<typeof createSupplierRepository>;
