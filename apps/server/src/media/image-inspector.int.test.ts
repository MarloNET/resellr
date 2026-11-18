import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { testImages } from '../../test/images.ts';
import { inspectImage } from './image-inspector.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'resellr-image-inspector-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const inspect = (data: Buffer) => {
  const path = join(root, 'upload');
  writeFileSync(path, data);
  return inspectImage(path);
};

describe('image inspector (CU-089, TH-04)', () => {
  it('reads type and dimensions of a PNG and a JPEG', async () => {
    expect(await inspect(await testImages.png())).toEqual({
      ext: 'png',
      mime: 'image/png',
      width: 120,
      height: 40,
    });
    expect(await inspect(await testImages.jpeg())).toEqual({
      ext: 'jpg',
      mime: 'image/jpeg',
      width: 120,
      height: 40,
    });
  });

  it.each([
    ['a GIF', () => testImages.gif()],
    ['a text', async () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ['an empty file', async () => Buffer.alloc(0)],
    [
      'the PNG signature without an image',
      async () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
    ],
    [
      'the JPEG signature in front of a PNG',
      async () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), await testImages.png()]),
    ],
  ])('rejects %s', async (_case, data) => {
    expect(await inspect(await data())).toBeNull();
  });
});
