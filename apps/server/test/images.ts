import { createHash } from 'node:crypto';

import sharp from 'sharp';

const MB = 1024 * 1024;

const blank = (width: number, height: number, background: string) =>
  sharp({ create: { width, height, channels: 3, background } });

/** Small test images as the user would upload them (synthetic, no real logos). */
export const testImages = {
  png: (background = '#1f6feb') => blank(120, 40, background).png().toBuffer(),
  jpeg: (background = '#d1242f') => blank(120, 40, background).jpeg().toBuffer(),
  gif: () => blank(120, 40, '#2da44e').gif().toBuffer(),
  /** A valid PNG padded to `megabytes` MB, e.g. 6 MB for the limit of 5 MB (AC-REQ-028-02). */
  async pngOfSize(megabytes: number) {
    const png = await testImages.png();
    return Buffer.concat([png, Buffer.alloc(megabytes * MB - png.length)]);
  },
};

export const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

export interface MultipartPart {
  name: string;
  value: string | Buffer;
  /** File name and content type make the part a file. */
  filename?: string;
  contentType?: string;
}

/** Body and content type of a `multipart/form-data` request with the parts in this order. */
export function multipart(parts: MultipartPart[]) {
  const boundary = '----resellr-test-boundary';
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition =
      part.filename === undefined
        ? `form-data; name="${part.name}"`
        : `form-data; name="${part.name}"; filename="${part.filename}"`;
    const type = part.contentType === undefined ? '' : `Content-Type: ${part.contentType}\r\n`;
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: ${disposition}\r\n${type}\r\n`));
    chunks.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/** The logo upload of UI-026: field `version`, then the file (Technical Specification 2.2). */
export const logoUpload = (version: number | string, file: Buffer, filename = 'logo.png') =>
  multipart([
    { name: 'version', value: String(version) },
    { name: 'file', value: file, filename, contentType: 'image/png' },
  ]);
