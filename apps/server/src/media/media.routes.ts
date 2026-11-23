import { createReadStream } from 'node:fs';

import { idSchema } from '@resellr/domain/schemas/common.schema';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { BadRequestError, NotFoundError } from '../shared/domain-error.ts';
import { createFileStore } from './file-store.ts';
import type { MediaFileIntake } from './media-file-intake.ts';
import { createMediaReader, type StoredImage } from './media-reader.ts';
import { createPhotoService } from './photo-service.ts';
import { createPhotoUploadService, PHOTO_MAX_BYTES } from './photo-upload-service.ts';

export interface MediaRoutesOptions {
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
  /** `<Datenordner>/media` (2.19); the media store (CU-088) stays inside `media` (4.1). */
  mediaDir: string;
  /** File intake (CU-090), shared with the logo of `settings`. */
  mediaFiles: MediaFileIntake;
  /** State `stopping` of the server (2.17); the photo upload checks it before its transaction. */
  isStopping: () => boolean;
}

/** A content hash: SHA-256 as 64 lower-case hex characters (2.0.1). */
const HASH_PATTERN = /^[0-9a-f]{64}$/;

/** Stored files never change under their hash (ADR-004, 2.11). */
const IMMUTABLE = 'private, max-age=31536000, immutable';

// Any string, so a wrong hash ends in `404` below and not in `400 bad_request` (2.0.1).
const hashParams = z.strictObject({ hash: z.string() });

const listingParams = z.strictObject({ id: z.coerce.number().pipe(idSchema) });

/** File name of a photo, 1 to 255 characters (3.1 `listing_photo.original_name`). */
const photoFileName = z.string().min(1).max(255);

const photoSchema = z.strictObject({
  id: z.number(),
  hash: z.string(),
  position: z.number(),
  originalName: z.string(),
  byteSize: z.number(),
  url: z.string(),
  thumbUrl: z.string(),
});

const photoListSchema = z.strictObject({ items: z.array(photoSchema), total: z.number() });

const photoUploadSchema = z.strictObject({
  photo: photoSchema,
  listingVersion: z.number(),
  count: z.number(),
});

/**
 * Media routes (CU-091, Technical Specification 2.0.1, 2.2, 2.11): `GET /media/logo/{hash}`,
 * `GET /media/photos/{hash}` and `GET /media/thumbs/{hash}`; `GET` and `POST
 * /api/listings/{id}/photos`. The hash is checked before any file access; a wrong or unknown one
 * answers `404`. The image goes out with the fixed content type of its stored type (TH-04), never
 * one derived from the request.
 */
export const mediaRoutes: FastifyPluginAsyncZod<MediaRoutesOptions> = async (
  app,
  { db, uow, clock, mediaDir, mediaFiles, isStopping },
) => {
  const fileStore = createFileStore({ mediaDir });
  const reader = createMediaReader({ db, fileStore });
  const photos = createPhotoService({ db, fileStore });
  const photoUpload = createPhotoUploadService({ uow, clock, mediaFiles, isStopping });

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

  app.get(
    '/api/listings/:id/photos',
    { schema: { params: listingParams, response: { 200: photoListSchema } } },
    async (request) => photos.list(request.params.id),
  );

  // multipart with exactly one file `file`, without `version` (2.0.1, 2.11, T-2); the parser skips
  // any further file. It stops one byte after the size limit, so the service sees the file is too
  // large without reading it all.
  app.post(
    '/api/listings/:id/photos',
    {
      config: { upload: true },
      schema: { params: listingParams, response: { 201: photoUploadSchema } },
    },
    async (request, reply) => {
      const upload = await request.file({
        limits: { fileSize: PHOTO_MAX_BYTES + 1, files: 1 },
        throwFileSizeLimit: false,
      });
      if (upload === undefined) throw new BadRequestError('file: missing');
      const fileName = photoFileName.safeParse(upload.filename);
      if (upload.fieldname !== 'file' || !fileName.success) {
        upload.file.resume();
        throw new BadRequestError('file: multipart field');
      }
      const result = await photoUpload.upload({
        listingId: request.params.id,
        file: upload.file,
        fileName: fileName.data,
      });
      return reply.code(201).send(result);
    },
  );
};
