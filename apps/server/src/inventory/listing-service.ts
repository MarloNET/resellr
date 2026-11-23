import {
  type DeviatingDevice,
  descriptionKey,
  deviationLine,
  variantDifferences,
  variantsMatch,
} from '@resellr/domain/inventory/compare-variants';
import {
  type AttributeValues,
  mergeAttributeValues,
} from '@resellr/domain/schemas/attribute-values.schema';
import {
  type Listing,
  type ListingUpdateInput,
  listingValuesSchema,
  toArticleNumberKey,
} from '@resellr/domain/schemas/listing.schema';
import type { Kysely } from 'kysely';

import { createAuditWriter } from '../audit/index.ts';
import { createCatalogReader } from '../catalog/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import {
  type AttributeEntry,
  createSettingsReader,
  type SettingsReader,
} from '../settings/index.ts';
import type { Clock } from '../shared/clock.ts';
import {
  BadRequestError,
  ConfirmationRequired,
  ConflictError,
  NotFoundError,
  RuleViolation,
} from '../shared/domain-error.ts';
import { splitDeviceValues, toListing } from './assignment-service.ts';
import { createDeviceRepository } from './device-repository.ts';
import {
  checkActivePickListValues,
  checkedRequest,
  findPickListValues,
  pickListValueReferences,
  readableValues,
} from './device-service.ts';
import { listingDeviations } from './listing-choice-query.ts';
import { createListingRepository, type ListingRow } from './listing-repository.ts';

