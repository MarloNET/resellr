import { sql, type Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';

/** The JSON columns holding attribute values by attribute id (Technical Specification 3.4). */
const VALUE_COLUMNS = [
  ['model_template', 'model_values'],
  ['model_template', 'default_device_values'],
  ['device', 'device_values'],
  ['listing', 'variant_values'],
  ['listing', 'other_device_values'],
] as const;

/**
 * True for a row of `attribute` with at least one stored value: a key that is missing is no
 * value (3.4); `false`, `0` and lists are values.
 */
const storedValueExists = sql<boolean>`(${sql.join(
  VALUE_COLUMNS.map(
    ([table, column]) =>
      sql`EXISTS (SELECT 1 FROM ${sql.table(table)} WHERE json_extract(${sql.ref(
        `${table}.${column}`,
      )}, '$."' || attribute.id || '"') IS NOT NULL)`,
  ),
  sql` OR `,
)})`;

/**
 * Attribute usage (CU-074, REQ-005; Technical Specification 2.1): whether values of an attribute
 * are stored in model templates, devices or model listings. Data type and level are locked from
 * the first stored value on (AC-REQ-005-04, AC-REQ-005-08). The only place that reads the tables
 * of other modules directly (4.1). Inside an action pass `tx.db`, outside of one the outer `db`.
 */
export function createAttributeUsageQuery(db: Kysely<DB>) {
  return {
    /** Ids of the attributes of a device type with stored values (`hasValues`). */
    async attributeIdsWithValues(deviceTypeId: number): Promise<Set<number>> {
      const rows = await db
        .selectFrom('attribute')
        .select('id')
        .where('device_type_id', '=', deviceTypeId)
        .where(storedValueExists)
        .execute();
      return new Set(rows.map((row) => row.id));
    },

    /** `hasValues` of one attribute. */
    async hasValues(attributeId: number): Promise<boolean> {
      const row = await db
        .selectFrom('attribute')
        .select('id')
        .where('id', '=', attributeId)
        .where(storedValueExists)
        .executeTakeFirst();
      return row !== undefined;
    },
  };
}
