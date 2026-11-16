import type { Insertable, Kysely, Selectable } from 'kysely';

import type { DB, DeviceTable } from '../db/schema.ts';

export type DeviceRow = Selectable<DeviceTable>;
export type DeviceInsert = Omit<Insertable<DeviceTable>, 'id'>;

/**
 * Queries on `device` (CU-122; Technical Specification 4.1, Nachtrag MAR-965). Inside an action
 * pass `tx.db`, outside of one the outer `db` (2.0.4). The search follows with #187, the
 * unassigned devices with #258.
 */
export function createDeviceRepository(db: Kysely<DB>) {
  return {
    /**
     * The device holding this WI-Nr key while available or sold, `undefined` if there is none:
     * a cancelled device frees its WI-Nr (REQ-012, REQ-093).
     */
    async findTakenByWiNrKey(wiNrKey: string) {
      return db
        .selectFrom('device')
        .select(['id', 'wi_nr', 'listing_id'])
        .where('wi_nr_key', '=', wiNrKey)
        .where('stock_status', 'in', ['available', 'sold'])
        .executeTakeFirst();
    },

    /** Inserts a device; returns its id. */
    async insert(row: DeviceInsert): Promise<number> {
      const { id } = await db
        .insertInto('device')
        .values(row)
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    async findById(id: number): Promise<DeviceRow | undefined> {
      return db.selectFrom('device').selectAll().where('id', '=', id).executeTakeFirst();
    },
  };
}

export type DeviceRepository = ReturnType<typeof createDeviceRepository>;
