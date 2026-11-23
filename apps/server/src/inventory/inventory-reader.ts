import type { Stock } from '@resellr/domain/content-engine/stock';
import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import { createDeviceRepository } from './device-repository.ts';
import { createListingRepository, type ListingRow } from './listing-repository.ts';

/** The current stock data of a model listing with their hash (2.7 `stock`, 2.8.2). */
export interface ListingStock extends Stock {
  stockHash: string;
}

/** The stock data as CU-128 stored them in `stock_json` and `stock_hash` (3.3). */
export function toListingStock(row: Pick<ListingRow, 'stock_json' | 'stock_hash'>): ListingStock {
  return { ...(JSON.parse(row.stock_json) as Stock), stockHash: row.stock_hash };
}

/**
 * Inventory reader (CU-129; Technical Specification 4.1, 4.4 S4): the read interface of
 * `inventory` for model listings, their devices and prices with the current stock data, which
 * CU-128 forms anew with every device change (2.8.2, 3.3). Pass `tx.db` inside an action, the
 * outer `db` outside of one (2.0.4).
 */
export function createInventoryReader(db: Kysely<DB>) {
  const listings = createListingRepository(db);
  return {
    /** The ids of all model listings in ascending order. */
    async listListingIds(): Promise<number[]> {
      return listings.listIds();
    },

    /** The model listing with its current stock data, `undefined` for an unknown id. */
    async findListing(id: number) {
      const row = await listings.findById(id);
      return (
        row && {
          id: row.id,
          modelTemplateId: row.model_template_id,
          articleNumber: row.article_number,
          displayTitle: row.display_title,
          stock: toListingStock(row),
        }
      );
    },

    /** The devices assigned to the model listing by `assigned_at` and `id` (2.8.2). */
    async listDevices(listingId: number) {
      const rows = await createDeviceRepository(db).listByListing(listingId);
      return rows.map((row) => ({
        id: row.id,
        wiNr: row.wi_nr,
        stockStatus: row.stock_status,
        assignedAt: row.assigned_at,
        values: JSON.parse(row.device_values) as Record<string, unknown>,
      }));
    },

    /** The prices of the model listing by channel (2.7). */
    async listPrices(listingId: number) {
      const rows = await listings.listPrices(listingId);
      return rows.map((row) => ({
        channelId: row.channel_id,
        amountCents: row.amount_cents,
        vb: row.vb === 1,
        source: row.source,
      }));
    },
  };
}

export type InventoryReader = ReturnType<typeof createInventoryReader>;
