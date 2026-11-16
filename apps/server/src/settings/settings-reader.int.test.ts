import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertDeviceType, insertManufacturer } from '../../test/model-templates.ts';
import { type Database, openDatabase } from '../db/database.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { createSettingsReader } from './settings-reader.ts';

let root: string;
let database: Database<DB>;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'resellr-settings-reader-'));
  database = openDatabase<DB>(join(root, 'resellr.db'));
  await runMigrations(database, [initialSchema], () => new Date());
});

afterEach(async () => {
  await database.close();
  rmSync(root, { recursive: true, force: true });
});

describe('settings reader (CU-086, Technical Specification 2.0.11, Nachtrag MAR-904)', () => {
  it('finds a device type with name and status, active or not', async () => {
    const { sqlite } = database;
    const notebook = insertDeviceType(sqlite, 'Notebook');
    const monitor = insertDeviceType(sqlite, 'Monitor');
    sqlite.prepare('UPDATE device_type SET active = 0 WHERE id = ?').run(monitor);
    const reader = createSettingsReader(database.db);

    await expect(reader.findDeviceType(notebook)).resolves.toEqual({
      id: notebook,
      name: 'Notebook',
      active: true,
    });
    await expect(reader.findDeviceType(monitor)).resolves.toEqual({
      id: monitor,
      name: 'Monitor',
      active: false,
    });
  });

  it('finds a manufacturer with name and status, active or not', async () => {
    const { sqlite } = database;
    const lenovo = insertManufacturer(sqlite, 'Lenovo');
    const fujitsu = insertManufacturer(sqlite, 'Fujitsu');
    sqlite.prepare('UPDATE manufacturer SET active = 0 WHERE id = ?').run(fujitsu);
    const reader = createSettingsReader(database.db);

    await expect(reader.findManufacturer(lenovo)).resolves.toEqual({
      id: lenovo,
      name: 'Lenovo',
      active: true,
    });
    await expect(reader.findManufacturer(fujitsu)).resolves.toEqual({
      id: fujitsu,
      name: 'Fujitsu',
      active: false,
    });
  });

  it('returns undefined for an unknown id', async () => {
    const reader = createSettingsReader(database.db);

    await expect(reader.findDeviceType(999)).resolves.toBeUndefined();
    await expect(reader.findManufacturer(999)).resolves.toBeUndefined();
  });
});
