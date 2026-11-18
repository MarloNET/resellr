import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import type { FileStore, MediaExt } from './file-store.ts';
import type { ImageMime } from './image-inspector.ts';
import { createMediaFileRepository } from './media-file-repository.ts';

export interface StoredImage {
  path: string;
  mime: ImageMime;
}

/**
 * Read interface of `media` (CU-287, FIND-202): the logo file. Photos of a listing and all
 * referenced hashes for the housekeeping follow in S7.
 */
export function createMediaReader({ db, fileStore }: { db: Kysely<DB>; fileStore: FileStore }) {
  return {
    /**
     * The logo file of `hash` with its fixed content type (TH-04), or `null` if resellr has no
     * such file. The caller has checked the hash against `^[0-9a-f]{64}$` (2.0.1).
     */
    async findLogo(hash: string): Promise<StoredImage | null> {
      const row = await createMediaFileRepository(db).findByHash(hash);
      if (row === undefined) return null;
      const ext = row.ext as MediaExt;
      if (!(await fileStore.has('logo', hash, ext))) return null;
      return { path: fileStore.pathOf('logo', hash, ext), mime: row.mime as ImageMime };
    },
  };
}

export type MediaReader = ReturnType<typeof createMediaReader>;
