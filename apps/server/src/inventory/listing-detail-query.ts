import type { BatteryCapacityValue } from '@resellr/domain/schemas/attribute-values.schema';
import type { ListingDetail, ListingDevice } from '@resellr/domain/schemas/listing.schema';
import type { Kysely } from 'kysely';

import { createCatalogReader } from '../catalog/index.ts';
import type { DB } from '../db/schema.ts';
import { createSettingsReader } from '../settings/index.ts';
import { NotFoundError } from '../shared/domain-error.ts';
import { toListing } from './assignment-service.ts';
import { createDeviceRepository } from './device-repository.ts';
import { createListingRepository } from './listing-repository.ts';

type StoredStock = Omit<ListingDetail['stock'], 'stockHash'>;

/**
 * Model listing detail (CU-292, REQ-088; Technical Specification 2.7): serves
 * `GET /api/listings/{id}?includeCancelled=` with the outer `db`: the model listing with its stock
 * data (2.8.2, as CU-128 stored them), its prices by channel, its devices (the cancelled ones only
 * with `includeCancelled`) with the battery capacity from the attribute with the system role
 * `battery_capacity`, and its delivery scope as text blocks with their names in their order;
 * `not_found` for an unknown model listing. Channel contents and photos have reads of their own
 * (FIND-202); `deleteBlockedReason` follows in S9.
 */
export function createListingDetailQuery(db: Kysely<DB>) {
  return {
    async find(id: number, { includeCancelled }: { includeCancelled: boolean }) {
      const listings = createListingRepository(db);
      const row = await listings.findById(id);
      if (row === undefined) throw new NotFoundError();
      const template = await createCatalogReader(db).findModelTemplate(row.model_template_id);
      if (template === undefined) throw new Error(`model template of listing ${id} is missing`);

      const settings = createSettingsReader(db);
      const capacity = (await settings.listAttributes(template.deviceTypeId)).find(
        (attribute) => attribute.systemRole === 'battery_capacity',
      );
      const deliveryScopeIds = await listings.listDeliveryScopeIds(id);
      const names = new Map(
        (await settings.findTextBlocks(deliveryScopeIds)).map((block) => [block.id, block.name]),
      );
      const deviceRows = await createDeviceRepository(db).listForListingDetail(id, {
        includeCancelled,
      });

      return {
        ...toListing(row, deliveryScopeIds),
        stock: { ...(JSON.parse(row.stock_json) as StoredStock), stockHash: row.stock_hash },
        prices: (await listings.listPrices(id)).map((price) => ({
          channelId: price.channel_id,
          amountCents: price.amount_cents,
          vb: price.vb === 1,
          source: price.source as ListingDetail['prices'][number]['source'],
        })),
        devices: deviceRows.map((device): ListingDevice => {
          const values = JSON.parse(device.device_values) as Record<string, unknown>;
          const batteryCapacity = capacity && values[String(capacity.id)];
          return {
            id: device.id,
            wiNr: device.wi_nr,
            stockStatus: device.stock_status as ListingDevice['stockStatus'],
            soldChannelId: device.sold_channel_id,
            soldOn: device.sold_on,
            batteryCapacity: (batteryCapacity as BatteryCapacityValue | undefined) ?? null,
            capturedOn: device.captured_on,
          };
        }),
        deliveryScope: deliveryScopeIds.map((blockId) => {
          const name = names.get(blockId);
          if (name === undefined)
            throw new Error(`text block ${blockId} of listing ${id} is missing`);
          return { id: blockId, name };
        }),
      } satisfies ListingDetail;
    },
  };
}
