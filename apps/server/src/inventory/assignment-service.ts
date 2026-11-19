import {
  descriptionKey,
  variantsMatch,
  type VariantSpec,
} from '@resellr/domain/inventory/compare-variants';
import type { AttributeValues } from '@resellr/domain/schemas/attribute-values.schema';
import {
  type DeviceAssignment,
  type DeviceAssignmentInput,
  deviceAssignmentBodySchema,
  type Listing,
  type ListingCreateInput,
  listingCreateBodySchema,
  toArticleNumberKey,
} from '@resellr/domain/schemas/listing.schema';

import { createAuditWriter } from '../audit/index.ts';
import { createCatalogReader } from '../catalog/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import { type AttributeEntry, createSettingsReader } from '../settings/index.ts';
import type { Clock } from '../shared/clock.ts';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  RuleViolation,
} from '../shared/domain-error.ts';
import { createDeviceRepository } from './device-repository.ts';
import { readableValues, toDevice } from './device-service.ts';
import { createListingRepository, type ListingRow } from './listing-repository.ts';
import { createListingStockUpdater } from './listing-stock-updater.ts';

export interface AssignmentServiceDeps {
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const parseValues = (json: string) => JSON.parse(json) as AttributeValues;

/** The model listing of 3.3 with its delivery scope in the answers of 2.6 and 2.7. */
export function toListing(row: ListingRow, deliveryScopeTextBlockIds: number[]): Listing {
  return {
    id: row.id,
    modelTemplateId: row.model_template_id,
    conditionValueId: row.condition_value_id,
    visualGrade: row.visual_grade,
    conditionDescription: row.condition_description,
    variantValues: parseValues(row.variant_values),
    otherValues: parseValues(row.other_device_values),
    deliveryScopeTextBlockIds,
    articleNumber: row.article_number,
    eanMode: row.ean_mode as Listing['eanMode'],
    ownEan: row.own_ean,
    displayTitle: row.display_title,
    quantity: row.quantity,
    version: row.version,
  };
}

/**
 * The values of a device split for its model listing (2.6, AC-REQ-019-01): the variant values
 * (attributes of the level device with the flag "variantenbildend", active or deactivated, K-03)
 * and the other device values without the battery capacity, which stays at the device (A-16).
 */
function splitDeviceValues(attributes: readonly AttributeEntry[], values: AttributeValues) {
  const variant: AttributeValues = {};
  const other: AttributeValues = {};
  for (const attribute of attributes) {
    const key = String(attribute.id);
    const value = values[key];
    if (attribute.level !== 'device' || value === undefined) continue;
    if (attribute.variantForming) variant[key] = value;
    else if (attribute.systemRole !== 'battery_capacity') other[key] = value;
  }
  return { variant, other };
}

/**
 * Assignment service (CU-123, REQ-017 to REQ-020; Technical Specification 2.6): the only place
 * that assigns devices, creates a model listing from a device and rebooks. With #197 creating a
 * model listing from a checked, available device, with #194 assigning a device to an existing
 * model listing of its model template, with #199 leaving the previous model listing on creating;
 * the deviation check (#196), rebooking (#202) and the check of the review flags (#189) follow.
 */
export function createAssignmentService({ uow, clock }: AssignmentServiceDeps) {
  return {
    /**
     * `POST /api/devices/{id}/assignment` (REQ-017): assigns the device to the model listing at
     * `assigned_at` = now, forms the stock of the model listing anew (CU-128, `StockChanged`) and
     * writes the audit entry. Order of the checks: the device (`not_found`), the model listing
     * (`400`, a program error of the user interface), the version (`version_conflict`), then the
     * preconditions of 2.6: available (`device_not_available`), not assigned
     * (`already_assigned`), the same model template (`other_model_template`); the first matching
     * stage wins and nothing is stored. `review_pending` (#189) and `variant_deviation` (#196)
     * follow. `adjustStockChannels` is the report of the `StockChanged` handlers, empty until S5.
     */
    async assign(deviceId: number, input: DeviceAssignmentInput): Promise<DeviceAssignment> {
      const request = deviceAssignmentBodySchema.parse(input);
      const { result, report } = await uow.run(async (tx) => {
        const devices = createDeviceRepository(tx.db);
        const listings = createListingRepository(tx.db);

        const device = await devices.findById(deviceId);
        if (device === undefined) throw new NotFoundError();
        const listing = await listings.findById(request.listingId);
        if (listing === undefined) throw new BadRequestError('listingId unknown');
        if (device.version !== request.version) throw new ConflictError('version_conflict');
        if (device.stock_status !== 'available') {
          throw new RuleViolation('device_not_available', { usage: 'assignment' });
        }
        if (device.listing_id !== null) throw new RuleViolation('already_assigned');
        if (device.model_template_id !== listing.model_template_id) {
          throw new RuleViolation('other_model_template');
        }

        const at = clock.now().toISOString();
        await devices.assign(device.id, listing.id, at);
        const quantity = await createListingStockUpdater(tx).update(listing.id);

        await createAuditWriter({ db: tx.db, clock }).write({
          objectType: 'device',
          objectId: device.id,
          objectLabel: `Gerät ${device.wi_nr}`,
          action: 'assigned',
          oldValue: null,
          newValue: { 'Modell-Inserat': listing.display_title },
        });

        const stored = await devices.findById(device.id);
        if (stored === undefined) throw new Error(`device ${device.id} vanished in its action`);
        return { device: toDevice(stored), listing: { id: listing.id, quantity } };
      });
      return { ...result, adjustStockChannels: report.adjustStockChannels };
    },

    /**
     * `POST /api/listings` (REQ-019): a model listing with the variant data and the other listed
     * values of the device, the article number (the WI-Nr unless `articleNumber` is set), the EAN
     * marking `original`, without delivery scope, prices and photos, and the device assigned to it
     * (quantity 1). An assigned device leaves its previous model listing, whose stock is formed
     * anew with `StockChanged` as well (AC-REQ-019-07). Order of the checks (2.0.11): the device
     * and its version, available, then the variant data against every model listing of the model
     * template (`variant_duplicate`, AC-REQ-019-02) and the article number
     * (`article_number_taken`). `ListingCreated` and `StockChanged` have no handler until S5
     * (4.4.0).
     */
    async createFromDevice(input: ListingCreateInput): Promise<Listing> {
      const request = listingCreateBodySchema.parse(input);
      const { result } = await uow.run(async (tx) => {
        const devices = createDeviceRepository(tx.db);
        const listings = createListingRepository(tx.db);
        const catalog = createCatalogReader(tx.db);
        const settings = createSettingsReader(tx.db);

        const device = await devices.findById(request.fromDeviceId);
        if (device === undefined) throw new BadRequestError('fromDeviceId unknown');
        if (device.version !== request.deviceVersion) throw new ConflictError('version_conflict');
        if (device.stock_status !== 'available') {
          throw new RuleViolation('device_not_available', { usage: 'new_listing' });
        }
        // A device always has its model template (`NOT NULL`, `ON DELETE RESTRICT`).
        const template = await catalog.findModelTemplate(device.model_template_id);
        if (template === undefined) {
          throw new Error(`model template ${device.model_template_id} of a device is missing`);
        }
        const attributes = await settings.listAttributes(template.deviceTypeId);
        const variantAttributeIds = attributes
          .filter((attribute) => attribute.level === 'device' && attribute.variantForming)
          .map((attribute) => attribute.id);
        const deviceValues = parseValues(device.device_values);
        const deviceSpec: VariantSpec = {
          conditionValueId: device.condition_value_id,
          visualGrade: device.visual_grade,
          conditionDescription: device.condition_description,
          values: deviceValues,
        };

        // The values of a listing are its device-level values, variant and other ones (2.1).
        const duplicate = (await listings.listVariantData([template.id])).find((row) =>
          variantsMatch(
            deviceSpec,
            {
              conditionValueId: row.condition_value_id,
              visualGrade: row.visual_grade,
              conditionDescription: row.condition_description,
              values: {
                ...parseValues(row.other_device_values),
                ...parseValues(row.variant_values),
              },
            },
            variantAttributeIds,
          ),
        );
        if (duplicate !== undefined) {
          throw new RuleViolation('variant_duplicate', {
            usage: 'new_listing',
            messageArgs: [duplicate.display_title],
            details: { listingId: duplicate.id },
          });
        }

        const articleNumber = request.articleNumber ?? device.wi_nr;
        const articleNumberKey = toArticleNumberKey(articleNumber);
        if ((await listings.findByArticleNumberKey(articleNumberKey)) !== undefined) {
          throw new RuleViolation('article_number_taken', {
            details: { path: 'articleNumber' },
          });
        }

        // Until the title formation of S5 (CU-145) the display title is the model name of the
        // model template (MAR-1053).
        const [named] = await catalog.listModelTemplateNames([template.id]);
        const displayTitle = named?.modelName ?? String(template.id);

        const { variant, other } = splitDeviceValues(attributes, deviceValues);
        const stock = createListingStockUpdater(tx);
        const at = clock.now().toISOString();
        const listingId = await listings.insert({
          model_template_id: template.id,
          condition_value_id: device.condition_value_id,
          visual_grade: device.visual_grade,
          condition_description: device.condition_description,
          condition_description_key: descriptionKey(device.condition_description),
          variant_values: JSON.stringify(variant),
          other_device_values: JSON.stringify(other),
          article_number: articleNumber,
          article_number_key: articleNumberKey,
          ean_mode: 'original',
          own_ean: null,
          display_title: displayTitle,
          ...(await stock.initialColumns()),
          version: 1,
          created_at: at,
          updated_at: at,
        });
        tx.emit({ type: 'ListingCreated', listingId });

        // An assigned device leaves its previous model listing, whose stock is formed anew in
        // the same transaction (AC-REQ-019-07, 2.8.2).
        const previous =
          device.listing_id === null ? undefined : await listings.findById(device.listing_id);
        await devices.assign(device.id, listingId, at);
        await stock.update(listingId);
        if (previous !== undefined) await stock.update(previous.id);

        const readable = await readableValues(settings, attributes, device.condition_value_id, {
          ...other,
          ...variant,
        });
        const audit = createAuditWriter({ db: tx.db, clock });
        await audit.write({
          objectType: 'listing',
          objectId: listingId,
          objectLabel: displayTitle,
          action: 'created',
          oldValue: null,
          newValue: {
            Modellvorlage: displayTitle,
            Zustand: readable.condition,
            'Optik-Note': device.visual_grade,
            ...(device.condition_description !== '' && {
              Zustandsbeschreibung: device.condition_description,
            }),
            ...readable.values,
            Artikelnummer: articleNumber,
            'EAN-Kennzeichnung': 'Original',
          },
        });
        await audit.write({
          objectType: 'device',
          objectId: device.id,
          objectLabel: `Gerät ${device.wi_nr}`,
          action: 'assigned',
          oldValue: previous === undefined ? null : { 'Modell-Inserat': previous.display_title },
          newValue: { 'Modell-Inserat': displayTitle },
        });

        const stored = await listings.findById(listingId);
        if (stored === undefined) throw new Error(`listing ${listingId} vanished in its action`);
        return toListing(stored, await listings.listDeliveryScopeIds(listingId));
      });
      return result;
    },
  };
}

export type AssignmentService = ReturnType<typeof createAssignmentService>;
