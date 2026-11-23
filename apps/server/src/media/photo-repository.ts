import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';

/** A photo of a model listing with the size of its file. */
export interface PhotoRow {
  id: number;
  file_hash: string;
  original_name: string;
  position: number;
  byte_size: number;
}

/**
 * Queries on `listing_photo` (CU-207, REQ-042; Technical Specification 2.11, 3.1). Inside an
 * action pass `tx.db`, outside of one the outer `db` (2.0.4, MAR-263).
 */
export function createPhotoRepository(db: Kysely<DB>) {
  const photos = () =>
    db
      .selectFrom('listing_photo')
      .innerJoin('media_file', 'media_file.hash', 'listing_photo.file_hash')
      .select([
        'listing_photo.id',
        'listing_photo.file_hash',
        'listing_photo.original_name',
        'listing_photo.position',
        'media_file.byte_size',
      ]);

  return {
    /** The photos of a model listing in their order. */
    async listByListing(listingId: number): Promise<PhotoRow[]> {
      return photos()
        .where('listing_photo.listing_id', '=', listingId)
        .orderBy('listing_photo.position')
        .execute();
    },

    async findById(id: number): Promise<PhotoRow | undefined> {
      return photos().where('listing_photo.id', '=', id).executeTakeFirst();
    },

    /** Number of photos and the highest position of a model listing (0 without photos). */
    async countByListing(listingId: number): Promise<{ count: number; maxPosition: number }> {
      const row = await db
        .selectFrom('listing_photo')
        .select((eb) => [
          eb.fn.countAll<number>().as('count'),
          eb.fn.coalesce(eb.fn.max('position'), eb.lit(0)).as('maxPosition'),
        ])
        .where('listing_id', '=', listingId)
        .executeTakeFirstOrThrow();
      return { count: Number(row.count), maxPosition: Number(row.maxPosition) };
    },

    /** Appends a photo; returns its id. */
    async insert(photo: {
      listingId: number;
      fileHash: string;
      originalName: string;
      position: number;
      createdAt: string;
    }): Promise<number> {
      const { id } = await db
        .insertInto('listing_photo')
        .values({
          listing_id: photo.listingId,
          file_hash: photo.fileHash,
          original_name: photo.originalName,
          position: photo.position,
          created_at: photo.createdAt,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },
  };
}

export type PhotoRepository = ReturnType<typeof createPhotoRepository>;
