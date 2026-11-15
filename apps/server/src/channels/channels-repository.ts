import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';

/** A channel of the list (3.1 `channel`); the further channel settings follow with S5. */
export interface ChannelListRow {
  id: number;
  code: string;
  name: string;
  active: number;
  sort_order: number;
}

/**
 * Queries on `channel` (CU-160): in S2 the channel list of the initial settings for the scopes
 * (4.4.0). Extended in S5 by the channel settings tables (FIND-201, #169). Inside an action
 * pass `tx.db`, outside of one the outer `db` (2.0.4, MAR-263).
 */
export function createChannelsRepository(db: Kysely<DB>) {
  return {
    /** All channels, active or not, in their order (`sort_order`, then id). */
    async list(): Promise<ChannelListRow[]> {
      return db
        .selectFrom('channel')
        .select(['id', 'code', 'name', 'active', 'sort_order'])
        .orderBy('sort_order')
        .orderBy('id')
        .execute();
    },
  };
}

export type ChannelsRepository = ReturnType<typeof createChannelsRepository>;
