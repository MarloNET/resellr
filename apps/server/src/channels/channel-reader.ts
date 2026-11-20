import type { ChannelSummary } from '@resellr/domain/schemas/channel.schema';
import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import { createChannelsRepository } from './channels-repository.ts';

/** A channel for the price of a model listing (2.7, Nachtrag MAR-1171); server only. */
export interface ChannelEntry {
  id: number;
  name: string;
  vbAllowed: boolean;
}

/**
 * Read interface of the channel settings (CU-161; Technical Specification 4.1): in S2 the
 * channel list of the initial settings (4.4.0), in S4 one channel for the price service (#204),
 * extended in S5 by price rules, patterns,
 * templates and mappings. Inside an action pass `tx.db`, outside of one the outer `db`.
 */
export function createChannelReader(db: Kysely<DB>) {
  const repository = createChannelsRepository(db);
  return {
    /** All channels, active or not, in their order. */
    async listChannels(): Promise<ChannelSummary[]> {
      const rows = await repository.list();
      return rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        active: row.active === 1,
        sortOrder: row.sort_order,
      }));
    },

    /**
     * One channel, active or not, with its name and whether it allows "Verhandlungsbasis"
     * (REQ-029), `undefined` if there is none; for the price service CU-126 with `tx.db` (2.7,
     * Nachtrag MAR-1171).
     */
    async findChannel(id: number): Promise<ChannelEntry | undefined> {
      const row = await repository.findById(id);
      if (row === undefined) return undefined;
      return { id: row.id, name: row.name, vbAllowed: row.vb_allowed === 1 };
    },
  };
}

export type ChannelReader = ReturnType<typeof createChannelReader>;
