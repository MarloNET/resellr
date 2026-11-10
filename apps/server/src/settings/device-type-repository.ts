import type { Kysely, Selectable } from 'kysely';

import type { DB, DeviceTypeTable } from '../db/schema.ts';

export type DeviceTypeRow = Selectable<DeviceTypeTable>;

/** A device type row with the number of its attributes (`attributeCount`, 2.1). */
export type DeviceTypeWithCount = DeviceTypeRow & { attribute_count: number };

export interface DeviceTypeInsert {
  name: string;
  nameKey: string;
  active: boolean;
  at: string;
}

export interface DeviceTypeChange {
  name?: string;
  nameKey?: string;
  active?: boolean;
  version: number;
  at: string;
}

/**
 * Queries on `device_type` (CU-073); `attribute` follows with the attribute endpoints (#151).
 * Inside an action pass `tx.db`, outside of one the outer `db` (2.0.4, MAR-263).
 */
export function createDeviceTypeRepository(db: Kysely<DB>) {
  const withCount = () =>
    db
      .selectFrom('device_type')
      .selectAll('device_type')
      .select((eb) =>
        eb
          .selectFrom('attribute')
          .whereRef('attribute.device_type_id', '=', 'device_type.id')
          .select(eb.fn.countAll<number>().as('count'))
          .as('attribute_count'),
      );

  return {
    /** Device types in their order, with the number of attributes. */
    async list({ limit, offset }: { limit: number; offset: number }) {
      const rows = await withCount()
        .orderBy('sort_order')
        .orderBy('id')
        .limit(limit)
        .offset(offset)
        .execute();
      const { total } = await db
        .selectFrom('device_type')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .executeTakeFirstOrThrow();
      return { rows: rows as DeviceTypeWithCount[], total };
    },

    async findById(id: number): Promise<DeviceTypeWithCount | undefined> {
      return (await withCount().where('device_type.id', '=', id).executeTakeFirst()) as
        DeviceTypeWithCount | undefined;
    },

    /** The device type that already has this name key, if any (uniqueness, AC-REQ-004-02). */
    async findIdByNameKey(nameKey: string): Promise<number | undefined> {
      const row = await db
        .selectFrom('device_type')
        .select('id')
        .where('name_key', '=', nameKey)
        .executeTakeFirst();
      return row?.id;
    },

    /** Inserts a device type at the end of the order; returns its id. */
    async insert({ name, nameKey, active, at }: DeviceTypeInsert): Promise<number> {
      const { next } = await db
        .selectFrom('device_type')
        .select((eb) => eb(eb.fn.coalesce(eb.fn.max('sort_order'), eb.lit(0)), '+', 1).as('next'))
        .executeTakeFirstOrThrow();
      const { id } = await db
        .insertInto('device_type')
        .values({
          name,
          name_key: nameKey,
          active: active ? 1 : 0,
          sort_order: next,
          version: 1,
          created_at: at,
          updated_at: at,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    /** Stores the changed fields with the new version. */
    async update(id: number, { name, nameKey, active, version, at }: DeviceTypeChange) {
      await db
        .updateTable('device_type')
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

export type DeviceTypeRepository = ReturnType<typeof createDeviceTypeRepository>;
