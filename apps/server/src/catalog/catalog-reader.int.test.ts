import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  insertDeviceType,
  insertManufacturer,
  insertModelTemplate,
} from '../../test/model-templates.ts';
import { type Database, openDatabase } from '../db/database.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { createCatalogReader } from './catalog-reader.ts';

let root: string;
let database: Database<DB>;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'resellr-catalog-reader-'));
  database = openDatabase<DB>(join(root, 'resellr.db'));
  await runMigrations(database, [initialSchema], () => new Date());
});

afterEach(async () => {
  await database.close();
  rmSync(root, { recursive: true, force: true });
});

describe('catalog reader (CU-108, Technical Specification 2.1, Nachtrag MAR-879)', () => {
  it('lists only the model templates of the given device type, by id ascending', async () => {
    const { sqlite } = database;
    const notebook = insertDeviceType(sqlite, 'Notebook');
    const monitor = insertDeviceType(sqlite, 'Monitor');
    const apple = insertManufacturer(sqlite, 'Apple');
    const air = insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: apple,
      modelName: 'MacBook Air M2',
      mpn: null,
      createdAt: '2026-11-10T09:00:00.000Z',
    });
    insertModelTemplate(sqlite, {
      deviceTypeId: monitor,
      manufacturerId: apple,
      modelName: 'Studio Display',
      mpn: null,
    });
    const pro = insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: apple,
      modelName: 'MacBook Pro 13',
      mpn: null,
      createdAt: '2026-11-10T08:00:00.000Z',
    });

    const templates = await createCatalogReader(database.db).listModelTemplatesOfDeviceType(
      notebook,
    );

    expect(templates).toEqual([
      { id: air, modelName: 'MacBook Air M2' },
      { id: pro, modelName: 'MacBook Pro 13' },
    ]);
  });

  it('lists nothing for a device type without model templates', async () => {
    const tablet = insertDeviceType(database.sqlite, 'Tablet');

    await expect(
      createCatalogReader(database.db).listModelTemplatesOfDeviceType(tablet),
    ).resolves.toEqual([]);
  });

  it('finds a model template with its device type; undefined for an unknown id', async () => {
    const { sqlite } = database;
    const notebook = insertDeviceType(sqlite, 'Notebook');
    const apple = insertManufacturer(sqlite, 'Apple');
    const air = insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: apple,
      modelName: 'MacBook Air M2',
      mpn: null,
    });
    const reader = createCatalogReader(database.db);

    await expect(reader.findModelTemplate(air)).resolves.toEqual({
      id: air,
      deviceTypeId: notebook,
      modelName: 'MacBook Air M2',
    });
    await expect(reader.findModelTemplate(999)).resolves.toBeUndefined();
  });
});
