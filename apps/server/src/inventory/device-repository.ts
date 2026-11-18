import { type Insertable, type Kysely, type Selectable, sql, type Updateable } from 'kysely';

import type { DB, DeviceTable } from '../db/schema.ts';

export type DeviceRow = Selectable<DeviceTable>;
export type DeviceInsert = Omit<Insertable<DeviceTable>, 'id'>;
/** The device values, review flags and version a change of the device values writes (2.5). */
export type DeviceUpdate = Pick<
  Updateable<DeviceTable>,
  | 'condition_value_id'
  | 'visual_grade'
  | 'condition_description'
  | 'device_values'
  | 'review_keys'
  | 'capture_status'
  | 'version'
  | 'updated_at'
>;

export interface DeviceSearchQuery {
  /** Part of a WI-Nr as key (`toWiNrKey`), at least 1 character. */
  wiNrKey: string;
  limit: number;
  offset: number;
}

/**
 * Queries on `device` (CU-122; Technical Specification 4.1, Nachtrag MAR-965). Inside an action
 * pass `tx.db`, outside of one the outer `db` (2.0.4). With #197 the devices of a model listing and
 * the assignment; the unassigned devices follow with #258.
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

    /**
     * Hits of the device search (`GET /api/devices?wiNr=`, 2.5, REQ-016): devices whose WI-Nr key
     * contains the given key, of every inventory status (AC-REQ-012-05), by WI-Nr key and `id`.
     * `instr` takes `%` and `_` literally. The titles of the model listings come from CU-125
     * (Nachtrag MAR-965).
     */
    async search({ wiNrKey, limit, offset }: DeviceSearchQuery) {
      return db
        .selectFrom('device')
        .select([
          'id',
          'wi_nr',
          'model_template_id',
          'listing_id',
          'stock_status',
          'capture_status',
        ])
        .where(sql<number>`instr(wi_nr_key, ${wiNrKey})`, '>', 0)
        .orderBy('wi_nr_key')
        .orderBy('id')
        .limit(limit)
        .offset(offset)
        .execute();
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

    /**
     * The devices assigned to a model listing with what its stock data need (2.8.2, CU-128), by
     * `assigned_at` and `id`; WI-Nrs and battery capacity follow with #209.
     */
    async listByListing(listingId: number) {
      return db
        .selectFrom('device')
        .select(['id', 'stock_status'])
        .where('listing_id', '=', listingId)
        .orderBy('assigned_at')
        .orderBy('id')
        .execute();
    },

    /**
     * Assigns a device to a model listing at `at` (2.6: `assigned_at` orders the WI-Nrs of
     * `{WI-Nr}`) and raises its version (2.0.3).
     */
    async assign(id: number, listingId: number, at: string): Promise<void> {
      await db
        .updateTable('device')
        .set((eb) => ({
          listing_id: listingId,
          assigned_at: at,
          version: eb('version', '+', 1),
          updated_at: at,
        }))
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
    },

    /** Writes the changed columns of a device (`PATCH /api/devices/{id}`, 2.5). */
    async update(id: number, changes: DeviceUpdate): Promise<void> {
      await db.updateTable('device').set(changes).where('id', '=', id).execute();
    },

    async findById(id: number): Promise<DeviceRow | undefined> {
      return db.selectFrom('device').selectAll().where('id', '=', id).executeTakeFirst();
    },
  };
}

export type DeviceRepository = ReturnType<typeof createDeviceRepository>;
