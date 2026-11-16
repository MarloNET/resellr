import type {
  AttributeDataType,
  AttributeLevel,
  AttributeSystemRole,
} from '@resellr/domain/schemas/attribute.schema';
import type { AttributeValueDefinition } from '@resellr/domain/schemas/attribute-values.schema';
import type { PickListKey } from '@resellr/domain/schemas/pick-list.schema';
import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import { createDeviceTypeRepository } from './device-type-repository.ts';
import { createManufacturerRepository } from './manufacturer-repository.ts';
import { createPickListRepository } from './pick-list-repository.ts';

/** A settings entry with its name and status, for the rule of 2.0.11. */
export interface SettingsEntry {
  id: number;
  name: string;
  active: boolean;
}

/** A value of a pick list with its list and status, for the rule of 2.0.11. */
export interface PickListValueEntry {
  id: number;
  pickListId: number;
  pickListKey: PickListKey;
  label: string;
  active: boolean;
}

/** An attribute definition as the value rules of CU-067 and the check of 2.0.11 need it. */
export interface AttributeEntry extends AttributeValueDefinition {
  pickListId: number | null;
}

const toEntry = (row: { id: number; name: string; active: number }): SettingsEntry => ({
  id: row.id,
  name: row.name,
  active: row.active === 1,
});

/**
 * Read interface of the settings for other components (CU-086; Technical Specification 4.1,
 * 2.0.11, Nachtrag MAR-904): device type and manufacturer for the model template service
 * (CU-105), with #178 the attribute definitions of a device type and the pick list values; each
 * further method follows with the first task that calls it. Inside an action pass `tx.db`, so
 * the check sees the state of the writing transaction.
 */
export function createSettingsReader(db: Kysely<DB>) {
  const deviceTypes = createDeviceTypeRepository(db);
  const manufacturers = createManufacturerRepository(db);
  const pickLists = createPickListRepository(db);
  return {
    /** The device type with name and status, active or not; `undefined` if unknown. */
    async findDeviceType(id: number): Promise<SettingsEntry | undefined> {
      const row = await deviceTypes.findById(id);
      return row && toEntry(row);
    },

    /** The manufacturer with name and status, active or not; `undefined` if unknown. */
    async findManufacturer(id: number): Promise<SettingsEntry | undefined> {
      const row = await manufacturers.findById(id);
      return row && toEntry(row);
    },

    /**
     * The attributes of a device type in their order, active and deactivated (2.5: the schema of
     * CU-067 is built from them at run time).
     */
    async listAttributes(deviceTypeId: number): Promise<AttributeEntry[]> {
      const rows = await deviceTypes.listAttributes(deviceTypeId);
      return rows.map((row) => ({
        id: row.id,
        label: row.label,
        dataType: row.data_type as AttributeDataType,
        systemRole: row.system_role as AttributeSystemRole | null,
        minValue: row.min_value,
        maxValue: row.max_value,
        pickListId: row.pick_list_id,
        level: row.level as AttributeLevel,
        required: row.required === 1,
        active: row.active === 1,
      }));
    },

    /**
     * The pick list values with these ids, with their list and status, active or not; unknown
     * ids are left out. No query for `[]` (4.4 CU-086).
     */
    async findPickListValues(ids: readonly number[]): Promise<PickListValueEntry[]> {
      if (ids.length === 0) return [];
      const rows = await pickLists.findValuesWithList([...new Set(ids)]);
      return rows.map((row) => ({
        id: row.id,
        pickListId: row.pick_list_id,
        pickListKey: row.pick_list_key as PickListKey,
        label: row.label,
        active: row.active === 1,
      }));
    },
  };
}

export type SettingsReader = ReturnType<typeof createSettingsReader>;
