import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sha256, testImages } from '../../test/images.ts';
import { type Database, openDatabase } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';
import type { DB } from '../db/schema.ts';
import { createClock } from '../shared/clock.ts';
import { RuleViolation } from '../shared/domain-error.ts';
import { withHashLock } from './file-store.ts';
import { createMediaFileIntake } from './media-file-intake.ts';

const PHOTO = { kind: 'photo', maxBytes: 20 * 1024 * 1024, usage: 'photo' } as const;

let root: string;
let mediaDir: string;
let database: Database<DB>;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'resellr-intake-'));
  mediaDir = join(root, 'media');
  database = openDatabase<DB>(join(root, 'resellr.db'));
  await runMigrations(database, migrations, () => new Date());
});

afterEach(async () => {
  await database.close();
  rmSync(root, { recursive: true, force: true });
});

const intake = () => createMediaFileIntake({ mediaDir, clock: createClock() });
const incoming = () => readdirSync(join(mediaDir, '.incoming'));
const photoPath = (hash: string, ext: string) =>
  join(mediaDir, 'photos', hash.slice(0, 2), `${hash}.${ext}`);
const thumbPath = (hash: string) => join(mediaDir, 'thumbs', `${hash}.jpg`);

describe('file intake of photos (CU-090, Technical Specification 2.11)', () => {
  it('places a photo under its hash with its thumbnail and registers it in the transaction of the caller', async () => {
    const file = await testImages.jpeg();
    const hash = sha256(file);

    const registered = await intake().intake(Readable.from(file), PHOTO, (register) =>
      register(database.db),
    );

    expect(registered).toBe(hash);
    expect(existsSync(photoPath(hash, 'jpg'))).toBe(true);
    const thumb = await sharp(thumbPath(hash)).metadata();
    expect({ format: thumb.format, width: thumb.width }).toEqual({ format: 'jpeg', width: 400 });
    expect(incoming()).toEqual([]);
    const row = database.sqlite
      .prepare(
        'SELECT kind, ext, mime, byte_size, unreferenced_since FROM media_file WHERE hash = ?',
      )
      .get(hash);
    expect(row).toEqual({
      kind: 'photo',
      ext: 'jpg',
      mime: 'image/jpeg',
      byte_size: file.length,
      unreferenced_since: null,
    });
  });

  it('DER-80-06 drops the temporary files of a photo already stored and resets unreferenced_since of its row', async () => {
    const file = await testImages.png();
    const hash = sha256(file);
    mkdirSync(join(mediaDir, 'photos', hash.slice(0, 2)), { recursive: true });
    mkdirSync(join(mediaDir, 'thumbs'), { recursive: true });
    writeFileSync(photoPath(hash, 'png'), 'stored photo');
    writeFileSync(thumbPath(hash), 'stored thumbnail');
    database.sqlite
      .prepare(
        "INSERT INTO media_file (hash, kind, ext, mime, byte_size, width, height, created_at, unreferenced_since) VALUES (?, 'photo', 'png', 'image/png', ?, 120, 40, '2026-11-13T09:00:00.000Z', '2026-11-20T09:00:00.000Z')",
      )
      .run(hash, file.length);

    await intake().intake(Readable.from(file), PHOTO, (register) => register(database.db));

    expect(incoming()).toEqual([]);
    expect(readdirSync(join(mediaDir, 'photos', hash.slice(0, 2)))).toEqual([`${hash}.png`]);
    expect(readFileSync(photoPath(hash, 'png'), 'utf8')).toBe('stored photo');
    expect(readFileSync(thumbPath(hash), 'utf8')).toBe('stored thumbnail');
    const row = database.sqlite
      .prepare('SELECT unreferenced_since, created_at FROM media_file WHERE hash = ?')
      .get(hash);
    expect(row).toEqual({ unreferenced_since: null, created_at: '2026-11-13T09:00:00.000Z' });
  });

  it('DER-80-06 holds the lock of the hash until the action of the caller has ended', async () => {
    const file = await testImages.png();
    const hash = sha256(file);
    const steps: string[] = [];
    let release!: () => void;
    const actionMayEnd = new Promise<void>((resolve) => (release = resolve));
    let actionStarted!: () => void;
    const started = new Promise<void>((resolve) => (actionStarted = resolve));

    const upload = intake().intake(Readable.from(file), PHOTO, async (register) => {
      await register(database.db);
      actionStarted();
      await actionMayEnd;
      steps.push('upload committed');
    });
    await started;
    // The housekeeping takes the same lock (2.19); it must wait for the commit.
    const housekeeping = withHashLock(hash, async () => {
      steps.push('housekeeping');
    });
    release();
    await Promise.all([upload, housekeeping]);

    expect(steps).toEqual(['upload committed', 'housekeeping']);
  });

  it.each([
    ['AC-REQ-042-02 a GIF file', () => testImages.gif(), 'unsupported_media_type'],
    [
      'DER-80-07 a .jpg file without a readable image',
      async () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('no image')]),
      'unsupported_media_type',
    ],
    ['AC-REQ-042-02 a file over 20 MB', () => testImages.pngOfSize(21), 'file_too_large'],
  ] as const)(
    '%s is rejected with the file name and leaves nothing behind',
    async (_, make, code) => {
      const file = await make();
      let rejection: unknown;

      try {
        await intake().intake(
          Readable.from(file),
          { ...PHOTO, fileName: 'Rückseite.jpg' },
          (register) => register(database.db),
        );
      } catch (error) {
        rejection = error;
      }

      expect(rejection).toBeInstanceOf(RuleViolation);
      expect(rejection).toMatchObject({ code, usage: 'photo', messageArgs: ['Rückseite.jpg'] });
      expect(incoming()).toEqual([]);
      expect(existsSync(join(mediaDir, 'photos'))).toBe(false);
      expect(existsSync(join(mediaDir, 'thumbs'))).toBe(false);
      expect(database.sqlite.prepare('SELECT COUNT(*) AS n FROM media_file').get()).toEqual({
        n: 0,
      });
    },
  );
});
