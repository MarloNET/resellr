import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertPickLists } from '../../test/pick-lists.ts';
import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import type { DB } from '../db/schema.ts';
import { createAttributeUsageQuery } from './attribute-usage-query.ts';
import { insertAttributeValueRecords, type StoredValues } from '../../test/attribute-values.ts';

const NOW = new Date('2026-11-12T09:00:00.000Z');

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-attribute-usage-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  // Schema only: the tests write their own settings; the initial settings have their own
  // tests (CU-071).
  await runMigrations(database, [initialSchema], () => NOW);
  insertPickLists(database.sqlite);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

const STAMP = NOW.toISOString();

/** Device type 1 with the attributes 11 to 13. */
function insertAttributes() {
  const run = (statement: string, ...params: unknown[]) =>
    database.sqlite.prepare(statement).run(...params);
  run(
    'INSERT INTO device_type (id, name, name_key, active, sort_order, version, created_at, updated_at) VALUES (1, ?, ?, 1, 1, 1, ?, ?)',
    'Notebook',
    'notebook',
    STAMP,
    STAMP,
  );
  for (const id of [11, 12, 13]) {
    run(
      `INSERT INTO attribute (id, device_type_id, label, label_key, data_type, unit_spacing,
         level, variant_forming, required, datasheet_block, sort_order, active, version, created_at, updated_at)
       VALUES (?, 1, ?, ?, 'integer', 0, 'device', 0, 0, 'technical', ?, 1, 1, ?, ?)`,
      id,
      `M${id}`,
      `m${id}`,
      id,
      STAMP,
      STAMP,
    );
  }
}

const COLUMNS: (keyof StoredValues)[] = [
  'modelValues',
  'defaultDeviceValues',
  'deviceValues',
  'variantValues',
  'otherDeviceValues',
];

describe('attribute usage query (CU-074, Technical Specification 2.1)', () => {
  it.each(COLUMNS)('finds a value stored in %s', async (column) => {
    insertAttributes();
    insertAttributeValueRecords(database.sqlite, { [column]: { '12': 16 } });
    const usage = createAttributeUsageQuery(database.db);

    expect(await usage.hasValues(12)).toBe(true);
    expect(await usage.hasValues(11)).toBe(false);
    expect([...(await usage.attributeIdsWithValues(1))]).toEqual([12]);
  });

  it('counts false, zero and a list as stored values; a missing key is no value', async () => {
    insertAttributes();
    insertAttributeValueRecords(database.sqlite, {
      modelValues: { '11': false, '13': [{ count: 2, typeId: 41, positionId: null }] },
      deviceValues: { '12': 0 },
    });
    const usage = createAttributeUsageQuery(database.db);

    expect([...(await usage.attributeIdsWithValues(1))].sort()).toEqual([11, 12, 13]);
  });

  it('reports no attribute without records', async () => {
    insertAttributes();
    insertAttributeValueRecords(database.sqlite, {});
    const usage = createAttributeUsageQuery(database.db);

    expect(await usage.attributeIdsWithValues(1)).toEqual(new Set());
    expect(await usage.hasValues(13)).toBe(false);
  });
});
