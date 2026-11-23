import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Kinds of files in the media store (3.1 `media_file.kind`). */
export type MediaKind = 'logo' | 'photo';

/** Stored files: the kinds of `media_file` and the thumbnail of a photo, which has no row (2.19). */
export type StoredKind = MediaKind | 'thumb';

/** File extensions of the stored images (3.1 `media_file.ext`); a thumbnail is always `jpg`. */
export type MediaExt = 'jpg' | 'png';

/**
 * Place of a stored file below `<Datenordner>/media` (Technical Specification 2.11, 2.19): logos
 * in `logo/`, photos in `photos/<hash[0..1]>/`, so no folder holds all of them, thumbnails in
 * `thumbs/`.
 */
const KIND_FOLDERS: Record<StoredKind, (hash: string) => string[]> = {
  logo: () => ['logo'],
  photo: (hash) => ['photos', hash.slice(0, 2)],
  thumb: () => ['thumbs'],
};

/** Folder of the temporary files of uploads, emptied by the housekeeping (2.19). */
const INCOMING_FOLDER = '.incoming';

const hashLocks = new Map<string, Promise<unknown>>();

/**
 * Lock per hash within the process (FIND-226): `fn` runs only after every earlier holder of the
 * same hash has finished. The upload (CU-090) holds it from placing the file until after the
 * commit, the housekeeping (CU-307) while it deletes, so neither sees half of the other.
 */
export async function withHashLock<T>(hash: string, fn: () => Promise<T>): Promise<T> {
  const previous = hashLocks.get(hash) ?? Promise.resolve();
  const current = previous.then(fn);
  const tail = current.catch(() => undefined);
  hashLocks.set(hash, tail);
  try {
    return await current;
  } finally {
    // Only the last holder removes the entry, so the map does not grow.
    if (hashLocks.get(hash) === tail) hashLocks.delete(hash);
  }
}

const exists = async (path: string) =>
  access(path, constants.F_OK).then(
    () => true,
    () => false,
  );

/**
 * Media store (CU-088, ADR-004, Baseline 9.4): files named after their content hash in the data
 * folder, temporary files of uploads under `media/.incoming` and the atomic move into place.
 */
export function createFileStore({ mediaDir }: { mediaDir: string }) {
  const incomingDir = join(mediaDir, INCOMING_FOLDER);

  const pathOf = (kind: StoredKind, hash: string, ext: MediaExt) =>
    join(mediaDir, ...KIND_FOLDERS[kind](hash), `${hash}.${ext}`);

  return {
    /**
     * Path of a stored file, e.g. `media/logo/<hash>.png` or `media/photos/3f/<hash>.jpg`; the
     * caller checks the hash first.
     */
    pathOf,

    /** A new, unused path for a temporary file; the folder exists afterwards. */
    async createIncomingPath(): Promise<string> {
      await mkdir(incomingDir, { recursive: true });
      return join(incomingDir, randomUUID());
    },

    /** Removes a temporary file; a missing one is no error. */
    async removeIncoming(path: string): Promise<void> {
      await rm(path, { force: true });
    },

    /**
     * Moves the temporary file to its place under the hash. Is the file already there, it has
     * the same content and the temporary file is deleted (2.11). Call only under the lock of the
     * hash (`withHashLock`).
     */
    async place(incomingPath: string, kind: StoredKind, hash: string, ext: MediaExt) {
      const target = pathOf(kind, hash, ext);
      if (await exists(target)) {
        await rm(incomingPath, { force: true });
        return;
      }
      await mkdir(dirname(target), { recursive: true });
      // Same file system as `.incoming`, so the rename is atomic.
      await rename(incomingPath, target);
    },

    /** Whether the stored file exists. */
    has: (kind: StoredKind, hash: string, ext: MediaExt) => exists(pathOf(kind, hash, ext)),
  };
}

export type FileStore = ReturnType<typeof createFileStore>;
