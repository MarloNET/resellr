import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAppMetaRepository, type AppMetaKey } from './app-meta-repository.ts';
import { openDatabase, type Database } from './database.ts';
import { runMigrations } from './migrator.ts';
import { migrations } from './migrations/index.ts';
import type { DB } from './schema.ts';
import { createUnitOfWork } from './unit-of-work.ts';

const KEYS: AppMetaKey[] = ['data_folder_stamp', 'engine_version', 'app_version'];

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-app-meta-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, migrations, () => new Date('2026-11-10T08:00:00.000Z'));
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('app meta repository (CU-285)', () => {
  it.each(KEYS)('E7 reads null for %s before it is written', async (key) => {
    const repository = createAppMetaRepository(database.db);
    await expect(repository.get(key)).resolves.toBeNull();
  });

  it.each(KEYS)('E7 writes and reads %s', async (key) => {
    const repository = createAppMetaRepository(database.db);
    await repository.set(key, 'first');
    await expect(repository.get(key)).resolves.toBe('first');
  });

  it.each(KEYS)('E7 overwrites an existing %s', async (key) => {
    const repository = createAppMetaRepository(database.db);
    await repository.set(key, 'first');
    await repository.set(key, 'second');
    await expect(repository.get(key)).resolves.toBe('second');
    const rows = database.sqlite.prepare('SELECT value FROM app_meta WHERE key = ?').all(key);
    expect(rows).toEqual([{ value: 'second' }]);
  });

  it('E7 keeps the values apart and leaves created_at untouched', async () => {
    const repository = createAppMetaRepository(database.db);
    const createdAt = database.sqlite
      .prepare("SELECT value FROM app_meta WHERE key = 'created_at'")
      .pluck()
      .get();
    await repository.set('data_folder_stamp', 'stamp-1');
    await repository.set('engine_version', '3');
    await repository.set('app_version', '0.1.0');

    expect(await repository.get('data_folder_stamp')).toBe('stamp-1');
    expect(await repository.get('engine_version')).toBe('3');
    expect(await repository.get('app_version')).toBe('0.1.0');
    expect(
      database.sqlite.prepare("SELECT value FROM app_meta WHERE key = 'created_at'").pluck().get(),
    ).toBe(createdAt);
  });

  it('E7 works with tx.db inside an action and writes nothing when the action fails', async () => {
    const uow = createUnitOfWork(database.db);
    await uow.run(async (tx) => {
      await createAppMetaRepository(tx.db).set('engine_version', '1');
    });
    const failing = uow.run(async (tx) => {
      await createAppMetaRepository(tx.db).set('engine_version', '2');
      throw new Error('later step failed');
    });

    await expect(failing).rejects.toThrow('later step failed');
    await expect(createAppMetaRepository(database.db).get('engine_version')).resolves.toBe('1');
  });
});
