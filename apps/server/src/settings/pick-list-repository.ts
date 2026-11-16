import type { Kysely, Selectable } from 'kysely';

import type { DB, PickListTable, PickListValueTable } from '../db/schema.ts';

export type PickListRow = Selectable<PickListTable>;
export type PickListValueRow = Selectable<PickListValueTable>;

export interface PickListValueInsert {
  pickListId: number;
  label: string;
  labelKey: string;
  batteryPresent: boolean | null;
  active: boolean;
}

export interface PickListValueChange {
  label?: string;
  labelKey?: string;
  batteryPresent?: boolean;
  active?: boolean;
  version: number;
}

/** Lists whose values the attributes of data type `ports` use without `pick_list_id` (2.1). */
const PORT_LISTS = ['port_type', 'port_position'];

const flag = (value: boolean) => (value ? 1 : 0);

/**
 * Queries on `pick_list` and `pick_list_value` (CU-077). Inside an action pass `tx.db`, outside
 * of one the outer `db` (2.0.4, MAR-263).
 */
export function createPickListRepository(db: Kysely<DB>) {
  return {
    /** The nine pick lists of the initial settings in the order of their creation. */
    async listPickLists(page: { limit: number; offset: number }) {
      const rows = await db
        .selectFrom('pick_list')
        .selectAll()
        .orderBy('id')
        .limit(page.limit)
        .offset(page.offset)
        .execute();
      const { total } = await db
        .selectFrom('pick_list')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .executeTakeFirstOrThrow();
      return { rows, total };
    },

    async findPickList(id: number): Promise<PickListRow | undefined> {
      return db.selectFrom('pick_list').selectAll().where('id', '=', id).executeTakeFirst();
    },

    /** Values of a list in their order, active and deactivated ones. */
    async listValues(pickListId: number, page: { limit: number; offset: number }) {
      const rows = await db
        .selectFrom('pick_list_value')
        .selectAll()
        .where('pick_list_id', '=', pickListId)
        .orderBy('sort_order')
        .orderBy('id')
        .limit(page.limit)
        .offset(page.offset)
        .execute();
      const { total } = await db
        .selectFrom('pick_list_value')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .where('pick_list_id', '=', pickListId)
        .executeTakeFirstOrThrow();
      return { rows, total };
    },

    /** All values of a list in their order, for the value order. */
    async allValues(pickListId: number): Promise<PickListValueRow[]> {
      return db
        .selectFrom('pick_list_value')
        .selectAll()
        .where('pick_list_id', '=', pickListId)
        .orderBy('sort_order')
        .orderBy('id')
        .execute();
    },

    async findValue(id: number): Promise<PickListValueRow | undefined> {
      return db.selectFrom('pick_list_value').selectAll().where('id', '=', id).executeTakeFirst();
    },

    /**
     * Values by id with the key of their list, for the check of new entries (2.0.11); unknown
     * ids are missing from the result. No ids: `[]` without a query.
     */
    async findValuesByIds(ids: readonly number[]) {
      if (ids.length === 0) return [];
      return db
        .selectFrom('pick_list_value')
        .innerJoin('pick_list', 'pick_list.id', 'pick_list_value.pick_list_id')
        .select([
          'pick_list_value.id',
          'pick_list_value.pick_list_id',
          'pick_list.key as pick_list_key',
          'pick_list_value.label',
          'pick_list_value.active',
        ])
        .where('pick_list_value.id', 'in', ids)
        .execute();
    },

    /** The value of the list that already has this label key, if any (AC-REQ-007-02). */
    async findValueIdByLabelKey(pickListId: number, labelKey: string) {
      const row = await db
        .selectFrom('pick_list_value')
        .select('id')
        .where('pick_list_id', '=', pickListId)
        .where('label_key', '=', labelKey)
        .executeTakeFirst();
      return row?.id;
    },

    /** Inserts a value at the end of the order of its list; returns its id. */
    async insertValue(value: PickListValueInsert): Promise<number> {
      const { next } = await db
        .selectFrom('pick_list_value')
        .select((eb) => eb(eb.fn.coalesce(eb.fn.max('sort_order'), eb.lit(0)), '+', 1).as('next'))
        .where('pick_list_id', '=', value.pickListId)
        .executeTakeFirstOrThrow();
      const { id } = await db
        .insertInto('pick_list_value')
        .values({
          pick_list_id: value.pickListId,
          label: value.label,
          label_key: value.labelKey,
          battery_present: value.batteryPresent === null ? null : flag(value.batteryPresent),
          sort_order: next,
          active: flag(value.active),
          version: 1,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    /** Stores the changed fields of a value with its new version. */
    async updateValue(id: number, change: PickListValueChange) {
      await db
        .updateTable('pick_list_value')
        .set({
          ...(change.label !== undefined && { label: change.label }),
          ...(change.labelKey !== undefined && { label_key: change.labelKey }),
          ...(change.batteryPresent !== undefined && {
            battery_present: flag(change.batteryPresent),
          }),
          ...(change.active !== undefined && { active: flag(change.active) }),
          version: change.version,
        })
        .where('id', '=', id)
        .execute();
    },

    /** Stores the order of the values (`sort_order` 1, 2, …) and the new version of the list. */
    async storeOrder(pickListId: number, valueIds: readonly number[], version: number) {
      for (const [index, id] of valueIds.entries()) {
        await db
          .updateTable('pick_list_value')
          .set({ sort_order: index + 1 })
          .where('id', '=', id)
          .where('pick_list_id', '=', pickListId)
          .execute();
      }
      await db.updateTable('pick_list').set({ version }).where('id', '=', pickListId).execute();
    },

    /**
     * Device types that use the list (scope of `SettingsChanged`, 2.1): those with an attribute
     * of the list, for the port lists also those with an attribute of data type `ports`, and
     * for the list condition all of them, because every device carries a condition (3.3).
     */
    async deviceTypeIdsUsing(list: PickListRow): Promise<number[]> {
      if (list.key === 'condition') {
        const rows = await db.selectFrom('device_type').select('id').orderBy('id').execute();
        return rows.map((row) => row.id);
      }
      const rows = await db
        .selectFrom('attribute')
        .select('device_type_id')
        .distinct()
        .where((eb) =>
          PORT_LISTS.includes(list.key)
            ? eb.or([eb('pick_list_id', '=', list.id), eb('data_type', '=', 'ports')])
            : eb('pick_list_id', '=', list.id),
        )
        .orderBy('device_type_id')
        .execute();
      return rows.map((row) => row.device_type_id);
    },
  };
}

export type PickListRepository = ReturnType<typeof createPickListRepository>;
