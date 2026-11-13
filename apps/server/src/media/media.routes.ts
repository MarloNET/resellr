import { createReadStream } from 'node:fs';

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import type { DB } from '../db/schema.ts';
import { NotFoundError } from '../shared/domain-error.ts';
import type { FileStore } from './file-store.ts';
import { createMediaReader } from './media-reader.ts';

export interface MediaRoutesOptions {
  db: Kysely<DB>;
  fileStore: FileStore;
}

/** A content hash: SHA-256 as 64 lower-case hex characters (2.0.1). */
const HASH_PATTERN = /^[0-9a-f]{64}$/;

/** Stored files never change under their hash (ADR-004, 2.11). */
const IMMUTABLE = 'private, max-age=31536000, immutable';

// Any string, so a wrong hash ends in `404` below and not in `400 bad_request` (2.0.1).
const hashParams = z.strictObject({ hash: z.string() });

/**
 * Media routes (CU-091, Technical Specification 2.0.1, 2.2): `GET /media/logo/{hash}`. The hash
 * is checked before any file access; a wrong or unknown one answers `404`. The image goes out
 * with the fixed content type of its stored type (TH-04), never one derived from the request.
 * Photos, thumbnails and the photo routes follow in S7.
 */
export const mediaRoutes: FastifyPluginAsyncZod<MediaRoutesOptions> = async (
  app,
  { db, fileStore },
) => {
  const reader = createMediaReader({ db, fileStore });

  app.get('/media/logo/:hash', { schema: { params: hashParams } }, async (request, reply) => {
    const { hash } = request.params;
    if (!HASH_PATTERN.test(hash)) throw new NotFoundError();
    const logo = await reader.findLogo(hash);
    if (logo === null) throw new NotFoundError();
    return reply
      .type(logo.mime)
      .header('cache-control', IMMUTABLE)
      .send(createReadStream(logo.path));
  });
};
