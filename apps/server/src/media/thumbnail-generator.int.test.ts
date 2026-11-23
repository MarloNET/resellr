import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateThumbnail } from './thumbnail-generator.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'resellr-thumbnail-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#1f6feb' } });

describe('thumbnail generator (CU-205, Technical Specification 2.11)', () => {
  it('writes a JPEG 400 px wide with the aspect ratio of the photo', async () => {
    const source = join(root, 'photo');
    writeFileSync(source, await image(1200, 900).png().toBuffer());
    const target = join(root, 'thumb');

    await generateThumbnail(source, target);

    const { format, width, height } = await sharp(target).metadata();
    expect({ format, width, height }).toEqual({ format: 'jpeg', width: 400, height: 300 });
  });

  it('turns the photo upright after its EXIF orientation first', async () => {
    // Stored 1200 × 900, shown rotated by 90° (orientation 6), i.e. upright 900 × 1200.
    const source = join(root, 'photo');
    writeFileSync(
      source,
      await image(1200, 900).jpeg().withMetadata({ orientation: 6 }).toBuffer(),
    );
    const target = join(root, 'thumb');

    await generateThumbnail(source, target);

    const { width, height } = await sharp(target).metadata();
    expect({ width, height }).toEqual({ width: 400, height: 533 });
  });
});
