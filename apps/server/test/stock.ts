import { isDeepStrictEqual } from 'node:util';

import { type Kysely, sql } from 'kysely';

import type { DB } from '../src/db/schema.ts';
import { createInventoryReader } from '../src/inventory/inventory-reader.ts';
import {
  createListingRepository,
  type ListingStockColumns,
} from '../src/inventory/listing-repository.ts';
import { formStockColumns } from '../src/inventory/listing-stock-updater.ts';

/** The stock columns of a model listing without an assigned device, as CU-128 forms them. */
export const EMPTY_STOCK_COLUMNS = {
  quantity: 0,
  stock_json: '{"quantity":0,"wiNrs":[],"batteryText":""}',
  stock_hash: '74f68861b8f71e9b878b5b1b24fe0b6535a9992a0a894753c3dae776abcc15f3',
} as const;

export interface StockColumnDifference {
  listingId: number;
  stored: ListingStockColumns;
  formed: ListingStockColumns;
}

/**
 * Invariant of the stock columns (DER-65-03; Technical Specification 3.3, FIND-221): the model
 * listings whose `quantity`, `stock_json` and `stock_hash` differ from what CU-128 forms anew from
 * their devices, with both states. A database without the tables `listing` and `device` (before
 * the migrations, or of a migration test) has none.
 */
export async function stockColumnDifferences(db: Kysely<DB>): Promise<StockColumnDifference[]> {
  const tables = await sql<{ name: string }>`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('listing', 'device')
  `.execute(db);
  if (tables.rows.length < 2) return [];

  const listings = createListingRepository(db);
  const differences: StockColumnDifference[] = [];
  for (const id of await createInventoryReader(db).listListingIds()) {
    const row = await listings.findById(id);
    if (row === undefined) continue;
    const stored = {
      quantity: row.quantity,
      stock_json: row.stock_json,
      stock_hash: row.stock_hash,
    };
    const formed = await formStockColumns(db, id);
    const equal =
      stored.quantity === formed.quantity &&
      stored.stock_hash === formed.stock_hash &&
      isDeepStrictEqual(JSON.parse(stored.stock_json), JSON.parse(formed.stock_json));
    if (!equal) differences.push({ listingId: id, stored, formed });
  }
  return differences;
}

/**
 * Writes the stock columns of every model listing as CU-128 forms them (3.3). For tests that put
 * model listings into the database or change devices there directly, because their writing
 * endpoint follows later (e.g. sale and cancellation in S9): the invariant test after the test
 * (`stock-invariant.ts`) then finds the state CU-128 would have written.
 */
export async function syncStockColumns(db: Kysely<DB>): Promise<void> {
  const listings = createListingRepository(db);
  for (const id of await listings.listIds()) {
    await listings.updateStock(id, await formStockColumns(db, id));
  }
}
