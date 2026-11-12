import type {
  ConditionCodeCreate,
  ConditionCodeEntry,
  ConditionCodeList,
  ConditionCodeResolution,
  ConditionCodeUpdate,
} from '@resellr/domain/schemas/condition-code.schema';
import { toKey } from '@resellr/domain/text/normalize-key';
import type { Kysely } from 'kysely';

import { createAuditWriter, type AuditEntryInput } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWork, UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { ConflictError, NotFoundError, RuleViolation } from '../shared/domain-error.ts';
import {
  createConditionCodeRepository,
  type ConditionCodeListQuery,
  type ConditionCodeRepository,
  type ConditionCodeRow,
  type ConditionCodeValues,
} from './condition-code-repository.ts';

export interface ConditionCodeServiceDeps {
  /** Outer database, only for reads outside of an action (2.0.4). */
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

type AuditValues = NonNullable<AuditEntryInput['newValue']>;

/** Readable field names of the audit entries (2.0.9, 3.4), as the columns of UI-033. */
const FIELD = {
  code: 'Zustandscode',
  supplier: 'Lieferant',
  plainText: 'Klartext',
  condition: 'Vorschlag Zustand',
  visualGrade: 'Vorschlag Optik-Note',
} as const;

/** Supplier of an entry without supplier, as UI-033 shows it. */
const ALL_SUPPLIERS = 'alle';

const objectLabel = (code: string, supplierName: string | null) =>
  supplierName === null ? `Code-Übersetzung ${code}` : `Code-Übersetzung ${code} (${supplierName})`;

function toEntry(row: ConditionCodeRow): ConditionCodeEntry {
  return {
    id: row.id,
    code: row.code,
    supplierId: row.supplier_id,
    plainText: row.plain_text,
    suggestedConditionValueId: row.suggested_condition_value_id,
    suggestedVisualGrade: row.suggested_visual_grade,
    version: row.version,
  };
}

function valuesOf(row: ConditionCodeRow): ConditionCodeValues {
  return {
    code: row.code,
    codeKey: row.code_key,
    supplierId: row.supplier_id,
    plainText: row.plain_text,
    suggestedConditionValueId: row.suggested_condition_value_id,
    suggestedVisualGrade: row.suggested_visual_grade,
  };
}

async function readOrThrow(repository: ConditionCodeRepository, id: number) {
  const row = await repository.findById(id);
  if (row === undefined) throw new NotFoundError();
  return row;
}

/** Code and supplier unique, the code without regard to case (AC-REQ-022-02); `ownId` on change. */
async function assertKeyFree(
  repository: ConditionCodeRepository,
  { codeKey, supplierId }: ConditionCodeValues,
  ownId?: number,
) {
  const existingId = await repository.findIdByKey(codeKey, supplierId);
  if (existingId !== undefined && existingId !== ownId) {
    throw new RuleViolation('name_taken', { usage: 'condition_code' });
  }
}

/**
 * Readable values of an entry for the audit entries (labels instead of ids, 3.4). A supplier
 * or condition value that does not exist (deleted in another window, or a wrong id) answers
 * `404 not_found` (M-15) instead of breaking the foreign key.
 */
async function readableOf(repository: ConditionCodeRepository, values: ConditionCodeValues) {
  let supplier: string | null = null;
  if (values.supplierId !== null) {
    supplier = (await repository.supplierName(values.supplierId)) ?? null;
    if (supplier === null) throw new NotFoundError();
  }
  let condition: string | null = null;
  if (values.suggestedConditionValueId !== null) {
    condition = (await repository.conditionValueLabel(values.suggestedConditionValueId)) ?? null;
    if (condition === null) throw new NotFoundError();
  }
  return {
    supplierName: supplier,
    fields: {
      [FIELD.code]: values.code,
      [FIELD.supplier]: supplier ?? ALL_SUPPLIERS,
      [FIELD.plainText]: values.plainText,
      [FIELD.condition]: condition,
      [FIELD.visualGrade]: values.suggestedVisualGrade,
    } satisfies AuditValues,
  };
}

/** Only the fields that differ (2.0.9). */
function changedFields(before: AuditValues, after: AuditValues) {
  const keys = Object.keys(after).filter((key) => before[key] !== after[key]);
  return {
    oldValue: Object.fromEntries(keys.map((key) => [key, before[key] ?? null])),
    newValue: Object.fromEntries(keys.map((key) => [key, after[key] ?? null])),
  };
}

/**
 * Condition code service (CU-081, REQ-022, REQ-015; Technical Specification 2.2): create,
 * change and delete entries of the condition code table and resolve a code. Each action runs in
 * one transaction with its audit entry (2.0.4, 2.0.9). Changes act only on future captures
 * (AC-REQ-022-03): the service emits no event, so no channel content is recalculated and no
 * stored condition description changes (2.2 "Wirkung auf Kanal-Inhalte").
 */
export function createConditionCodeService({ db, uow, clock }: ConditionCodeServiceDeps) {
  const inAction = (tx: UnitOfWork<DB>) => ({
    repository: createConditionCodeRepository(tx.db),
    audit: createAuditWriter({ db: tx.db, clock }),
    at: clock.now().toISOString(),
  });

  return {
    /** `GET /api/condition-codes`. */
    async list(query: ConditionCodeListQuery): Promise<ConditionCodeList> {
      const { rows, total } = await createConditionCodeRepository(db).list(query);
      return { items: rows.map(toEntry), total };
    },

    /**
     * `GET /api/condition-codes/resolve`: the entry of the supplier before the entry without
     * supplier, the code without regard to case (2.2 "Auflösen eines Codes", AC-REQ-015-01).
     */
    async resolve(code: string, supplierId: number | null): Promise<ConditionCodeResolution> {
      const codeKey = toKey(code);
      const row =
        codeKey === ''
          ? undefined
          : await createConditionCodeRepository(db).resolve(codeKey, supplierId);
      if (row === undefined) {
        return {
          found: false,
          plainText: null,
          suggestedConditionValueId: null,
          suggestedVisualGrade: null,
        };
      }
      return {
        found: true,
        plainText: row.plain_text,
        suggestedConditionValueId: row.suggested_condition_value_id,
        suggestedVisualGrade: row.suggested_visual_grade,
      };
    },

    /** `POST /api/condition-codes` (AC-REQ-022-01, AC-REQ-022-02). */
    async create(entry: ConditionCodeCreate): Promise<ConditionCodeEntry> {
      const values: ConditionCodeValues = {
        code: entry.code,
        codeKey: toKey(entry.code),
        supplierId: entry.supplierId ?? null,
        plainText: entry.plainText,
        suggestedConditionValueId: entry.suggestedConditionValueId ?? null,
        suggestedVisualGrade: entry.suggestedVisualGrade ?? null,
      };
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const readable = await readableOf(repository, values);
        await assertKeyFree(repository, values);
        const id = await repository.insert(values, at);
        await audit.write({
          objectType: 'condition_code',
          objectId: id,
          objectLabel: objectLabel(values.code, readable.supplierName),
          action: 'created',
          oldValue: null,
          newValue: readable.fields,
        });
        return toEntry(await readOrThrow(repository, id));
      });
      return result;
    },

