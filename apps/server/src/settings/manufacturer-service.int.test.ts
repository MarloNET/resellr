import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { createManufacturerService } from './manufacturer-service.ts';

const NOW = new Date('2026-11-12T09:15:00.000Z');
const clock: Clock = { now: () => NOW, today: () => '2026-11-12' };

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-manufacturers-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, migrations, () => NOW);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

const service = () =>
  createManufacturerService({ db: database.db, uow: createUnitOfWork(database.db, {}), clock });

const failAuditWrites = () =>
  database.sqlite.exec(
    "CREATE TRIGGER fail_audit BEFORE INSERT ON audit_entry BEGIN SELECT RAISE(ABORT, 'audit'); END",
  );

const manufacturerRows = () =>
  database.sqlite.prepare('SELECT name, name_key, active, version FROM manufacturer').all();

describe('manufacturer service (CU-078)', () => {
  it('stores the clock time as created_at, updated_at and occurred_at of the audit entry', async () => {
    await service().create({ name: 'Lenovo' });

    expect(
      database.sqlite.prepare('SELECT created_at, updated_at FROM manufacturer').get(),
    ).toEqual({ created_at: NOW.toISOString(), updated_at: NOW.toISOString() });
    expect(database.sqlite.prepare('SELECT occurred_at FROM audit_entry').pluck().get()).toBe(
      NOW.toISOString(),
    );
  });

  it('stores the name key in lower case and a new manufacturer without GPSR as incomplete', async () => {
    await service().create({ name: 'Lenovo' });

    expect(
      database.sqlite.prepare('SELECT name_key, gpsr_complete FROM manufacturer').get(),
    ).toEqual({ name_key: 'lenovo', gpsr_complete: 0 });
  });

  it('stores no new manufacturer without its audit entry (2.0.4)', async () => {
    failAuditWrites();

    await expect(service().create({ name: 'Lenovo' })).rejects.toThrow('audit');

    expect(manufacturerRows()).toEqual([]);
  });

  it('keeps name, status and version when the audit entry of a change fails (2.0.4)', async () => {
    const { manufacturer } = await service().create({ name: 'Lenvo' });
    failAuditWrites();

    await expect(
      service().update(manufacturer.id, { version: 1, name: 'Lenovo', active: false }),
    ).rejects.toThrow('audit');

    expect(manufacturerRows()).toEqual([
      { name: 'Lenvo', name_key: 'lenvo', active: 1, version: 1 },
    ]);
  });
});
