import type { FieldError } from '@resellr/domain/errors/error-response';
import {
  ATTRIBUTE_VALUE_LABELS,
  attributeDefinitionIssues,
  attributeLabelSchemaFor,
  canonicalBound,
  type AttributeDefinitionIssue,
  type Attribute,
  type AttributeCreate,
  type AttributeDataType,
  type AttributeLevel,
  type AttributeList,
  type AttributeOrder,
  type AttributeSystemRole,
  type AttributeUpdate,
  type DatasheetBlock,
} from '@resellr/domain/schemas/attribute.schema';
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
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  RuleViolation,
  ValidationError,
} from '../shared/domain-error.ts';
import {
  createDeviceTypeRepository,
  type AttributeRow,
  type DeviceTypeRepository,
  type DeviceTypeWithCount,
} from './device-type-repository.ts';
import { createPickListRepository } from './pick-list-repository.ts';
import { checkVariantSetChange } from './variant-flag-guard.ts';

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

function toAttribute(row: AttributeRow): Attribute {
  return {
    id: row.id,
    deviceTypeId: row.device_type_id,
    label: row.label,
    dataType: row.data_type as AttributeDataType,
    systemRole: row.system_role as AttributeSystemRole | null,
    unit: row.unit,
    unitSpacing: row.unit_spacing === 1,
    minValue: row.min_value,
    maxValue: row.max_value,
    pickListId: row.pick_list_id,
    level: row.level as AttributeLevel,
    variantForming: row.variant_forming === 1,
    required: row.required === 1,
    datasheetBlock: row.datasheet_block as DatasheetBlock,
    sortOrder: row.sort_order,
    active: row.active === 1,
    version: row.version,
  };
}

async function attributeOrThrow(repository: DeviceTypeRepository, id: number) {
  const row = await repository.findAttribute(id);
  if (row === undefined) throw new NotFoundError();
  return row;
}

/** Label unique per device type without regard to case (2.1, DER-34-05); `ownId` when renaming. */
async function assertLabelFree(
  repository: DeviceTypeRepository,
  deviceTypeId: number,
  labelKey: string,
  ownId?: number,
) {
  const existingId = await repository.findAttributeIdByLabelKey(deviceTypeId, labelKey);
  if (existingId !== undefined && existingId !== ownId) {
    throw new RuleViolation('name_taken', { usage: 'attribute' });
  }
}

/**
 * Label rule with the exception of the role `battery_capacity` (2.1, M-02 to M-04): the trimmed
 * label, or its field error.
 */
function labelRule(
  label: string,
  systemRole: AttributeSystemRole | null,
): { value: string; error?: FieldError } {
  const result = attributeLabelSchemaFor(systemRole).safeParse(label);
  if (result.success) return { value: result.data };
  const issue = result.error.issues[0];
  const code = (issue as { params?: { code?: string } } | undefined)?.params?.code ?? 'custom';
  return { value: label, error: { path: 'label', code, message: issue?.message ?? '' } };
}

/** Fields of an attribute with their names and readable values for the audit entry (2.0.9). */
type AuditFields = Record<string, string | null>;

const yesNo = (value: boolean) => (value ? 'Ja' : 'Nein');

/**
 * The definition of an attribute with readable values (2.0.9): display names of UI-027 and the
 * name of the pick list instead of its id.
 */
async function auditFieldsOf(attribute: Attribute, pickListName: (id: number) => Promise<string>) {
  const fields: AuditFields = {
    Bezeichnung: attribute.label,
    Datentyp: ATTRIBUTE_VALUE_LABELS.dataType[attribute.dataType],
    Einheit: attribute.unit,
    Schreibweise: ATTRIBUTE_VALUE_LABELS.unitSpacing[`${attribute.unitSpacing}`],
    Mindestwert: attribute.minValue,
    Höchstwert: attribute.maxValue,
    Auswahlliste: attribute.pickListId === null ? null : await pickListName(attribute.pickListId),
    Ebene: ATTRIBUTE_VALUE_LABELS.level[attribute.level],
    Variantenbildend: yesNo(attribute.variantForming),
    Pflichtmerkmal: yesNo(attribute.required),
    'Datenblatt-Block': ATTRIBUTE_VALUE_LABELS.datasheetBlock[attribute.datasheetBlock],
  };
  return fields;
}

/** Only the fields whose value differs, as old and new value of an audit entry (2.0.9). */
function changedFields(before: AuditFields, after: AuditFields) {
  const names = Object.keys(after).filter((name) => before[name] !== after[name]);
  return {
    oldValue: Object.fromEntries(names.map((name) => [name, before[name] ?? null])),
    newValue: Object.fromEntries(names.map((name) => [name, after[name] ?? null])),
  };
}

const attributeLabel = (label: string, deviceTypeName: string) =>
  `Merkmal ${label} (${deviceTypeName})`;

/**
 * Fields of an attribute whose change alters channel contents and reports `SettingsChanged`:
 * label, unit, unit spacing and status (2.1 "Wirkung auf Kanal-Inhalte", DER-34-12).
 */
