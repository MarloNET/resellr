import type { Kysely } from 'kysely';

import type { DB } from './schema.ts';

/**
 * Values of `app_meta` this repository reads and writes (FIND-202): `engine_version` is written
 * by CU-173, `app_version` and `data_folder_stamp` by the startup check. `created_at` is set
 * only by the initial migration.
 */
export type AppMetaKey = 'data_folder_stamp' | 'engine_version' | 'app_version';

export interface AppMetaRepository {
  /** The stored value, or `null` if it was never written. */
  get(key: AppMetaKey): Promise<string | null>;
  /** Inserts or overwrites the value. */
  set(key: AppMetaKey, value: string): Promise<void>;
}

/**
 * Queries on `app_meta` (CU-285). Inside an action pass `tx.db`, never the outer `db` (2.0.4).
 */
export function createAppMetaRepository(db: Kysely<DB>): AppMetaRepository {
  return {
    get: async (key) => {
      const row = await db
        .selectFrom('app_meta')
        .select('value')
        .where('key', '=', key)
        .executeTakeFirst();
      return row?.value ?? null;
    },
    set: async (key, value) => {
      await db
        .insertInto('app_meta')
        .values({ key, value })
        .onConflict((conflict) => conflict.column('key').doUpdateSet({ value }))
        .execute();
    },
  };
}
