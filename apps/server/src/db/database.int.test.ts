import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type Database } from './database.ts';

let dir: string;
let database: Database<unknown> | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-db-'));
});

afterEach(async () => {
  await database?.close();
  database = undefined;
  rmSync(dir, { recursive: true, force: true });
});

describe('database access (CU-027)', () => {
  it('E1 sets journal_mode WAL, synchronous FULL, busy_timeout 5000 and foreign_keys ON', () => {
    database = openDatabase(join(dir, 'resellr.db'));
    const pragma = (name: string) => database?.sqlite.pragma(name, { simple: true });

    expect(pragma('journal_mode')).toBe('wal');
    expect(pragma('synchronous')).toBe(2); // FULL
    expect(pragma('busy_timeout')).toBe(5000);
    expect(pragma('foreign_keys')).toBe(1);
  });

  it('E1 keeps WAL in the file when it is opened again', async () => {
    const file = join(dir, 'resellr.db');
    await openDatabase(file).close();

    database = openDatabase(file);

    expect(database.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
  });

  it('runs Kysely queries on the same connection', async () => {
    database = openDatabase(join(dir, 'resellr.db'));
    database.sqlite.exec('CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');

    await sql`INSERT INTO item (name) VALUES (${'Laptop'})`.execute(database.db);

    expect(database.sqlite.prepare('SELECT name FROM item').pluck().all()).toEqual(['Laptop']);
  });

  it('closes the connection', async () => {
    database = openDatabase(join(dir, 'resellr.db'));
    const { sqlite } = database;

    await database.close();
    database = undefined;

    expect(sqlite.open).toBe(false);
  });

  it('checkpoint moves the WAL into the database file and empties the WAL (2.17 step 4)', async () => {
    const file = join(dir, 'resellr.db');
    database = openDatabase(file);
    database.sqlite.exec('CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    await sql`INSERT INTO item (name) VALUES (${'Laptop'})`.execute(database.db);
    expect(statSync(`${file}-wal`).size).toBeGreaterThan(0);

    database.checkpoint();

    expect(statSync(`${file}-wal`).size).toBe(0);
  });

  it('checkpoint throws when SQLite reports busy, e.g. while another connection reads', () => {
    const file = join(dir, 'resellr.db');
    database = openDatabase(file);
    database.sqlite.exec('CREATE TABLE item (id INTEGER PRIMARY KEY)');
    database.sqlite.exec('INSERT INTO item DEFAULT VALUES');
    database.sqlite.pragma('busy_timeout = 0');
    const reader = new BetterSqlite3(file);
    try {
      reader.exec('BEGIN');
      reader.prepare('SELECT count(*) FROM item').get();

      expect(() => database?.checkpoint()).toThrow(/busy/);
    } finally {
      reader.close();
    }
  });

  it('closeConnection leaves only the database file; reopen makes the same Kysely instance work again', async () => {
    const file = join(dir, 'resellr.db');
    database = openDatabase(file);
    database.sqlite.exec('CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    await sql`INSERT INTO item (name) VALUES (${'Laptop'})`.execute(database.db);
    const { db } = database;

    database.closeConnection();

    expect(database.sqlite.open).toBe(false);
    expect(readdirSync(dir)).toEqual(['resellr.db']);
    await expect(sql`SELECT 1`.execute(db)).rejects.toThrow();

    database.reopen();

    const { rows } = await sql<{ name: string }>`SELECT name FROM item`.execute(db);
    expect(rows).toEqual([{ name: 'Laptop' }]);
    expect(database.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(database.sqlite.pragma('synchronous', { simple: true })).toBe(2);
    expect(database.sqlite.pragma('busy_timeout', { simple: true })).toBe(5000);
    expect(database.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('close after closeConnection does not throw', async () => {
    database = openDatabase(join(dir, 'resellr.db'));
    database.closeConnection();

    await database.close();
    database = undefined;
  });
});
