import type { Kysely, Selectable } from 'kysely';

import type { DB, TextBlockTable } from '../db/schema.ts';

export type TextBlockRow = Selectable<TextBlockTable>;

/** Legal check status as stored (3.1): all `null` for the kinds without one. */
export interface TextBlockLegalColumns {
  legalStatus: string | null;
  legalCheckedOn: string | null;
  legalCheckedBy: string | null;
}

export interface TextBlockInsert {
  name: string;
  nameKey: string;
  kind: string;
  body: string;
  legalStatus: string | null;
  at: string;
}

export interface TextBlockChange {
  name?: string;
  nameKey?: string;
  kind?: string;
  body?: string;
  active?: boolean;
  legal?: TextBlockLegalColumns;
  version: number;
  at: string;
}

/**
 * Queries on `text_block` and its scope tables (CU-083). Inside an action pass `tx.db`, outside
 * of one the outer `db` (2.0.4, MAR-263).
 */
export function createTextBlockRepository(db: Kysely<DB>) {
  return {
    /** Text blocks by name (case-insensitive key, then id), with the total. */
    async list({ limit, offset }: { limit: number; offset: number }) {
      const rows = await db
        .selectFrom('text_block')
        .selectAll()
        .orderBy('name_key')
        .orderBy('id')
        .limit(limit)
        .offset(offset)
        .execute();
      const { total } = await db
        .selectFrom('text_block')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .executeTakeFirstOrThrow();
      return { rows, total };
    },

    async findById(id: number): Promise<TextBlockRow | undefined> {
      return db.selectFrom('text_block').selectAll().where('id', '=', id).executeTakeFirst();
    },

    /** The text block that already has this name key, active or not (2.2). */
    async findIdByNameKey(nameKey: string): Promise<number | undefined> {
      const row = await db
        .selectFrom('text_block')
        .select('id')
        .where('name_key', '=', nameKey)
        .executeTakeFirst();
      return row?.id;
    },

    /**
     * Inserts an active text block for all device types and all channels, without check date
     * and checking body; returns its id. The choice of a scope follows with #163.
     */
    async insert({ name, nameKey, kind, body, legalStatus, at }: TextBlockInsert): Promise<number> {
      const { id } = await db
        .insertInto('text_block')
        .values({
          name,
          name_key: nameKey,
          kind,
          body,
          active: 1,
          all_device_types: 1,
          all_channels: 1,
          legal_status: legalStatus,
          legal_checked_on: null,
          legal_checked_by: null,
          version: 1,
          created_at: at,
          updated_at: at,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    /** Stores the changed fields with the new version. */
    async update(
      id: number,
      { name, nameKey, kind, body, active, legal, version, at }: TextBlockChange,
    ) {
      await db
        .updateTable('text_block')
        .set({
          ...(name !== undefined && { name }),
          ...(nameKey !== undefined && { name_key: nameKey }),
          ...(kind !== undefined && { kind }),
          ...(body !== undefined && { body }),
          ...(active !== undefined && { active: active ? 1 : 0 }),
          ...(legal !== undefined && {
            legal_status: legal.legalStatus,
            legal_checked_on: legal.legalCheckedOn,
            legal_checked_by: legal.legalCheckedBy,
          }),
          version,
          updated_at: at,
        })
        .where('id', '=', id)
        .execute();
    },
  };
}

export type TextBlockRepository = ReturnType<typeof createTextBlockRepository>;
