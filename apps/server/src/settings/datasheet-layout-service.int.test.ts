import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork, emptyChangeReport, type EventHandlers } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { createDatasheetLayoutService } from './datasheet-layout-service.ts';

const NOW = new Date('2026-11-13T09:15:00.000Z');
const clock: Clock = { now: () => NOW, today: () => '2026-11-13' };

const BLOCKS = [
  'identification',
  'condition',
  'delivery_scope',
  'technical',
  'ports',
  'software',
] as const;

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-datasheet-layout-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  // Schema only: the tests write their own settings; the initial settings have their own
  // tests (CU-071).
  await runMigrations(database, [initialSchema], () => NOW);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

function serviceWith(handlers: EventHandlers<DB> = {}) {
  const uow = createUnitOfWork(database.db, handlers);
  return createDatasheetLayoutService({ db: database.db, uow, clock });
}

const at = NOW.toISOString();

function insertDeviceType(name: string): number {
  return Number(
    database.sqlite
      .prepare(
        `INSERT INTO device_type (name, name_key, active, sort_order, version, created_at, updated_at)
         VALUES (?, ?, 1, 1, 1, ?, ?)`,
      )
      .run(name, name.toLowerCase(), at, at).lastInsertRowid,
  );
}

function insertAttribute(deviceTypeId: number, label: string, sortOrder: number): number {
  return Number(
    database.sqlite
      .prepare(
        `INSERT INTO attribute (device_type_id, label, label_key, data_type, unit_spacing, level,
           variant_forming, required, datasheet_block, sort_order, active, version, created_at, updated_at)
         VALUES (?, ?, ?, 'text', 1, 'device', 0, 0, 'technical', ?, 1, 1, ?, ?)`,
      )
      .run(deviceTypeId, label, label.toLowerCase(), sortOrder, at, at).lastInsertRowid,
  );
}

const auditRows = () =>
  database.sqlite
    .prepare('SELECT object_type, object_category, action FROM audit_entry ORDER BY id')
    .all();

describe('datasheet layout service (CU-085)', () => {
  it('reads the initial layout while the seed row is missing', async () => {
    expect(await serviceWith().get()).toEqual({
      headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:'],
      blockOrder: [...BLOCKS],
      attributeOrder: {},
      version: 1,
    });
  });

  it('stores the first save without the seed row and logs it as a setting', async () => {
    const service = serviceWith();

    const saved = await service.update({
      version: 1,
      headerLabels: ['Shop:', 'Ebay-Nr.:', 'Kleinanzeigen:'],
      blockOrder: [...BLOCKS],
      attributeOrder: {},
    });

    expect(saved).toMatchObject({
      headerLabels: ['Shop:', 'Ebay-Nr.:', 'Kleinanzeigen:'],
      version: 2,
    });
    expect(auditRows()).toEqual([
      { object_type: 'datasheet_layout', object_category: 'settings', action: 'updated' },
    ]);
  });

  it('changes no channel contents: a save reports no SettingsChanged', async () => {
    const handler = vi.fn(async () => emptyChangeReport());
    const service = serviceWith({ change: { SettingsChanged: handler } });

    await service.update({
      version: 1,
      headerLabels: ['Ebay-Nr.:'],
      blockOrder: [
        'identification',
        'condition',
        'delivery_scope',
        'ports',
        'technical',
        'software',
      ],
      attributeOrder: {},
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('adds attributes created after the save at the end of the stored order', async () => {
    const notebook = insertDeviceType('Notebook');
    const ram = insertAttribute(notebook, 'RAM', 1);
    const cpu = insertAttribute(notebook, 'CPU', 2);
    const service = serviceWith();
    await service.update({
      version: 1,
      headerLabels: ['Shop:'],
      blockOrder: [...BLOCKS],
      attributeOrder: { [notebook]: [cpu, ram] },
    });

    const gpu = insertAttribute(notebook, 'GPU', 3);

    expect((await service.get()).attributeOrder).toEqual({ [notebook]: [cpu, ram, gpu] });
  });

  it('keeps the stored order of a device type left out of the save', async () => {
    const notebook = insertDeviceType('Notebook');
    const ram = insertAttribute(notebook, 'RAM', 1);
    const cpu = insertAttribute(notebook, 'CPU', 2);
    const service = serviceWith();
    await service.update({
      version: 1,
      headerLabels: ['Shop:'],
      blockOrder: [...BLOCKS],
      attributeOrder: { [notebook]: [cpu, ram] },
    });

    const saved = await service.update({
      version: 2,
      headerLabels: ['Kasse:'],
      blockOrder: [...BLOCKS],
      attributeOrder: {},
    });

    expect(saved.attributeOrder).toEqual({ [notebook]: [cpu, ram] });
  });
});
