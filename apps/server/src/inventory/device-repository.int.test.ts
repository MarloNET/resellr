import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
import { createDeviceRepository, type DeviceInsert } from './device-repository.ts';

const STAMP = '2026-11-16T09:00:00.000Z';
const USED = 1;

let root: string;
let database: Database<DB>;
let modelTemplateId: number;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'resellr-device-'));
  database = openDatabase<DB>(join(root, 'resellr.db'));
  await runMigrations(database, [initialSchema], () => new Date());
  const { sqlite } = database;
  insertPickLists(sqlite);
  sqlite
    .prepare(
      "INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version) VALUES (?, ?, 'gebraucht', 'gebraucht', 1, 1, 1)",
    )
    .run(USED, pickListId('condition'));
  modelTemplateId = insertModelTemplate(sqlite, {
    deviceTypeId: insertDeviceType(sqlite, 'Notebook'),
    manufacturerId: insertManufacturer(sqlite, 'Lenovo'),
    modelName: 'ThinkPad T14',
    mpn: null,
  });
});

afterEach(async () => {
  await database.close();
  rmSync(root, { recursive: true, force: true });
});

const device = (wiNr: string, change: Partial<DeviceInsert> = {}): DeviceInsert => ({
  wi_nr: wiNr,
  wi_nr_key: wiNr.toLowerCase(),
  model_template_id: modelTemplateId,
  listing_id: null,
  cancelled_from_listing_id: null,
  supplier_id: null,
  condition_code: null,
  condition_value_id: USED,
  visual_grade: 3,
  condition_description: '',
  device_values: '{}',
  review_keys: '[]',
  capture_status: 'checked',
  stock_status: 'available',
  sold_channel_id: null,
  sold_on: null,
  cancel_reason: null,
  cancelled_at: null,
  assigned_at: null,
  captured_at: STAMP,
  captured_on: '2026-11-16',
  version: 1,
  updated_at: STAMP,
  ...change,
});

describe('device repository (CU-122, Technical Specification 2.5, Nachtrag MAR-965)', () => {
  it('inserts a device and finds it by id', async () => {
    const repository = createDeviceRepository(database.db);

    const id = await repository.insert(device('626198'));

    await expect(repository.findById(id)).resolves.toEqual({ id, ...device('626198') });
    await expect(repository.findById(999)).resolves.toBeUndefined();
  });

  it('findTakenByWiNrKey finds an available and a sold device, a cancelled one not', async () => {
    const repository = createDeviceRepository(database.db);
    const available = await repository.insert(device('626198'));
    const sold = await repository.insert(
      device('A637607', { stock_status: 'sold', sold_on: '2026-11-16' }),
    );
    await repository.insert(
      device('633641', { stock_status: 'cancelled', cancel_reason: 'falsch', cancelled_at: STAMP }),
    );

    await expect(repository.findTakenByWiNrKey('626198')).resolves.toEqual({
      id: available,
      wi_nr: '626198',
      listing_id: null,
    });
    await expect(repository.findTakenByWiNrKey('a637607')).resolves.toEqual({
      id: sold,
      wi_nr: 'A637607',
      listing_id: null,
    });
    await expect(repository.findTakenByWiNrKey('633641')).resolves.toBeUndefined();
  });

  describe('search (REQ-016, #187)', () => {
    const hit = (id: number, wiNr: string, change: Partial<DeviceInsert> = {}) => {
      const row = device(wiNr, change);
      return {
        id,
        wi_nr: row.wi_nr,
        model_template_id: row.model_template_id,
        listing_id: row.listing_id,
        stock_status: row.stock_status,
        capture_status: row.capture_status,
      };
    };

    it('finds devices of every inventory status by a part of the WI-Nr key, ordered by key and id', async () => {
      const repository = createDeviceRepository(database.db);
      const cancelled = { stock_status: 'cancelled', cancel_reason: 'falsch', cancelled_at: STAMP };
      const sold = { stock_status: 'sold', sold_on: '2026-11-16' };
      const old = await repository.insert(device('633641', cancelled));
      const now = await repository.insert(device('633641'));
      const other = await repository.insert(device('A633640', sold));
      await repository.insert(device('626198'));

      await expect(repository.search({ wiNrKey: '6336', limit: 50, offset: 0 })).resolves.toEqual([
        hit(old, '633641', cancelled),
        hit(now, '633641'),
        hit(other, 'A633640', sold),
      ]);
    });

    it('compares the key literally, so % and _ match nothing', async () => {
      const repository = createDeviceRepository(database.db);
      await repository.insert(device('626198'));

      await expect(repository.search({ wiNrKey: '%', limit: 50, offset: 0 })).resolves.toEqual([]);
      await expect(repository.search({ wiNrKey: '6_6', limit: 50, offset: 0 })).resolves.toEqual(
        [],
      );
    });

    it('pages the hits with limit and offset', async () => {
      const repository = createDeviceRepository(database.db);
      await repository.insert(device('626198'));
      const second = await repository.insert(device('626199'));
      await repository.insert(device('626200'));

      await expect(repository.search({ wiNrKey: '62', limit: 1, offset: 1 })).resolves.toEqual([
        hit(second, '626199'),
      ]);
    });
  });
});
