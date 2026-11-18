import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  insertDeviceType,
  insertManufacturer,
  insertModelTemplate,
} from '../../test/model-templates.ts';
import { type Database, openDatabase } from '../db/database.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { createModelTemplateRepository } from './model-template-repository.ts';

let root: string;
let database: Database<DB>;
let ids: { notebook: number; monitor: number; apple: number; asus: number; mvA: number };

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'resellr-catalog-'));
  database = openDatabase<DB>(join(root, 'resellr.db'));
  await runMigrations(database, [initialSchema], () => new Date());
  const { sqlite } = database;
  const notebook = insertDeviceType(sqlite, 'Notebook');
  const monitor = insertDeviceType(sqlite, 'Monitor');
  const apple = insertManufacturer(sqlite, 'Apple');
  const asus = insertManufacturer(sqlite, 'ASUS');
  const mvA = insertModelTemplate(sqlite, {
    deviceTypeId: notebook,
    manufacturerId: apple,
    modelName: 'MacBook Pro 13',
    typeDesignation: 'A1708',
    mpn: 'MHGT3D/A',
    createdAt: '2026-11-10T08:00:00.000Z',
  });
  insertModelTemplate(sqlite, {
    deviceTypeId: monitor,
    manufacturerId: asus,
    modelName: 'ProArt PA278QV',
    mpn: null,
    createdAt: '2026-11-10T09:00:00.000Z',
  });
  ids = { notebook, monitor, apple, asus, mvA };
});

afterEach(async () => {
  await database.close();
  rmSync(root, { recursive: true, force: true });
});

const repository = () => createModelTemplateRepository(database.db);
const page = { limit: 50, offset: 0 };
const namesOf = (rows: { model_name: string }[]) => rows.map((row) => row.model_name);

describe('model template repository (CU-106, Technical Specification 2.4 "Suche")', () => {
  it('AC-REQ-009-01 finds MV-A for "macbook pro" with device type and manufacturer names', async () => {
    const { rows, total } = await repository().list({ q: 'macbook pro', ...page });

    expect(total).toBe(1);
    expect(rows).toEqual([
      expect.objectContaining({
        id: ids.mvA,
        model_name: 'MacBook Pro 13',
        type_designation: 'A1708',
        mpn: 'MHGT3D/A',
        mpn_unknown: 0,
        device_type_id: ids.notebook,
        device_type_name: 'Notebook',
        manufacturer_id: ids.apple,
        manufacturer_name: 'Apple',
      }),
    ]);
  });

  it('AC-REQ-009-02 finds MV-A by a part of its MPN "MHGT3"', async () => {
    const { rows } = await repository().list({ q: 'MHGT3', ...page });

    expect(rows.map((row) => row.id)).toEqual([ids.mvA]);
  });

  it('finds by a part of the type designation, ignoring case', async () => {
    expect(namesOf((await repository().list({ q: 'a17', ...page })).rows)).toEqual([
      'MacBook Pro 13',
    ]);
  });

  it('finds by the manufacturer name through manufacturer.name_key', async () => {
    expect(namesOf((await repository().list({ q: 'asu', ...page })).rows)).toEqual([
      'ProArt PA278QV',
    ]);
  });

  it('finds by the new manufacturer name after a rename without updating the model template', async () => {
    database.sqlite
      .prepare("UPDATE manufacturer SET name = 'Apple Inc.', name_key = 'apple inc.' WHERE id = ?")
      .run(ids.apple);

    const { rows } = await repository().list({ q: 'apple inc', ...page });

    expect(rows).toEqual([expect.objectContaining({ manufacturer_name: 'Apple Inc.' })]);
  });

  it('AC-REQ-009-03 finds nothing for "Zenbook"', async () => {
    expect(await repository().list({ q: 'Zenbook', ...page })).toEqual({ rows: [], total: 0 });
  });

  it('takes "%" and "_" in the search term literally', async () => {
    expect((await repository().list({ q: '%_', ...page })).total).toBe(0);
  });

  it('DER-51-05 restricts the hits to the chosen device type', async () => {
    const { rows, total } = await repository().list({
      q: 'pro',
      deviceTypeId: ids.monitor,
      ...page,
    });

    expect(total).toBe(1);
    expect(namesOf(rows)).toEqual(['ProArt PA278QV']);
  });

  it('DER-51-01 lists the latest created first without a search term, with the total', async () => {
    const { rows, total } = await repository().list(page);

    expect(total).toBe(2);
    expect(namesOf(rows)).toEqual(['ProArt PA278QV', 'MacBook Pro 13']);
  });

  it('pages the list with limit and offset; the total counts all matches', async () => {
    const { rows, total } = await repository().list({ limit: 1, offset: 1 });

    expect(total).toBe(2);
    expect(namesOf(rows)).toEqual(['MacBook Pro 13']);
  });

  it('reads a model template by id and nothing for an unknown id', async () => {
    expect(await repository().findById(ids.mvA)).toEqual(
      expect.objectContaining({ id: ids.mvA, model_name: 'MacBook Pro 13' }),
    );
    expect(await repository().findById(999)).toBeUndefined();
  });
});
