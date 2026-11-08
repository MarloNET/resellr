// Generates the bundled 4000 x 3000 JPEG test file for the server self test (no binary in the repository).
// Usage: node make-test-image.mjs <appDir> <out.jpg>
import path from 'node:path';
import { createRequire } from 'node:module';

const [appDir, outFile] = process.argv.slice(2);
const require = createRequire(path.join(path.resolve(appDir), 'package.json'));
const sharp = require('sharp');

const info = await sharp({
  create: { width: 4000, height: 3000, channels: 3, background: { r: 90, g: 120, b: 150 }, noise: { type: 'gaussian', mean: 128, sigma: 40 } },
})
  .jpeg({ quality: 85 })
  .toFile(outFile);
console.log(JSON.stringify({ file: outFile, width: info.width, height: info.height, size: info.size }));
