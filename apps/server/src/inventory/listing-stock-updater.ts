import { buildStock, type StockDevice, stockHash } from '@resellr/domain/content-engine/stock';

import type { DB } from '../db/schema.ts';
import type { UnitOfWork } from '../db/unit-of-work.ts';
import { createDeviceRepository } from './device-repository.ts';
import { createListingRepository, type ListingStockColumns } from './listing-repository.ts';

/** The derived stock columns of a model listing with these assigned devices (3.3, 2.8.2). */
async function stockColumns(devices: readonly StockDevice[]): Promise<ListingStockColumns> {
  const stock = buildStock(devices);
  return {
    quantity: stock.quantity,
    stock_json: JSON.stringify(stock),
    stock_hash: await stockHash(stock),
  };
}

/**
 * Stock update (CU-128, REQ-091; Technical Specification 2.8.2, 3.3): the only writer of
 * `listing.quantity`, `stock_json` and `stock_hash`, always formed anew from the assigned devices
 * (CU-120) in the transaction of the device change, which then reports `StockChanged`. Runs inside
 * an action with its `uow` (2.0.4).
 */
export function createListingStockUpdater(uow: UnitOfWork<DB>) {
  const devices = createDeviceRepository(uow.db);
  const listings = createListingRepository(uow.db);
  return {
    /** The stock columns of a new model listing, before a device is assigned to it. */
    initialColumns: () => stockColumns([]),

    /**
     * Forms the stock columns of the model listing anew from its devices, writes them and emits
     * `StockChanged` (2.6); returns the new quantity.
     */
    async update(listingId: number): Promise<number> {
      const assigned = await devices.listByListing(listingId);
      const columns = await stockColumns(
        assigned.map((device) => ({ stockStatus: device.stock_status })),
      );
      await listings.updateStock(listingId, columns);
      uow.emit({ type: 'StockChanged', listingId });
      return columns.quantity;
    },
  };
}

export type ListingStockUpdater = ReturnType<typeof createListingStockUpdater>;
