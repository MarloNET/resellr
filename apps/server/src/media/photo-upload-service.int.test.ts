import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { multipart, sha256, testImages } from '../../test/images.ts';
import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';
import { createUnitOfWork } from '../db/unit-of-work.ts';
import { createClock } from '../shared/clock.ts';
import { withHashLock } from './file-store.ts';
import { createMediaFileIntake } from './media-file-intake.ts';
import { createPhotoUploadService } from './photo-upload-service.ts';

// Integration tests of the photo upload (CU-204) with a real data folder: the check of the state
// `stopping` before the transaction and the lock of the hash until the commit (Technical
// Specification 2.11, 2.17; DER-80-06).

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let listingId: number;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  const { sqlite } = t.database;
  const one = <T>(sql: string) => sqlite.prepare(sql).get() as T;
  const modelTemplateId = insertModelTemplate(sqlite, {
    deviceTypeId: one<{ id: number }>("SELECT id FROM device_type WHERE name = 'Notebook'").id,
    manufacturerId: insertManufacturer(sqlite, 'Apple'),
    modelName: 'MacBook Pro 13',
    mpn: null,
  });
  const stamp = '2026-11-16T08:00:00.000Z';
  listingId = Number(
    sqlite
      .prepare(
        `INSERT INTO listing (model_template_id, condition_value_id, visual_grade,
           condition_description, condition_description_key, variant_values, other_device_values,
           article_number, article_number_key, ean_mode, display_title, quantity, stock_json,
           stock_hash, version, created_at, updated_at)
         VALUES (?, ?, 2, '', '', '{}', '{}', '626198', '626198', 'original', 'MacBook Pro 13',
           1, '{}', '', 1, ?, ?)`,
      )
      .run(
        modelTemplateId,
        one<{ id: number }>("SELECT id FROM pick_list_value WHERE label = 'gebraucht'").id,
        stamp,
        stamp,
      ).lastInsertRowid,
  );
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

function uploadService(isStopping: () => boolean) {
  const clock = createClock();
  return createPhotoUploadService({
    uow: createUnitOfWork(t.database.db),
    clock,
    mediaFiles: createMediaFileIntake({ mediaDir: join(t.dataDir, 'media'), clock }),
    isStopping,
  });
}

const count = (sql: string) => (t.database.sqlite.prepare(sql).get() as { n: number }).n;

describe('photo upload (CU-204, Technical Specification 2.11)', () => {
  it('DER-80-06 rejects with 503 shutting_down when resellr began to stop during the upload; nothing is stored in the database', async () => {
    const file = await testImages.jpeg();

    const upload = uploadService(() => true).upload({
      listingId,
      file: Readable.from(file),
      fileName: 'front.jpg',
    });

    await expect(upload).rejects.toMatchObject({ code: 'shutting_down' });
    expect(count('SELECT COUNT(*) AS n FROM listing_photo')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM media_file')).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM audit_entry WHERE action = 'photo_added'")).toBe(0);
    // The placed file stays without row; the housekeeping handles it (2.19).
    expect(readdirSync(join(t.dataDir, 'media', '.incoming'))).toEqual([]);
  });

  it('DER-80-06 answers 503 shutting_down to an upload in the state stopping', async () => {
    t.lifecycle.beginStopping();
    const { payload, contentType } = multipart([
      {
        name: 'file',
        value: await testImages.jpeg(),
        filename: 'front.jpg',
        contentType: 'image/jpeg',
      },
    ]);

    const response = await t.app.inject({
      method: 'POST',
      url: `/api/listings/${listingId}/photos`,
      headers: { ...SAME_ORIGIN_WRITE, 'content-type': contentType },
      payload,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('shutting_down');
    expect(count('SELECT COUNT(*) AS n FROM listing_photo')).toBe(0);
    expect(existsSync(join(t.dataDir, 'media', 'photos'))).toBe(false);
  });

  it('DER-80-06 frees the lock of the hash only after the commit', async () => {
    const file = await testImages.jpeg();
    const hash = sha256(file);
    let committedWhenLockFree: number | undefined;
    // The housekeeping waits for the lock (2.19); it starts as soon as the file is placed.
    let housekeeping: Promise<void> | undefined;
    const service = uploadService(() => {
      housekeeping = withHashLock(hash, async () => {
        committedWhenLockFree = count('SELECT COUNT(*) AS n FROM listing_photo');
      });
      return false;
    });

    await service.upload({ listingId, file: Readable.from(file), fileName: 'front.jpg' });
    await housekeeping;

    expect(committedWhenLockFree).toBe(1);
  });
});
