import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  insertDeviceType,
  insertManufacturer,
  insertModelTemplate,
} from '../../test/model-templates.ts';
import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { type Database, openDatabase } from '../db/database.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork, emptyChangeReport, type EventHandlers } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import type { ContentInputsChanged } from '../shared/events.ts';
import { createModelTemplateService } from './model-template-service.ts';

const NOW = new Date('2026-11-20T10:00:00.000Z');
const clock: Clock = { now: () => NOW, today: () => '2026-11-20' };

/** Attribute ids: processor of the level model, operating system of the level device. */
const A = { processor: 11, os: 21 };
const V = { win11: 51, win10: 52 };

let dir: string;
let database: Database<DB>;
let mv: number;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-model-templates-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, [initialSchema], () => NOW);
  const { sqlite } = database;
  const notebook = insertDeviceType(sqlite, 'Notebook');
  const lenovo = insertManufacturer(sqlite, 'Lenovo');
  insertPickLists(sqlite);
  const value = sqlite.prepare(
    'INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version) VALUES (?, ?, ?, ?, ?, 1, 1)',
  );
  value.run(V.win11, pickListId('operating_system'), 'Windows 11 Pro', 'windows 11 pro', 1);
  value.run(V.win10, pickListId('operating_system'), 'Windows 10 Pro', 'windows 10 pro', 2);
  const attribute = sqlite.prepare(
    `INSERT INTO attribute (id, device_type_id, label, label_key, data_type, system_role, unit,
       unit_spacing, min_value, max_value, pick_list_id, level, variant_forming, required,
       datasheet_block, sort_order, active, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, 1, NULL, NULL, ?, ?, 0, 0, 'technical', ?, 1, 1, '', '')`,
  );
  attribute.run(A.processor, notebook, 'Prozessor', 'prozessor', 'text', null, 'model', 1);
  attribute.run(
    A.os,
    notebook,
    'Betriebssystem',
    'betriebssystem',
    'pick',
    pickListId('operating_system'),
    'device',
    2,
  );
  mv = insertModelTemplate(sqlite, {
    deviceTypeId: notebook,
    manufacturerId: lenovo,
    modelName: 'ThinkPad T14',
    mpn: '20W1S0F300',
    modelValues: { [A.processor]: 'Intel Core i5-1135G7' },
    defaultDeviceValues: { [A.os]: V.win11 },
  });
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

const serviceWith = (handlers: EventHandlers<DB>) =>
  createModelTemplateService({ uow: createUnitOfWork(database.db, handlers), clock });

const auditRows = () =>
  database.sqlite
    .prepare(
      'SELECT object_type, object_id, object_label, action, object_category, old_value, new_value, occurred_at FROM audit_entry',
    )
    .all();

const versionOf = () =>
  database.sqlite.prepare('SELECT version FROM model_template WHERE id = ?').pluck().get(mv);

describe('model template service: changing (CU-105, REQ-010, Technical Specification 2.4)', () => {
  it('a change of model data reports ContentInputsChanged(modelTemplateId) in the same transaction', async () => {
    const seen: { event: ContentInputsChanged; stored: unknown }[] = [];
    const service = serviceWith({
      change: {
        ContentInputsChanged: async (event, tx) => {
          const stored = await tx.db
            .selectFrom('model_template')
            .select(['type_designation', 'version'])
            .executeTakeFirst();
          seen.push({ event, stored });
          return emptyChangeReport();
        },
      },
    });

    await service.update(mv, { version: 1, typeDesignation: '20W2' });

    expect(seen).toEqual([
      {
        event: { type: 'ContentInputsChanged', modelTemplateId: mv },
        stored: { type_designation: '20W2', version: 2 },
      },
    ]);
  });

  it('a change of a model value reports ContentInputsChanged', async () => {
    const handler = vi.fn(async () => emptyChangeReport());

    await serviceWith({ change: { ContentInputsChanged: handler } }).update(mv, {
      version: 1,
      modelValues: { [A.processor]: 'Intel Core i7-1165G7' },
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('a change of a device default stores it without ContentInputsChanged (2.4)', async () => {
    const handler = vi.fn(async () => emptyChangeReport());

    const saved = await serviceWith({ change: { ContentInputsChanged: handler } }).update(mv, {
      version: 1,
      defaultDeviceValues: { [A.os]: V.win10 },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(saved).toMatchObject({ defaultDeviceValues: { [A.os]: V.win10 }, version: 2 });
  });

  it('writes the audit entry `updated` with the changed fields only, labels instead of ids', async () => {
    await serviceWith({}).update(mv, {
      version: 1,
      typeDesignation: '20W2',
      defaultDeviceValues: { [A.os]: V.win10 },
    });

    expect(auditRows()).toEqual([
      {
        object_type: 'model_template',
        object_id: mv,
        object_label: 'Modellvorlage ThinkPad T14',
        action: 'updated',
        object_category: 'model_template',
        old_value: JSON.stringify({
          Typbezeichnung: null,
          'Vorbelegungswert Betriebssystem': 'Windows 11 Pro',
        }),
        new_value: JSON.stringify({
          Typbezeichnung: '20W2',
          'Vorbelegungswert Betriebssystem': 'Windows 10 Pro',
        }),
        occurred_at: NOW.toISOString(),
      },
    ]);
  });

  it('stores nothing when the audit entry cannot be written (2.0.4)', async () => {
    database.sqlite.exec(
      "CREATE TRIGGER fail_audit BEFORE INSERT ON audit_entry BEGIN SELECT RAISE(ABORT, 'audit'); END",
    );

    await expect(
      serviceWith({}).update(mv, { version: 1, typeDesignation: '20W2' }),
    ).rejects.toThrow('audit');

    expect(versionOf()).toBe(1);
  });

  it('rolls the change back with its audit entry when a handler of ContentInputsChanged fails', async () => {
    const failing = serviceWith({
      change: {
        ContentInputsChanged: async () => {
          throw new Error('handler');
        },
      },
    });

    await expect(failing.update(mv, { version: 1, modelName: 'ThinkPad T14s' })).rejects.toThrow(
      'handler',
    );

    expect(versionOf()).toBe(1);
    expect(auditRows()).toEqual([]);
  });
});