    /**
     * `PATCH /api/condition-codes/{id}`: `409 version_conflict` if the version read differs
     * (2.0.3); one audit entry with the changed fields.
     */
    async update(id: number, { version, ...changes }: ConditionCodeUpdate) {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const current = await readOrThrow(repository, id);
        if (current.version !== version) throw new ConflictError('version_conflict');

        const before = valuesOf(current);
        const code = changes.code ?? before.code;
        const after: ConditionCodeValues = {
          code,
          codeKey: toKey(code),
          supplierId: changes.supplierId === undefined ? before.supplierId : changes.supplierId,
          plainText: changes.plainText ?? before.plainText,
          suggestedConditionValueId:
            changes.suggestedConditionValueId === undefined
              ? before.suggestedConditionValueId
              : changes.suggestedConditionValueId,
          suggestedVisualGrade:
            changes.suggestedVisualGrade === undefined
              ? before.suggestedVisualGrade
              : changes.suggestedVisualGrade,
        };
        const oldReadable = await readableOf(repository, before);
        const newReadable = await readableOf(repository, after);
        const { oldValue, newValue } = changedFields(oldReadable.fields, newReadable.fields);
        if (Object.keys(newValue).length === 0) return toEntry(current);

        await assertKeyFree(repository, after, id);
        await repository.update(id, after, current.version + 1, at);
        await audit.write({
          objectType: 'condition_code',
          objectId: id,
          objectLabel: objectLabel(after.code, newReadable.supplierName),
          action: 'updated',
          oldValue,
          newValue,
        });
        return toEntry(await readOrThrow(repository, id));
      });
      return result;
    },

    /**
     * `DELETE /api/condition-codes/{id}?version=`: deleting an entry is allowed (2.2, REQ-022);
     * `409 version_conflict` if the version read differs.
     */
    async delete(id: number, version: number): Promise<void> {
      await uow.run(async (tx) => {
        const { repository, audit } = inAction(tx);
        const current = await readOrThrow(repository, id);
        if (current.version !== version) throw new ConflictError('version_conflict');
        const readable = await readableOf(repository, valuesOf(current));
        await repository.delete(id);
        await audit.write({
          objectType: 'condition_code',
          objectId: id,
          objectLabel: objectLabel(current.code, readable.supplierName),
          action: 'deleted',
          oldValue: readable.fields,
          newValue: null,
        });
      });
    },
  };
}

export type ConditionCodeService = ReturnType<typeof createConditionCodeService>;
