import { createReadStream } from 'node:fs';

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import type { DB } from '../db/schema.ts';
import { NotFoundError } from '../shared/domain-error.ts';
import { createFileStore } from './file-store.ts';
import { createMediaReader, type StoredImage } from './media-reader.ts';
import { createPhotoService } from './photo-service.ts';

export interface MediaRoutesOptions {
  db: Kysely<DB>;
  /** `<Datenordner>/media` (2.19); the media store (CU-088) stays inside `media` (4.1). */
  mediaDir: string;
}

/** A content hash: SHA-256 as 64 lower-case hex characters (2.0.1). */
const HASH_PATTERN = /^[0-9a-f]{64}$/;

/** Stored files never change under their hash (ADR-004, 2.11). */
const IMMUTABLE = 'private, max-age=31536000, immutable';

// Any string, so a wrong hash ends in `404` below and not in `400 bad_request` (2.0.1).
const hashParams = z.strictObject({ hash: z.string() });

/**
 * Media routes (CU-091, Technical Specification 2.0.1, 2.2, 2.11): `GET /media/logo/{hash}`,
 * `GET /media/photos/{hash}` and `GET /media/thumbs/{hash}`. The hash is checked before any file
 * access; a wrong or unknown one answers `404`. The image goes out with the fixed content type of
 * its stored type (TH-04), never one derived from the request.
 */
export const mediaRoutes: FastifyPluginAsyncZod<MediaRoutesOptions> = async (
  app,
  { db, mediaDir },
) => {
  const fileStore = createFileStore({ mediaDir });
  const reader = createMediaReader({ db, fileStore });
  const photos = createPhotoService({ db, fileStore });

  const serveImage = (path: string, find: (hash: string) => Promise<StoredImage | null>) =>
    app.get(path, { schema: { params: hashParams } }, async (request, reply) => {
      const { hash } = request.params;
      if (!HASH_PATTERN.test(hash)) throw new NotFoundError();
      const image = await find(hash);
      if (image === null) throw new NotFoundError();
      return reply
        .type(image.mime)
        .header('cache-control', IMMUTABLE)
        .send(createReadStream(image.path));
    });

  serveImage('/media/logo/:hash', reader.findLogo);
  serveImage('/media/photos/:hash', photos.findPhotoFile);
  serveImage('/media/thumbs/:hash', photos.findThumbnailFile);
};
