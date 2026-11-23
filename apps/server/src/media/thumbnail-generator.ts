import sharp from 'sharp';

import { LIMIT_INPUT_PIXELS } from './image-inspector.ts';

/** Width of a thumbnail in pixels (Technical Specification 2.11). */
const THUMBNAIL_WIDTH = 400;

/** JPEG quality of a thumbnail (2.11). */
const THUMBNAIL_QUALITY = 80;

/**
 * Thumbnails (CU-205, REQ-042; Technical Specification 2.11): writes the thumbnail of a checked
 * photo to `targetPath` as JPEG, 400 px wide, turned upright after its EXIF orientation first.
 */
export async function generateThumbnail(sourcePath: string, targetPath: string): Promise<void> {
  await sharp(sourcePath, { limitInputPixels: LIMIT_INPUT_PIXELS })
    .rotate()
    .resize({ width: THUMBNAIL_WIDTH })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toFile(targetPath);
}
