import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  insertDeviceType,
  insertManufacturer,
  insertModelTemplate,
} from '../../test/model-templates.ts';
import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { type Database, openDatabase } from '../db/database.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { createInventoryReader } from './inventory-reader.ts';

const STAMP = '2026-11-15T09:00:00.000Z';

let root: string;
let database: Database<DB>;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'resellr-inventory-reader-'));
  database = openDatabase<DB>(join(root, 'resellr.db'));
  await runMigrations(database, [initialSchema], () => new Date());
  insertPickLists(database.sqlite);
});

afterEach(async () => {
  await database.close();
  rmSync(root, { recursive: true, force: true });
});

/** A model listing in version 3; model listings of other tests come from the API. */
function insertListing(): number {
  const { sqlite } = database;
  const conditionId = Number(
    sqlite
      .prepare(
        "INSERT INTO pick_list_value (pick_list_id, label, label_key, sort_order, active, version) VALUES (?, 'gebraucht', 'gebraucht', 1, 1, 1)",
      )
      .run(pickListId('condition')).lastInsertRowid,
  );
  const modelTemplateId = insertModelTemplate(sqlite, {
    deviceTypeId: insertDeviceType(sqlite, 'Notebook'),
    manufacturerId: insertManufacturer(sqlite, 'Apple'),
    modelName: 'MacBook Pro 13',
    mpn: null,
  });
  const { lastInsertRowid } = sqlite
    .prepare(
      `INSERT INTO listing (model_template_id, condition_value_id, visual_grade,
         condition_description, condition_description_key, variant_values, other_device_values,
         article_number, article_number_key, ean_mode, display_title, quantity, stock_json,
         stock_hash, version, created_at, updated_at)
       VALUES (?, ?, 2, '', '', '{}', '{}', '626198', '626198', 'original', 'MacBook Pro 13 16 GB',
         1, '{}', '', 3, ?, ?)`,
    )
    .run(modelTemplateId, conditionId, STAMP, STAMP);
  return Number(lastInsertRowid);
}

describe('inventory reader (CU-129, Nachtrag MAR-1280)', () => {
  it('finds a model listing with its display title and version', async () => {
    const id = insertListing();

    await expect(createInventoryReader(database.db).findListing(id)).resolves.toEqual({
      id,
      displayTitle: 'MacBook Pro 13 16 GB',
      version: 3,
    });
  });

  it('answers undefined for an unknown model listing', async () => {
    await expect(createInventoryReader(database.db).findListing(404)).resolves.toBeUndefined();
  });
});
