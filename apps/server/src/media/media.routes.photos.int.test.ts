import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { logoUpload, multipart, sha256, testImages } from '../../test/images.ts';
import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';

// API tests of `GET` and `POST /api/listings/{id}/photos` (CU-091, CU-204, CU-206, CU-207,
// CU-129; Technical Specification 2.11, Nachtrag MAR-1280) with a real data folder. MI-A is
// created from a checked device of MV-A through the API (#197).

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let ids: Record<'mvA' | 'mvB' | 'used', number>;

const FILE_RULE = (name: string) => `${name}: nur JPEG oder PNG bis 20 MB`;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  const { sqlite } = t.database;
  const one = <T>(sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...params) as T;
  const notebook = one<{ id: number }>("SELECT id FROM device_type WHERE name = 'Notebook'").id;
  const apple = insertManufacturer(sqlite, 'Apple');
  ids = {
    mvA: insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: apple,
      modelName: 'MacBook Pro 13',
      typeDesignation: 'A1989',
      mpn: 'MR9Q2D/A',
    }),
    mvB: insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: apple,
      modelName: 'MacBook Air 13',
      typeDesignation: 'A2337',
      mpn: 'MGN63D/A',
    }),
    used: one<{ id: number }>("SELECT id FROM pick_list_value WHERE label = 'gebraucht'").id,
  };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

/**
 * Creates MI-A from a checked device of MV-A (or MI-B of MV-B) through the API; returns its id.
 * The device has no values: like prices, photos check no attribute values (A-39,
 * AC-REQ-005-12 (c), DER-34-25).
 */
async function createListing(modelTemplate: 'mvA' | 'mvB' = 'mvA'): Promise<number> {
  const wiNr = modelTemplate === 'mvA' ? '626198' : '626199';
  // A device without the required values is only possible while they are deactivated, so the test
  // writes it into the database like the data of the example of AC-REQ-005-12.
  const stamp = '2026-11-16T08:00:00.000Z';
  const deviceId = Number(
    t.database.sqlite
      .prepare(
        `INSERT INTO device (wi_nr, wi_nr_key, model_template_id, condition_value_id, visual_grade,
           condition_description, device_values, review_keys, capture_status, stock_status,
           captured_at, captured_on, version, updated_at)
         VALUES (?, ?, ?, ?, 2, '', '{}', '[]', 'checked', 'available', ?, '2026-11-16', 1, ?)`,
      )
      .run(wiNr, wiNr, ids[modelTemplate], ids.used, stamp, stamp).lastInsertRowid,
  );
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/listings',
    headers: SAME_ORIGIN_WRITE,
    payload: { fromDeviceId: deviceId, deviceVersion: 1 },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: number }>().id;
}

/** One file per request, field `file`, without `version` (2.0.1, 2.11, T-2). */
function upload(listingId: number, file: Buffer, filename: string, contentType = 'image/jpeg') {
  const { payload, contentType: type } = multipart([
    { name: 'file', value: file, filename, contentType },
  ]);
  return t.app.inject({
    method: 'POST',
    url: `/api/listings/${listingId}/photos`,
    headers: { ...SAME_ORIGIN_WRITE, 'content-type': type },
    payload,
  });
}

const getPhotos = (listingId: number) =>
  t.app.inject({
    method: 'GET',
    url: `/api/listings/${listingId}/photos`,
    headers: { host: HOST },
  });

const rows = (sql: string, ...params: unknown[]) =>
  t.database.sqlite.prepare(sql).all(...params) as Record<string, unknown>[];

const photoRows = () =>
  rows('SELECT listing_id, file_hash, original_name, position FROM listing_photo ORDER BY id');

const photoAudit = () =>
  rows(
    `SELECT object_type, object_category, object_id, object_label, old_value, new_value
       FROM audit_entry WHERE action = 'photo_added' ORDER BY id`,
  );

const listingState = (id: number) =>
  rows('SELECT version, updated_at FROM listing WHERE id = ?', id)[0];

const mediaFiles = (...parts: string[]) => {
  const folder = join(t.dataDir, 'media', ...parts);
  return existsSync(folder) ? readdirSync(folder) : [];
};

