import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertDeviceType, insertManufacturer } from '../../test/model-templates.ts';
import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { type Database, openDatabase } from '../db/database.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import { seedInitialSettings } from '../db/migrations/20261110_0002_seed_initial_settings.ts';
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

  it('finds a supplier with name and status, active or not', async () => {
    const insert = database.sqlite.prepare(
      `INSERT INTO supplier (name, name_key, active, version, created_at, updated_at)
       VALUES (?, ?, ?, 1, '2026-11-16T08:00:00.000Z', '2026-11-16T08:00:00.000Z')`,
    );
    const ost = Number(insert.run('Lieferant Ost', 'lieferant ost', 1).lastInsertRowid);
    const west = Number(insert.run('Lieferant West', 'lieferant west', 0).lastInsertRowid);
    const reader = createSettingsReader(database.db);

    await expect(reader.findSupplier(ost)).resolves.toEqual({
      id: ost,
      name: 'Lieferant Ost',
      active: true,
    });
    await expect(reader.findSupplier(west)).resolves.toEqual({
      id: west,
      name: 'Lieferant West',
      active: false,
    });
  });

  it('lists the values of the list battery with the flag "Akku vorhanden", also deactivated ones', async () => {
    await runMigrations(database, [initialSchema, seedInitialSettings], () => new Date());
    const { sqlite } = database;
    sqlite.prepare("UPDATE pick_list_value SET active = 0 WHERE label = 'mit Akku (defekt)'").run();
    const idOf = (label: string) =>
      (
        sqlite.prepare('SELECT id FROM pick_list_value WHERE label = ?').get(label) as {
          id: number;
        }
      ).id;
    const reader = createSettingsReader(database.db);

    await expect(reader.listBatteryValues()).resolves.toEqual([
      { id: idOf('mit Akku'), batteryPresent: true },
      { id: idOf('mit Akku (defekt)'), batteryPresent: true },
      { id: idOf('ohne Akku'), batteryPresent: false },
    ]);
  });

  it('returns undefined for an unknown id', async () => {
    const reader = createSettingsReader(database.db);

    await expect(reader.findDeviceType(999)).resolves.toBeUndefined();
    await expect(reader.findManufacturer(999)).resolves.toBeUndefined();
    await expect(reader.findSupplier(999)).resolves.toBeUndefined();
  });

  it('finds pick list values with their list and status and leaves unknown ids out', async () => {
    const { sqlite } = database;
    insertPickLists(sqlite);
    const insert = sqlite.prepare(
      'INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version) VALUES (?, ?, ?, ?, ?, ?, 1)',
    );
    insert.run(31, pickListId('keyboard_layout'), 'Deutsch', 'deutsch', 1, 1);
    insert.run(32, pickListId('keyboard_layout'), 'Ungarisch', 'ungarisch', 2, 0);
    insert.run(41, pickListId('port_type'), 'USB-C', 'usb-c', 1, 1);
    const reader = createSettingsReader(database.db);

    await expect(reader.findPickListValues([41, 32, 999, 31, 32])).resolves.toEqual([
      {
        id: 31,
        pickListId: pickListId('keyboard_layout'),
        pickListKey: 'keyboard_layout',
        label: 'Deutsch',
        active: true,
      },
      {
        id: 32,
        pickListId: pickListId('keyboard_layout'),
        pickListKey: 'keyboard_layout',
        label: 'Ungarisch',
        active: false,
      },
      {
        id: 41,
        pickListId: pickListId('port_type'),
        pickListKey: 'port_type',
        label: 'USB-C',
        active: true,
      },
    ]);
  });

  it('does not query the database for no pick list values', async () => {
    const reader = createSettingsReader(database.db);
    await database.close();

    // A closed database would reject every query.
    await expect(reader.findPickListValues([])).resolves.toEqual([]);
    database = openDatabase<DB>(join(root, 'resellr.db'));
  });

  it('resolves a condition code with and without supplier, without regard to case (2.2, REQ-015)', async () => {
    const { sqlite } = database;
    const supplier = sqlite.prepare(
      `INSERT INTO supplier (name, name_key, active, version, created_at, updated_at)
       VALUES (?, ?, 1, 1, '2026-11-16T08:00:00.000Z', '2026-11-16T08:00:00.000Z')`,
    );
    const l1 = Number(supplier.run('L1', 'l1').lastInsertRowid);
    const l2 = Number(supplier.run('L2', 'l2').lastInsertRowid);
    const insert = sqlite.prepare(
      `INSERT INTO condition_code (code, code_key, supplier_id, plain_text,
         suggested_condition_value_id, suggested_visual_grade, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, 1, '2026-11-16T08:00:00.000Z', '2026-11-16T08:00:00.000Z')`,
    );
    insert.run('DGS', 'dgs', null, 'Display- und Gehäuseschaden', null);
    insert.run('DGS', 'dgs', l1, 'Display und Gehäuse beschädigt (L1)', 4);
    insert.run('KR', 'kr', l1, 'Kratzer (L1)', null);
    const reader = createSettingsReader(database.db);

    const withoutSupplier = {
      code: 'DGS',
      plainText: 'Display- und Gehäuseschaden',
      suggestedConditionValueId: null,
      suggestedVisualGrade: null,
    };
    await expect(reader.resolveConditionCode('dgs', null)).resolves.toEqual(withoutSupplier);
    await expect(reader.resolveConditionCode(' dgs ', l2)).resolves.toEqual(withoutSupplier);
    await expect(reader.resolveConditionCode('DGS', l1)).resolves.toEqual({
      code: 'DGS',
      plainText: 'Display und Gehäuse beschädigt (L1)',
      suggestedConditionValueId: null,
      suggestedVisualGrade: 4,
    });
    await expect(reader.resolveConditionCode('KR', null)).resolves.toBeUndefined();
    await expect(reader.resolveConditionCode('XYZ', l1)).resolves.toBeUndefined();
    await expect(reader.resolveConditionCode('  ', null)).resolves.toBeUndefined();
  });

  it('lists the attributes of a device type in their order with level, rules and status', async () => {
    const { sqlite } = database;
    const notebook = insertDeviceType(sqlite, 'Notebook');
    const insert = sqlite.prepare(
      `INSERT INTO attribute (id, device_type_id, label, label_key, data_type, system_role, unit,
         unit_spacing, min_value, max_value, pick_list_id, level, variant_forming, required,
         datasheet_block, sort_order, active, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, 1, ?, ?, NULL, ?, 0, ?, 'technical', ?, ?, 1, '', '')`,
    );
    insert.run(2, notebook, 'RAM', 'ram', 'integer', '1', '1024', 'device', 1, 2, 0);
    insert.run(1, notebook, 'Prozessor', 'prozessor', 'text', null, null, 'model', 1, 1, 1);
    const reader = createSettingsReader(database.db);

    await expect(reader.listAttributes(notebook)).resolves.toEqual([
      {
        id: 1,
        label: 'Prozessor',
        dataType: 'text',
        systemRole: null,
        minValue: null,
        maxValue: null,
        pickListId: null,
        level: 'model',
        required: true,
        active: true,
      },
      {
        id: 2,
        label: 'RAM',
        dataType: 'integer',
        systemRole: null,
        minValue: '1',
        maxValue: '1024',
        pickListId: null,
        level: 'device',
        required: true,
        active: false,
      },
    ]);
  });
});