export interface ListingServiceDeps {
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const parseValues = (json: string) => JSON.parse(json) as AttributeValues;

/**
 * The attributes of the listing values (2.5, 2.6): the variant attributes (level device with the
 * flag "variantenbildend", active or deactivated, K-03) and the other attributes of the level
 * device without the battery capacity, which stays at the device (A-16).
 */
function listingAttributes(attributes: readonly AttributeEntry[]) {
  const ofDevice = attributes.filter(({ level }) => level === 'device');
  return {
    variantAttributes: ofDevice.filter(({ variantForming }) => variantForming),
    otherAttributes: ofDevice.filter(
      ({ variantForming, systemRole }) => !variantForming && systemRole !== 'battery_capacity',
    ),
  };
}

/** The EAN marking as the audit entry names it (UI-014 "EAN"). */
const EAN_MODE_LABELS = { original: 'Original', own: 'eigene' } as const;

/** The listing values readable for the audit entry (3.4): labels instead of ids. */
async function readableListingValues(
  settings: SettingsReader,
  attributes: readonly AttributeEntry[],
  listing: Pick<
    Listing,
    | 'conditionValueId'
    | 'visualGrade'
    | 'conditionDescription'
    | 'articleNumber'
    | 'eanMode'
    | 'ownEan'
  > & { values: AttributeValues; deliveryScopeTextBlockIds: readonly number[] },
): Promise<Record<string, string | number>> {
  const readable = await readableValues(
    settings,
    attributes,
    listing.conditionValueId,
    listing.values,
  );
  const names = new Map(
    (await settings.findTextBlocks(listing.deliveryScopeTextBlockIds)).map((block) => [
      block.id,
      block.name,
    ]),
  );
  return {
    Zustand: readable.condition,
    'Optik-Note': listing.visualGrade,
    ...(listing.conditionDescription !== '' && {
      Zustandsbeschreibung: listing.conditionDescription,
    }),
    ...readable.values,
    ...(listing.deliveryScopeTextBlockIds.length > 0 && {
      Lieferumfang: listing.deliveryScopeTextBlockIds
        .map((id) => names.get(id) ?? String(id))
        .join(', '),
    }),
    Artikelnummer: listing.articleNumber,
    'EAN-Kennzeichnung': EAN_MODE_LABELS[listing.eanMode],
    ...(listing.ownEan !== null && { 'eigene EAN': listing.ownEan }),
  };
}

/** The variant data of a stored model listing: its variant and other values together (2.1). */
const variantSpecOf = (
  row: Pick<
    ListingRow,
    | 'condition_value_id'
    | 'visual_grade'
    | 'condition_description'
    | 'variant_values'
    | 'other_device_values'
  >,
) => ({
  conditionValueId: row.condition_value_id,
  visualGrade: row.visual_grade,
  conditionDescription: row.condition_description,
  values: { ...parseValues(row.other_device_values), ...parseValues(row.variant_values) },
});

/**
 * The assigned, available devices of a model listing that deviate from its variant data `listing`
 * after the comparison rule (CU-119, 2.6; REQ-088, AC-REQ-088-03), by `assigned_at` and `id`, each
 * with its WI-Nr and its deviations with readable values.
 */
async function deviatingDevices(
  db: Kysely<DB>,
  settings: SettingsReader,
  variantAttributes: readonly AttributeEntry[],
  listingId: number,
  listing: Parameters<typeof listingDeviations>[3],
): Promise<DeviatingDevice[]> {
  const devices = createDeviceRepository(db);
  const deviating: DeviatingDevice[] = [];
  for (const { id, stock_status } of await devices.listByListing(listingId)) {
    if (stock_status !== 'available') continue;
    const device = await devices.findById(id);
    if (device === undefined) continue;
    const deviations = await listingDeviations(settings, variantAttributes, device, listing);
    if (deviations.length > 0) deviating.push({ wiNr: device.wi_nr, deviations });
  }
  return deviating;
}

/**
 * Model listing service (CU-124, REQ-088; Technical Specification 2.7): changes the listing values
 * of a model listing together with its audit entry and `ContentInputsChanged` in one transaction
 * (2.0.4), with the confirmation of deviating assigned devices (`confirmDeviatingDevices`, #207)
 * and the uniqueness of a changed article number (`article_number_taken`, #200).
 */
export function createListingService({ uow, clock }: ListingServiceDeps) {
  return {
    /**
     * `PATCH /api/listings/{id}` for the listing values of UI-014 (2.7). Order of the checks
     * (2.0.11, first matching stage wins, nothing is stored): the model listing (`not_found`) and
     * its version (`version_conflict`); the condition and the pick list values in `variantValues`,
     * then in `otherValues` and the text blocks of the delivery scope exist (`400 bad_request`);
     * a changed condition or pick list value is active (`pick_list_value_deactivated`, a stored,
     * deactivated one stays valid); the rules on the complete state after the change
     * (`validation_failed`: values by CU-067, article number, own EAN); the variant data differ
     * from every other model listing of the model template (`variant_duplicate`,
     * AC-REQ-088-02); the article number belongs to no other model listing, without regard to
     * case (`article_number_taken` at `articleNumber`, AC-REQ-019-04); then the question: if the variant data change and assigned, available
     * devices deviate from them afterwards, `confirmation_required` with `details.kind =
     * assigned_devices_deviate` and `details.devices[]: { wiNr, deviations[] }` unless
     * `confirmDeviatingDevices` is `true` (AC-REQ-088-03, `UI-014.abweichung-bestaetigen`). The
     * model data are not part of the request (AC-REQ-088-06). An unchanged request keeps the
     * version; a change writes the audit entry `values_updated` with the changed fields, confirmed
     * `deviation_confirmed` with the deviations as well, and reports `ContentInputsChanged` for the
     * model listing (no handler until S5).
     */
    async update(id: number, input: ListingUpdateInput): Promise<Listing> {
      const { result } = await uow.run(async (tx) => {
        const settings = createSettingsReader(tx.db);
        const listings = createListingRepository(tx.db);
        const row = await listings.findById(id);
        if (row === undefined) throw new NotFoundError();
        if (row.version !== input.version) throw new ConflictError('version_conflict');

        const stored = toListing(row, await listings.listDeliveryScopeIds(id));
        // A model listing always has its model template (`NOT NULL`, `ON DELETE RESTRICT`).
        const template = await createCatalogReader(tx.db).findModelTemplate(stored.modelTemplateId);
        if (template === undefined) throw new Error(`model template of listing ${id} is missing`);
        const attributes = await settings.listAttributes(template.deviceTypeId);
        const { variantAttributes, otherAttributes } = listingAttributes(attributes);
        // The stored values split by the current flag "variantenbildend" (2.1: the flag may
        // change after the model listing was created; the values move with it).
        const { variant: storedVariant, other: storedOther } = splitDeviceValues(attributes, {
          ...(stored.otherValues as AttributeValues),
          ...(stored.variantValues as AttributeValues),
        });

        // The state after the change (2.5, 2.7): a missing field stays, the values are changes.
        const eanMode = input.eanMode ?? stored.eanMode;
        const changed = {
          conditionValueId:
            input.conditionValueId === undefined ? stored.conditionValueId : input.conditionValueId,
          visualGrade: input.visualGrade === undefined ? stored.visualGrade : input.visualGrade,
          conditionDescription: input.conditionDescription ?? stored.conditionDescription,
          variantValues: mergeAttributeValues(storedVariant, input.variantValues),
          otherValues: mergeAttributeValues(storedOther, input.otherValues),
          deliveryScopeTextBlockIds:
            input.deliveryScopeTextBlockIds ?? stored.deliveryScopeTextBlockIds,
          articleNumber: input.articleNumber ?? stored.articleNumber,
          eanMode,
          ownEan: input.ownEan === undefined ? stored.ownEan : input.ownEan,
        };

        // The existing ids, then the active entries, before the other rules (2.0.11).
        const references = [
          ...pickListValueReferences(
            variantAttributes,
            { conditionValueId: changed.conditionValueId, values: changed.variantValues },
            { conditionValueId: stored.conditionValueId, values: storedVariant },
            'variantValues',
          ),
          ...pickListValueReferences(
            otherAttributes,
            { conditionValueId: null, values: changed.otherValues },
            { conditionValueId: null, values: storedOther },
            'otherValues',
          ),
        ];
        const values = await findPickListValues(settings, references);
        // UI-014 cannot choose a text block twice: a duplicate is a structure error (2.0.5).
        const blockIds = new Set(changed.deliveryScopeTextBlockIds);
        if (blockIds.size !== changed.deliveryScopeTextBlockIds.length) {
          throw new BadRequestError('deliveryScopeTextBlockIds: text block chosen twice');
        }
        const blocks = await settings.findTextBlocks(changed.deliveryScopeTextBlockIds);
        if (blocks.length !== blockIds.size) {
          throw new BadRequestError('deliveryScopeTextBlockIds: text block unknown');
        }
        checkActivePickListValues(references, values);

        const after = checkedRequest(
          listingValuesSchema({ variantAttributes, otherAttributes }),
          changed,
        );

        const variantAttributeIds = variantAttributes.map((attribute) => attribute.id);
        const afterSpec = {
          conditionValueId: after.conditionValueId,
          visualGrade: after.visualGrade,
          conditionDescription: after.conditionDescription,
          values: { ...after.otherValues, ...after.variantValues },
        };
        const duplicate = (await listings.listVariantData([template.id])).find(
          (other) =>
            other.id !== id && variantsMatch(afterSpec, variantSpecOf(other), variantAttributeIds),
        );
        if (duplicate !== undefined) {
          throw new RuleViolation('variant_duplicate', {
            usage: 'listing_values',
            messageArgs: [duplicate.display_title],
            details: { listingId: duplicate.id },
          });
        }

        // Unique without case (2.7, 3.3): the own article number in another case stays valid.
        const articleNumberKey = toArticleNumberKey(after.articleNumber);
        const holder = await listings.findByArticleNumberKey(articleNumberKey);
        if (holder !== undefined && holder.id !== id) {
          throw new RuleViolation('article_number_taken', { details: { path: 'articleNumber' } });
        }

        // The question comes after every rule (2.5): only a change of the variant data makes
        // devices deviate (UI-014 "Änderung trotzdem speichern", precondition).
        const afterRow = {
          condition_value_id: after.conditionValueId,
          visual_grade: after.visualGrade,
          condition_description: after.conditionDescription,
          variant_values: JSON.stringify(after.variantValues),
          other_device_values: JSON.stringify(after.otherValues),
        };
        const storedSpec = {
          conditionValueId: stored.conditionValueId,
          visualGrade: stored.visualGrade,
          conditionDescription: stored.conditionDescription,
          values: { ...storedOther, ...storedVariant },
        };
        const deviating =
          variantDifferences(storedSpec, afterSpec, variantAttributeIds).length === 0
            ? []
            : await deviatingDevices(tx.db, settings, variantAttributes, id, afterRow);
        if (deviating.length > 0 && input.confirmDeviatingDevices !== true) {
          throw new ConfirmationRequired('assigned_devices_deviate', {
            usage: 'assigned_devices_deviate',
            messageArgs: [String(deviating.length)],
            details: { devices: deviating },
          });
        }

        const oldFields = await readableListingValues(settings, attributes, {
          ...stored,
          values: storedSpec.values,
        });
        const newFields = await readableListingValues(settings, attributes, {
          ...after,
          values: afterSpec.values,
        });
        const changedFields = [
          ...new Set([...Object.keys(oldFields), ...Object.keys(newFields)]),
        ].filter((field) => oldFields[field] !== newFields[field]);
        const scopeChanged =
          after.deliveryScopeTextBlockIds.join() !== stored.deliveryScopeTextBlockIds.join();
        if (changedFields.length === 0 && !scopeChanged) return stored;

        await listings.updateValues(id, {
          ...afterRow,
          condition_description_key: descriptionKey(after.conditionDescription),
          article_number: after.articleNumber,
          article_number_key: articleNumberKey,
          ean_mode: after.eanMode,
          own_ean: after.ownEan,
          version: stored.version + 1,
          updated_at: clock.now().toISOString(),
        });
        if (scopeChanged) {
          await listings.replaceDeliveryScope(id, after.deliveryScopeTextBlockIds);
        }
        tx.emit({ type: 'ContentInputsChanged', listingIds: [id] });

        // Two text blocks of the same name change the order only; the entry names the scope.
        const fields = changedFields.length > 0 ? changedFields : ['Lieferumfang'];
        const pick = (readable: Record<string, string | number>) =>
          Object.fromEntries(fields.map((field) => [field, readable[field] ?? null]));
        // "Änderung trotzdem speichern": the decision with its time (the entry's) and the
        // deviations of each device (UI-014, REQ-072).
        await createAuditWriter({ db: tx.db, clock }).write({
          objectType: 'listing',
          objectId: id,
          objectLabel: stored.displayTitle,
          action: deviating.length > 0 ? 'deviation_confirmed' : 'values_updated',
          oldValue: pick(oldFields),
          newValue: {
            ...pick(newFields),
            ...(deviating.length > 0 && {
              Abweichungen: Object.fromEntries(
                deviating.map(({ wiNr, deviations }) => [
                  `Gerät ${wiNr}`,
                  deviations.map(deviationLine),
                ]),
              ),
            }),
          },
        });

        const updated = await listings.findById(id);
        if (updated === undefined) throw new Error(`listing ${id} vanished in its action`);
        return toListing(updated, await listings.listDeliveryScopeIds(id));
      });
      return result;
    },
  };
}

export type ListingService = ReturnType<typeof createListingService>;
