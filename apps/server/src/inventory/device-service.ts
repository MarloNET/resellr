import type { FieldError } from '@resellr/domain/errors/error-response';
import { formatNumber, formatYesNo } from '@resellr/domain/format/format-value';
import type { ReviewKey } from '@resellr/domain/inventory/device-prefill';
import { captureStatusOf, remainingReviewKeys } from '@resellr/domain/inventory/review-flags';
import {
  type AttributeValue,
  type AttributeValues,
  type BatteryCapacityValue,
  mergeAttributeValues,
  type PortEntry,
} from '@resellr/domain/schemas/attribute-values.schema';
import {
  type Device,
  type DeviceCreateInput,
  deviceCreateSchema,
  type DeviceUpdateInput,
  deviceValuesSchema,
  toWiNrKey,
} from '@resellr/domain/schemas/device.schema';
import type { PickListKey } from '@resellr/domain/schemas/pick-list.schema';
import type { z } from 'zod';

import { createAuditWriter } from '../audit/index.ts';
import { createCatalogReader } from '../catalog/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import {
  type AttributeEntry,
  createSettingsReader,
  type PickListValueEntry,
  type SettingsReader,
} from '../settings/index.ts';
import type { Clock } from '../shared/clock.ts';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  RuleViolation,
  ValidationError,
} from '../shared/domain-error.ts';
import { readDevicePrefill } from './device-prefill-query.ts';
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
    conditionCode: row.condition_code,
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
export function checkedRequest<T>(schema: z.ZodType<T>, input: unknown): T {
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

/** A pick list value in the request and the list it has to come from (2.0.11). */
export interface PickListValueReference {
  /** Field path like `fields[].path`, e.g. `conditionValueId`, `values.14` (2.0.11). */
  path: string;
  id: number;
  expected: { pickListId: number | null } | { pickListKey: PickListKey };
  /** The attribute of a value in `values`; `null` for the condition. */
  attribute: AttributeEntry | null;
}

/**
 * The new pick list values of a request in the order of 2.0.11: the condition, then the values
 * of the attributes in their order; for *Auswahl aus Liste* and the roles the list of the
 * attribute, for *Mehrfachangabe Anzahl × Typ* `port_type` for `typeId` and `port_position` for
 * `positionId`. With `stored` (`PATCH`) only a changed value counts: a condition or choice whose
 * id differs from the stored one, an id of a port entry the stored value of the same attribute
 * does not hold (Nachtrag MAR-904). A value of another shape is left to the schema of CU-067.
 * The values are at `<prefix>.<id>`, for a model listing `variantValues` and `otherValues` (CU-124).
 */
export function pickListValueReferences(
  attributes: readonly AttributeEntry[],
  request: { conditionValueId: number | null; values: Readonly<Record<string, unknown>> },
  stored: { conditionValueId: number | null; values: Readonly<Record<string, unknown>> } = {
    conditionValueId: null,
    values: {},
  },
  prefix = 'values',
): PickListValueReference[] {
  const references: PickListValueReference[] = [];
  const { conditionValueId } = request;
  if (conditionValueId !== null && conditionValueId !== stored.conditionValueId) {
    references.push({
      path: 'conditionValueId',
      id: conditionValueId,
      expected: { pickListKey: 'condition' },
      attribute: null,
    });
  }
  for (const attribute of attributes.filter(({ level }) => level === 'device')) {
    const key = String(attribute.id);
    const path = `${prefix}.${key}`;
    const value = request.values[key];
    const before = stored.values[key];
    if (attribute.dataType === 'pick' && typeof value === 'number' && value !== before) {
      references.push({
        path,
        id: value,
        expected: { pickListId: attribute.pickListId },
        attribute,
      });
    }
    if (attribute.dataType !== 'ports' || !Array.isArray(value)) continue;
    const storedEntries = (Array.isArray(before) ? before : []) as Partial<PortEntry>[];
    for (const entry of value as unknown[]) {
      if (typeof entry !== 'object' || entry === null) continue;
      const { typeId, positionId } = entry as Record<string, unknown>;
      if (typeof typeId === 'number' && !storedEntries.some((old) => old.typeId === typeId)) {
        references.push({ path, id: typeId, expected: { pickListKey: 'port_type' }, attribute });
      }
      if (
        typeof positionId === 'number' &&
        !storedEntries.some((old) => old.positionId === positionId)
      ) {
        references.push({
          path,
          id: positionId,
          expected: { pickListKey: 'port_position' },
          attribute,
        });
      }
    }
  }
  return references;
}

/**
 * The referenced pick list values (2.0.11 stage (3)): each must exist in the expected list,
 * otherwise the user interface sent a wrong id (`400 bad_request`; none is ever deleted).
 */
export async function findPickListValues(
  settings: SettingsReader,
  references: readonly PickListValueReference[],
): Promise<Map<number, PickListValueEntry>> {
  const values = new Map(
    (await settings.findPickListValues(references.map(({ id }) => id))).map((value) => [
      value.id,
      value,
    ]),
  );
  for (const { path, id, expected } of references) {
    const value = values.get(id);
    const inList =
      value !== undefined &&
      ('pickListKey' in expected
        ? value.pickListKey === expected.pickListKey
        : value.pickListId === expected.pickListId);
    if (!inList) throw new BadRequestError(`${path}: pick list value unknown or of another list`);
  }
  return values;
}

/**
 * The first deactivated pick list value (2.0.11 stage (4)): `pick_list_value_deactivated` with
 * the usage `.condition` ("Zustand <Wert> ist deaktiviert") or `.attribute` ("<Merkmal>: <Wert>
 * ist deaktiviert") and `details: { path, id }`.
 */
export function checkActivePickListValues(
  references: readonly PickListValueReference[],
  values: ReadonlyMap<number, PickListValueEntry>,
) {
  for (const { path, id, attribute } of references) {
    const value = values.get(id);
    if (value === undefined || value.active) continue;
    throw attribute === null
      ? new RuleViolation('pick_list_value_deactivated', {
          usage: 'condition',
          messageArgs: [value.label],
          details: { path, id },
        })
      : new RuleViolation('pick_list_value_deactivated', {
          usage: 'attribute',
          messageArgs: [attribute.label, value.label],
          details: { path, id },
        });
  }
}

/**
 * The active entries of a new device (2.0.11, Nachtrag MAR-904): supplier, condition and the pick
 * list values in `values` must exist, otherwise the user interface sent a wrong id (`400`); then
 * each must be active, the first hit in the order supplier (`supplier_deactivated.device`),
 * condition, pick list values (`pick_list_value_deactivated`). Returns the supplier.
 */
async function checkActiveEntries(
  settings: SettingsReader,
  { supplierId }: Pick<DeviceCreateInput, 'supplierId'>,
  references: readonly PickListValueReference[],
) {
  const supplier = supplierId === null ? undefined : await settings.findSupplier(supplierId);
  if (supplierId !== null && supplier === undefined) {
    throw new BadRequestError('supplierId unknown');
  }
  const values = await findPickListValues(settings, references);
  if (supplier !== undefined && !supplier.active) {
    throw new RuleViolation('supplier_deactivated', {
      usage: 'device',
      messageArgs: [supplier.name],
      details: { path: 'supplierId', id: supplierId },
    });
  }
  checkActivePickListValues(references, values);
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

/** The values of the attributes readable for the audit entry, by attribute label (3.4). */
function readableAttributeValues(
  attributes: readonly AttributeEntry[],
  values: AttributeValues,
  label: (id: number) => string,
): Record<string, string> {
  return Object.fromEntries(
    attributes.flatMap((attribute) => {
      const value = values[String(attribute.id)];
      return value === undefined ? [] : [[attribute.label, readable(attribute, value, label)]];
    }),
  );
}

/** The device values of 2.5 as the audit entry names them: condition, visual grade, values. */
function readableDeviceValues(
  attributes: readonly AttributeEntry[],
  device: Pick<Device, 'conditionValueId' | 'visualGrade' | 'conditionDescription'> & {
    values: AttributeValues;
  },
  label: (id: number) => string,
): Record<string, string | number> {
  return {
    Zustand: label(device.conditionValueId),
    'Optik-Note': device.visualGrade,
    ...(device.conditionDescription !== '' && {
      Zustandsbeschreibung: device.conditionDescription,
    }),
    ...readableAttributeValues(attributes, device.values, label),
  };
}

/** The labels of the pick list values of devices, read in one query (3.4). */
async function pickListLabels(
  settings: SettingsReader,
  attributes: readonly AttributeEntry[],
  devices: readonly { conditionValueId: number; values: AttributeValues }[],
) {
  const ids = devices.flatMap(({ conditionValueId, values }) => [
    conditionValueId,
    ...pickListValueIds(attributes, values),
  ]);
  const labels = new Map(
    (await settings.findPickListValues(ids)).map((value) => [value.id, value.label]),
  );
  return (valueId: number) => labels.get(valueId) ?? String(valueId);
}

/**
 * The condition and the values of a device or model listing readable for an audit entry (3.4):
 * labels instead of pick list ids, by the label of the attribute in the order of the device type;
 * attributes without a value are left out. Also used by CU-123 (#197).
 */
export async function readableValues(
  settings: SettingsReader,
  attributes: readonly AttributeEntry[],
  conditionValueId: number,
  values: AttributeValues,
): Promise<{ condition: string; values: Record<string, string> }> {
  const label = await pickListLabels(settings, attributes, [{ conditionValueId, values }]);
  return {
    condition: label(conditionValueId),
    values: readableAttributeValues(attributes, values, label),
  };
}

/**
 * Device service (CU-121, REQ-012 to REQ-014; Technical Specification 2.5): creates a device as
 * available, unassigned and with its capture date, together with its audit entry in one
 * transaction (2.0.4). Order of the checks when creating (2.0.11): the model template, the active
 * entries (supplier, condition, pick list values), the rules of the request with the values of
 * the level device (CU-116, CU-067), then the WI-Nr. The service forms the prefill again (CU-117
 * with the same inputs as CU-293, the condition code resolved for the supplier sent) and keeps the
 * review flags neither confirmed nor changed (CU-118), so the capture status is `checked` only
 * without one (AC-REQ-013-04). A known condition code is stored as its entry spells it ("dgs" →
 * "DGS", AC-REQ-015-01), an unknown one as entered. Changing the device values checks the state
 * after the change (2.5); the deviation from the model listing follows with #191.
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
        // The active entries before the other rules of the request (2.0.11, Nachtrag MAR-904).
        const supplier = await checkActiveEntries(
          settings,
          input,
          pickListValueReferences(attributes ?? [], input),
        );
        const schema = deviceCreateSchema(attributes ?? null, {
          batteryValues: await settings.listBatteryValues(),
        });
        const device = checkedRequest(schema, input);
        if (template === undefined || attributes === undefined) {
          throw new Error('model template checked by the schema');
        }
        // Checked by the attributes of the device type, so in their stored form (3.4).
        const deviceValues = device.values as AttributeValues;

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

        // Remaining = prefill keys − confirmed keys − keys whose value differs (2.5, REQ-013).
        const code =
          device.conditionCode === null
            ? undefined
            : await settings.resolveConditionCode(device.conditionCode, device.supplierId);
        const prefill = await readDevicePrefill(settings, template, attributes, code ?? null);
        const reviewKeys = remainingReviewKeys(prefill.reviewKeys, device.confirmedKeys, prefill, {
          conditionValueId: device.conditionValueId,
          visualGrade: device.visualGrade,
          values: deviceValues,
        });

        const at = clock.now().toISOString();
        const id = await devices.insert({
          wi_nr: device.wiNr,
          wi_nr_key: toWiNrKey(device.wiNr),
          model_template_id: template.id,
          listing_id: null,
          cancelled_from_listing_id: null,
          supplier_id: device.supplierId,
          condition_code: code?.code ?? device.conditionCode,
          condition_value_id: device.conditionValueId,
          visual_grade: device.visualGrade,
          condition_description: device.conditionDescription,
          device_values: JSON.stringify(device.values),
          review_keys: JSON.stringify(reviewKeys),
          capture_status: captureStatusOf(reviewKeys),
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

        const label = await pickListLabels(settings, attributes, [
          { conditionValueId: device.conditionValueId, values: deviceValues },
        ]);
        const modelName = (
          await createCatalogReader(tx.db).listModelTemplatesOfDeviceType(template.deviceTypeId)
        ).find((candidate) => candidate.id === template.id)?.modelName;
        await createAuditWriter({ db: tx.db, clock }).write({
          objectType: 'device',
          objectId: id,
          objectLabel: objectLabel(device.wiNr),
          action: 'created',
          oldValue: null,
          newValue: {
            'WI-Nr': device.wiNr,
            Modellvorlage: modelName ?? String(template.id),
            ...(supplier !== undefined && { Lieferant: supplier.name }),
            ...(device.conditionCode !== null && {
              Zustandscode: code?.code ?? device.conditionCode,
            }),
            ...readableDeviceValues(attributes, { ...device, values: deviceValues }, label),
          },
        });

        const stored = await devices.findById(id);
        if (stored === undefined) throw new Error(`device ${id} vanished in its action`);
        return toDevice(stored);
      });
      return result;
    },

    /**
     * `PATCH /api/devices/{id}` for the device values of UI-010 (2.5): preconditions first (a sold
     * or cancelled device is read only, `device_not_available`; then `version_conflict`), then
     * the changed pick list values (2.0.11: unknown `400`, deactivated `422`; a stored,
     * deactivated value stays valid), then the rules on the complete state after the change
     * (CU-067 with the values of the list battery, FIND-362). The review flags follow the rule of
     * `POST` against the stored ones (2.5, CU-118). An unchanged request keeps the version; a
     * change of a value writes one audit entry `values_updated` with the changed fields (3.6).
     */
    async update(id: number, input: DeviceUpdateInput): Promise<Device> {
      const { result } = await uow.run(async (tx) => {
        const settings = createSettingsReader(tx.db);
        const devices = createDeviceRepository(tx.db);
        const row = await devices.findById(id);
        if (row === undefined) throw new NotFoundError();
        if (row.stock_status !== 'available') {
          throw new RuleViolation('device_not_available', { usage: 'device_values' });
        }
        if (row.version !== input.version) throw new ConflictError('version_conflict');

        const stored = toDevice(row);
        const storedValues = stored.values as AttributeValues;
        const template = await createCatalogReader(tx.db).findModelTemplate(stored.modelTemplateId);
        if (template === undefined) throw new Error(`model template of device ${id} is missing`);
        const attributes = await settings.listAttributes(template.deviceTypeId);

        // The state after the change (2.5): a missing field stays, `values` are changes.
        const changed = {
          conditionValueId:
            input.conditionValueId === undefined ? stored.conditionValueId : input.conditionValueId,
          visualGrade: input.visualGrade === undefined ? stored.visualGrade : input.visualGrade,
          conditionDescription: input.conditionDescription ?? stored.conditionDescription,
          values: mergeAttributeValues(storedValues, input.values),
        };
        const references = pickListValueReferences(attributes, changed, stored);
        checkActivePickListValues(references, await findPickListValues(settings, references));
        const schema = deviceValuesSchema(attributes, {
          batteryValues: await settings.listBatteryValues(),
        });
        const after = checkedRequest(schema, changed);

        const reviewKeys = remainingReviewKeys(
          stored.reviewKeys as ReviewKey[],
          input.confirmedKeys,
          stored,
          after,
        );
        const label = await pickListLabels(settings, attributes, [
          { conditionValueId: stored.conditionValueId, values: storedValues },
          after,
        ]);
        const oldFields = readableDeviceValues(
          attributes,
          { ...stored, values: storedValues },
          label,
        );
        const newFields = readableDeviceValues(attributes, after, label);
        const changedFields = [
          ...new Set([...Object.keys(oldFields), ...Object.keys(newFields)]),
        ].filter((field) => oldFields[field] !== newFields[field]);
        const flagsChanged = reviewKeys.join() !== stored.reviewKeys.join();
        if (changedFields.length === 0 && !flagsChanged) return stored;

        await devices.update(id, {
          condition_value_id: after.conditionValueId,
          visual_grade: after.visualGrade,
          condition_description: after.conditionDescription,
          device_values: JSON.stringify(after.values),
          review_keys: JSON.stringify(reviewKeys),
          capture_status: captureStatusOf(reviewKeys),
          version: stored.version + 1,
          updated_at: clock.now().toISOString(),
        });
        if (changedFields.length > 0) {
          const pick = (fields: Record<string, string | number>) =>
            Object.fromEntries(changedFields.map((field) => [field, fields[field] ?? null]));
          await createAuditWriter({ db: tx.db, clock }).write({
            objectType: 'device',
            objectId: id,
            objectLabel: objectLabel(stored.wiNr),
            action: 'values_updated',
            oldValue: pick(oldFields),
            newValue: pick(newFields),
          });
        }

        const updated = await devices.findById(id);
        if (updated === undefined) throw new Error(`device ${id} vanished in its action`);
        return toDevice(updated);
      });
      return result;
    },
  };
}

export type DeviceService = ReturnType<typeof createDeviceService>;
