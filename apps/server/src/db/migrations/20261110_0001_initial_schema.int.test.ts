import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type Database } from '../database.ts';
import { runMigrations } from '../migrator.ts';
import type { DB } from '../schema.ts';
import { migrations } from './index.ts';

const MIGRATED_AT = new Date('2026-11-10T08:00:00.000Z');

/** The 29 tables of Technical Specification 3.1 to 3.3. */
const DOMAIN_TABLES = [
  // 3.1
  'merchant_profile',
  'device_type',
  'attribute',
  'pick_list',
  'pick_list_value',
  'manufacturer',
  'supplier',
  'condition_code',
  'text_block',
  'text_block_device_type',
  'text_block_channel',
  'datasheet_layout',
  'media_file',
  // 3.2
  'channel',
  'price_rule',
  'title_pattern',
  'description_template',
  'condition_mapping',
  'category_mapping',
  'attribute_mapping',
  // 3.3
  'model_template',
  'device',
  'listing',
  'listing_delivery_scope',
  'listing_price',
  'listing_photo',
  'channel_content',
  'audit_entry',
  'app_meta',
];

interface ExpectedIndex {
  table: string;
  /** Key columns; an expression is given as written in the index. */
  columns: string[];
  unique: boolean;
  where?: string;
}

/** The indexes of Technical Specification 3.7. */
const INDEXES: ExpectedIndex[] = [
  { table: 'device', columns: ['wi_nr_key'], unique: true, where: "stock_status <> 'cancelled'" },
  { table: 'device', columns: ['wi_nr_key'], unique: false },
  { table: 'device', columns: ['listing_id', 'stock_status'], unique: false },
  { table: 'device', columns: ['stock_status', 'listing_id', 'captured_at'], unique: false },
  { table: 'model_template', columns: ['manufacturer_id', 'model_name_key'], unique: false },
  { table: 'model_template', columns: ['device_type_id'], unique: false },
  { table: 'model_template', columns: ['search_key'], unique: false },
  { table: 'listing', columns: ['article_number_key'], unique: true },
  { table: 'listing', columns: ['model_template_id'], unique: false },
  { table: 'listing', columns: ['updated_at'], unique: false },
  { table: 'channel_content', columns: ['listing_id', 'channel_id'], unique: true },
  { table: 'channel_content', columns: ['status'], unique: false },
  { table: 'channel_content', columns: ['flag_changed_since_release'], unique: false },
  { table: 'channel_content', columns: ['flag_transfer_change'], unique: false },
  { table: 'channel_content', columns: ['flag_adjust_stock'], unique: false },
  { table: 'listing_photo', columns: ['listing_id', 'position'], unique: false },
  { table: 'listing_photo', columns: ['file_hash'], unique: false },
  { table: 'condition_code', columns: ['code_key', 'IFNULL(supplier_id, 0)'], unique: true },
  { table: 'title_pattern', columns: ['device_type_id', 'IFNULL(channel_id, 0)'], unique: true },
  {
    table: 'condition_mapping',
    columns: ['channel_id', 'condition_value_id', 'IFNULL(visual_grade, 0)'],
    unique: true,
  },
  { table: 'category_mapping', columns: ['device_type_id', 'channel_id'], unique: true },
  { table: 'attribute_mapping', columns: ['channel_id', 'device_type_id'], unique: true },
  { table: 'attribute', columns: ['device_type_id', 'label_key'], unique: true },
  { table: 'pick_list_value', columns: ['pick_list_id', 'label_key'], unique: true },
  { table: 'audit_entry', columns: ['occurred_at'], unique: false },
  { table: 'audit_entry', columns: ['object_category', 'occurred_at'], unique: false },
  { table: 'audit_entry', columns: ['object_type', 'occurred_at'], unique: false },
];

interface IndexListRow {
  name: string;
  unique: 0 | 1;
  partial: 0 | 1;
}
interface IndexColumnRow {
  name: string | null;
  key: 0 | 1;
}

