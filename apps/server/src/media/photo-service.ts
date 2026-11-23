import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import type { FileStore, MediaExt } from './file-store.ts';
import type { ImageMime } from './image-inspector.ts';
import { createMediaFileRepository } from './media-file-repository.ts';
import type { StoredImage } from './media-reader.ts';

export interface PhotoServiceDeps {
  /** Outer database, only for reads outside of an action (2.0.4). */
  db: Kysely<DB>;
  fileStore: FileStore;
}

/**
 * Photo service (CU-206, REQ-042; Technical Specification 2.11): the stored files of the photos.
 */
export function createPhotoService({ db, fileStore }: PhotoServiceDeps) {
  /** The row of a photo whose original is stored, or `undefined`. */
  async function findStoredPhoto(hash: string) {
    const row = await createMediaFileRepository(db).findByHash(hash);
    if (row?.kind !== 'photo') return undefined;
    const ext = row.ext as MediaExt;
    return (await fileStore.has('photo', hash, ext)) ? { ...row, ext } : undefined;
  }

  return {
    /**
     * `GET /media/photos/{hash}`: the original with its fixed content type (TH-04), or `null` if
     * resellr has no such photo. The caller has checked the hash against `^[0-9a-f]{64}$` (2.0.1).
     */
    async findPhotoFile(hash: string): Promise<StoredImage | null> {
      const photo = await findStoredPhoto(hash);
      if (photo === undefined) return null;
      return { path: fileStore.pathOf('photo', hash, photo.ext), mime: photo.mime as ImageMime };
    },

    /** `GET /media/thumbs/{hash}`: the thumbnail of a stored photo, always JPEG (2.11). */
    async findThumbnailFile(hash: string): Promise<StoredImage | null> {
      if ((await findStoredPhoto(hash)) === undefined) return null;
      if (!(await fileStore.has('thumb', hash, 'jpg'))) return null;
      return { path: fileStore.pathOf('thumb', hash, 'jpg'), mime: 'image/jpeg' };
    },
  };
}

export type PhotoService = ReturnType<typeof createPhotoService>;
