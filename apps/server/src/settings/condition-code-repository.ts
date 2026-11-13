import type { Kysely, Selectable } from 'kysely';

import type { ConditionCodeTable, DB } from '../db/schema.ts';

export type ConditionCodeRow = Selectable<ConditionCodeTable>;

/** Fields of an entry as stored; `null` = without supplier or suggestion. */
export interface ConditionCodeValues {
  code: string;
  codeKey: string;
  supplierId: number | null;
  plainText: string;
  suggestedConditionValueId: number | null;
  suggestedVisualGrade: number | null;
}

export interface ConditionCodeListQuery {
  limit: number;
  offset: number;
}

/**
 * Queries on `condition_code` (CU-302, FIND-223). Inside an action pass `tx.db`, outside of one
 * the outer `db` (2.0.4, MAR-263).
 */
export function createConditionCodeRepository(db: Kysely<DB>) {
  return {
    /**
     * Entries by code (case-insensitive key), the entry without supplier first, then the
     * supplier entries in the order of creation; with the total.
     */
    async list({ limit, offset }: ConditionCodeListQuery) {
      const rows = await db
        .selectFrom('condition_code')
        .selectAll()
        .orderBy('code_key')
        .orderBy((eb) => eb.fn.coalesce('supplier_id', eb.lit(0)))
        .orderBy('id')
        .limit(limit)
        .offset(offset)
        .execute();
      const { total } = await db
        .selectFrom('condition_code')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .executeTakeFirstOrThrow();
      return { rows, total };
    },

    async findById(id: number): Promise<ConditionCodeRow | undefined> {
      return db.selectFrom('condition_code').selectAll().where('id', '=', id).executeTakeFirst();
    },

    /**
     * The entry with this code key and supplier, if any: the uniqueness of
     * (code_key, IFNULL(supplier_id, 0)) (3.1, AC-REQ-022-02).
     */
    async findIdByKey(codeKey: string, supplierId: number | null): Promise<number | undefined> {
      const row = await db
        .selectFrom('condition_code')
        .select('id')
        .where('code_key', '=', codeKey)
        .where('supplier_id', supplierId === null ? 'is' : '=', supplierId)
        .executeTakeFirst();
      return row?.id;
    },

    /**
     * The entry for a code: the one of the supplier before the one without supplier (2.2
     * "Auflösen eines Codes", REQ-015).
     */
    async resolve(codeKey: string, supplierId: number | null) {
      return db
        .selectFrom('condition_code')
        .selectAll()
        .where('code_key', '=', codeKey)
        .where((eb) =>
          supplierId === null
            ? eb('supplier_id', 'is', null)
            : eb.or([eb('supplier_id', 'is', null), eb('supplier_id', '=', supplierId)]),
        )
        .orderBy((eb) => eb.fn.coalesce('supplier_id', eb.lit(0)), 'desc')
        .executeTakeFirst();
    },

    /** Name of the supplier (active or deactivated); `undefined` if there is none. */
    async supplierName(supplierId: number): Promise<string | undefined> {
      const row = await db
        .selectFrom('supplier')
        .select('name')
        .where('id', '=', supplierId)
        .executeTakeFirst();
      return row?.name;
    },

    /**
     * Label of the value if it belongs to the list `condition` (3.1); `undefined` for any other
     * id.
     */
    async conditionValueLabel(valueId: number): Promise<string | undefined> {
      const row = await db
        .selectFrom('pick_list_value')
        .innerJoin('pick_list', 'pick_list.id', 'pick_list_value.pick_list_id')
        .select('pick_list_value.label')
        .where('pick_list_value.id', '=', valueId)
        .where('pick_list.key', '=', 'condition')
        .executeTakeFirst();
      return row?.label;
    },

    /** Inserts an entry; returns its id. */
    async insert(values: ConditionCodeValues, at: string): Promise<number> {
      const { id } = await db
        .insertInto('condition_code')
        .values({ ...toColumns(values), version: 1, created_at: at, updated_at: at })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    /** Stores all fields with the new version. */
    async update(id: number, values: ConditionCodeValues, version: number, at: string) {
      await db
        .updateTable('condition_code')
        .set({ ...toColumns(values), version, updated_at: at })
        .where('id', '=', id)
        .execute();
    },

    async delete(id: number) {
      await db.deleteFrom('condition_code').where('id', '=', id).execute();
    },
  };
}

function toColumns(values: ConditionCodeValues) {
  return {
    code: values.code,
    code_key: values.codeKey,
    supplier_id: values.supplierId,
    plain_text: values.plainText,
    suggested_condition_value_id: values.suggestedConditionValueId,
    suggested_visual_grade: values.suggestedVisualGrade,
  };
}

export type ConditionCodeRepository = ReturnType<typeof createConditionCodeRepository>;
