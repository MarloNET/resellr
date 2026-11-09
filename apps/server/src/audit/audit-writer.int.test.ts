import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork } from '../db/unit-of-work.ts';
import { createAuditWriter, type AuditEntry } from './audit-writer.ts';

const OCCURRED_AT = new Date('2026-11-10T09:15:00.000Z');
const SERVER_SRC = join(import.meta.dirname, '..');

const visualGradeChanged: AuditEntry = {
  occurredAt: OCCURRED_AT,
  objectType: 'device',
  objectId: 7,
  objectLabel: 'Gerät 626198',
  action: 'values_updated',
  oldValue: { 'Optik-Note': 2 },
  newValue: { 'Optik-Note': 4 },
};

let dir: string;
let database: Database<DB>;

const auditRows = () => database.sqlite.prepare('SELECT * FROM audit_entry ORDER BY id').all();
const deviceTypeNames = () =>
  database.sqlite.prepare('SELECT name FROM device_type ORDER BY id').pluck().all();

const insertDeviceType = (db: Database<DB>['db'], name: string) =>
  db
    .insertInto('device_type')
    .values({
      name,
      name_key: name.toLowerCase(),
      active: 1,
      sort_order: 1,
      version: 1,
      created_at: OCCURRED_AT.toISOString(),
      updated_at: OCCURRED_AT.toISOString(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();

/** Server source files except tests, relative to `apps/server/src`. */
function serverSourceFiles(folder = SERVER_SRC): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return serverSourceFiles(path);
    if (!/\.ts$/.test(entry.name) || /\.test\.ts$/.test(entry.name)) return [];
    return [relative(SERVER_SRC, path)];
  });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-audit-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, migrations, () => OCCURRED_AT);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('audit writer (CU-035)', () => {
  it('E5 inserts an entry with all fields of 2.0.9', async () => {
    await createAuditWriter(database.db).write(visualGradeChanged);

    expect(auditRows()).toEqual([
      {
        id: 1,
        occurred_at: '2026-11-10T09:15:00.000Z',
        object_type: 'device',
        object_category: 'device',
        object_id: 7,
        object_label: 'Gerät 626198',
        action: 'values_updated',
        old_value: '{"Optik-Note":2}',
        new_value: '{"Optik-Note":4}',
      },
    ]);
  });

  it('E5 stores missing old or new values and a missing object id as NULL', async () => {
    await createAuditWriter(database.db).write({
      occurredAt: OCCURRED_AT,
      objectType: 'listing',
      objectId: null,
      objectLabel: 'Modell-Inserat NB-1',
      action: 'created',
      oldValue: null,
      newValue: null,
    });

    expect(auditRows()).toMatchObject([{ object_id: null, old_value: null, new_value: null }]);
  });

  it.each([
    ['text_block', 'legal_status_changed', 'settings'],
    ['condition_mappings', 'updated', 'settings'],
    ['model_template', 'updated', 'model_template'],
    ['listing', 'photos_reordered', 'listing'],
    ['channel_content', 'released', 'channel_content'],
    ['device', 'wi_nr_corrected', 'device'],
    ['condition_code', 'deleted', 'other'],
    ['model_template', 'deleted', 'other'],
    ['listing', 'deleted', 'other'],
    ['channel_content', 'unchecked_legal_confirmed', 'other'],
  ] as const)('E5 files %s %s under the category %s of 3.6', async (type, action, category) => {
    await createAuditWriter(database.db).write({
      ...visualGradeChanged,
      objectType: type,
      action,
    } as AuditEntry);

    expect(auditRows()).toMatchObject([{ object_type: type, action, object_category: category }]);
  });

  it('E5 no other server source file inserts into audit_entry', () => {
    const inserts =
      /insertInto\(\s*['"`]audit_entry['"`]|INSERT\s+(?:OR\s+\w+\s+)?INTO\s+["'`]?audit_entry/i;
    const writers = serverSourceFiles().filter((file) =>
      inserts.test(readFileSync(join(SERVER_SRC, file), 'utf8')),
    );
    expect(writers).toEqual([join('audit', 'audit-writer.ts')]);
  });

  it('E6 stores the entry in the same transaction as the change', async () => {
    const uow = createUnitOfWork(database.db);

    await uow.run(async (tx) => {
      const { id } = await insertDeviceType(tx.db, 'Notebook');
      await createAuditWriter(tx.db).write({
        occurredAt: OCCURRED_AT,
        objectType: 'device_type',
        objectId: id,
        objectLabel: 'Geräteart Notebook',
        action: 'created',
        oldValue: null,
        newValue: { Name: 'Notebook' },
      });
    });

    expect(deviceTypeNames()).toEqual(['Notebook']);
    expect(auditRows()).toMatchObject([{ object_type: 'device_type', action: 'created' }]);
  });

  it('E6 leaves no entry when the transaction fails after the entry was written', async () => {
    const uow = createUnitOfWork(database.db);

    const run = uow.run(async (tx) => {
      const { id } = await insertDeviceType(tx.db, 'Notebook');
      await createAuditWriter(tx.db).write({
        occurredAt: OCCURRED_AT,
        objectType: 'device_type',
        objectId: id,
        objectLabel: 'Geräteart Notebook',
        action: 'created',
        oldValue: null,
        newValue: { Name: 'Notebook' },
      });
      // A later write of the same action fails: the name is taken.
      await insertDeviceType(tx.db, 'Notebook');
    });

    await expect(run).rejects.toThrow(/UNIQUE constraint failed/);
    expect(deviceTypeNames()).toEqual([]);
    expect(auditRows()).toEqual([]);
  });

  it('E6 rejects an entry the database refuses, so the action is not stored', async () => {
    const uow = createUnitOfWork(database.db);

    const run = uow.run(async (tx) => {
      await insertDeviceType(tx.db, 'Notebook');
      await createAuditWriter(tx.db).write({
        ...visualGradeChanged,
        objectLabel: null as unknown as string,
      });
    });

    await expect(run).rejects.toThrow(/NOT NULL constraint failed/);
    expect(deviceTypeNames()).toEqual([]);
  });
});
