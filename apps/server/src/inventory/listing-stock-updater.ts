import { buildStock, type StockDevice, stockHash } from '@resellr/domain/content-engine/stock';
import type { BatteryCapacityValue } from '@resellr/domain/schemas/attribute-values.schema';
import type { Kysely } from 'kysely';

import { createCatalogReader } from '../catalog/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWork } from '../db/unit-of-work.ts';
import { createSettingsReader } from '../settings/index.ts';
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
 * The stock columns of the model listing as formed anew from its assigned devices (2.8.2): the
 * stored value of the attribute with the role `battery_capacity` and the flag "Akku vorhanden" of
 * the stored value of the attribute with the role `battery`, `null` without one; the status of
 * both attributes does not enter (RQ-27, Nachtrag MAR-1204). Reads only, with `tx.db` inside an
 * action or the outer `db`; the invariant test of the stock columns compares with it (3.3).
 */
export async function formStockColumns(
  db: Kysely<DB>,
  listingId: number,
): Promise<ListingStockColumns> {
  const listing = await createListingRepository(db).findById(listingId);
  if (listing === undefined) throw new Error(`listing ${listingId} is missing`);
  const template = await createCatalogReader(db).findModelTemplate(listing.model_template_id);
  if (template === undefined) throw new Error(`model template of listing ${listingId} is missing`);
  const settings = createSettingsReader(db);
  const attributes = await settings.listAttributes(template.deviceTypeId);
  const capacity = attributes.find((attribute) => attribute.systemRole === 'battery_capacity');
  const battery = attributes.find((attribute) => attribute.systemRole === 'battery');
  const batteryFlags = new Map(
    battery === undefined
      ? []
      : (await settings.listBatteryValues()).map((value) => [value.id, value.batteryPresent]),
  );

  const assigned = await createDeviceRepository(db).listByListing(listingId);
  return stockColumns(
    assigned.map((device): StockDevice => {
      const values = JSON.parse(device.device_values) as Record<string, unknown>;
      const batteryValue = battery && values[String(battery.id)];
      return {
        id: device.id,
        wiNr: device.wi_nr,
        stockStatus: device.stock_status,
        assignedAt: device.assigned_at,
        batteryCapacity:
          (capacity && (values[String(capacity.id)] as BatteryCapacityValue | undefined)) ?? null,
        batteryPresent:
          typeof batteryValue === 'number' ? (batteryFlags.get(batteryValue) ?? null) : null,
      };
    }),
  );
}

/**
 * Stock update (CU-128, REQ-091; Technical Specification 2.8.2, 3.3): the only writer of
 * `listing.quantity`, `stock_json` and `stock_hash`, always formed anew from the assigned devices
 * (CU-120) in the transaction of the device change, which then reports `StockChanged`. Runs inside
 * an action with its `uow` (2.0.4).
 */
export function createListingStockUpdater(uow: UnitOfWork<DB>) {
  const listings = createListingRepository(uow.db);
  return {
    /** The stock columns of a new model listing, before a device is assigned to it. */
    initialColumns: () => stockColumns([]),

    /**
     * Forms the stock columns of the model listing anew from its devices; only if `stock_hash`
     * changes, writes them and emits `StockChanged` (2.8.2, Nachtrag MAR-1204); returns the
     * quantity.
     */
    async update(listingId: number): Promise<number> {
      const columns = await formStockColumns(uow.db, listingId);
      const stored = await listings.findById(listingId);
      if (stored?.stock_hash !== columns.stock_hash) {
        await listings.updateStock(listingId, columns);
        uow.emit({ type: 'StockChanged', listingId });
      }
      return columns.quantity;
    },
  };
}

export type ListingStockUpdater = ReturnType<typeof createListingStockUpdater>;
