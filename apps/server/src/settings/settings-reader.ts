import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import { createDeviceTypeRepository } from './device-type-repository.ts';
import { createManufacturerRepository } from './manufacturer-repository.ts';
import { createSupplierRepository } from './supplier-repository.ts';

/** A settings entry with its name and status, for the rule of 2.0.11. */
export interface SettingsEntry {
  id: number;
  name: string;
  active: boolean;
}

const toEntry = (row: { id: number; name: string; active: number }): SettingsEntry => ({
  id: row.id,
  name: row.name,
  active: row.active === 1,
});

/**
 * Read interface of the settings for other components (CU-086; Technical Specification 4.1,
 * 2.0.11, Nachtrag MAR-904): first device type and manufacturer for the model template service
 * (CU-105), the supplier for the device service (CU-121); each further method follows with the
 * first task that calls it. Inside an action pass `tx.db`, so the check sees the state of the
 * writing transaction.
 */
export function createSettingsReader(db: Kysely<DB>) {
  const deviceTypes = createDeviceTypeRepository(db);
  const manufacturers = createManufacturerRepository(db);
  const suppliers = createSupplierRepository(db);
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

    /** The supplier with name and status, active or not; `undefined` if unknown. */
    async findSupplier(id: number): Promise<SettingsEntry | undefined> {
      const row = await suppliers.findById(id);
      return row && toEntry(row);
    },
  };
}

export type SettingsReader = ReturnType<typeof createSettingsReader>;
