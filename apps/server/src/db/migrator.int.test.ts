import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type Database } from './database.ts';
import { MigrationError, runMigrations, type Migration } from './migrator.ts';

// Test migrations only; they are not shipped. The real migration 0001 follows with #111.

const now = () => new Date('2026-11-09T10:00:00.000Z');

/** `listing` and the tables that refer to it with `ON DELETE CASCADE` (3.3, 6.2 (a)). */
const listingSchema: Migration = {
  name: '20261101_0001_test_listing_schema',
  async up(db) {
    await sql`CREATE TABLE channel (id INTEGER PRIMARY KEY, code TEXT NOT NULL)`.execute(db);
    await sql`CREATE TABLE listing (id INTEGER PRIMARY KEY, title TEXT NOT NULL)`.execute(db);
    for (const table of ['listing_price', 'listing_photo', 'listing_delivery_scope']) {
      await sql`CREATE TABLE ${sql.table(table)} (
        id INTEGER PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES listing (id) ON DELETE CASCADE
      )`.execute(db);
    }
    await sql`CREATE TABLE channel_content (
      id INTEGER PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
      channel_id INTEGER NOT NULL REFERENCES channel (id) ON DELETE RESTRICT
    )`.execute(db);
  },
};

const failingSecond: Migration = {
  name: '20261101_0002_test_failing',
  async up(db) {
    await sql`CREATE TABLE half_done (id INTEGER PRIMARY KEY)`.execute(db);
    await sql`ALTER TABLE listing ADD COLUMN subtitle TEXT`.execute(db);
    await sql`INSERT INTO no_such_table (id) VALUES (1)`.execute(db);
  },
};

/** SQLite rebuild of `listing`: new table, copy, `DROP TABLE`, rename (3.8, FIND-228). */
const rebuildListing: Migration = {
  name: '20261101_0002_test_rebuild_listing',
  async up(db) {
    await sql`CREATE TABLE listing_new (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    )`.execute(db);
    await sql`INSERT INTO listing_new (id, title) SELECT id, title FROM listing`.execute(db);
    await sql`DROP TABLE listing`.execute(db);
    await sql`ALTER TABLE listing_new RENAME TO listing`.execute(db);
  },
};

const brokenForeignKey: Migration = {
  name: '20261101_0002_test_broken_foreign_key',
  async up(db) {
    await sql`INSERT INTO listing_price (id, listing_id) VALUES (99, 4711)`.execute(db);
  },
};

let dir: string;
let database: Database<unknown>;

