import {
  GPSR_FIELDS,
  GPSR_LABELS,
  gpsrMissingOf,
  type Gpsr,
  type Manufacturer,
  type ManufacturerCreate,
  type ManufacturerList,
  type ManufacturerUpdate,
  type ManufacturerUpdateResult,
} from '@resellr/domain/schemas/manufacturer.schema';
import { toKey } from '@resellr/domain/text/normalize-key';
import type { Kysely } from 'kysely';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWork, UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { ConflictError, NotFoundError, RuleViolation } from '../shared/domain-error.ts';
import {
  createManufacturerRepository,
  type ManufacturerListQuery,
  type ManufacturerRepository,
  type ManufacturerRow,
} from './manufacturer-repository.ts';

export interface ManufacturerServiceDeps {
  /** Outer database, only for reads outside of an action (2.0.4). */
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

/** Result of `create`: the new manufacturer, or the active one that already has the name. */
export interface ManufacturerCreated {
  manufacturer: Manufacturer;
  existing: boolean;
}

const STATUS_LABEL = { true: 'aktiv', false: 'deaktiviert' } as const;
const statusLabel = (active: boolean) => STATUS_LABEL[`${active}`];

const objectLabel = (name: string) => `Hersteller ${name}`;

/** Stored GPSR details, `''` for `NULL` (3.1). */
function gpsrOf(row: ManufacturerRow): Gpsr {
  return {
    legalName: row.gpsr_legal_name ?? '',
    street: row.gpsr_street ?? '',
    postalCode: row.gpsr_postal_code ?? '',
    city: row.gpsr_city ?? '',
    country: row.gpsr_country ?? '',
    contact: row.gpsr_contact ?? '',
    euRpName: row.eu_rp_name ?? '',
    euRpAddress: row.eu_rp_address ?? '',
    euRpContact: row.eu_rp_contact ?? '',
  };
}

function toManufacturer(row: ManufacturerRow): Manufacturer {
  const gpsr = gpsrOf(row);
  return {
    id: row.id,
    name: row.name,
    active: row.active === 1,
    gpsrComplete: row.gpsr_complete === 1,
    gpsrMissing: gpsrMissingOf(gpsr),
    gpsr,
    version: row.version,
  };
}

/** Values of the changed GPSR fields under their labels, for the audit entry (3.6). */
const gpsrAuditValues = (gpsr: Gpsr, changed: readonly (keyof Gpsr)[]) =>
  Object.fromEntries(changed.map((field) => [GPSR_LABELS[field], gpsr[field]]));

async function readOrThrow(repository: ManufacturerRepository, id: number) {
  const row = await repository.findById(id);
  if (row === undefined) throw new NotFoundError();
  return row;
}

/**
 * Manufacturer service (CU-078, REQ-027, REQ-100, REQ-101; Technical Specification 2.2):
 * create (with "already there"), rename, activate and deactivate manufacturers and keep their
 * GPSR details. There is no deletion (2.2); a deactivated manufacturer stays at its model
 * templates. Each action runs in one transaction with its audit entries (2.0.4, 2.0.9). A change
 * of the GPSR details reports `SettingsChanged` for all model listings of the manufacturer's
 * model templates; the effect of a rename follows with #159. Until S5 `impact` is `{0, 0, 0}`
 * (4.4.0).
 */
export function createManufacturerService({ db, uow, clock }: ManufacturerServiceDeps) {
  const inAction = (tx: UnitOfWork<DB>) => ({
    repository: createManufacturerRepository(tx.db),
    audit: createAuditWriter({ db: tx.db, clock }),
    at: clock.now().toISOString(),
  });

  return {
    /**
     * `GET /api/manufacturers`: without `includeInactive` only the active manufacturers, the
     * choice for new model templates (AC-REQ-101-02); UI-031 asks for all of them.
     */
    async list(query: ManufacturerListQuery): Promise<ManufacturerList> {
      const { rows, total } = await createManufacturerRepository(db).list(query);
      return { items: rows.map(toManufacturer), total };
    },

    /**
     * `POST /api/manufacturers` (AC-REQ-100-01 to AC-REQ-100-03): a name that an active
     * manufacturer already has, in any case, creates nothing and gives that manufacturer
     * (`existing`, AC-REQ-100-02); the name of a deactivated one is rejected with
     * `manufacturer_deactivated` (DER-37-09). A new manufacturer is active and has no GPSR
     * details, so it is incomplete.
     */
    async create({ name }: ManufacturerCreate): Promise<ManufacturerCreated> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const nameKey = toKey(name);
        const present = await repository.findByNameKey(nameKey);
        if (present !== undefined) {
          if (present.active !== 1) {
            throw new RuleViolation('manufacturer_deactivated', { messageArgs: [present.name] });
          }
          return { manufacturer: toManufacturer(present), existing: true };
        }

        const id = await repository.insert({ name, nameKey, at });
        await audit.write({
          objectType: 'manufacturer',
          objectId: id,
          objectLabel: objectLabel(name),
          action: 'created',
          oldValue: null,
          newValue: { Name: name, Status: statusLabel(true) },
        });
        return { manufacturer: toManufacturer(await readOrThrow(repository, id)), existing: false };
      });
      return result;
    },

    /**
     * `PATCH /api/manufacturers/{id}`: rename, switch the status and/or save the GPSR details;
     * a name another manufacturer has, active or not, is `name_taken` (DER-37-04);
     * `409 version_conflict` if the version read differs (2.0.3). Incomplete GPSR details are
     * saved, `gpsr_complete` is derived (AC-REQ-027-02). One audit entry `updated` for name and
     * GPSR details and one for the status (3.6).
     */
    async update(
      id: number,
      { version, name, active, gpsr }: ManufacturerUpdate,
    ): Promise<ManufacturerUpdateResult> {
      const { result, report } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const current = await readOrThrow(repository, id);
        if (current.version !== version) throw new ConflictError('version_conflict');

        const renamed = name !== undefined && name !== current.name;
        const wasActive = current.active === 1;
        const switched = active !== undefined && active !== wasActive;
        const storedGpsr = gpsrOf(current);
        const gpsrChanged =
          gpsr === undefined
            ? []
            : GPSR_FIELDS.filter((field) => gpsr[field] !== storedGpsr[field]);
        if (!renamed && !switched && gpsrChanged.length === 0) return toManufacturer(current);

        const nameKey = renamed ? toKey(name) : undefined;
        if (nameKey !== undefined) {
          const holder = await repository.findByNameKey(nameKey);
          if (holder !== undefined && holder.id !== id) {
            throw new RuleViolation('name_taken', { usage: 'manufacturer' });
          }
        }
        await repository.update(id, {
          ...(renamed && { name, nameKey }),
          ...(switched && { active }),
          ...(gpsr !== undefined &&
            gpsrChanged.length > 0 && {
              gpsr: { values: gpsr, complete: gpsrMissingOf(gpsr).length === 0 },
            }),
          version: current.version + 1,
          at,
        });

        const label = objectLabel(renamed ? name : current.name);
        if (renamed || gpsrChanged.length > 0) {
          await audit.write({
            objectType: 'manufacturer',
            objectId: id,
            objectLabel: label,
            action: 'updated',
            oldValue: {
              ...(renamed && { Name: current.name }),
              ...gpsrAuditValues(storedGpsr, gpsrChanged),
            },
            newValue: {
              ...(renamed && { Name: name }),
              ...(gpsr !== undefined && gpsrAuditValues(gpsr, gpsrChanged)),
            },
          });
        }
        if (switched) {
          await audit.write({
            objectType: 'manufacturer',
            objectId: id,
            objectLabel: label,
            action: active ? 'activated' : 'deactivated',
            oldValue: { Status: statusLabel(wasActive) },
            newValue: { Status: statusLabel(active) },
          });
        }
        // All model listings of the manufacturer's model templates (2.2, 2.8.3).
        if (gpsrChanged.length > 0) {
          tx.emit({ type: 'SettingsChanged', scope: { kind: 'manufacturer', manufacturerId: id } });
        }
        return toManufacturer(await readOrThrow(repository, id));
      });
      return { manufacturer: result, impact: report.impact };
    },
  };
}

export type ManufacturerService = ReturnType<typeof createManufacturerService>;
