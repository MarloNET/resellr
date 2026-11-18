import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import type { DB } from '../db/schema.ts';
import { createPickListRepository } from './pick-list-repository.ts';

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-pick-list-repository-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, [initialSchema], () => new Date('2026-11-16T08:00:00.000Z'));
  insertPickLists(database.sqlite);
  database.sqlite.exec(`
    INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version)
      VALUES (1, ${pickListId('condition')}, 'Gebraucht', 'gebraucht', 1, 1, 1),
             (2, ${pickListId('condition')}, 'Stark gebraucht', 'stark gebraucht', 2, 0, 1),
             (3, ${pickListId('keyboard_layout')}, 'Deutsch', 'deutsch', 1, 1, 1);
  `);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('pick list repository (CU-077) findValuesByIds (2.0.11)', () => {
  it('reads the values with the key of their list and leaves out unknown ids', async () => {
    const rows = await createPickListRepository(database.db).findValuesByIds([2, 3, 99]);

    expect(rows.sort((a, b) => a.id - b.id)).toEqual([
      {
        id: 2,
        pick_list_id: pickListId('condition'),
        pick_list_key: 'condition',
        label: 'Stark gebraucht',
        active: 0,
      },
      {
        id: 3,
        pick_list_id: pickListId('keyboard_layout'),
        pick_list_key: 'keyboard_layout',
        label: 'Deutsch',
        active: 1,
      },
    ]);
  });

  it('answers [] for no ids without a query', async () => {
    // A database that fails on any use: the empty input must not reach it.
    const unusable = new Proxy({} as Kysely<DB>, {
      get: () => {
        throw new Error('no query expected');
      },
    });

    await expect(createPickListRepository(unusable).findValuesByIds([])).resolves.toEqual([]);
  });
});
