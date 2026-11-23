import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import { createListingRepository } from './listing-repository.ts';

/** A model listing as other components need it (Nachtrag MAR-1280); server only. */
export interface ListingEntry {
  id: number;
  displayTitle: string;
  version: number;
}

/**
 * Read interface of `inventory` (CU-129; Technical Specification 4.1): in S7 one model listing
 * for the photos of `media` (#238, Nachtrag MAR-1280); extended later for model listings,
 * devices and prices (F-08, F-13, F-14). Inside an action pass `tx.db`, outside of one the outer
 * `db`.
 */
export function createInventoryReader(db: Kysely<DB>) {
  const listings = createListingRepository(db);
  return {
    /** A model listing with its display title and version, `undefined` if there is none. */
    async findListing(id: number): Promise<ListingEntry | undefined> {
      const row = await listings.findById(id);
      if (row === undefined) return undefined;
      return { id: row.id, displayTitle: row.display_title, version: row.version };
    },
  };
}

export type InventoryReader = ReturnType<typeof createInventoryReader>;
