import type { Gpsr } from '@resellr/domain/schemas/manufacturer.schema';
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
  /** GPSR details with `gpsr_complete` derived from them (2.2). */
  gpsr?: { values: Gpsr; complete: boolean };
  version: number;
  at: string;
}

/** `''` = not given, stored as `NULL` (3.1). */
const textOrNull = (value: string) => (value === '' ? null : value);

const gpsrColumns = ({ values, complete }: NonNullable<ManufacturerChange['gpsr']>) => ({
  gpsr_legal_name: textOrNull(values.legalName),
  gpsr_street: textOrNull(values.street),
  gpsr_postal_code: textOrNull(values.postalCode),
  gpsr_city: textOrNull(values.city),
  gpsr_country: textOrNull(values.country),
  gpsr_contact: textOrNull(values.contact),
  eu_rp_name: textOrNull(values.euRpName),
  eu_rp_address: textOrNull(values.euRpAddress),
  eu_rp_contact: textOrNull(values.euRpContact),
  gpsr_complete: complete ? 1 : 0,
});

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
    async update(id: number, { name, nameKey, active, gpsr, version, at }: ManufacturerChange) {
      await db
        .updateTable('manufacturer')
        .set({
          ...(name !== undefined && { name }),
          ...(nameKey !== undefined && { name_key: nameKey }),
          ...(active !== undefined && { active: active ? 1 : 0 }),
          ...(gpsr !== undefined && gpsrColumns(gpsr)),
          version,
          updated_at: at,
        })
        .where('id', '=', id)
        .execute();
    },
  };
}

export type ManufacturerRepository = ReturnType<typeof createManufacturerRepository>;
