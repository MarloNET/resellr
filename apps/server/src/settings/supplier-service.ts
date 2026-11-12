import type {
  Supplier,
  SupplierCreate,
  SupplierList,
  SupplierUpdate,
} from '@resellr/domain/schemas/supplier.schema';
import { toKey } from '@resellr/domain/text/normalize-key';
import type { Kysely } from 'kysely';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWork, UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { ConflictError, NotFoundError, RuleViolation } from '../shared/domain-error.ts';
import {
  createSupplierRepository,
  type SupplierListQuery,
  type SupplierRepository,
  type SupplierRow,
} from './supplier-repository.ts';

export interface SupplierServiceDeps {
  /** Outer database, only for reads outside of an action (2.0.4). */
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const STATUS_LABEL = { true: 'aktiv', false: 'deaktiviert' } as const;
const statusLabel = (active: boolean) => STATUS_LABEL[`${active}`];

const objectLabel = (name: string) => `Lieferant ${name}`;

function toSupplier(row: SupplierRow): Supplier {
  return { id: row.id, name: row.name, active: row.active === 1, version: row.version };
}

/** Name unique over `name_key` (lower case, AC-REQ-099-02); `ownId` when renaming. */
async function assertNameFree(repository: SupplierRepository, nameKey: string, ownId?: number) {
  const existingId = await repository.findIdByNameKey(nameKey);
  if (existingId !== undefined && existingId !== ownId) {
    throw new RuleViolation('name_taken', { usage: 'supplier' });
  }
}

async function readOrThrow(repository: SupplierRepository, id: number) {
  const row = await repository.findById(id);
  if (row === undefined) throw new NotFoundError();
  return row;
}

/**
 * Supplier service (CU-080, REQ-099; Technical Specification 2.2): create, rename, activate
 * and deactivate suppliers. There is no deletion (2.2, DER-36-08); a deactivated supplier stays
 * at the devices and condition codes that refer to it. Each action runs in one transaction with
 * its audit entries (2.0.4, 2.0.9). Suppliers change no channel content, so there is no event
 * (2.2 "Wirkung auf Kanal-Inhalte").
 */
export function createSupplierService({ db, uow, clock }: SupplierServiceDeps) {
  const inAction = (tx: UnitOfWork<DB>) => ({
    repository: createSupplierRepository(tx.db),
    audit: createAuditWriter({ db: tx.db, clock }),
    at: clock.now().toISOString(),
  });

  return {
    /**
     * `GET /api/suppliers`: without `includeInactive` only the active suppliers, the choice for
     * new entries (AC-REQ-099-01, AC-REQ-099-03); UI-032 asks for all of them.
     */
    async list(query: SupplierListQuery): Promise<SupplierList> {
      const { rows, total } = await createSupplierRepository(db).list(query);
      return { items: rows.map(toSupplier), total };
    },

    /** `POST /api/suppliers` (AC-REQ-099-01, AC-REQ-099-02). */
    async create({ name, active }: SupplierCreate): Promise<Supplier> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const nameKey = toKey(name);
        await assertNameFree(repository, nameKey);
        const id = await repository.insert({ name, nameKey, active, at });
        await audit.write({
          objectType: 'supplier',
          objectId: id,
          objectLabel: objectLabel(name),
          action: 'created',
          oldValue: null,
          newValue: { Name: name, Status: statusLabel(active) },
        });
        return toSupplier(await readOrThrow(repository, id));
      });
      return result;
    },

    /**
     * `PATCH /api/suppliers/{id}`: rename and/or switch the status; `409 version_conflict` if
     * the version read differs (2.0.3). One audit entry per change (3.6).
     */
    async update(id: number, { version, name, active }: SupplierUpdate): Promise<Supplier> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const current = await readOrThrow(repository, id);
        if (current.version !== version) throw new ConflictError('version_conflict');

        const renamed = name !== undefined && name !== current.name;
        const wasActive = current.active === 1;
        const switched = active !== undefined && active !== wasActive;
        if (!renamed && !switched) return toSupplier(current);

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
            objectType: 'supplier',
            objectId: id,
            objectLabel: label,
            action: 'updated',
            oldValue: { Name: current.name },
            newValue: { Name: name },
          });
        }
        if (switched) {
          await audit.write({
            objectType: 'supplier',
            objectId: id,
            objectLabel: label,
            action: active ? 'activated' : 'deactivated',
            oldValue: { Status: statusLabel(wasActive) },
            newValue: { Status: statusLabel(active) },
          });
        }
        return toSupplier(await readOrThrow(repository, id));
      });
      return result;
    },
  };
}

export type SupplierService = ReturnType<typeof createSupplierService>;