const CONTENT_FIELDS = ['label', 'unit', 'unitSpacing', 'active'] as const;

/**
 * Device type service (CU-072, REQ-004, REQ-005; Technical Specification 2.1): create, rename,
 * activate and deactivate device types, and create, change, order and deactivate their
 * attributes. There is no deletion (REQ-004, REQ-005). Each action runs in one transaction with
 * its audit entries (2.0.4, 2.0.9); a change that alters channel contents reports
 * `SettingsChanged` with the scope of the device type (2.1 "Wirkung auf Kanal-Inhalte"). The
 * answers hold no counts: UI-043 only follows UI-030 and UI-031 (2.1, DER-33-12, DER-34-12).
 */
export function createDeviceTypeService({ db, uow, clock }: DeviceTypeServiceDeps) {
  const inAction = (tx: UnitOfWork<DB>) => ({
    repository: createDeviceTypeRepository(tx.db),
    audit: createAuditWriter({ db: tx.db, clock }),
    at: clock.now().toISOString(),
  });

  const pickListNames = (tx: UnitOfWork<DB>) => {
    const pickLists = createPickListRepository(tx.db);
    return async (id: number) => {
      const list = await pickLists.findPickList(id);
      if (list === undefined) throw new BadRequestError('pickListId attribute_pick_list_unknown');
      return list.name;
    };
  };

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

    /**
     * `GET /api/device-types/{id}/attributes`: active and deactivated attributes in their order.
     * `hasValues` (CU-074) locks data type and level once values are stored; the usage query
     * follows with #152, until then no attribute has values.
     */
    async listAttributes(deviceTypeId: number): Promise<AttributeList> {
      const repository = createDeviceTypeRepository(db);
      await readOrThrow(repository, deviceTypeId);
      const rows = await repository.listAttributes(deviceTypeId);
      return {
        items: rows.map((row) => ({ ...toAttribute(row), hasValues: false })),
        total: rows.length,
      };
    },

    /**
     * `POST /api/device-types/{id}/attributes` (AC-REQ-005-01, AC-REQ-005-06, DER-34-05): the
     * schema has checked the field rules; the label must be free in the device type. The new
     * attribute stands at the end of the order. It has no values yet, so it alters no channel
     * content and reports no event.
     */
    async createAttribute(deviceTypeId: number, input: AttributeCreate): Promise<Attribute> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const deviceType = await readOrThrow(repository, deviceTypeId);
        const labelKey = toKey(input.label);
        await assertLabelFree(repository, deviceTypeId, labelKey);
        const pickListName = pickListNames(tx);
        if (input.pickListId !== null) await pickListName(input.pickListId);

        const id = await repository.insertAttribute({ ...input, deviceTypeId, labelKey, at });
        const created = toAttribute(await attributeOrThrow(repository, id));
        await audit.write({
          objectType: 'attribute',
          objectId: id,
          objectLabel: attributeLabel(created.label, deviceType.name),
          action: 'created',
          oldValue: null,
          newValue: {
            ...(await auditFieldsOf(created, pickListName)),
            Status: statusLabel(created.active),
          },
        });
        return created;
      });
      return result;
    },

    /**
     * `PATCH /api/attributes/{id}`: change fields and/or the status; `409 version_conflict` if
     * the version read differs (2.0.3). The rules apply to the merged state: label with the
     * exception of `battery_capacity` (DER-34-02), uniqueness (DER-34-05), the cross-field rules
     * (DER-34-03, DER-34-04, AC-REQ-005-07) and the fixed fields of a system role (DER-34-08).
     * Deactivating is never rejected and keeps the attribute in the variant set (K-03,
     * DER-34-07); removing the flag "variantenbildend" reports `VariantSetChanging` (CU-075).
     */
    async updateAttribute(id: number, patch: AttributeUpdate): Promise<Attribute> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const currentRow = await attributeOrThrow(repository, id);
        const { version, ...fields } = patch;
        if (currentRow.version !== version) throw new ConflictError('version_conflict');
        const current = toAttribute(currentRow);
        // The rules apply to the stored state with the changed fields (2.1).
        const merged: Attribute = {
          ...current,
          ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
        };

        // Order of the checks (2.1): structural errors (400), field rules (422), name_taken.
        if (current.systemRole !== null) assertSystemRoleFieldsKept(current, merged);
        const issues = attributeDefinitionIssues(merged);
        assertNoStructuralIssue(issues);
        const pickListName = pickListNames(tx);
        if (merged.pickListId !== null && merged.pickListId !== current.pickListId) {
          await pickListName(merged.pickListId);
        }
        const label =
          fields.label === undefined
            ? { value: current.label }
            : labelRule(fields.label, current.systemRole);
        assertFieldRules([...(label.error ? [label.error] : []), ...issues]);

        const next: Attribute = {
          ...merged,
          label: label.value,
          minValue: canonicalBound(merged.minValue),
          maxValue: canonicalBound(merged.maxValue),
        };
        const changed = (Object.keys(fields) as (keyof typeof fields)[]).filter(
          (field) => next[field] !== current[field],
        );
        if (changed.length === 0) return current;

        const deviceType = await readOrThrow(repository, current.deviceTypeId);
        const renamed = next.label !== current.label;
        const labelKey = renamed ? toKey(next.label) : undefined;
        if (labelKey !== undefined) {
          await assertLabelFree(repository, current.deviceTypeId, labelKey, id);
        }

        await repository.updateAttribute(id, {
          ...Object.fromEntries(changed.map((field) => [field, next[field]])),
          ...(labelKey !== undefined && { labelKey }),
          version: current.version + 1,
          at,
        });
        await checkVariantSetChange(tx, {
          deviceTypeId: current.deviceTypeId,
          before: current,
          after: next,
        });

        const objectLabel = attributeLabel(next.label, deviceType.name);
        const { oldValue, newValue } = changedFields(
          await auditFieldsOf(current, pickListName),
          await auditFieldsOf(next, pickListName),
        );
        if (Object.keys(newValue).length > 0) {
          await audit.write({
            objectType: 'attribute',
            objectId: id,
            objectLabel,
            action: 'updated',
            oldValue,
            newValue,
          });
        }
        if (next.active !== current.active) {
          await audit.write({
            objectType: 'attribute',
            objectId: id,
            objectLabel,
            action: next.active ? 'activated' : 'deactivated',
            oldValue: { Status: statusLabel(current.active) },
            newValue: { Status: statusLabel(next.active) },
          });
        }
        if (CONTENT_FIELDS.some((field) => next[field] !== current[field])) {
          tx.emit({
            type: 'SettingsChanged',
            scope: { kind: 'device_types', deviceTypeIds: [current.deviceTypeId] },
          });
        }
        return toAttribute(await attributeOrThrow(repository, id));
      });
      return result;
    },

    /**
     * `PUT /api/device-types/{id}/attribute-order` (DER-34-06): the version of the device type
     * guards the order as a whole (2.0.3); the ids must be exactly the attributes of the device
     * type, otherwise `409 version_conflict` as well (2.1). The answer is the device type with its
     * new version.
     */
    async reorderAttributes(
      deviceTypeId: number,
      { version, attributeIds }: AttributeOrder,
    ): Promise<DeviceType> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const deviceType = await readOrThrow(repository, deviceTypeId);
        if (deviceType.version !== version) throw new ConflictError('version_conflict');
        const attributes = await repository.listAttributes(deviceTypeId);
        const known = new Set(attributes.map((attribute) => attribute.id));
        const complete =
          attributeIds.length === known.size &&
          new Set(attributeIds).size === attributeIds.length &&
          attributeIds.every((attributeId) => known.has(attributeId));
        // Missing, repeated or foreign ids: the order was read before another window created
        // an attribute, which does not change the version of the device type (2.1, P-05).
        if (!complete) throw new ConflictError('version_conflict');

        const unchanged = attributes.every(
          (attribute, index) => attribute.id === attributeIds[index],
        );
        if (unchanged) return toDeviceType(deviceType);

        await repository.storeAttributeOrder(
          deviceTypeId,
          attributeIds,
          deviceType.version + 1,
          at,
        );
        const labelOf = new Map(attributes.map((attribute) => [attribute.id, attribute.label]));
        await audit.write({
          objectType: 'attribute',
          objectId: null,
          objectLabel: objectLabel(deviceType.name),
          action: 'reordered',
          oldValue: { Reihenfolge: attributes.map((attribute) => attribute.label) },
          newValue: {
            Reihenfolge: attributeIds.map((attributeId) => labelOf.get(attributeId) ?? ''),
          },
        });
        return toDeviceType(await readOrThrow(repository, deviceTypeId));
      });
      return result;
    },
  };
}

