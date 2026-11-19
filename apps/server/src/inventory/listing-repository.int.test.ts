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
import { createListingRepository } from './listing-repository.ts';

const STAMP = '2026-11-15T09:00:00.000Z';
const USED = 1;

let root: string;
let database: Database<DB>;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'resellr-listing-'));
  database = openDatabase<DB>(join(root, 'resellr.db'));
  await runMigrations(database, [initialSchema], () => new Date());
  insertPickLists(database.sqlite);
  database.sqlite
    .prepare(
      "INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version) VALUES (?, ?, 'gebraucht', 'gebraucht', 1, 1, 1)",
    )
    .run(USED, pickListId('condition'));
});

afterEach(async () => {
  await database.close();
  rmSync(root, { recursive: true, force: true });
});

/** Model listings get their service in S4 (Technical Specification 4.4); until then tests insert them. */
function insertListing(modelTemplateId: number, articleNumber: string): number {
  const { lastInsertRowid } = database.sqlite
    .prepare(
      `INSERT INTO listing (model_template_id, condition_value_id, visual_grade,
         condition_description, condition_description_key, variant_values, other_device_values,
         article_number, article_number_key, ean_mode, display_title, quantity, stock_json,
         stock_hash, version, created_at, updated_at)
       VALUES (?, ?, 2, '', '', '{"1":16}', '{"2":"silber"}', ?, ?, 'original', ?, 1, '{}', '', 1, ?, ?)`,
    )
    .run(
      modelTemplateId,
      USED,
      articleNumber,
      articleNumber.toLowerCase(),
      `Listing ${articleNumber}`,
      STAMP,
      STAMP,
    );
  return Number(lastInsertRowid);
}

describe('listing repository (CU-125, Technical Specification 2.1, Nachtrag MAR-879)', () => {
  it('listVariantData([]) is [] without a query', async () => {
    await expect(createListingRepository(database.db).listVariantData([])).resolves.toEqual([]);
  });

  it('listVariantData lists the variant data of the given model templates by template and id', async () => {
    const { sqlite } = database;
    const notebook = insertDeviceType(sqlite, 'Notebook');
    const apple = insertManufacturer(sqlite, 'Apple');
    const template = (modelName: string) =>
      insertModelTemplate(sqlite, {
        deviceTypeId: notebook,
        manufacturerId: apple,
        modelName,
        mpn: null,
      });
    const air = template('MacBook Air M2');
    const pro = template('MacBook Pro 13');
    const other = template('MacBook Pro 16');
    const pro1 = insertListing(pro, '626201');
    const air1 = insertListing(air, '626198');
    insertListing(other, '626300');
    const air2 = insertListing(air, '626199');

    const rows = await createListingRepository(database.db).listVariantData([pro, air]);

    expect(rows.map((row) => [row.model_template_id, row.id])).toEqual([
      [air, air1],
      [air, air2],
      [pro, pro1],
    ]);
    expect(rows[0]).toEqual({
      id: air1,
      model_template_id: air,
      condition_value_id: USED,
      visual_grade: 2,
      condition_description: '',
      variant_values: '{"1":16}',
      other_device_values: '{"2":"silber"}',
      display_title: 'Listing 626198',
      article_number: '626198',
      quantity: 1,
    });
  });

  it('listTitles([]) is [] without a query', async () => {
    await expect(createListingRepository(database.db).listTitles([])).resolves.toEqual([]);
  });

  it('listTitles lists the display titles of the given model listings by id', async () => {
    const { sqlite } = database;
    const notebook = insertDeviceType(sqlite, 'Notebook');
    const apple = insertManufacturer(sqlite, 'Apple');
    const air = insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: apple,
      modelName: 'MacBook Air M2',
      mpn: null,
    });
    const first = insertListing(air, '626198');
    insertListing(air, '626199');
    const third = insertListing(air, '626200');

    await expect(
      createListingRepository(database.db).listTitles([third, first, 999]),
    ).resolves.toEqual([
      { id: first, display_title: 'Listing 626198' },
      { id: third, display_title: 'Listing 626200' },
    ]);
  });
});
