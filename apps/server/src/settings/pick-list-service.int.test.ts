import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork, emptyChangeReport, type EventHandlers } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import type { SettingsChanged } from '../shared/events.ts';
import { createPickListService } from './pick-list-service.ts';

const NOW = new Date('2026-11-11T09:15:00.000Z');
const STAMP = NOW.toISOString();
const clock: Clock = { now: () => NOW, today: () => '2026-11-11' };

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-pick-lists-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, migrations, () => NOW);
  insertPickLists(database.sqlite);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

function serviceWith(handlers: EventHandlers<DB> = {}) {
  const uow = createUnitOfWork(database.db, handlers);
  return createPickListService({ db: database.db, uow, clock });
}

const run = (sql: string, ...params: unknown[]) => database.sqlite.prepare(sql).run(...params);

function insertDeviceType(id: number, name: string) {
  run(
    'INSERT INTO device_type (id, name, name_key, active, sort_order, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, 1, ?, ?)',
    id,
    name,
    name.toLowerCase(),
    id,
    STAMP,
    STAMP,
  );
}

function insertAttribute(
  deviceTypeId: number,
  label: string,
  { dataType = 'pick', listId = null }: { dataType?: string; listId?: number | null } = {},
) {
  run(
    `INSERT INTO attribute (device_type_id, label, label_key, data_type, unit_spacing, pick_list_id,
       level, variant_forming, required, datasheet_block, sort_order, active, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, 'device', 0, 0, 'technical', 1, 1, 1, ?, ?)`,
    deviceTypeId,
    label,
    label.toLowerCase(),
    dataType,
    listId,
    STAMP,
    STAMP,
  );
}

/** A device of the device type 1 with the condition value `conditionValueId` (3.3). */
function insertDevice(conditionValueId: number) {
  insertDeviceType(1, 'Notebook');
  run(
    'INSERT INTO manufacturer (id, name, name_key, active, gpsr_complete, version, created_at, updated_at) VALUES (1, ?, ?, 1, 0, 1, ?, ?)',
    'Lenovo',
    'lenovo',
    STAMP,
    STAMP,
  );
  run(
    `INSERT INTO model_template (id, device_type_id, manufacturer_id, model_name, model_name_key,
       mpn_unknown, model_values, default_device_values, search_key, import_review_pending,
       import_review_keys, version, created_at, updated_at)
     VALUES (1, 1, 1, 'ThinkPad T14', 'thinkpadt14', 1, '{}', '{}', 'thinkpad t14', 0, '[]', 1, ?, ?)`,
    STAMP,
    STAMP,
  );
  run(
    `INSERT INTO device (id, wi_nr, wi_nr_key, model_template_id, condition_value_id, visual_grade,
       condition_description, device_values, review_keys, capture_status, stock_status,
       captured_at, captured_on, version, updated_at)
     VALUES (1, '626198', '626198', 1, ?, 2, '', '{}', '[]', 'checked', 'available', ?, '2026-11-11', 1, ?)`,
    conditionValueId,
    STAMP,
    STAMP,
  );
}

/** Condition of the device as the records read it: through the stored value id (3.3). */
const deviceCondition = () =>
  database.sqlite
    .prepare(
      `SELECT d.condition_value_id AS valueId, v.label, v.active FROM device d
       JOIN pick_list_value v ON v.id = d.condition_value_id WHERE d.id = 1`,
    )
    .get();

const auditRows = () =>
  database.sqlite
    .prepare(
      "SELECT object_category, object_id, object_label, action, old_value, new_value FROM audit_entry WHERE object_type = 'pick_list_value' ORDER BY id",
    )
    .all();