/**
 * Data type, level and pick list of an attribute with a system role are fixed (2.1, DER-34-08);
 * UI-027 locks these fields, so a different value is a structural error. Sending the stored
 * value again is no change.
 */
function assertSystemRoleFieldsKept(current: Attribute, next: Attribute) {
  const fixed = ['dataType', 'level', 'pickListId'] as const;
  const changed = fixed.filter((field) => next[field] !== current[field]);
  if (changed.length > 0) {
    throw new BadRequestError(`${changed.join(', ')} attribute_system_role_fixed`);
  }
}

/** Cross-field rules without a field are structural errors (2.1, 2.0.5 rule (4)). */
function assertNoStructuralIssue(issues: readonly AttributeDefinitionIssue[]) {
  const structural = issues.filter((issue) => issue.path === undefined);
  if (structural.length > 0) {
    throw new BadRequestError(structural.map((issue) => issue.code).join(', '));
  }
}

/** Field rules: one entry per field, the first violated rule (2.0.5). */
function assertFieldRules(issues: readonly (FieldError | AttributeDefinitionIssue)[]) {
  const fields: FieldError[] = [];
  for (const { path, code, message } of issues) {
    if (path === undefined || fields.some((field) => field.path === path)) continue;
    fields.push({ path, code, message });
  }
  if (fields.length > 0) throw new ValidationError(fields);
}
