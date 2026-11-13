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
import { RuleViolation } from '../shared/domain-error.ts';
import type { SettingsChanged, VariantSetChanging } from '../shared/events.ts';
import { createDeviceTypeService } from './device-type-service.ts';

const NOW = new Date('2026-11-10T09:15:00.000Z');
const clock: Clock = { now: () => NOW, today: () => '2026-11-10' };

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-device-types-'));
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

const ram = {
  label: 'RAM',
  dataType: 'integer' as const,
  unit: 'GB',
  unitSpacing: false,
  minValue: null,
  maxValue: null,
  pickListId: null,
  level: 'device' as const,
  variantForming: true,
  required: true,
  datasheetBlock: 'technical' as const,
  active: true,
};

describe('attributes in the device type service (CU-072)', () => {
  async function notebookWithRam(handlers: EventHandlers<DB> = {}) {
    const service = serviceWith(handlers);
    const notebook = await service.create({ name: 'Notebook', active: true });
    const attribute = await service.createAttribute(notebook.id, ram);
    return { service, notebook, attribute };
  }

  it.each([
    ['the label', { label: 'Arbeitsspeicher' }],
    ['the unit', { unit: 'GiB' }],
    ['the unit spacing', { unitSpacing: true }],
    ['the status', { active: false }],
  ])(
    'DER-34-12 a change of %s reports SettingsChanged with the scope of the device type in the same transaction and no counts',
    async (_case, change) => {
      const seen: { event: SettingsChanged; version: number | undefined }[] = [];
      const { service, notebook, attribute } = await notebookWithRam({
        change: {
          SettingsChanged: async (event, tx) => {
            const row = await tx.db
              .selectFrom('attribute')
              .select('version')
              .where('id', '=', attribute.id)
              .executeTakeFirst();
            seen.push({ event, version: row?.version });
            return {
              impact: { updated: 3, rerelease: 1, manualReview: 0 },
              adjustStockChannels: [],
            };
          },
        },
      });

      const saved = await service.updateAttribute(attribute.id, { version: 1, ...change });

      expect(seen).toEqual([
        {
          event: {
            type: 'SettingsChanged',
            scope: { kind: 'device_types', deviceTypeIds: [notebook.id] },
          },
          version: 2,
        },
      ]);
      expect(Object.keys(saved)).not.toContain('impact');
    },
  );

  it('reports no SettingsChanged for a change of the flag "Pflichtmerkmal" or when creating', async () => {
    const handler = vi.fn(async () => emptyChangeReport());
    const { service, attribute } = await notebookWithRam({ change: { SettingsChanged: handler } });

    await service.updateAttribute(attribute.id, { version: 1, required: false });

    expect(handler).not.toHaveBeenCalled();
  });

  it('removing the flag "variantenbildend" reports VariantSetChanging with the smaller variant set', async () => {
    const seen: VariantSetChanging[] = [];
    const { service, notebook, attribute } = await notebookWithRam({
      check: {
        VariantSetChanging: async (event) => {
          seen.push(event);
        },
      },
    });
    const ssd = await service.createAttribute(notebook.id, { ...ram, label: 'SSD' });

    const saved = await service.updateAttribute(attribute.id, {
      version: 1,
      variantForming: false,
    });

    expect(seen).toEqual([
      { type: 'VariantSetChanging', deviceTypeId: notebook.id, variantAttributeIds: [ssd.id] },
    ]);
    expect(saved).toMatchObject({ variantForming: false, version: 2 });
  });

  it('keeps the flag when the handler of VariantSetChanging rejects (rollback)', async () => {
    const { service, notebook, attribute } = await notebookWithRam({
      check: {
        VariantSetChanging: async () => {
          throw new RuleViolation('name_taken', { usage: 'attribute' });
        },
      },
    });

    await expect(
      service.updateAttribute(attribute.id, { version: 1, variantForming: false }),
    ).rejects.toBeInstanceOf(RuleViolation);

    expect((await service.listAttributes(notebook.id)).items[0]).toMatchObject({
      variantForming: true,
      version: 1,
    });
  });

  it.each([
    ['deactivating', { active: false }],
    ['setting the flag', { variantForming: true }],
    ['a change of the label', { label: 'Arbeitsspeicher' }],
  ])('K-03 %s reports no VariantSetChanging', async (_case, change) => {
    const handler = vi.fn(async () => {});
    const { service, notebook } = await notebookWithRam({
      check: { VariantSetChanging: handler },
    });
    const ssd = await service.createAttribute(notebook.id, {
      ...ram,
      label: 'SSD',
      variantForming: false,
    });
    const target =
      'variantForming' in change ? ssd : (await service.listAttributes(notebook.id)).items[0];

    await service.updateAttribute(target?.id ?? 0, { version: 1, ...change });

    expect(handler).not.toHaveBeenCalled();
  });

  it('AC-REQ-005-11 activating a deactivated variant attribute reports SettingsChanged and no VariantSetChanging in the same transaction', async () => {
    const variantSet = vi.fn(async () => {});
    const settings: { event: SettingsChanged; active: number | undefined }[] = [];
    const { service, notebook, attribute } = await notebookWithRam({
      check: { VariantSetChanging: variantSet },
      change: {
        SettingsChanged: async (event, tx) => {
          const row = await tx.db
            .selectFrom('attribute')
            .select('active')
            .where('id', '=', 1)
            .executeTakeFirst();
          settings.push({ event, active: row?.active });
          return emptyChangeReport();
        },
      },
    });
    await service.updateAttribute(attribute.id, { version: 1, active: false });
    settings.length = 0;

    const saved = await service.updateAttribute(attribute.id, { version: 2, active: true });

    expect(saved).toEqual({ ...attribute, active: true, version: 3 });
    expect(variantSet).not.toHaveBeenCalled();
    expect(settings).toEqual([
      {
        event: {
          type: 'SettingsChanged',
          scope: { kind: 'device_types', deviceTypeIds: [notebook.id] },
        },
        active: 1,
      },
    ]);
  });

  it('keeps the version and writes nothing when nothing changes', async () => {
    const { service, attribute } = await notebookWithRam();

    const saved = await service.updateAttribute(attribute.id, {
      version: 1,
      label: ' RAM ',
      unit: 'GB',
    });

    expect(saved).toEqual(attribute);
    expect(
      database.sqlite
        .prepare("SELECT action FROM audit_entry WHERE object_type = 'attribute'")
        .pluck()
        .all(),
    ).toEqual(['created']);
  });
});
