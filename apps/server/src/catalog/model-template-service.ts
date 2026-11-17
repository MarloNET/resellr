import {
  type ModelTemplate,
  type ModelTemplateCreate,
  modelTemplateSearchKey,
} from '@resellr/domain/schemas/model-template.schema';
import { toModelNameKey } from '@resellr/domain/text/normalize-key';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import { createSettingsReader, type SettingsReader } from '../settings/index.ts';
import type { Clock } from '../shared/clock.ts';
import { BadRequestError, RuleViolation } from '../shared/domain-error.ts';
import { createDuplicateCheck } from './duplicate-check.ts';
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

/**
 * Model template service (CU-105, REQ-008; Technical Specification 2.4): creates a model
 * template together with its audit entry in one transaction (2.0.4); without the entry nothing
 * is stored. The field rules are checked before by the schema of CU-104 (route), so the service
 * stores the trimmed values; device type and manufacturer it checks through `settings-reader`
 * (CU-086) with `tx.db`, so the check sees the state of the writing transaction. The question
 * about a possible duplicate (CU-107) comes after every rejection, so the user never confirms a
 * save that fails afterwards (2.4 "Prüfreihenfolge beim Speichern", 2.0.11). Changing (#181) and
 * the attribute values (#178) follow.
 */
export function createModelTemplateService({ uow, clock }: ModelTemplateServiceDeps) {
  return {
    /** `POST /api/model-templates`: the new model template with version 1. */
    async create({ confirmDuplicate, ...input }: ModelTemplateCreate): Promise<ModelTemplate> {
      const { result } = await uow.run(async (tx) => {
        await checkActiveEntries(createSettingsReader(tx.db), input);
        await createDuplicateCheck(tx.db).checkPossibleDuplicate({ ...input, confirmDuplicate });
        const repository = createModelTemplateRepository(tx.db);
        const audit = createAuditWriter({ db: tx.db, clock });
        const id = await repository.insert({
          ...input,
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
