import {
  batteryPresentRequiredSchema,
  type PickList,
  type PickListKey,
  type PickListList,
  type PickListValue,
  type PickListValueCreate,
  type PickListValueList,
  type PickListValueOrder,
  type PickListValueUpdate,
} from '@resellr/domain/schemas/pick-list.schema';
import { toKey } from '@resellr/domain/text/normalize-key';
import type { Kysely } from 'kysely';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWork, UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import {
  ConflictError,
  NotFoundError,
  RuleViolation,
  ValidationError,
} from '../shared/domain-error.ts';
import {
  createPickListRepository,
  type PickListRepository,
  type PickListRow,
  type PickListValueRow,
} from './pick-list-repository.ts';

export interface PickListServiceDeps {
  /** Outer database, only for reads outside of an action (2.0.4). */
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

type Page = { limit: number; offset: number };

const STATUS_LABEL = { true: 'aktiv', false: 'deaktiviert' } as const;
const statusLabel = (active: boolean) => STATUS_LABEL[`${active}`];
const BATTERY_LABEL = { true: 'Ja', false: 'Nein' } as const;
const batteryLabel = (present: boolean) => BATTERY_LABEL[`${present}`];

const valueLabel = (list: PickListRow, label: string) => `Listenwert ${label} (${list.name})`;

function toPickList(row: PickListRow): PickList {
  return {
    id: row.id,
    key: row.key as PickListKey,
    name: row.name,
    isBatteryList: row.is_battery_list === 1,
    version: row.version,
  };
}

function toValue(row: PickListValueRow): PickListValue {
  return {
    id: row.id,
    label: row.label,
    active: row.active === 1,
    batteryPresent: row.battery_present === null ? null : row.battery_present === 1,
    sortOrder: row.sort_order,
    version: row.version,
  };
}

/** Value unique per list without regard to case (AC-REQ-007-02); `ownId` when renaming. */
async function assertLabelFree(
  repository: PickListRepository,
  pickListId: number,
  labelKey: string,
  ownId?: number,
) {
  const existingId = await repository.findValueIdByLabelKey(pickListId, labelKey);
  if (existingId !== undefined && existingId !== ownId) {
    throw new RuleViolation('name_taken', { usage: 'pick_list_value' });
  }
}

/** "Akku vorhanden" is required in the list battery (REQ-007, DER-35-10). */
function assertBatteryPresent(value: boolean | null | undefined): asserts value is boolean {
  const result = batteryPresentRequiredSchema.safeParse(value ?? null);
  if (result.success) return;
  throw new ValidationError([
    {
      path: 'batteryPresent',
      code: 'battery_present_missing',
      message: result.error.issues[0]?.message ?? '',
    },
  ]);
}

async function listOrThrow(repository: PickListRepository, id: number) {
  const row = await repository.findPickList(id);
  if (row === undefined) throw new NotFoundError();
  return row;
}

async function valueOrThrow(repository: PickListRepository, id: number) {
  const row = await repository.findValue(id);
  if (row === undefined) throw new NotFoundError();
  return row;
}

/**
 * Pick list service (CU-076, REQ-007; Technical Specification 2.1): create, rename, order,
 * activate and deactivate the values of the nine pick lists. There is no creation or deletion
 * of a list and no deletion of a value (RQ-07, DER-35-09). Records store the value id, so a
 * rename applies everywhere (DER-35-11). Each action runs in one transaction with its audit
 * entries (2.0.4, 2.0.9); a new label reports `SettingsChanged` with all device types that use
 * the list (DER-35-13). The answers hold no counts: UI-043 only follows UI-030 and UI-031.
 */
export function createPickListService({ db, uow, clock }: PickListServiceDeps) {
  const inAction = (tx: UnitOfWork<DB>) => ({
    repository: createPickListRepository(tx.db),
    audit: createAuditWriter({ db: tx.db, clock }),
  });

  return {
    /** `GET /api/pick-lists`. */
    async list(page: Page): Promise<PickListList> {
      const { rows, total } = await createPickListRepository(db).listPickLists(page);
      return { items: rows.map(toPickList), total };
    },

    /** `GET /api/pick-lists/{id}/values`: active and deactivated values in their order. */
    async listValues(pickListId: number, page: Page): Promise<PickListValueList> {
      const repository = createPickListRepository(db);
      await listOrThrow(repository, pickListId);
      const { rows, total } = await repository.listValues(pickListId, page);
      return { items: rows.map(toValue), total };
    },

    /** `POST /api/pick-lists/{id}/values` (AC-REQ-007-01, AC-REQ-007-02, DER-35-10). */
    async createValue(
      pickListId: number,
      { label, active, batteryPresent }: PickListValueCreate,
    ): Promise<PickListValue> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit } = inAction(tx);
        const list = await listOrThrow(repository, pickListId);
        const isBatteryList = list.is_battery_list === 1;
        if (isBatteryList) assertBatteryPresent(batteryPresent);
        const labelKey = toKey(label);
        await assertLabelFree(repository, pickListId, labelKey);

        // Outside the list battery the flag stays empty (DER-35-10).
        const storedBattery = isBatteryList ? (batteryPresent ?? null) : null;
        const id = await repository.insertValue({
          pickListId,
          label,
          labelKey,
          batteryPresent: storedBattery,
          active,
        });
        await audit.write({
          objectType: 'pick_list_value',
          objectId: id,
          objectLabel: valueLabel(list, label),
          action: 'created',
          oldValue: null,
          newValue: {
            Wert: label,
            Status: statusLabel(active),
            ...(storedBattery !== null && { 'Akku vorhanden': batteryLabel(storedBattery) }),
          },
        });
        return toValue(await valueOrThrow(repository, id));
      });
      return result;
    },

    /**
     * `PATCH /api/pick-list-values/{id}`: rename, set the flag "Akku vorhanden" and/or switch
     * the status; `409 version_conflict` if the version read differs (2.0.3). A deactivated
     * value stays stored in every record and is no longer offered for new ones (AC-REQ-007-03).
     */
    async updateValue(
      id: number,
      { version, label, active, batteryPresent }: PickListValueUpdate,
    ): Promise<PickListValue> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit } = inAction(tx);
        const current = await valueOrThrow(repository, id);
        if (current.version !== version) throw new ConflictError('version_conflict');
        const list = await listOrThrow(repository, current.pick_list_id);
        const isBatteryList = list.is_battery_list === 1;
        if (isBatteryList && batteryPresent !== undefined) assertBatteryPresent(batteryPresent);

        const renamed = label !== undefined && label !== current.label;
        const wasActive = current.active === 1;
        const switched = active !== undefined && active !== wasActive;
        const wasPresent = current.battery_present === null ? null : current.battery_present === 1;
        const flagged =
          isBatteryList && typeof batteryPresent === 'boolean' && batteryPresent !== wasPresent;
        if (!renamed && !switched && !flagged) return toValue(current);

        const labelKey = renamed ? toKey(label) : undefined;
        if (labelKey !== undefined) await assertLabelFree(repository, list.id, labelKey, id);
        await repository.updateValue(id, {
          ...(renamed && { label, labelKey }),
          ...(switched && { active }),
          ...(flagged && { batteryPresent }),
          version: current.version + 1,
        });

        const objectLabel = valueLabel(list, renamed ? label : current.label);
        if (renamed || flagged) {
          await audit.write({
            objectType: 'pick_list_value',
            objectId: id,
            objectLabel,
            action: 'updated',
            oldValue: {
              ...(renamed && { Wert: current.label }),
              ...(flagged && {
                'Akku vorhanden': wasPresent === null ? null : batteryLabel(wasPresent),
              }),
            },
            newValue: {
              ...(renamed && { Wert: label }),
              ...(flagged && { 'Akku vorhanden': batteryLabel(batteryPresent) }),
            },
          });
        }
        if (renamed) {
          tx.emit({
            type: 'SettingsChanged',
            scope: {
              kind: 'device_types',
              deviceTypeIds: await repository.deviceTypeIdsUsing(list),
            },
          });
        }
        if (switched) {
          await audit.write({
            objectType: 'pick_list_value',
            objectId: id,
            objectLabel,
            action: active ? 'activated' : 'deactivated',
            oldValue: { Status: statusLabel(wasActive) },
            newValue: { Status: statusLabel(active) },
          });
        }
        return toValue(await valueOrThrow(repository, id));
      });
      return result;
    },

    /**
     * `PUT /api/pick-lists/{id}/value-order` (DER-35-08): the list version guards the order
     * (2.0.3). The ids must be exactly the values of the list; otherwise the order was read
     * before another window added a value, which is a conflict as well (P-05).
     */
    async reorderValues(
      pickListId: number,
      { version, valueIds }: PickListValueOrder,
    ): Promise<PickList> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit } = inAction(tx);
        const list = await listOrThrow(repository, pickListId);
        if (list.version !== version) throw new ConflictError('version_conflict');
        const values = await repository.allValues(pickListId);
        const known = new Set(values.map((value) => value.id));
        const complete =
          valueIds.length === known.size &&
          new Set(valueIds).size === valueIds.length &&
          valueIds.every((valueId) => known.has(valueId));
        if (!complete) throw new ConflictError('version_conflict');

        const unchanged = values.every((value, index) => value.id === valueIds[index]);
        if (unchanged) return toPickList(list);

        await repository.storeOrder(pickListId, valueIds, list.version + 1);
        const labelOf = new Map(values.map((value) => [value.id, value.label]));
        await audit.write({
          objectType: 'pick_list_value',
          objectId: null,
          objectLabel: `Auswahlliste ${list.name}`,
          action: 'reordered',
          oldValue: { Reihenfolge: values.map((value) => value.label) },
          newValue: { Reihenfolge: valueIds.map((valueId) => labelOf.get(valueId) ?? '') },
        });
        return toPickList(await listOrThrow(repository, pickListId));
      });
      return result;
    },
  };
}

export type PickListService = ReturnType<typeof createPickListService>;
