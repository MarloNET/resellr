import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork, emptyChangeReport, type EventHandlers } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import type { SettingsChanged } from '../shared/events.ts';
import { createDeviceTypeService } from './device-type-service.ts';

const NOW = new Date('2026-11-10T09:15:00.000Z');
const clock: Clock = { now: () => NOW, today: () => '2026-11-10' };

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-device-types-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, migrations, () => NOW);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

function serviceWith(handlers: EventHandlers<DB> = {}) {
  const uow = createUnitOfWork(database.db, handlers);
  return createDeviceTypeService({ db: database.db, uow, clock });
}

describe('device type service (CU-072)', () => {
  it('DER-33-12 renaming reports SettingsChanged with the scope of this device type in the same transaction', async () => {
    const seen: { event: SettingsChanged; nameInTransaction: string | undefined }[] = [];
    const service = serviceWith({
      change: {
        SettingsChanged: async (event, tx) => {
          const row = await tx.db
            .selectFrom('device_type')
            .select('name')
            .where('id', '=', 1)
            .executeTakeFirst();
          seen.push({ event, nameInTransaction: row?.name });
          return emptyChangeReport();
        },
      },
    });
    const notebook = await service.create({ name: 'Notebook', active: true });
    expect(seen).toEqual([]);

    await service.update(notebook.id, { version: 1, name: 'Laptop' });

    expect(seen).toEqual([
      {
        event: { type: 'SettingsChanged', scope: { kind: 'device_types', deviceTypeIds: [1] } },
        nameInTransaction: 'Laptop',
      },
    ]);
  });

  it('reports no SettingsChanged for a change of the status only', async () => {
    const handler = vi.fn(async () => emptyChangeReport());
    const service = serviceWith({ change: { SettingsChanged: handler } });
    const notebook = await service.create({ name: 'Notebook', active: true });

    await service.update(notebook.id, { version: 1, active: false });

    expect(handler).not.toHaveBeenCalled();
  });

  it('rolls the rename back with its audit entry when a handler of SettingsChanged fails', async () => {
    const service = serviceWith({
      change: {
        SettingsChanged: async () => {
          throw new Error('rebuild failed');
        },
      },
    });
    const notebook = await service.create({ name: 'Notebook', active: true });

    await expect(service.update(notebook.id, { version: 1, name: 'Laptop' })).rejects.toThrow(
      'rebuild failed',
    );

    expect(await service.list({ limit: 50, offset: 0 })).toEqual({ items: [notebook], total: 1 });
    expect(database.sqlite.prepare('SELECT action FROM audit_entry').pluck().all()).toEqual([
      'created',
    ]);
  });

  it('writes one audit entry per change when name and status change together', async () => {
    const service = serviceWith();
    const notebook = await service.create({ name: 'Notebook', active: true });

    await service.update(notebook.id, { version: 1, name: 'Laptop', active: false });

    expect(
      database.sqlite
        .prepare(
          'SELECT occurred_at, object_id, object_category, action FROM audit_entry ORDER BY id',
        )
        .all(),
    ).toEqual([
      {
        occurred_at: NOW.toISOString(),
        object_id: 1,
        object_category: 'settings',
        action: 'created',
      },
      {
        occurred_at: NOW.toISOString(),
        object_id: 1,
        object_category: 'settings',
        action: 'updated',
      },
      {
        occurred_at: NOW.toISOString(),
        object_id: 1,
        object_category: 'settings',
        action: 'deactivated',
      },
    ]);
  });

  it('stores the name key in Unicode lower case and the timestamps of the clock', async () => {
    const service = serviceWith();

    await service.create({ name: 'Übergröße', active: true });

    expect(
      database.sqlite
        .prepare('SELECT name, name_key, sort_order, created_at, updated_at FROM device_type')
        .get(),
    ).toEqual({
      name: 'Übergröße',
      name_key: 'übergröße',
      sort_order: 1,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
  });

  it('counts the attributes of a device type', async () => {
    const service = serviceWith();
    const notebook = await service.create({ name: 'Notebook', active: true });
    database.sqlite
      .prepare(
        `INSERT INTO attribute (device_type_id, label, label_key, data_type, unit_spacing, level,
           variant_forming, required, datasheet_block, sort_order, active, version, created_at, updated_at)
         VALUES (?, 'RAM', 'ram', 'integer', 1, 'device', 1, 1, 'technical', 1, 1, 1, ?, ?)`,
      )
      .run(notebook.id, NOW.toISOString(), NOW.toISOString());

    expect((await service.list({ limit: 50, offset: 0 })).items[0]?.attributeCount).toBe(1);
  });
});
