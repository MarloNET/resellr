import type { Readable } from 'node:stream';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWorkRunner } from '../db/unit-of-work.ts';
import { createInventoryReader } from '../inventory/index.ts';
import type { Clock } from '../shared/clock.ts';
import { NotFoundError, RuleViolation, ShuttingDownError } from '../shared/domain-error.ts';
import type { MediaFileIntake } from './media-file-intake.ts';
import { createPhotoRepository } from './photo-repository.ts';
import { type Photo, toPhoto } from './photo-service.ts';

/** Largest photo file: 20 MB (2.11, REQ-042). */
export const PHOTO_MAX_BYTES = 20 * 1024 * 1024;

/** Highest number of photos of a model listing (2.0.6, AC-REQ-042-03). */
export const MAX_PHOTOS = 20;

export interface PhotoUploadServiceDeps {
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
  /** File intake of `media` (CU-090): checks and stores the photo with its thumbnail. */
  mediaFiles: MediaFileIntake;
  /** State `stopping` of the server (2.17), checked before the transaction. */
  isStopping: () => boolean;
}

export interface PhotoUploadResult {
  photo: Photo;
  /** The version of the model listing read in the transaction, unchanged (Nachtrag MAR-1280). */
  listingVersion: number;
  count: number;
}

/**
 * Photo upload (CU-204, REQ-042; Technical Specification 2.11, Nachtrag MAR-1280): one file per
 * request, without version check (2.0.3, T-2). The file intake (CU-090) checks the file (`413`,
 * `415` with its name) and places it with its thumbnail under the lock of its hash; still under
 * the lock, after the check of `stopping`, one transaction checks the model listing through
 * `findListing` (CU-129, `404`) and the number of photos (`photo_limit_reached`), registers the
 * file, appends the photo at position max + 1, reports `ContentInputsChanged` and writes the
 * audit entry `photo_added`. Until the architecture change "Version des Modell-Inserats bei
 * Foto-Änderungen" the version of the model listing stays unchanged (4.4.0, S7).
 */
export function createPhotoUploadService({
  uow,
  clock,
  mediaFiles,
  isStopping,
}: PhotoUploadServiceDeps) {
  return {
    /** `POST /api/listings/{id}/photos`. */
    async upload({
      listingId,
      file,
      fileName,
    }: {
      listingId: number;
      file: Readable;
      fileName: string;
    }): Promise<PhotoUploadResult> {
      const options = {
        kind: 'photo',
        maxBytes: PHOTO_MAX_BYTES,
        usage: 'photo',
        fileName,
      } as const;
      return mediaFiles.intake(file, options, async (register) => {
        // A long upload may outlast the start of the shutdown (2.17 step 3).
        if (isStopping()) throw new ShuttingDownError();
        const { result } = await uow.run(async (tx) => {
          const listing = await createInventoryReader(tx.db).findListing(listingId);
          if (listing === undefined) throw new NotFoundError();
          const photos = createPhotoRepository(tx.db);
          const { count, maxPosition } = await photos.countByListing(listingId);
          if (count >= MAX_PHOTOS) throw new RuleViolation('photo_limit_reached');

          const hash = await register(tx.db);
          const position = maxPosition + 1;
          const id = await photos.insert({
            listingId,
            fileHash: hash,
            originalName: fileName,
            position,
            createdAt: clock.now().toISOString(),
          });
          tx.emit({ type: 'ContentInputsChanged', listingIds: [listingId] });
          await createAuditWriter({ db: tx.db, clock }).write({
            objectType: 'listing',
            objectId: listingId,
            objectLabel: listing.displayTitle,
            action: 'photo_added',
            oldValue: null,
            newValue: { Datei: fileName, Nummer: position },
          });
          const photo = await photos.findById(id);
          return {
            photo: toPhoto(photo!),
            listingVersion: listing.version,
            count: count + 1,
          };
        });
        return result;
      });
    },
  };
}

export type PhotoUploadService = ReturnType<typeof createPhotoUploadService>;