describe('pick list service (CU-076)', () => {
  it('AC-REQ-007-03 a deactivated value stays stored at the device and is no longer offered for new devices', async () => {
    const service = serviceWith();
    const condition = pickListId('condition');
    await service.createValue(condition, { label: 'gebraucht', active: true });
    const refurbished = await service.createValue(condition, {
      label: 'refurbished',
      active: true,
    });
    insertDevice(refurbished.id);

    const saved = await service.updateValue(refurbished.id, { version: 1, active: false });

    expect(saved).toMatchObject({ id: refurbished.id, label: 'refurbished', active: false });
    expect(deviceCondition()).toEqual({ valueId: refurbished.id, label: 'refurbished', active: 0 });
    // The choice for new devices offers the active values (#56); the deactivated one stays listed.
    const { items } = await service.listValues(condition, { limit: 50, offset: 0 });
    expect(items.filter((item) => item.active).map((item) => item.label)).toEqual(['gebraucht']);
    expect(items.map((item) => item.label)).toEqual(['gebraucht', 'refurbished']);
  });

  it('DER-35-11 after a rename every record that uses the value carries the new label, because it stores the value id', async () => {
    const service = serviceWith();
    const condition = pickListId('condition');
    const used = await service.createValue(condition, { label: 'wie neu', active: true });
    insertDevice(used.id);

    await service.updateValue(used.id, { version: 1, label: 'neuwertig' });

    expect(deviceCondition()).toEqual({ valueId: used.id, label: 'neuwertig', active: 1 });
  });

  it('DER-35-13 a new label reports SettingsChanged with all device types that use the list, in the same transaction and without counts', async () => {
    const seen: { event: SettingsChanged; labelInTransaction: unknown }[] = [];
    const service = serviceWith({
      change: {
        SettingsChanged: async (event, tx) => {
          const row = await tx.db
            .selectFrom('pick_list_value')
            .select('label')
            .where('id', '=', 1)
            .executeTakeFirst();
          seen.push({ event, labelInTransaction: row?.label });
          return { impact: { updated: 3, rerelease: 1, manualReview: 0 }, adjustStockChannels: [] };
        },
      },
    });
    const layout = pickListId('keyboard_layout');
    insertDeviceType(1, 'Notebook');
    insertDeviceType(2, 'Tablet');
    insertDeviceType(3, 'PC/Mini-PC');
    insertAttribute(1, 'Tastaturlayout', { listId: layout });
    insertAttribute(3, 'Tastaturlayout', { listId: layout });
    insertAttribute(2, 'Betriebssystem', { listId: pickListId('operating_system') });
    const value = await service.createValue(layout, { label: 'Deutsch (QWERTZ)', active: true });
    expect(seen).toEqual([]);

    const saved = await service.updateValue(value.id, { version: 1, label: 'Deutsch QWERTZ' });

    expect(seen).toEqual([
      {
        event: { type: 'SettingsChanged', scope: { kind: 'device_types', deviceTypeIds: [1, 3] } },
        labelInTransaction: 'Deutsch QWERTZ',
      },
    ]);
    // No `impact` in the answer: UI-028 opens no impact dialog UI-043 (2.1).
    expect(Object.keys(saved).sort()).toEqual(
      ['active', 'batteryPresent', 'id', 'label', 'sortOrder', 'version'].sort(),
    );
  });

  it('DER-35-13 the scope of the port lists also holds the device types with an attribute of data type ports', async () => {
    const seen: SettingsChanged[] = [];
    const service = serviceWith({
      change: {
        SettingsChanged: async (event) => {
          seen.push(event);
          return emptyChangeReport();
        },
      },
    });
    insertDeviceType(1, 'Notebook');
    insertDeviceType(2, 'Tablet');
    insertAttribute(2, 'Anschlüsse', { dataType: 'ports' });
    const portType = pickListId('port_type');
    const value = await service.createValue(portType, { label: 'USB-C', active: true });

    await service.updateValue(value.id, { version: 1, label: 'USB Typ C' });

    expect(seen).toEqual([
      { type: 'SettingsChanged', scope: { kind: 'device_types', deviceTypeIds: [2] } },
    ]);
  });

  it('DER-35-13 the scope of the list condition holds all device types, because every device has a condition', async () => {
    const seen: SettingsChanged[] = [];
    const service = serviceWith({
      change: {
        SettingsChanged: async (event) => {
          seen.push(event);
          return emptyChangeReport();
        },
      },
    });
    insertDeviceType(1, 'Notebook');
    insertDeviceType(2, 'Tablet');
    const value = await service.createValue(pickListId('condition'), {
      label: 'gebraucht',
      active: true,
    });

    await service.updateValue(value.id, { version: 1, label: 'Gebraucht' });

    expect(seen).toEqual([
      { type: 'SettingsChanged', scope: { kind: 'device_types', deviceTypeIds: [1, 2] } },
    ]);
  });

  it('reports no SettingsChanged when only the status, the flag or the order changes', async () => {
    const seen: SettingsChanged[] = [];
    const service = serviceWith({
      change: {
        SettingsChanged: async (event) => {
          seen.push(event);
          return emptyChangeReport();
        },
      },
    });
    const battery = pickListId('battery');
    const first = await service.createValue(battery, {
      label: 'mit Akku',
      active: true,
      batteryPresent: true,
    });
    const second = await service.createValue(battery, {
      label: 'ohne Akku',
      active: true,
      batteryPresent: false,
    });

    await service.updateValue(first.id, { version: 1, active: false });
    await service.updateValue(second.id, { version: 1, batteryPresent: true });
    await service.reorderValues(battery, { version: 1, valueIds: [second.id, first.id] });

    expect(seen).toEqual([]);
  });

  it('writes one audit entry per change with readable old and new values (2.0.9, 3.6)', async () => {
    const service = serviceWith();
    const battery = pickListId('battery');
    const value = await service.createValue(battery, {
      label: 'mit Akku (defekt)',
      active: true,
      batteryPresent: true,
    });
    const other = await service.createValue(battery, {
      label: 'ohne Akku',
      active: true,
      batteryPresent: false,
    });

    await service.updateValue(value.id, { version: 1, label: 'Akku defekt', active: false });
    await service.reorderValues(battery, { version: 1, valueIds: [other.id, value.id] });

    expect(auditRows()).toEqual([
      {
        object_category: 'settings',
        object_id: value.id,
        object_label: 'Listenwert mit Akku (defekt) (Akku)',
        action: 'created',
        old_value: null,
        new_value: JSON.stringify({
          Wert: 'mit Akku (defekt)',
          Status: 'aktiv',
          'Akku vorhanden': 'Ja',
        }),
      },
      {
        object_category: 'settings',
        object_id: other.id,
        object_label: 'Listenwert ohne Akku (Akku)',
        action: 'created',
        old_value: null,
        new_value: JSON.stringify({ Wert: 'ohne Akku', Status: 'aktiv', 'Akku vorhanden': 'Nein' }),
      },
      {
        object_category: 'settings',
        object_id: value.id,
        object_label: 'Listenwert Akku defekt (Akku)',
        action: 'updated',
        old_value: JSON.stringify({ Wert: 'mit Akku (defekt)' }),
        new_value: JSON.stringify({ Wert: 'Akku defekt' }),
      },
      {
        object_category: 'settings',
        object_id: value.id,
        object_label: 'Listenwert Akku defekt (Akku)',
        action: 'deactivated',
        old_value: JSON.stringify({ Status: 'aktiv' }),
        new_value: JSON.stringify({ Status: 'deaktiviert' }),
      },
      {
        object_category: 'settings',
        object_id: null,
        object_label: 'Auswahlliste Akku',
        action: 'reordered',
        old_value: JSON.stringify({ Reihenfolge: ['Akku defekt', 'ohne Akku'] }),
        new_value: JSON.stringify({ Reihenfolge: ['ohne Akku', 'Akku defekt'] }),
      },
    ]);
  });

  it('DER-35-12 a rename of a battery value keeps its flag "Akku vorhanden"', async () => {
    const service = serviceWith();
    const value = await service.createValue(pickListId('battery'), {
      label: 'mit Akku (defekt)',
      active: true,
      batteryPresent: true,
    });

    const saved = await service.updateValue(value.id, { version: 1, label: 'Akku defekt' });

    expect(saved).toMatchObject({ label: 'Akku defekt', batteryPresent: true, version: 2 });
  });

  it('stores nothing and writes no audit entry when the event handler fails (2.0.4)', async () => {
    const service = serviceWith({
      change: {
        SettingsChanged: async () => {
          throw new Error('content engine failed');
        },
      },
    });
    const value = await service.createValue(pickListId('condition'), {
      label: 'gebraucht',
      active: true,
    });

    await expect(service.updateValue(value.id, { version: 1, label: 'benutzt' })).rejects.toThrow(
      'content engine failed',
    );

    const { items } = await service.listValues(pickListId('condition'), { limit: 50, offset: 0 });
    expect(items).toEqual([value]);
    expect(auditRows().map((row) => (row as { action: string }).action)).toEqual(['created']);
  });

  it('returns the value unchanged and writes nothing when nothing changes', async () => {
    const service = serviceWith();
    const value = await service.createValue(pickListId('condition'), {
      label: 'gebraucht',
      active: true,
    });

    const saved = await service.updateValue(value.id, {
      version: 1,
      label: 'gebraucht',
      active: true,
    });

    expect(saved).toEqual(value);
    expect(auditRows()).toHaveLength(1);
  });
});
