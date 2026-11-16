import {
  type ModelTemplate,
  type ModelTemplateCreate,
  modelTemplateSearchKey,
} from '@resellr/domain/schemas/model-template.schema';
import { toModelNameKey } from '@resellr/domain/text/normalize-key';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
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
 * Model template service (CU-105, REQ-008; Technical Specification 2.4): creates a model
 * template together with its audit entry in one transaction (2.0.4); without the entry nothing
 * is stored. The field rules are checked before by the schema of CU-104 (route), so the service
 * stores the trimmed values. Changing (#181), the attribute values (#178) and the duplicate hint
 * (#184) follow.
 */
export function createModelTemplateService({ uow, clock }: ModelTemplateServiceDeps) {
  return {
    /** `POST /api/model-templates`: the new model template with version 1. */
    async create(input: ModelTemplateCreate): Promise<ModelTemplate> {
      const { result } = await uow.run(async (tx) => {
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
