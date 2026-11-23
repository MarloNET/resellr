import type { FieldError } from '@resellr/domain/errors/error-response';
import { formatNumber, formatYesNo } from '@resellr/domain/format/format-value';
import {
  type AttributeValue,
  type AttributeValues,
  type BatteryCapacityValue,
  mergeAttributeValues,
  type PortEntry,
} from '@resellr/domain/schemas/attribute-values.schema';
import {
  type ModelTemplate,
  type ModelTemplateCreate,
  modelTemplateSearchKey,
  type ModelTemplateUpdate,
  modelTemplateValuesSchema,
} from '@resellr/domain/schemas/model-template.schema';
import type { PickListKey } from '@resellr/domain/schemas/pick-list.schema';
import type { z } from 'zod';
import { toModelNameKey } from '@resellr/domain/text/normalize-key';

import { createAuditWriter } from '../audit/index.ts';
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
  ConflictError,
  NotFoundError,
  RuleViolation,
  ValidationError,
} from '../shared/domain-error.ts';
import { createDuplicateCheck } from './duplicate-check.ts';
import {
  createModelTemplateRepository,
  type ModelTemplateRepository,
  type ModelTemplateRow,
} from './model-template-repository.ts';

export interface ModelTemplateServiceDeps {
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

/** "Herstellernummer" of a model template without one (REQ-008, AC-REQ-008-03). */
const MPN_UNKNOWN_LABEL = 'unbekannt';

const objectLabel = (modelName: string) => `Modellvorlage ${modelName}`;

/** The model template of 3.3 without the internal keys `model_name_key` and `search_key`. */
export function toModelTemplate(row: ModelTemplateRow): ModelTemplate {
  return {
    id: row.id,
    deviceTypeId: row.device_type_id,
    manufacturerId: row.manufacturer_id,
    modelName: row.model_name,
    typeDesignation: row.type_designation,
    mpn: row.mpn,
    mpnUnknown: row.mpn_unknown === 1,
    originalEan: row.original_ean,
    modelValues: JSON.parse(row.model_values) as Record<string, unknown>,
    defaultDeviceValues: JSON.parse(row.default_device_values) as Record<string, unknown>,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Device type and manufacturer of a model template (2.4 "Aktive Geräteart und aktiver
 * Hersteller", 2.0.11, Nachtrag MAR-904): each must exist, otherwise the user interface sent a
 * wrong id (`400 bad_request`; neither is ever deleted); then each must be active, the device
 * type first. With `stored` (`PATCH`) only a changed id is checked, so a stored entry deactivated
 * meanwhile stays valid. Runs after the schema and before every other rule of the service.
 */
async function checkActiveEntries(
  settings: SettingsReader,
  { deviceTypeId, manufacturerId }: Pick<ModelTemplate, 'deviceTypeId' | 'manufacturerId'>,
  stored?: Pick<ModelTemplate, 'deviceTypeId' | 'manufacturerId'>,
): Promise<void> {
  const newDeviceType = deviceTypeId !== stored?.deviceTypeId;
  const newManufacturer = manufacturerId !== stored?.manufacturerId;
  const deviceType = newDeviceType ? await settings.findDeviceType(deviceTypeId) : undefined;
  const manufacturer = newManufacturer
    ? await settings.findManufacturer(manufacturerId)
    : undefined;
  if (newDeviceType && deviceType === undefined) throw new BadRequestError('deviceTypeId unknown');
  if (newManufacturer && manufacturer === undefined) {
    throw new BadRequestError('manufacturerId unknown');
  }
  if (deviceType !== undefined && !deviceType.active) {
    throw new RuleViolation('device_type_deactivated', {
      usage: 'model_template',
      messageArgs: [deviceType.name],
      details: { path: 'deviceTypeId', id: deviceTypeId },
    });
  }
  if (manufacturer !== undefined && !manufacturer.active) {
    throw new RuleViolation('manufacturer_deactivated', {
      usage: 'model_template',
      messageArgs: [manufacturer.name],
      details: { path: 'manufacturerId', id: manufacturerId },
    });
  }
}

/** The objects of a model template holding attribute values, in the order they are checked. */
const VALUE_OBJECTS = [
  { key: 'modelValues', level: 'model' },
  { key: 'defaultDeviceValues', level: 'device' },
] as const;

/** A pick list value in the attribute values and the list it has to come from (2.0.11). */
interface PickListValueReference {
  attribute: AttributeEntry;
  /** Field path like `fields[].path`, e.g. `modelValues.14` (2.0.11). */
  path: string;
  id: number;
  expected: { pickListId: number | null } | { pickListKey: PickListKey };
}

/** Attribute values by attribute id, as stored or sent (3.4). */
type AttributeValueObjects = Readonly<
  Record<(typeof VALUE_OBJECTS)[number]['key'], Readonly<Record<string, unknown>>>
>;

const NO_VALUES: AttributeValueObjects = { modelValues: {}, defaultDeviceValues: {} };

/**
 * The new pick list values of the request: `modelValues` before `defaultDeviceValues`, within
 * each in the order of the attributes (2.0.11); for *Auswahl aus Liste* and the roles the list of
 * the attribute, for *Mehrfachangabe Anzahl × Typ* `port_type` for `typeId` and `port_position`
 * for `positionId`. With `stored` (`PATCH`) only a changed value counts: a choice whose id
 * differs from the stored one of the same attribute, an id of a port entry the stored value of
 * the same attribute does not hold (Nachtrag MAR-904). A value of another shape is left to the
 * schema of CU-067.
 */
function pickListValueReferences(
  attributes: readonly AttributeEntry[],
  input: AttributeValueObjects,
  stored: AttributeValueObjects = NO_VALUES,
): PickListValueReference[] {
  const references: PickListValueReference[] = [];
  for (const { key, level } of VALUE_OBJECTS) {
    for (const attribute of attributes.filter((candidate) => candidate.level === level)) {
      const path = `${key}.${attribute.id}`;
      const value = input[key][String(attribute.id)];
      const before = stored[key][String(attribute.id)];
      if (attribute.dataType === 'pick' && typeof value === 'number' && value !== before) {
        references.push({
          attribute,
          path,
          id: value,
          expected: { pickListId: attribute.pickListId },
        });
      }
      if (attribute.dataType === 'ports' && Array.isArray(value)) {
        const storedEntries = (Array.isArray(before) ? before : []) as Partial<PortEntry>[];
        for (const entry of value as unknown[]) {
          if (typeof entry !== 'object' || entry === null) continue;
          const { typeId, positionId } = entry as Record<string, unknown>;
          if (typeof typeId === 'number' && !storedEntries.some((old) => old.typeId === typeId)) {
            references.push({
              attribute,
              path,
              id: typeId,
              expected: { pickListKey: 'port_type' },
            });
          }
          if (
            typeof positionId === 'number' &&
            !storedEntries.some((old) => old.positionId === positionId)
          ) {
            references.push({
              attribute,
              path,
              id: positionId,
              expected: { pickListKey: 'port_position' },
            });
          }
        }
      }
    }
  }
  return references;
}

/**
 * New pick list values of a model template (2.0.11, Nachtrag MAR-904): each must exist in the
 * expected list, otherwise the user interface sent a wrong id (`400 bad_request`); then each
 * must be active, and only the first deactivated one is reported, with `details: { path, id }`.
 * Runs after the device type and the manufacturer and before the other attribute rules.
 */
async function checkPickListValues(
  settings: SettingsReader,
  references: readonly PickListValueReference[],
): Promise<void> {
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
  for (const { attribute, path, id } of references) {
    const value = values.get(id);
    if (value === undefined || value.active) continue;
    throw new RuleViolation('pick_list_value_deactivated', {
      usage: 'attribute',
      messageArgs: [attribute.label, value.label],
      details: { path, id },
    });
  }
}

/** Zod codes of a value that does not have the shape of its data type (2.0.5 rule (4)). */
const STRUCTURE_CODES = new Set([
  'invalid_type',
  'unrecognized_keys',
  'invalid_union',
  'invalid_key',
  'invalid_element',
]);

/**
 * The attribute values in their stored form, checked against the current attribute definitions
 * of the device type (2.4 "Regeln", 2.5; CU-067): a value of another shape is a structural error
 * (`400`), a violated rule a field error at `modelValues.<id>` or `defaultDeviceValues.<id>`,
 * the first one per field (`422 validation_failed`).
 */
function checkedAttributeValues(
  attributes: readonly AttributeEntry[],
  input: AttributeValueObjects,
) {
  const result = modelTemplateValuesSchema(attributes).safeParse({
    modelValues: input.modelValues,
    defaultDeviceValues: input.defaultDeviceValues,
  });
  if (result.success) return result.data;
  const issues: z.core.$ZodIssue[] = result.error.issues;
  const structural = issues.filter((issue) => STRUCTURE_CODES.has(issue.code));
  if (structural.length > 0) {
    const found = structural.map((issue) => `${issue.code} at ${issue.path.join('.')}`);
    throw new BadRequestError(`attribute values: ${found.join(', ')}`);
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

/** A model template with the names of device type and manufacturer (CU-106). */
type ModelTemplateWithNames = NonNullable<
  Awaited<ReturnType<ModelTemplateRepository['findWithNamesById']>>
>;

/** The model data of a model template as the audit entry names them (3.4, 3.6). */
function readableModelData(
  row: Pick<
    ModelTemplateWithNames,
    | 'device_type_name'
    | 'manufacturer_name'
    | 'model_name'
    | 'type_designation'
    | 'mpn'
    | 'original_ean'
  >,
): Record<string, string> {
  return {
    Geräteart: row.device_type_name,
    Hersteller: row.manufacturer_name,
    Modellbezeichnung: row.model_name,
    ...(row.type_designation !== null && { Typbezeichnung: row.type_designation }),
    Herstellernummer: row.mpn ?? MPN_UNKNOWN_LABEL,
    ...(row.original_ean !== null && { 'Original-EAN': row.original_ean }),
  };
}

/** A stored attribute value readable for the audit entry: labels instead of ids (3.4). */
function readableValue(
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
          positionId === null
            ? `${count} × ${label(typeId)}`
            : `${count} × ${label(typeId)} ${label(positionId)}`,
        )
        .join(', ');
    default:
      return value as string;
  }
}

/**
 * The attribute values of a model template readable for the audit entry (3.4): by the label of
 * the attribute, the device defaults as "Vorbelegungswert <Merkmal>"; attributes without a value
 * are left out.
 */
function readableAttributeValues(
  attributes: readonly AttributeEntry[],
  values: AttributeValueObjects,
  label: (id: number) => string,
): Record<string, string> {
  const readable: Record<string, string> = {};
  for (const { key, level } of VALUE_OBJECTS) {
    for (const attribute of attributes.filter((candidate) => candidate.level === level)) {
      const value = values[key][String(attribute.id)];
      if (value === undefined) continue;
      const name = level === 'model' ? attribute.label : `Vorbelegungswert ${attribute.label}`;
      readable[name] = readableValue(attribute, value as AttributeValue, label);
    }
  }
  return readable;
}

/**
 * The labels of the pick list values in attribute values, each read against the attributes of
 * its device type, in one query (3.4).
 */
async function pickListLabels(
  settings: SettingsReader,
  templates: readonly (readonly [readonly AttributeEntry[], AttributeValueObjects])[],
) {
  const ids = templates.flatMap(([attributes, values]) =>
    pickListValueReferences(attributes, values).map(({ id }) => id),
  );
  const labels = new Map(
    (await settings.findPickListValues(ids)).map((value) => [value.id, value.label]),
  );
  return (valueId: number) => labels.get(valueId) ?? String(valueId);
}

/** The name of a changed device type or manufacturer, read in the action (CU-086). */
async function nameOf(
  id: number,
  storedId: number,
  storedName: string,
  find: (id: number) => Promise<{ name: string } | undefined>,
): Promise<string> {
  return id === storedId ? storedName : ((await find(id))?.name ?? '');
}

/** The fields of the model data besides the attribute values (3.3); a change is model data. */
const FIELD_KEYS = [
  'deviceTypeId',
  'manufacturerId',
  'modelName',
  'typeDesignation',
  'mpn',
  'mpnUnknown',
  'originalEan',
] as const;

/**
 * Only the fields that differ, in the order of the state after the change, `null` for a field
 * without value (2.0.9, 3.6).
 */
function changedFields(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
) {
  const fields = [...new Set([...Object.keys(after), ...Object.keys(before)])].filter(
    (field) => before[field] !== after[field],
  );
  const pick = (values: Readonly<Record<string, string>>) =>
    Object.fromEntries(fields.map((field) => [field, values[field] ?? null]));
  return { oldValue: pick(before), newValue: pick(after) };
}

/**
 * Model template service (CU-105, REQ-008; Technical Specification 2.4): creates a model
 * template together with its audit entry in one transaction (2.0.4); without the entry nothing
 * is stored. The field rules are checked before by the schema of CU-104 (route), so the service
 * stores the trimmed values; device type and manufacturer it checks through `settings-reader`
 * (CU-086) with `tx.db`, so the check sees the state of the writing transaction. Then the
 * pick list values and the attribute values against the attribute definitions of the device
 * type (2.0.11, 2.5). The question about a possible duplicate (CU-107) comes after every
 * rejection, so the user never confirms a save that fails afterwards (2.4 "Prüfreihenfolge beim
 * Speichern", 2.0.11). Changing checks the state after the change the same way, a stored entry
 * deactivated meanwhile only when the request changes it (#181).
 */
export function createModelTemplateService({ uow, clock }: ModelTemplateServiceDeps) {
  return {
    /** `POST /api/model-templates`: the new model template with version 1. */
    async create({ confirmDuplicate, ...input }: ModelTemplateCreate): Promise<ModelTemplate> {
      const { result } = await uow.run(async (tx) => {
        const settings = createSettingsReader(tx.db);
        await checkActiveEntries(settings, input);
        const attributes = await settings.listAttributes(input.deviceTypeId);
        await checkPickListValues(settings, pickListValueReferences(attributes, input));
        const values = checkedAttributeValues(attributes, input);
        await createDuplicateCheck(tx.db).checkPossibleDuplicate({ ...input, confirmDuplicate });
        const repository = createModelTemplateRepository(tx.db);
        const audit = createAuditWriter({ db: tx.db, clock });
        const id = await repository.insert({
          ...input,
          ...values,
          modelNameKey: toModelNameKey(input.modelName),
          searchKey: modelTemplateSearchKey(input),
          at: clock.now().toISOString(),
        });

        const stored = await repository.findWithNamesById(id);
        if (stored === undefined) throw new Error(`model template ${id} vanished in its action`);
        const newValue = {
          Geräteart: stored.device_type_name,
          Hersteller: stored.manufacturer_name,
          Modellbezeichnung: stored.model_name,
          ...(stored.type_designation !== null && { Typbezeichnung: stored.type_designation }),
          Herstellernummer: stored.mpn ?? MPN_UNKNOWN_LABEL,
          ...(stored.original_ean !== null && { 'Original-EAN': stored.original_ean }),
        };
        await audit.write({
          objectType: 'model_template',
          objectId: id,
          objectLabel: objectLabel(stored.model_name),
          action: 'created',
          oldValue: null,
          newValue,
        });
        return toModelTemplate(stored);
      });
      return result;
    },

    /**
     * `PATCH /api/model-templates/{id}` (2.4, REQ-010): the preconditions first (`not_found`,
     * `version_conflict`), then "unbekannt" against the MPN (`400`), the changed device type and
     * manufacturer and the changed pick list values (2.0.11: unknown `400`, deactivated `422`),
     * then the attribute values on the complete state after the change (2.5, CU-067). A changed
     * device type has other attributes, so the stored values do not carry over. An unchanged
     * request keeps the version; a change writes the audit entry `updated` with the changed
     * fields and, unless only device defaults changed, `ContentInputsChanged` (AC-REQ-010-05).
     */
    async update(id: number, input: ModelTemplateUpdate): Promise<ModelTemplate> {
      const { result } = await uow.run(async (tx) => {
        const repository = createModelTemplateRepository(tx.db);
        const row = await repository.findWithNamesById(id);
        if (row === undefined) throw new NotFoundError();
        const { version, modelValues, defaultDeviceValues, ...changes } = input;
        if (row.version !== version) throw new ConflictError('version_conflict');
        const stored = toModelTemplate(row);

        const fields = Object.fromEntries(
          Object.entries(changes).filter(([, value]) => value !== undefined),
        ) as Partial<Omit<ModelTemplate, 'modelValues' | 'defaultDeviceValues'>>;
        const next = { ...stored, ...fields };
        if (next.mpnUnknown !== (next.mpn === null)) {
          throw new BadRequestError('mpn must be null exactly with mpnUnknown');
        }

        const settings = createSettingsReader(tx.db);
        await checkActiveEntries(settings, next, stored);
        const attributes = await settings.listAttributes(next.deviceTypeId);
        // The state after the change (2.5): values of another device type do not carry over.
        const base = next.deviceTypeId === stored.deviceTypeId ? stored : NO_VALUES;
        const after = {
          modelValues: mergeAttributeValues(base.modelValues as AttributeValues, modelValues),
          defaultDeviceValues: mergeAttributeValues(
            base.defaultDeviceValues as AttributeValues,
            defaultDeviceValues,
          ),
        };
        await checkPickListValues(settings, pickListValueReferences(attributes, after, base));
        const values = checkedAttributeValues(attributes, after);

        const modelChanged =
          FIELD_KEYS.some((key) => next[key] !== stored[key]) ||
          JSON.stringify(values.modelValues) !== JSON.stringify(stored.modelValues);
        const defaultsChanged =
          JSON.stringify(values.defaultDeviceValues) !== JSON.stringify(stored.defaultDeviceValues);
        if (!modelChanged && !defaultsChanged) return stored;

        // The stored values are read with the attributes of the stored device type, so values
        // dropped by a change of the device type appear as changed fields (2.0.9).
        const storedAttributes =
          next.deviceTypeId === stored.deviceTypeId
            ? attributes
            : await settings.listAttributes(stored.deviceTypeId);
        const label = await pickListLabels(settings, [
          [storedAttributes, stored],
          [attributes, values],
        ]);
        const names = {
          ...row,
          device_type_name: await nameOf(
            next.deviceTypeId,
            stored.deviceTypeId,
            row.device_type_name,
            settings.findDeviceType,
          ),
          manufacturer_name: await nameOf(
            next.manufacturerId,
            stored.manufacturerId,
            row.manufacturer_name,
            settings.findManufacturer,
          ),
          model_name: next.modelName,
          type_designation: next.typeDesignation,
          mpn: next.mpn,
          original_ean: next.originalEan,
        };
        const { oldValue, newValue } = changedFields(
          {
            ...readableModelData(row),
            ...readableAttributeValues(storedAttributes, stored, label),
          },
          {
            ...readableModelData(names),
            ...readableAttributeValues(attributes, values, label),
          },
        );

        await repository.update(id, {
          ...next,
          ...values,
          modelNameKey: toModelNameKey(next.modelName),
          searchKey: modelTemplateSearchKey(next),
          version: stored.version + 1,
          at: clock.now().toISOString(),
        });
        await createAuditWriter({ db: tx.db, clock }).write({
          objectType: 'model_template',
          objectId: id,
          objectLabel: objectLabel(next.modelName),
          action: 'updated',
          oldValue,
          newValue,
        });
        // Device defaults act only on devices captured later (AC-REQ-010-05).
        if (modelChanged) tx.emit({ type: 'ContentInputsChanged', modelTemplateId: id });

        const updated = await repository.findById(id);
        if (updated === undefined) throw new Error(`model template ${id} vanished in its action`);
        return toModelTemplate(updated);
      });
      return result;
    },
  };
}

export type ModelTemplateService = ReturnType<typeof createModelTemplateService>;
