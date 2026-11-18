import type { Kysely, Selectable } from 'kysely';

import type { DB, MediaFileTable } from '../db/schema.ts';

export type MediaFileRow = Selectable<MediaFileTable>;

export interface MediaFileRecord {
  hash: string;
  kind: string;
  ext: string;
  mime: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt: string;
}

/**
 * Queries on `media_file` including `unreferenced_since` (CU-286, FIND-201, FIND-226). Inside an
 * action pass `tx.db`, outside of one the outer `db` (2.0.4, MAR-263).
 */
export function createMediaFileRepository(db: Kysely<DB>) {
  return {
    async findByHash(hash: string): Promise<MediaFileRow | undefined> {
      return db.selectFrom('media_file').selectAll().where('hash', '=', hash).executeTakeFirst();
    },

    /**
     * Inserts the row of an uploaded file; is it already there, only its `unreferenced_since` is
     * reset, so the housekeeping counts the grace period anew (2.11, FIND-226).
     */
    async insertOrReclaim(file: MediaFileRecord): Promise<void> {
      await db
        .insertInto('media_file')
        .values({
          hash: file.hash,
          kind: file.kind,
          ext: file.ext,
          mime: file.mime,
          byte_size: file.byteSize,
          width: file.width,
          height: file.height,
          created_at: file.createdAt,
          unreferenced_since: null,
        })
        .onConflict((conflict) => conflict.column('hash').doUpdateSet({ unreferenced_since: null }))
        .execute();
    },
  };
}

export type MediaFileRepository = ReturnType<typeof createMediaFileRepository>;
