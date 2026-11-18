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
  allDeviceTypes: boolean;
  allChannels: boolean;
  at: string;
}

export interface TextBlockChange {
  name?: string;
  nameKey?: string;
  kind?: string;
  body?: string;
  active?: boolean;
  legal?: TextBlockLegalColumns;
  allDeviceTypes?: boolean;
  allChannels?: boolean;
  version: number;
  at: string;
}

/** Chosen device types and channels of a text block; empty when it applies to all (3.1). */
export interface TextBlockScopeIds {
  deviceTypeIds: number[];
  channelIds: number[];
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
     * Inserts an active text block without check date and checking body; returns its id. The
     * chosen device types and channels are stored with `replaceScope`.
     */
    async insert({
      name,
      nameKey,
      kind,
      body,
      legalStatus,
      allDeviceTypes,
      allChannels,
      at,
    }: TextBlockInsert): Promise<number> {
      const { id } = await db
        .insertInto('text_block')
        .values({
          name,
          name_key: nameKey,
          kind,
          body,
          active: 1,
          all_device_types: allDeviceTypes ? 1 : 0,
          all_channels: allChannels ? 1 : 0,
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
    async update(id: number, change: TextBlockChange) {
      const { name, nameKey, kind, body, active, legal, allDeviceTypes, allChannels } = change;
      const { version, at } = change;
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
          ...(allDeviceTypes !== undefined && { all_device_types: allDeviceTypes ? 1 : 0 }),
          ...(allChannels !== undefined && { all_channels: allChannels ? 1 : 0 }),
          version,
          updated_at: at,
        })
        .where('id', '=', id)
        .execute();
    },

    /** Chosen device types and channels of the text blocks, by text block id, ids ascending. */
    async scopesOf(ids: number[]): Promise<Map<number, TextBlockScopeIds>> {
      const scopes = new Map<number, TextBlockScopeIds>(
        ids.map((id) => [id, { deviceTypeIds: [], channelIds: [] }]),
      );
      if (ids.length === 0) return scopes;
      const deviceTypes = await db
        .selectFrom('text_block_device_type')
        .select(['text_block_id', 'device_type_id'])
        .where('text_block_id', 'in', ids)
        .orderBy('device_type_id')
        .execute();
      for (const row of deviceTypes) {
        scopes.get(row.text_block_id)?.deviceTypeIds.push(row.device_type_id);
      }
      const channels = await db
        .selectFrom('text_block_channel')
        .select(['text_block_id', 'channel_id'])
        .where('text_block_id', 'in', ids)
        .orderBy('channel_id')
        .execute();
      for (const row of channels) scopes.get(row.text_block_id)?.channelIds.push(row.channel_id);
      return scopes;
    },

    /** Replaces the chosen device types and channels; empty lists for "alle" (3.1). */
    async replaceScope(id: number, { deviceTypeIds, channelIds }: TextBlockScopeIds) {
      await db.deleteFrom('text_block_device_type').where('text_block_id', '=', id).execute();
      await db.deleteFrom('text_block_channel').where('text_block_id', '=', id).execute();
      if (deviceTypeIds.length > 0) {
        await db
          .insertInto('text_block_device_type')
          .values(
            deviceTypeIds.map((deviceTypeId) => ({
              text_block_id: id,
              device_type_id: deviceTypeId,
            })),
          )
          .execute();
      }
      if (channelIds.length > 0) {
        await db
          .insertInto('text_block_channel')
          .values(channelIds.map((channelId) => ({ text_block_id: id, channel_id: channelId })))
          .execute();
      }
    },
  };
}

export type TextBlockRepository = ReturnType<typeof createTextBlockRepository>;
