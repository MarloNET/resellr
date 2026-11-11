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
import { createSupplierService } from './supplier-service.ts';

const NOW = new Date('2026-11-11T09:15:00.000Z');
const clock: Clock = { now: () => NOW, today: () => '2026-11-11' };

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-suppliers-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, migrations, () => NOW);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

const service = () =>
  createSupplierService({ db: database.db, uow: createUnitOfWork(database.db, {}), clock });

const failAuditWrites = () =>
  database.sqlite.exec(
    "CREATE TRIGGER fail_audit BEFORE INSERT ON audit_entry BEGIN SELECT RAISE(ABORT, 'audit'); END",
  );

const supplierRows = () =>
  database.sqlite.prepare('SELECT name, active, version FROM supplier').all();

describe('supplier service (CU-080)', () => {
  it('stores the clock time as created_at, updated_at and occurred_at of the audit entry', async () => {
    await service().create({ name: 'L1', active: true });

    expect(database.sqlite.prepare('SELECT created_at, updated_at FROM supplier').get()).toEqual({
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
    expect(database.sqlite.prepare('SELECT occurred_at FROM audit_entry').pluck().get()).toBe(
      NOW.toISOString(),
    );
  });

  it('stores no new supplier without its audit entry (2.0.4)', async () => {
    failAuditWrites();

    await expect(service().create({ name: 'L1', active: true })).rejects.toThrow('audit');

    expect(supplierRows()).toEqual([]);
  });

  it('keeps name, status and version when the audit entry of a change fails (2.0.4)', async () => {
    const l1 = await service().create({ name: 'L1', active: true });
    failAuditWrites();

    await expect(
      service().update(l1.id, { version: 1, name: 'L2', active: false }),
    ).rejects.toThrow('audit');

    expect(supplierRows()).toEqual([{ name: 'L1', active: 1, version: 1 }]);
  });
});
