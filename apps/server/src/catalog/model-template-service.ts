import type { FieldError } from '@resellr/domain/errors/error-response';
import type { PickListKey } from '@resellr/domain/schemas/pick-list.schema';
import {
  type ModelTemplate,
  type ModelTemplateCreate,
  modelTemplateSearchKey,
  modelTemplateValuesSchema,
} from '@resellr/domain/schemas/model-template.schema';
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
import { BadRequestError, RuleViolation, ValidationError } from '../shared/domain-error.ts';
import {
  createModelTemplateRepository,
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
 * Device type and manufacturer of a new model template (2.4 "Aktive Geräteart und aktiver
 * Hersteller", 2.0.11, Nachtrag MAR-904): both must exist, otherwise the user interface sent a
 * wrong id (`400 bad_request`; neither is ever deleted); then both must be active, the device
 * type first. Runs after the schema and before every other rule of the service.
 */
async function checkActiveEntries(
  settings: SettingsReader,
  { deviceTypeId, manufacturerId }: Pick<ModelTemplateCreate, 'deviceTypeId' | 'manufacturerId'>,
): Promise<void> {
  const deviceType = await settings.findDeviceType(deviceTypeId);
  const manufacturer = await settings.findManufacturer(manufacturerId);
  if (deviceType === undefined) throw new BadRequestError('deviceTypeId unknown');
  if (manufacturer === undefined) throw new BadRequestError('manufacturerId unknown');
  if (!deviceType.active) {
    throw new RuleViolation('device_type_deactivated', {
      usage: 'model_template',
      messageArgs: [deviceType.name],
      details: { path: 'deviceTypeId', id: deviceTypeId },
    });
  }
  if (!manufacturer.active) {
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

/**
 * The pick list values of the request: `modelValues` before `defaultDeviceValues`, within each
 * in the order of the attributes (2.0.11); for *Auswahl aus Liste* and the roles the list of
 * the attribute, for *Mehrfachangabe Anzahl × Typ* `port_type` for `typeId` and `port_position`
 * for `positionId`. A value of another shape is left to the schema of CU-067.
 */
function pickListValueReferences(
  attributes: readonly AttributeEntry[],
  input: Pick<ModelTemplateCreate, 'modelValues' | 'defaultDeviceValues'>,
): PickListValueReference[] {
  const references: PickListValueReference[] = [];
  for (const { key, level } of VALUE_OBJECTS) {
    for (const attribute of attributes.filter((candidate) => candidate.level === level)) {
      const path = `${key}.${attribute.id}`;
      const value = input[key][String(attribute.id)];
      if (attribute.dataType === 'pick' && typeof value === 'number') {
        references.push({
          attribute,
          path,
          id: value,
          expected: { pickListId: attribute.pickListId },
        });
      }
      if (attribute.dataType === 'ports' && Array.isArray(value)) {
        for (const entry of value as unknown[]) {
          if (typeof entry !== 'object' || entry === null) continue;
          const { typeId, positionId } = entry as Record<string, unknown>;
          if (typeof typeId === 'number') {
            references.push({
              attribute,
              path,
              id: typeId,
              expected: { pickListKey: 'port_type' },
            });
          }
          if (typeof positionId === 'number') {
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
 * Pick list values of a new model template (2.0.11, Nachtrag MAR-904): each must exist in the
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
  input: Pick<ModelTemplateCreate, 'modelValues' | 'defaultDeviceValues'>,
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

/**
 * Model template service (CU-105, REQ-008; Technical Specification 2.4): creates a model
 * template together with its audit entry in one transaction (2.0.4); without the entry nothing
 * is stored. The field rules are checked before by the schema of CU-104 (route), so the service
 * stores the trimmed values; device type and manufacturer it checks through `settings-reader`
 * (CU-086) with `tx.db`, so the check sees the state of the writing transaction. Then the
 * pick list values and the attribute values against the attribute definitions of the device
 * type (2.0.11, 2.5). Changing (#181) and the duplicate hint (#184) follow.
 */
export function createModelTemplateService({ uow, clock }: ModelTemplateServiceDeps) {
  return {
    /** `POST /api/model-templates`: the new model template with version 1. */
    async create(input: ModelTemplateCreate): Promise<ModelTemplate> {
      const { result } = await uow.run(async (tx) => {
        const settings = createSettingsReader(tx.db);
        await checkActiveEntries(settings, input);
        const attributes = await settings.listAttributes(input.deviceTypeId);
        await checkPickListValues(settings, pickListValueReferences(attributes, input));
        const values = checkedAttributeValues(attributes, input);
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
  };
}

export type ModelTemplateService = ReturnType<typeof createModelTemplateService>;
