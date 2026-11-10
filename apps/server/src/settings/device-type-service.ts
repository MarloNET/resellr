import type {
  DeviceType,
  DeviceTypeCreate,
  DeviceTypeList,
  DeviceTypeUpdate,
} from '@resellr/domain/schemas/device-type.schema';
import { toKey } from '@resellr/domain/text/normalize-key';
import type { Kysely } from 'kysely';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWork, UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { ConflictError, NotFoundError, RuleViolation } from '../shared/domain-error.ts';
import {
  createDeviceTypeRepository,
  type DeviceTypeRepository,
  type DeviceTypeWithCount,
} from './device-type-repository.ts';

export interface DeviceTypeServiceDeps {
  /** Outer database, only for reads outside of an action (2.0.4). */
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const STATUS_LABEL = { true: 'aktiv', false: 'deaktiviert' } as const;
const statusLabel = (active: boolean) => STATUS_LABEL[`${active}`];

const objectLabel = (name: string) => `Geräteart ${name}`;

function toDeviceType(row: DeviceTypeWithCount): DeviceType {
  return {
    id: row.id,
    name: row.name,
    active: row.active === 1,
    version: row.version,
    attributeCount: row.attribute_count,
  };
}

/** Name unique over `name_key` (Unicode lower case, AC-REQ-004-02); `ownId` when renaming. */
async function assertNameFree(repository: DeviceTypeRepository, nameKey: string, ownId?: number) {
  const existingId = await repository.findIdByNameKey(nameKey);
  if (existingId !== undefined && existingId !== ownId) {
    throw new RuleViolation('name_taken', { usage: 'device_type' });
  }
}

async function readOrThrow(repository: DeviceTypeRepository, id: number) {
  const row = await repository.findById(id);
  if (row === undefined) throw new NotFoundError();
  return row;
}

/**
 * Device type service (CU-072, REQ-004; Technical Specification 2.1): create, rename, activate
 * and deactivate device types. There is no deletion (REQ-004, AC-REQ-004-04). Each action runs
 * in one transaction with its audit entries (2.0.4, 2.0.9); renaming reports `SettingsChanged`
 * with the scope of the device type (2.1 "Wirkung auf Kanal-Inhalte"). The answers hold no
 * counts: UI-043 only follows UI-030 and UI-031 (2.1, DER-33-12). The attributes follow with #151.
 */
export function createDeviceTypeService({ db, uow, clock }: DeviceTypeServiceDeps) {
  const inAction = (tx: UnitOfWork<DB>) => ({
    repository: createDeviceTypeRepository(tx.db),
    audit: createAuditWriter({ db: tx.db, clock }),
    at: clock.now().toISOString(),
  });

  return {
    /** `GET /api/device-types`: active and deactivated ones, in their order. */
    async list(page: { limit: number; offset: number }): Promise<DeviceTypeList> {
      const { rows, total } = await createDeviceTypeRepository(db).list(page);
      return { items: rows.map(toDeviceType), total };
    },

    /** `POST /api/device-types` (AC-REQ-004-01, AC-REQ-004-02). */
    async create({ name, active }: DeviceTypeCreate): Promise<DeviceType> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const nameKey = toKey(name);
        await assertNameFree(repository, nameKey);
        const id = await repository.insert({ name, nameKey, active, at });
        await audit.write({
          objectType: 'device_type',
          objectId: id,
          objectLabel: objectLabel(name),
          action: 'created',
          oldValue: null,
          newValue: { Name: name, Status: statusLabel(active) },
        });
        return toDeviceType(await readOrThrow(repository, id));
      });
      return result;
    },

    /**
     * `PATCH /api/device-types/{id}`: rename and/or switch the status; `409 version_conflict`
     * if the version read differs (2.0.3). Deactivating removes the device type from the choice
     * for new model templates (AC-REQ-004-03); existing data keeps referring to it.
     */
    async update(id: number, { version, name, active }: DeviceTypeUpdate): Promise<DeviceType> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const current = await readOrThrow(repository, id);
        if (current.version !== version) throw new ConflictError('version_conflict');

        const renamed = name !== undefined && name !== current.name;
        const wasActive = current.active === 1;
        const switched = active !== undefined && active !== wasActive;
        if (!renamed && !switched) return toDeviceType(current);

        const nameKey = renamed ? toKey(name) : undefined;
        if (nameKey !== undefined) await assertNameFree(repository, nameKey, id);
        await repository.update(id, {
          ...(renamed && { name, nameKey }),
          ...(switched && { active }),
          version: current.version + 1,
          at,
        });

        const label = objectLabel(renamed ? name : current.name);
        if (renamed) {
          await audit.write({
            objectType: 'device_type',
            objectId: id,
            objectLabel: label,
            action: 'updated',
            oldValue: { Name: current.name },
            newValue: { Name: name },
          });
          tx.emit({
            type: 'SettingsChanged',
            scope: { kind: 'device_types', deviceTypeIds: [id] },
          });
        }
        if (switched) {
          await audit.write({
            objectType: 'device_type',
            objectId: id,
            objectLabel: label,
            action: active ? 'activated' : 'deactivated',
            oldValue: { Status: statusLabel(wasActive) },
            newValue: { Status: statusLabel(active) },
          });
        }
        return toDeviceType(await readOrThrow(repository, id));
      });
      return result;
    },
  };
}

export type DeviceTypeService = ReturnType<typeof createDeviceTypeService>;