/** Distinct small JPEGs, like photos of different sides of a device. */
const jpeg = (index: number) =>
  sharp({
    create: { width: 120, height: 40, channels: 3, background: { r: index, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();

describe('POST /api/listings/{id}/photos (CU-204, Technical Specification 2.11)', () => {
  it('stores a photo with its thumbnail under its hash and answers 201 { photo, listingVersion, count } with the version unchanged (Nachtrag MAR-1280)', async () => {
    const listingId = await createListing();
    const before = listingState(listingId);
    const file = await testImages.jpeg();
    const hash = sha256(file);

    const response = await upload(listingId, file, 'front.jpg');

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({
      photo: {
        id: expect.any(Number),
        hash,
        position: 1,
        originalName: 'front.jpg',
        byteSize: file.length,
        url: `/media/photos/${hash}`,
        thumbUrl: `/media/thumbs/${hash}`,
      },
      listingVersion: before?.version,
      count: 1,
    });
    expect(listingState(listingId)).toEqual(before);
    expect(photoRows()).toEqual([
      { listing_id: listingId, file_hash: hash, original_name: 'front.jpg', position: 1 },
    ]);
    expect(mediaFiles('photos', hash.slice(0, 2))).toEqual([`${hash}.jpg`]);
    expect(mediaFiles('thumbs')).toEqual([`${hash}.jpg`]);
    expect(mediaFiles('.incoming')).toEqual([]);
    expect(photoAudit()).toEqual([
      {
        object_type: 'listing',
        object_category: 'listing',
        object_id: listingId,
        object_label: 'MacBook Pro 13',
        old_value: null,
        new_value: JSON.stringify({ Datei: 'front.jpg', Nummer: 1 }),
      },
    ]);

    const photo = await t.app.inject({
      method: 'GET',
      url: body.photo.url,
      headers: { host: HOST },
    });
    expect(photo.statusCode).toBe(200);
    expect(photo.rawPayload.equals(file)).toBe(true);
  });

  it('appends each further photo at position max + 1 and counts them', async () => {
    const listingId = await createListing();

    for (const index of [1, 2, 3]) {
      const response = await upload(listingId, await jpeg(index), `${index}.jpg`);
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ photo: { position: index }, count: index });
    }

    expect(photoRows().map(({ original_name, position }) => [original_name, position])).toEqual([
      ['1.jpg', 1],
      ['2.jpg', 2],
      ['3.jpg', 3],
    ]);
  });

  it.each([
    ['GIF file', () => testImages.gif(), 'Foto.gif', 415, 'unsupported_media_type'],
    ['file over 20 MB', () => testImages.pngOfSize(21), 'Gross.png', 413, 'file_too_large'],
  ] as const)(
    'AC-REQ-042-02 rejects a %s with the reason and the file name; nothing is stored',
    async (_, make, name, status, code) => {
      const listingId = await createListing();

      const response = await upload(listingId, await make(), name);

      expect(response.statusCode).toBe(status);
      expect(response.json().error).toMatchObject({ code, message: FILE_RULE(name) });
      expect(photoRows()).toEqual([]);
      expect(rows('SELECT hash FROM media_file')).toEqual([]);
      expect(mediaFiles('.incoming')).toEqual([]);
      expect(mediaFiles('photos')).toEqual([]);
      expect(photoAudit()).toEqual([]);
    },
  );

  it('AC-REQ-042-02 accepts a file of exactly 20 MB', async () => {
    const listingId = await createListing();

    const response = await upload(
      listingId,
      await testImages.pngOfSize(20),
      'Genau.png',
      'image/png',
    );

    expect(response.statusCode).toBe(201);
  });

  it('DER-80-07 rejects a .jpg file without a readable image with 415 and the file name', async () => {
    const listingId = await createListing();
    const notAnImage = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('kein Bild')]);

    const response = await upload(listingId, notAnImage, 'Kaputt.jpg');

    expect(response.statusCode).toBe(415);
    expect(response.json().error).toMatchObject({
      code: 'unsupported_media_type',
      message: FILE_RULE('Kaputt.jpg'),
    });
    expect(photoRows()).toEqual([]);
    expect(mediaFiles('.incoming')).toEqual([]);
  });

  it('AC-REQ-042-03 rejects a 21st photo with 422 photo_limit_reached "Höchstens 20 Fotos je Modell-Inserat"', async () => {
    const listingId = await createListing();
    for (let index = 1; index <= 20; index += 1) {
      expect((await upload(listingId, await jpeg(index), `${index}.jpg`)).statusCode).toBe(201);
    }

    const response = await upload(listingId, await jpeg(21), '21.jpg');

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'photo_limit_reached',
      message: 'Höchstens 20 Fotos je Modell-Inserat',
    });
    expect(photoRows()).toHaveLength(20);
    expect(photoAudit()).toHaveLength(20);
  });

  it('DER-80-06 a photo already stored keeps its files, resets unreferenced_since and gets position max + 1', async () => {
    const first = await createListing('mvA');
    const second = await createListing('mvB');
    const file = await testImages.jpeg();
    const hash = sha256(file);
    expect((await upload(first, file, 'front.jpg')).statusCode).toBe(201);
    expect((await upload(second, await jpeg(7), 'andere.jpg')).statusCode).toBe(201);
    // The housekeeping found the file without reference after it was removed (2.19).
    t.database.sqlite
      .prepare(
        "UPDATE media_file SET unreferenced_since = '2026-11-20T09:00:00.000Z' WHERE hash = ?",
      )
      .run(hash);

    const response = await upload(second, file, 'gleich.jpg');

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ photo: { hash, position: 2 }, count: 2 });
    expect(mediaFiles('.incoming')).toEqual([]);
    expect(mediaFiles('photos', hash.slice(0, 2)).filter((name) => name.startsWith(hash))).toEqual([
      `${hash}.jpg`,
    ]);
    expect(rows('SELECT unreferenced_since FROM media_file WHERE hash = ?', hash)).toEqual([
      { unreferenced_since: null },
    ]);
    expect(rows('SELECT COUNT(*) AS n FROM media_file WHERE hash = ?', hash)).toEqual([{ n: 1 }]);
  });

  // The same content used as logo and as photo has one row whose kind stays the first use; the
  // files lie in the folder of each use and are served regardless of kind (Nachtrag MAR-1294).
  it.each([
    ['logo', 'photo'],
    ['photo', 'logo'],
  ] as const)(
    'DER-80-07 serves photo, thumbnail and logo of the same JPEG uploaded first as %s, then as %s',
    async (first, second) => {
      const listingId = await createListing();
      const file = await testImages.jpeg();
      const hash = sha256(file);
      const uploads = {
        logo: () => {
          const logo = logoUpload(1, file, 'logo.jpg');
          return t.app.inject({
            method: 'PUT',
            url: '/api/merchant-profile/logo',
            headers: { ...SAME_ORIGIN_WRITE, 'content-type': logo.contentType },
            payload: logo.payload,
          });
        },
        photo: () => upload(listingId, file, 'front.jpg'),
      };
      const created = { logo: 200, photo: 201 };

      expect((await uploads[first]()).statusCode).toBe(created[first]);
      expect((await uploads[second]()).statusCode).toBe(created[second]);

      const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });
      for (const path of ['photos', 'thumbs', 'logo']) {
        const response = await get(`/media/${path}/${hash}`);
        expect(response.statusCode, path).toBe(200);
        expect(response.headers['content-type'], path).toBe('image/jpeg');
      }
      expect((await get(`/media/photos/${hash}`)).rawPayload.equals(file)).toBe(true);
      expect((await get(`/media/logo/${hash}`)).rawPayload.equals(file)).toBe(true);
      expect(rows('SELECT kind FROM media_file WHERE hash = ?', hash)).toEqual([{ kind: first }]);
    },
  );

  it('answers 404 not_found for an unknown model listing with a valid file; no row and no audit entry (Nachtrag MAR-1280)', async () => {
    const response = await upload(404, await testImages.jpeg(), 'front.jpg');

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: 'not_found',
      message: 'Dieser Eintrag ist nicht mehr vorhanden.',
    });
    expect(photoRows()).toEqual([]);
    expect(photoAudit()).toEqual([]);
  });

  it('checks the file before the model listing: an unknown model listing with a file over 20 MB answers 413 (Nachtrag MAR-1280)', async () => {
    const response = await upload(404, await testImages.pngOfSize(21), 'Gross.png');

    expect(response.statusCode).toBe(413);
  });

  it('DER-34-25 adds a photo to a model listing without the value of a required attribute and shows no "<Merkmal> fehlt"', async () => {
    const listingId = await createListing();

    const response = await upload(listingId, await testImages.jpeg(), 'front.jpg');

    expect(response.statusCode).toBe(201);
    expect(response.body).not.toContain('fehlt');
  });

  it.each([
    ['without a file', [{ name: 'version', value: '1' }]],
    [
      'with the file in another field',
      [{ name: 'photo', value: Buffer.from('x'), filename: 'a.jpg', contentType: 'image/jpeg' }],
    ],
  ])('answers 400 bad_request %s', async (_, parts) => {
    const listingId = await createListing();
    const { payload, contentType } = multipart(parts);

    const response = await t.app.inject({
      method: 'POST',
      url: `/api/listings/${listingId}/photos`,
      headers: { ...SAME_ORIGIN_WRITE, 'content-type': contentType },
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(photoRows()).toEqual([]);
  });
});

