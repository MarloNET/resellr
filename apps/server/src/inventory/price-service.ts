import { formatMoney, formatYesNo } from '@resellr/domain/format/format-value';
import {
  type ListingPrice,
  type ListingPriceInput,
  type ListingPrices,
  listingPriceBodySchema,
} from '@resellr/domain/schemas/listing.schema';
import { FIELD_MESSAGES } from '@resellr/domain/messages/messages.de';

import { createAuditWriter } from '../audit/index.ts';
import { createChannelReader } from '../channels/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../shared/domain-error.ts';
import { createListingRepository, type ListingRepository } from './listing-repository.ts';

export interface PriceServiceDeps {
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

/** The prices of a model listing by channel id (2.7). */
async function listPrices(listings: ListingRepository, listingId: number): Promise<ListingPrice[]> {
  return (await listings.listPrices(listingId)).map((price) => ({
    channelId: price.channel_id,
    amountCents: price.amount_cents,
    vb: price.vb === 1,
    source: price.source as ListingPrice['source'],
  }));
}

/** A price in the audit entry `price_updated` (3.6): channel, "269,00 €" and VB as "Ja"/"Nein". */
const auditPrice = (channel: string, price: Pick<ListingPrice, 'amountCents' | 'vb'>) => ({
  Kanal: channel,
  Preis: formatMoney(price.amountCents),
  VB: formatYesNo(price.vb),
});

/**
 * Price service (CU-126, REQ-032; Technical Specification 2.7): saves the price of a model
 * listing for one channel. Until S5 there are no price rules (CU-127), so only the entered price is
 * stored (4.4.0, FIND-227); from S5 it calls CU-127.
 */
export function createPriceService({ uow, clock }: PriceServiceDeps) {
  return {
    /**
     * `PUT /api/listings/{id}/prices/{channelId}`: the price becomes `manual`. Order of the checks
     * (2.7, Nachtrag MAR-1171): the rule of the amount by the schema (AC-REQ-032-03), the model
     * listing (`not_found`) and its version (`version_conflict`), the channel (`bad_request`),
     * then VB only for a channel with `vbAllowed` (`validation_failed`, AC-REQ-032-04). A request without change keeps the version;
     * otherwise the version rises, `ContentInputsChanged` names the channel and the audit entry
     * `price_updated` holds the old and the new price. The answer has the prices of all channels
     * (DER-62-04). Prices check no attribute values (A-39, AC-REQ-005-12 (c)).
     */
    async save(
      listingId: number,
      channelId: number,
      input: ListingPriceInput,
    ): Promise<ListingPrices> {
      const request = listingPriceBodySchema.parse(input);
      const { result } = await uow.run(async (tx) => {
        const listings = createListingRepository(tx.db);
        const listing = await listings.findById(listingId);
        if (listing === undefined) throw new NotFoundError();
        if (listing.version !== request.version) throw new ConflictError('version_conflict');
        // Channels are never deleted, so an unknown one is a program error; a deactivated one is
        // no error (2.0.11 "Ohne Regel bleiben").
        const channel = await createChannelReader(tx.db).findChannel(channelId);
        if (channel === undefined) throw new BadRequestError('channelId unknown');
        if (request.vb && !channel.vbAllowed) {
          throw new ValidationError([
            { path: 'vb', code: 'vb_not_allowed', message: FIELD_MESSAGES.priceVbNotAllowed },
          ]);
        }

        const stored = (await listPrices(listings, listingId)).find(
          (price) => price.channelId === channelId,
        );
        const unchanged =
          stored?.source === 'manual' &&
          stored.amountCents === request.amountCents &&
          stored.vb === request.vb;
        if (unchanged) {
          return {
            listing: { version: listing.version },
            prices: await listPrices(listings, listingId),
          };
        }

        await listings.savePrice({
          listing_id: listingId,
          channel_id: channelId,
          amount_cents: request.amountCents,
          vb: request.vb ? 1 : 0,
          source: 'manual',
        });
        await listings.raiseVersion(listingId, clock.now().toISOString());
        tx.emit({ type: 'ContentInputsChanged', listingIds: [listingId], channelIds: [channelId] });
        await createAuditWriter({ db: tx.db, clock }).write({
          objectType: 'listing',
          objectId: listingId,
          objectLabel: listing.display_title,
          action: 'price_updated',
          oldValue: stored === undefined ? null : auditPrice(channel.name, stored),
          newValue: auditPrice(channel.name, request),
        });

        return {
          listing: { version: listing.version + 1 },
          prices: await listPrices(listings, listingId),
        };
      });
      return result;
    },
  };
}

export type PriceService = ReturnType<typeof createPriceService>;
