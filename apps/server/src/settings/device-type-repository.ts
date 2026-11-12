import type { Kysely, Selectable } from 'kysely';

import type { AttributeTable, DB, DeviceTypeTable } from '../db/schema.ts';

export type DeviceTypeRow = Selectable<DeviceTypeTable>;
export type AttributeRow = Selectable<AttributeTable>;

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

/** Fields of a new attribute; it is appended at the end of the order of its device type. */
export interface AttributeInsert {
  deviceTypeId: number;
  label: string;
  labelKey: string;
  dataType: string;
  unit: string | null;
  unitSpacing: boolean;
  minValue: string | null;
  maxValue: string | null;
  pickListId: number | null;
  level: string;
  variantForming: boolean;
  required: boolean;
  datasheetBlock: string;
  active: boolean;
  at: string;
}

/** Changed fields of an attribute with its new version. */
export type AttributeChange = Partial<Omit<AttributeInsert, 'deviceTypeId' | 'at'>> & {
  version: number;
  at: string;
};

const flag = (value: boolean) => (value ? 1 : 0);

/**
 * Queries on `device_type` and `attribute` (CU-073).
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

    /** Attributes of a device type in their order, active and deactivated. */
    async listAttributes(deviceTypeId: number): Promise<AttributeRow[]> {
      return db
        .selectFrom('attribute')
        .selectAll()
        .where('device_type_id', '=', deviceTypeId)
        .orderBy('sort_order')
        .orderBy('id')
        .execute();
    },

    async findAttribute(id: number): Promise<AttributeRow | undefined> {
      return db.selectFrom('attribute').selectAll().where('id', '=', id).executeTakeFirst();
    },

    /** The attribute of the device type that already has this label key, if any (2.1). */
    async findAttributeIdByLabelKey(
      deviceTypeId: number,
      labelKey: string,
    ): Promise<number | undefined> {
      const row = await db
        .selectFrom('attribute')
        .select('id')
        .where('device_type_id', '=', deviceTypeId)
        .where('label_key', '=', labelKey)
        .executeTakeFirst();
      return row?.id;
    },

    /** Inserts an attribute at the end of the order of its device type; returns its id. */
    async insertAttribute(attribute: AttributeInsert): Promise<number> {
      const { next } = await db
        .selectFrom('attribute')
        .select((eb) => eb(eb.fn.coalesce(eb.fn.max('sort_order'), eb.lit(0)), '+', 1).as('next'))
        .where('device_type_id', '=', attribute.deviceTypeId)
        .executeTakeFirstOrThrow();
      const { id } = await db
        .insertInto('attribute')
        .values({
          device_type_id: attribute.deviceTypeId,
          label: attribute.label,
          label_key: attribute.labelKey,
          data_type: attribute.dataType,
          system_role: null,
          unit: attribute.unit,
          unit_spacing: flag(attribute.unitSpacing),
          min_value: attribute.minValue,
          max_value: attribute.maxValue,
          pick_list_id: attribute.pickListId,
          level: attribute.level,
          variant_forming: flag(attribute.variantForming),
          required: flag(attribute.required),
          datasheet_block: attribute.datasheetBlock,
          sort_order: next,
          active: flag(attribute.active),
          version: 1,
          created_at: attribute.at,
          updated_at: attribute.at,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    /** Stores the changed fields of an attribute with its new version. */
    async updateAttribute(id: number, change: AttributeChange) {
      const optionalFlag = (value: boolean | undefined) =>
        value === undefined ? undefined : flag(value);
      const set = {
        label: change.label,
        label_key: change.labelKey,
        data_type: change.dataType,
        unit: change.unit,
        unit_spacing: optionalFlag(change.unitSpacing),
        min_value: change.minValue,
        max_value: change.maxValue,
        pick_list_id: change.pickListId,
        level: change.level,
        variant_forming: optionalFlag(change.variantForming),
        required: optionalFlag(change.required),
        datasheet_block: change.datasheetBlock,
        active: optionalFlag(change.active),
      };
      await db
        .updateTable('attribute')
        .set({
          ...Object.fromEntries(Object.entries(set).filter(([, value]) => value !== undefined)),
          version: change.version,
          updated_at: change.at,
        })
        .where('id', '=', id)
        .execute();
    },

    /**
     * Stores the order of the attributes of a device type (`sort_order` 1, 2, …) and the new
     * version of the device type, which guards the order as a whole (2.0.3).
     */
    async storeAttributeOrder(
      deviceTypeId: number,
      attributeIds: readonly number[],
      version: number,
      at: string,
    ) {
      for (const [index, id] of attributeIds.entries()) {
        await db
          .updateTable('attribute')
          .set({ sort_order: index + 1 })
          .where('id', '=', id)
          .where('device_type_id', '=', deviceTypeId)
          .execute();
      }
      await db
        .updateTable('device_type')
        .set({ version, updated_at: at })
        .where('id', '=', deviceTypeId)
        .execute();
    },
  };
}

export type DeviceTypeRepository = ReturnType<typeof createDeviceTypeRepository>;