describe('GET /api/listings/{id}/photos (CU-206, Technical Specification 2.11)', () => {
  it('lists the photos of a model listing in their order with file name, size and the addresses of photo and thumbnail', async () => {
    const listingId = await createListing();
    const other = await createListing('mvB');
    const front = await jpeg(1);
    const back = await testImages.png();
    await upload(listingId, front, 'Vorderseite.jpg');
    await upload(other, await jpeg(2), 'anderes.jpg');
    await upload(listingId, back, 'Rückseite.png', 'image/png');

    const response = await getPhotos(listingId);

    expect(response.statusCode).toBe(200);
    const photo = (file: Buffer, position: number, originalName: string) => ({
      id: expect.any(Number),
      hash: sha256(file),
      position,
      originalName,
      byteSize: file.length,
      url: `/media/photos/${sha256(file)}`,
      thumbUrl: `/media/thumbs/${sha256(file)}`,
    });
    expect(response.json()).toEqual({
      items: [photo(front, 1, 'Vorderseite.jpg'), photo(back, 2, 'Rückseite.png')],
      total: 2,
    });
  });

  it('lists no photos of a model listing without photos', async () => {
    const listingId = await createListing();

    const response = await getPhotos(listingId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], total: 0 });
  });

  it('answers 404 not_found for an unknown model listing', async () => {
    const response = await getPhotos(404);

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('not_found');
  });
});
