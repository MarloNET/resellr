import type { FieldError } from '@resellr/domain/errors/error-response';
import { formatNumber, formatYesNo } from '@resellr/domain/format/format-value';
import type {
  AttributeValue,
  AttributeValues,
  BatteryCapacityValue,
  PortEntry,
} from '@resellr/domain/schemas/attribute-values.schema';
import {
  type Device,
  type DeviceCreate,
  type DeviceCreateInput,
  deviceCreateSchema,
  toWiNrKey,
} from '@resellr/domain/schemas/device.schema';
import type { z } from 'zod';

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
import { BadRequestError, RuleViolation, ValidationError } from '../shared/domain-error.ts';
import { createDeviceRepository, type DeviceRow } from './device-repository.ts';
import { createListingRepository } from './listing-repository.ts';

export interface DeviceServiceDeps {
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const objectLabel = (wiNr: string) => `Gerät ${wiNr}`;

/** The device of 3.3 in the answers of 2.5. */
export function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    wiNr: row.wi_nr,
    modelTemplateId: row.model_template_id,
    listingId: row.listing_id,
    supplierId: row.supplier_id,
    conditionValueId: row.condition_value_id,
    visualGrade: row.visual_grade,
    conditionDescription: row.condition_description,
    values: JSON.parse(row.device_values) as Record<string, unknown>,
    reviewKeys: JSON.parse(row.review_keys) as string[],
    captureStatus: row.capture_status as Device['captureStatus'],
    stockStatus: row.stock_status as Device['stockStatus'],
    capturedAt: row.captured_at,
    capturedOn: row.captured_on,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

/** Zod codes of an input that does not have the shape of the request (2.0.5 rule (4)). */
const STRUCTURE_CODES = new Set([
  'invalid_type',
  'unrecognized_keys',
  'invalid_union',
  'invalid_key',
  'invalid_element',
]);

/**
 * The request checked by its rules (2.5, CU-116): a value of another shape is a structural error
 * (`400`, e.g. a value for an attribute of another level), a violated rule a field error, the
 * first one per field, all fields in one answer (`422 validation_failed`).
 */
function checkedRequest(schema: z.ZodType<DeviceCreate>, input: DeviceCreateInput): DeviceCreate {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issues: z.core.$ZodIssue[] = result.error.issues;
  const structural = issues.filter((issue) => STRUCTURE_CODES.has(issue.code));
  if (structural.length > 0) {
    const found = structural.map((issue) => `${issue.code} at ${issue.path.join('.')}`);
    throw new BadRequestError(`device: ${found.join(', ')}`);
  }
  const fields: FieldError[] = [];
  for (const issue of issues) {
    const path = issue.path.join('.');
    if (fields.some((field) => field.path === path)) continue;
    const code = (issue as { params?: { code?: string } }).params?.code ?? issue.code;
    fields.push({ path, code, message: issue.message });
  }
  throw new ValidationError(fields);
}

/**
 * The supplier of a new device (2.0.11, Nachtrag MAR-904): it must exist, otherwise the user
 * interface sent a wrong id (`400`, it is never deleted); then it must be active
 * (`supplier_deactivated.device`). Condition and pick list values follow in this order with #190.
 */
async function checkActiveEntries(settings: SettingsReader, { supplierId }: DeviceCreate) {
  if (supplierId === null) return undefined;
  const supplier = await settings.findSupplier(supplierId);
  if (supplier === undefined) throw new BadRequestError('supplierId unknown');
  if (!supplier.active) {
    throw new RuleViolation('supplier_deactivated', {
      usage: 'device',
      messageArgs: [supplier.name],
      details: { path: 'supplierId', id: supplierId },
    });
  }
  return supplier;
}

/** Ids of pick list values in the values of a device, for their labels in the audit entry. */
function pickListValueIds(attributes: readonly AttributeEntry[], values: AttributeValues) {
  return attributes.flatMap(({ id, dataType }) => {
    const value = values[String(id)];
    if (dataType === 'pick' && typeof value === 'number') return [value];
    if (dataType === 'ports' && Array.isArray(value)) {
      return value.flatMap(({ typeId, positionId }) =>
        positionId === null ? [typeId] : [typeId, positionId],
      );
    }
    return [];
  });
}

/** A stored value readable for the audit entry: labels instead of ids (3.4). */
function readable(
  { dataType, systemRole }: AttributeEntry,
  value: AttributeValue,
  label: (id: number) => string,
): string {
  if (systemRole === 'battery_capacity') {
    const capacity = value as BatteryCapacityValue;
    return 'percent' in capacity ? `${capacity.percent} %` : 'nicht ermittelbar';
  }
  switch (dataType) {
    case 'pick':
      return label(value as number);
    case 'boolean':
      return formatYesNo(value as boolean);
    case 'integer':
    case 'decimal':
      return formatNumber(value as number | string);
    case 'ports':
      return (value as PortEntry[])
        .map(({ count, typeId, positionId }) =>
          [`${count} × ${label(typeId)}`, positionId === null ? '' : ` ${label(positionId)}`].join(
            '',
          ),
        )
        .join(', ');
    default:
      return value as string;
  }
}

/**
 * Device service (CU-121, REQ-012 to REQ-014; Technical Specification 2.5): creates a device as
 * available, unassigned and with its capture date, together with its audit entry in one
 * transaction (2.0.4). Order of the checks (2.0.11): the rules of the request with the values of
 * the level device (CU-116, CU-067) after the model template is known, the supplier, then the
 * WI-Nr. Prefill and review flags follow with #188, changing a device with #190.
 */
export function createDeviceService({ uow, clock }: DeviceServiceDeps) {
  return {
    /** `POST /api/devices`: the new device with version 1. */
    async create(input: DeviceCreateInput): Promise<Device> {
      const { result } = await uow.run(async (tx) => {
        const settings = createSettingsReader(tx.db);
        const devices = createDeviceRepository(tx.db);

        // The values are checked by the attributes of the device type of the model template; an
        // unknown model template is a wrong id of the user interface (never deleted while used).
        const template =
          input.modelTemplateId === null
            ? undefined
            : await createCatalogReader(tx.db).findModelTemplate(input.modelTemplateId);
        if (input.modelTemplateId !== null && template === undefined) {
          throw new BadRequestError('modelTemplateId unknown');
        }
        const attributes = template && (await settings.listAttributes(template.deviceTypeId));
        const schema = deviceCreateSchema(attributes ?? null, {
          batteryValues: await settings.listBatteryValues(),
        });
        const device = checkedRequest(schema, input);
        if (template === undefined || attributes === undefined) {
          throw new Error('model template checked by the schema');
        }
        // Checked by the attributes of the device type, so in their stored form (3.4).
        const deviceValues = device.values as AttributeValues;

        const supplier = await checkActiveEntries(settings, device);

        const taken = await devices.findTakenByWiNrKey(toWiNrKey(device.wiNr));
        if (taken !== undefined) {
          const [listing] = await createListingRepository(tx.db).listTitles(
            taken.listing_id === null ? [] : [taken.listing_id],
          );
          throw new RuleViolation('wi_nr_taken', {
            usage: listing === undefined ? 'unassigned' : 'listing',
            messageArgs:
              listing === undefined ? [taken.wi_nr] : [taken.wi_nr, listing.display_title],
            details: { deviceId: taken.id, listingId: taken.listing_id },
          });
        }

        const at = clock.now().toISOString();
        const id = await devices.insert({
          wi_nr: device.wiNr,
          wi_nr_key: toWiNrKey(device.wiNr),
          model_template_id: template.id,
          listing_id: null,
          cancelled_from_listing_id: null,
          supplier_id: device.supplierId,
          condition_code: null,
          condition_value_id: device.conditionValueId,
          visual_grade: device.visualGrade,
          condition_description: device.conditionDescription,
          device_values: JSON.stringify(device.values),
          review_keys: '[]',
          capture_status: 'checked',
          stock_status: 'available',
          sold_channel_id: null,
          sold_on: null,
          cancel_reason: null,
          cancelled_at: null,
          assigned_at: null,
          captured_at: at,
          captured_on: clock.today(),
          version: 1,
          updated_at: at,
        });

        const labels = new Map(
          (
            await settings.findPickListValues([
              device.conditionValueId,
              ...pickListValueIds(attributes, deviceValues),
            ])
          ).map((value) => [value.id, value.label]),
        );
        const label = (valueId: number) => labels.get(valueId) ?? String(valueId);
        const values = Object.fromEntries(
          attributes.flatMap((attribute) => {
            const value = deviceValues[String(attribute.id)];
            return value === undefined
              ? []
              : [[attribute.label, readable(attribute, value, label)]];
          }),
        );
        await createAuditWriter({ db: tx.db, clock }).write({
          objectType: 'device',
          objectId: id,
          objectLabel: objectLabel(device.wiNr),
          action: 'created',
          oldValue: null,
          newValue: {
            'WI-Nr': device.wiNr,
            Modellvorlage: template.modelName,
            ...(supplier !== undefined && { Lieferant: supplier.name }),
            Zustand: label(device.conditionValueId),
            'Optik-Note': device.visualGrade,
            ...(device.conditionDescription !== '' && {
              Zustandsbeschreibung: device.conditionDescription,
            }),
            ...values,
          },
        });

        const stored = await devices.findById(id);
        if (stored === undefined) throw new Error(`device ${id} vanished in its action`);
        return toDevice(stored);
      });
      return result;
    },
  };
}

export type DeviceService = ReturnType<typeof createDeviceService>;