let dir: string;
let database: Database<DB>;

const tableNames = () =>
  database.sqlite
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .pluck()
    .all() as string[];

/** Index definitions of a table in the form of `ExpectedIndex`, without automatic indexes. */
function indexesOf(table: string): ExpectedIndex[] {
  const list = database.sqlite.pragma(`index_list(${table})`) as IndexListRow[];
  return list
    .filter((index) => !index.name.startsWith('sqlite_autoindex_'))
    .map((index) => {
      const sqlText = database.sqlite
        .prepare("SELECT sql FROM sqlite_schema WHERE type = 'index' AND name = ?")
        .pluck()
        .get(index.name) as string;
      const keyColumns = (database.sqlite.pragma(`index_xinfo(${index.name})`) as IndexColumnRow[])
        .filter((column) => column.key === 1)
        .map((column) => column.name);
      // An expression column has no name; take it from the column list of the statement.
      const written = /\((.*)\)(?:\s+WHERE|$)/s.exec(sqlText)?.[1] ?? '';
      const parts = splitTopLevel(written);
      return {
        table,
        columns: keyColumns.map((name, i) => name ?? parts[i] ?? '?'),
        unique: index.unique === 1,
        ...(index.partial === 1 ? { where: /\sWHERE\s+(.*)$/s.exec(sqlText)?.[1]?.trim() } : {}),
      };
    });
}

function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-schema-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  // E8: exactly the static list of CU-308, as the startup sequence passes it to CU-029.
  await runMigrations(database, migrations, () => MIGRATED_AT);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('migration list (CU-308)', () => {
  it('E8 contains the initial schema and the seed migration in this order', () => {
    expect(migrations.map((migration) => migration.name)).toEqual([
      '20261110_0001_initial_schema',
      '20261110_0002_seed_initial_settings',
    ]);
  });

  it('E8 the migration run applies exactly this list and records it in app_migration', () => {
    const rows = database.sqlite.prepare('SELECT name, applied_at FROM app_migration').all();
    expect(rows).toEqual([
      { name: '20261110_0001_initial_schema', applied_at: MIGRATED_AT.toISOString() },
      { name: '20261110_0002_seed_initial_settings', applied_at: MIGRATED_AT.toISOString() },
    ]);
  });

  it('E8 a second run with the same list applies nothing', async () => {
    await expect(runMigrations(database, migrations, () => MIGRATED_AT)).resolves.toEqual([]);
  });
});

describe('initial migration 20261110_0001_initial_schema (CU-030)', () => {
  it('E1 creates the 29 domain tables of 3.1 to 3.3 and app_migration, nothing else', () => {
    expect(DOMAIN_TABLES).toHaveLength(29);
    expect(tableNames()).toEqual([...DOMAIN_TABLES, 'app_migration'].toSorted());
  });

  it('E1 creates the indexes of 3.7', () => {
    const actual = DOMAIN_TABLES.flatMap(indexesOf);
    expect(actual).toHaveLength(INDEXES.length);
    expect(actual).toEqual(expect.arrayContaining(INDEXES));
  });

  it('E1 sets app_meta.created_at to the time of the migration as ISO 8601 UTC', () => {
    const rows = database.sqlite.prepare('SELECT key, value FROM app_meta').all() as {
      key: string;
      value: string;
    }[];
    expect(rows.map((row) => row.key)).toEqual(['created_at']);
    const createdAt = rows[0]?.value ?? '';
    expect(createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Math.abs(Date.parse(createdAt) - Date.now())).toBeLessThan(60_000);
  });

  it('E2 foreign_key_check and quick_check report no findings', () => {
    expect(database.sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(database.sqlite.pragma('quick_check')).toEqual([{ quick_check: 'ok' }]);
  });

  it('E2 leaves foreign_keys switched on after the run', () => {
    expect(database.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});
