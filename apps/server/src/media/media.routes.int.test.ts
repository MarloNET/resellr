import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sha256, testImages } from '../../test/images.ts';
import { createTestApp, HOST } from '../../test/test-app.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });

/** A logo as the file intake leaves it: the file under its hash and its row (2.11). */
function storeLogo(hash: string, file: Buffer, ext: 'png' | 'jpg') {
  const folder = join(t.dataDir, 'media', 'logo');
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `${hash}.${ext}`), file);
  t.database.sqlite
    .prepare(
      "INSERT INTO media_file (hash, kind, ext, mime, byte_size, width, height, created_at) VALUES (?, 'logo', ?, ?, ?, 120, 40, '2026-11-13T09:00:00.000Z')",
    )
    .run(hash, ext, ext === 'png' ? 'image/png' : 'image/jpeg', file.length);
}

describe('media routes (CU-091, Technical Specification 2.0.1)', () => {
  it.each([
    ['png', 'image/png', () => testImages.png()],
    ['jpg', 'image/jpeg', () => testImages.jpeg()],
  ] as const)(
    'DER-42-10 serves a %s logo with the fixed content type %s',
    async (ext, contentType, image) => {
      const file = await image();
      const hash = sha256(file);
      storeLogo(hash, file, ext);

      const response = await get(`/media/logo/${hash}`);

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe(contentType);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['cache-control']).toBe('private, max-age=31536000, immutable');
      expect(response.rawPayload.equals(file)).toBe(true);
    },
  );

  it('DER-42-10 answers 404 for a hash that is not 64 lower-case hex characters, before any file access', async () => {
    // A file and a row exist under the upper-case name, so only the check before the file
    // access can lead to 404.
    const file = await testImages.png();
    const upperCase = sha256(file).toUpperCase();
    storeLogo(upperCase, file, 'png');

    for (const hash of [
      upperCase,
      sha256(file).slice(0, 63),
      `${sha256(file)}0`,
      '..%2F..%2Fresellr.db',
    ]) {
      const response = await get(`/media/logo/${hash}`);

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('not_found');
    }
  });

  it('answers 404 for a valid hash without file or row', async () => {
    const file = await testImages.png();
    const hash = sha256(file);
    // Row without file.
    t.database.sqlite
      .prepare(
        "INSERT INTO media_file (hash, kind, ext, mime, byte_size, width, height, created_at) VALUES (?, 'logo', 'png', 'image/png', 1, 1, 1, '2026-11-13T09:00:00.000Z')",
      )
      .run(hash);

    expect((await get(`/media/logo/${hash}`)).statusCode).toBe(404);
    expect((await get(`/media/logo/${'0'.repeat(64)}`)).statusCode).toBe(404);
  });
});

/** A photo as the file intake leaves it: original and thumbnail under the hash, and its row. */
function storePhoto(hash: string, file: Buffer, ext: 'png' | 'jpg', thumb: Buffer) {
  const folder = join(t.dataDir, 'media', 'photos', hash.slice(0, 2));
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `${hash}.${ext}`), file);
  mkdirSync(join(t.dataDir, 'media', 'thumbs'), { recursive: true });
  writeFileSync(join(t.dataDir, 'media', 'thumbs', `${hash}.jpg`), thumb);
  t.database.sqlite
    .prepare(
      "INSERT INTO media_file (hash, kind, ext, mime, byte_size, width, height, created_at) VALUES (?, 'photo', ?, ?, ?, 120, 40, '2026-11-13T09:00:00.000Z')",
    )
    .run(hash, ext, ext === 'png' ? 'image/png' : 'image/jpeg', file.length);
}

describe('photo and thumbnail routes (CU-091, Technical Specification 2.0.1, 2.11)', () => {
  it.each([
    ['png', 'image/png', () => testImages.png()],
    ['jpg', 'image/jpeg', () => testImages.jpeg()],
  ] as const)(
    'DER-80-07 serves a %s photo with the fixed content type %s and its thumbnail as JPEG',
    async (ext, contentType, image) => {
      const file = await image();
      const thumb = await testImages.jpeg('#000000');
      const hash = sha256(file);
      storePhoto(hash, file, ext, thumb);

      const photo = await get(`/media/photos/${hash}`);
      const thumbnail = await get(`/media/thumbs/${hash}`);

      for (const response of [photo, thumbnail]) {
        expect(response.statusCode).toBe(200);
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['cache-control']).toBe('private, max-age=31536000, immutable');
      }
      expect(photo.headers['content-type']).toBe(contentType);
      expect(photo.rawPayload.equals(file)).toBe(true);
      expect(thumbnail.headers['content-type']).toBe('image/jpeg');
      expect(thumbnail.rawPayload.equals(thumb)).toBe(true);
    },
  );

  it('DER-80-07 answers 404 for a hash that is not 64 lower-case hex characters, before any file access', async () => {
    // Files and a row exist under the upper-case name, so only the check before the file
    // access can lead to 404.
    const file = await testImages.png();
    const upperCase = sha256(file).toUpperCase();
    storePhoto(upperCase, file, 'png', file);

    for (const path of ['photos', 'thumbs']) {
      for (const hash of [
        upperCase,
        sha256(file).slice(0, 63),
        `${sha256(file)}0`,
        '..%2F..%2Fresellr.db',
      ]) {
        const response = await get(`/media/${path}/${hash}`);

        expect(response.statusCode).toBe(404);
        expect(response.json().error.code).toBe('not_found');
      }
    }
  });

  it('answers 404 for a valid hash without file or row, and for the hash of a logo', async () => {
    const logo = await testImages.png();
    storeLogo(sha256(logo), logo, 'png');

    for (const path of ['photos', 'thumbs']) {
      expect((await get(`/media/${path}/${sha256(logo)}`)).statusCode).toBe(404);
      expect((await get(`/media/${path}/${'0'.repeat(64)}`)).statusCode).toBe(404);
    }
  });
});
