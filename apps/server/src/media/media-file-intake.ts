import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import type { Clock } from '../shared/clock.ts';
import { RuleViolation } from '../shared/domain-error.ts';
import { createFileStore, type MediaKind, withHashLock } from './file-store.ts';
import { type ImageInfo, inspectImage } from './image-inspector.ts';
import { createMediaFileRepository } from './media-file-repository.ts';

/** Usage of the rejection texts `file_too_large.<usage>` and `unsupported_media_type.<usage>`. */
export type IntakeUsage = 'logo';

export interface IntakeOptions {
  kind: MediaKind;
  /** Largest accepted file in bytes, e.g. 5 MB for the logo (2.2). */
  maxBytes: number;
  usage: IntakeUsage;
}

/** A checked upload, still a temporary file in `media/.incoming`. */
interface IncomingFile extends ImageInfo {
  path: string;
  hash: string;
  byteSize: number;
}

/**
 * Stores the row of the placed file in the transaction of the caller (`tx.db`) and returns its
 * hash: `media_file` is inserted, or its `unreferenced_since` reset (FIND-226).
 */
export type RegisterFile = (db: Kysely<DB>) => Promise<string>;

/**
 * Counts and hashes the bytes on their way to the temporary file. Beyond `maxBytes` nothing more
 * is written, but the source is still read to its end, so the request can be answered.
 */
function hashingLimit(maxBytes: number) {
  const hash = createHash('sha256');
  let byteSize = 0;
  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      byteSize += chunk.length;
      if (byteSize > maxBytes) {
        callback();
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  return {
    stream,
    tooLarge: () => byteSize > maxBytes,
    result: () => ({ hash: hash.digest('hex'), byteSize }),
  };
}

/**
 * File intake of `media` (CU-090, FIND-203, FIND-226; Technical Specification 2.11): streams an
 * uploaded file to `media/.incoming` with its size limit, hashes it, checks it (CU-089), places it
 * under the lock of its hash (CU-088) and lets the caller register it in its own transaction.
 * The lock is held until that transaction has ended, so the housekeeping never deletes a file
 * that an upload is just referencing. A rejected file leaves nothing behind. The media store
 * (CU-088) stays inside `media` (4.1); callers pass only the media folder.
 */
export function createMediaFileIntake({ mediaDir, clock }: { mediaDir: string; clock: Clock }) {
  const fileStore = createFileStore({ mediaDir });

  async function receive(source: Readable, { maxBytes, usage }: IntakeOptions) {
    const path = await fileStore.createIncomingPath();
    const limit = hashingLimit(maxBytes);
    try {
      await pipeline(source, limit.stream, createWriteStream(path));
    } catch (error) {
      await fileStore.removeIncoming(path);
      throw error;
    }
    if (limit.tooLarge()) {
      await fileStore.removeIncoming(path);
      throw new RuleViolation('file_too_large', { usage });
    }

    const image = await inspectImage(path).catch(async (error: unknown) => {
      await fileStore.removeIncoming(path);
      throw error;
    });
    if (image === null) {
      await fileStore.removeIncoming(path);
      throw new RuleViolation('unsupported_media_type', { usage });
    }
    return { path, ...limit.result(), ...image } satisfies IncomingFile;
  }

  return {
    /**
     * Takes one uploaded file. Too large → `413 file_too_large`, not a readable JPEG or PNG →
     * `415 unsupported_media_type`, both with the text of `usage`; nothing is stored then. A
     * valid file is placed under its hash, then `action` runs under the lock of the hash and
     * registers the file with `register` in its transaction.
     */
    async intake<T>(
      source: Readable,
      options: IntakeOptions,
      action: (register: RegisterFile) => Promise<T>,
    ): Promise<T> {
      const file = await receive(source, options);
      return withHashLock(file.hash, async () => {
        await fileStore.place(file.path, options.kind, file.hash, file.ext);
        return action(async (db) => {
          await createMediaFileRepository(db).insertOrReclaim({
            hash: file.hash,
            kind: options.kind,
            ext: file.ext,
            mime: file.mime,
            byteSize: file.byteSize,
            width: file.width,
            height: file.height,
            createdAt: clock.now().toISOString(),
          });
          return file.hash;
        });
      });
    },
  };
}

export type MediaFileIntake = ReturnType<typeof createMediaFileIntake>;
