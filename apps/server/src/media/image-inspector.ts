import { open } from 'node:fs/promises';

import sharp from 'sharp';

import type { MediaExt } from './file-store.ts';

/** Largest image sharp reads, in pixels (Technical Specification 2.11). */
export const LIMIT_INPUT_PIXELS = 100_000_000;

const SIGNATURES: { ext: MediaExt; mime: ImageMime; format: string; bytes: number[] }[] = [
  { ext: 'jpg', mime: 'image/jpeg', format: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  {
    ext: 'png',
    mime: 'image/png',
    format: 'png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
];

export type ImageMime = 'image/jpeg' | 'image/png';

export interface ImageInfo {
  ext: MediaExt;
  mime: ImageMime;
  width: number;
  height: number;
}

async function readHead(path: string, length: number): Promise<Buffer> {
  const file = await open(path, 'r');
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(length), 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

/**
 * Image check (CU-089, TH-04; Technical Specification 2.11): the signature decides the type
 * (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`), never the file name or the stated content
 * type; sharp then reads the dimensions. `null` for anything that is not a readable JPEG or PNG.
 */
export async function inspectImage(path: string): Promise<ImageInfo | null> {
  const head = await readHead(path, 8);
  const signature = SIGNATURES.find(({ bytes }) =>
    bytes.every((byte, index) => head[index] === byte),
  );
  if (signature === undefined) return null;

  try {
    const { format, width, height } = await sharp(path, {
      limitInputPixels: LIMIT_INPUT_PIXELS,
    }).metadata();
    if (format !== signature.format || !width || !height) return null;
    return { ext: signature.ext, mime: signature.mime, width, height };
  } catch {
    // Not a readable image, or larger than the pixel limit.
    return null;
  }
}