const pragma = (name: string) => database.sqlite.pragma(name, { simple: true });
const all = (query: string) => database.sqlite.prepare(query).all();
const schemaSnapshot = () =>
  all("SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
const migrationRows = () => all('SELECT name, applied_at FROM app_migration ORDER BY name');

const DEPENDENT_TABLES = [
  'listing_price',
  'listing_photo',
  'listing_delivery_scope',
  'channel_content',
] as const;

function seedListingWithDependents() {
  database.sqlite.exec(`
    INSERT INTO channel (id, code) VALUES (1, 'shop');
    INSERT INTO listing (id, title) VALUES (1, 'ThinkPad T14'), (2, 'EliteBook 840');
    INSERT INTO listing_price (id, listing_id) VALUES (1, 1), (2, 2);
    INSERT INTO listing_photo (id, listing_id) VALUES (1, 1), (2, 1), (3, 2);
    INSERT INTO listing_delivery_scope (id, listing_id) VALUES (1, 1);
    INSERT INTO channel_content (id, listing_id, channel_id) VALUES (1, 1, 1), (2, 2, 1);
  `);
}

const dependentRows = () =>
  Object.fromEntries(
    DEPENDENT_TABLES.map((table) => [table, all(`SELECT * FROM ${table} ORDER BY id`)]),
  );

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-migrator-'));
  database = openDatabase(join(dir, 'resellr.db'));
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('migration run (CU-029)', () => {
  it('applies pending migrations in name order and records them in app_migration', async () => {
    const second: Migration = {
      name: '20261101_0002_test_second',
      async up(db) {
        await sql`ALTER TABLE listing ADD COLUMN subtitle TEXT`.execute(db);
      },
    };

    const applied = await runMigrations(database, [second, listingSchema], now);

    expect(applied).toEqual([listingSchema.name, second.name]);
    expect(migrationRows()).toEqual([
      { name: listingSchema.name, applied_at: '2026-11-09T10:00:00.000Z' },
      { name: second.name, applied_at: '2026-11-09T10:00:00.000Z' },
    ]);
    expect(pragma('foreign_keys')).toBe(1);
  });

  it('runs only the migrations that are not yet applied', async () => {
    await runMigrations(database, [listingSchema], now);
    let runs = 0;
    const second: Migration = {
      name: '20261101_0002_test_second',
      async up() {
        runs += 1;
      },
    };

    expect(await runMigrations(database, [listingSchema, second], now)).toEqual([second.name]);
    expect(await runMigrations(database, [listingSchema, second], now)).toEqual([]);
    expect(runs).toBe(1);
  });

  it('switches foreign_keys off during the run, inside one transaction', async () => {
    const seen: unknown[] = [];
    const probe: Migration = {
      name: '20261101_0001_test_probe',
      async up() {
        seen.push(pragma('foreign_keys'), database.sqlite.inTransaction);
      },
    };

    await runMigrations(database, [probe], now);

    expect(seen).toEqual([0, true]);
    expect(pragma('foreign_keys')).toBe(1);
  });

  it('E2 leaves schema and app_migration unchanged after a failing second migration', async () => {
    await runMigrations(database, [listingSchema], now);
    const schemaBefore = schemaSnapshot();
    const migrationsBefore = migrationRows();

    const run = runMigrations(database, [listingSchema, failingSecond], now);

    await expect(run).rejects.toThrow(MigrationError);
    await expect(run).rejects.toMatchObject({ migration: failingSecond.name });
    expect(schemaSnapshot()).toEqual(schemaBefore);
    expect(migrationRows()).toEqual(migrationsBefore);
    expect(database.sqlite.inTransaction).toBe(false);
    expect(pragma('foreign_keys')).toBe(1);
  });

  it('E2 rolls back every migration of the run, also the ones before the failing one', async () => {
    const run = runMigrations(database, [listingSchema, failingSecond], now);

    await expect(run).rejects.toThrow(MigrationError);
    expect(schemaSnapshot()).toEqual([]);
    expect(pragma('foreign_keys')).toBe(1);
  });

  it('E3 keeps the rows of all dependent tables when listing is rebuilt', async () => {
    await runMigrations(database, [listingSchema], now);
    seedListingWithDependents();
    const before = dependentRows();

    await runMigrations(database, [listingSchema, rebuildListing], now);

    expect(dependentRows()).toEqual(before);
    expect(before.listing_photo).toHaveLength(3);
    expect(all('SELECT id, title, note FROM listing ORDER BY id')).toEqual([
      { id: 1, title: 'ThinkPad T14', note: '' },
      { id: 2, title: 'EliteBook 840', note: '' },
    ]);
    expect(all('PRAGMA foreign_key_check')).toEqual([]);
    expect(pragma('foreign_keys')).toBe(1);
  });

  it('E3 the same rebuild with foreign_keys ON would cascade (control)', async () => {
    await runMigrations(database, [listingSchema], now);
    seedListingWithDependents();

    await database.db.connection().execute((db) => rebuildListing.up(db));

    expect(all('SELECT * FROM listing_price')).toEqual([]);
  });

  it('E4 rolls back a migration that leaves a violated foreign key', async () => {
    await runMigrations(database, [listingSchema], now);
    seedListingWithDependents();
    const migrationsBefore = migrationRows();

    const run = runMigrations(database, [listingSchema, brokenForeignKey], now);

    await expect(run).rejects.toThrow(MigrationError);
    await expect(run).rejects.toMatchObject({
      migration: null,
      foreignKeyViolations: [
        expect.objectContaining({ table: 'listing_price', parent: 'listing' }),
      ],
    });
    expect(all('SELECT id FROM listing_price ORDER BY id')).toEqual([{ id: 1 }, { id: 2 }]);
    expect(migrationRows()).toEqual(migrationsBefore);
    expect(pragma('foreign_keys')).toBe(1);
  });

  it('E5 leaves foreign_keys ON and does not touch it without a pending migration', async () => {
    await runMigrations(database, [listingSchema], now);
    const statements: string[] = [];
    const pragmaSpy = database.sqlite.pragma.bind(database.sqlite);
    database.sqlite.pragma = ((source: string, options?: object) => {
      statements.push(source);
      return pragmaSpy(source, options);
    }) as typeof database.sqlite.pragma;

    expect(await runMigrations(database, [listingSchema], now)).toEqual([]);

    expect(statements).toEqual([]);
    expect(pragma('foreign_keys')).toBe(1);
  });

  it('E5 creates no app_migration table when there is nothing to migrate', async () => {
    expect(await runMigrations(database, [], now)).toEqual([]);

    expect(schemaSnapshot()).toEqual([]);
    expect(pragma('foreign_keys')).toBe(1);
  });
});
