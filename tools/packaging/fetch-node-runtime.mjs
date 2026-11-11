// Node.js runtime (CU-275, ADR-008, Technical Specification 2.19 "Build des Pakets"): loads
// `node-v<version>-win-x64.zip` from nodejs.org, checks it against `SHASUMS256.txt` and writes
// `node.exe` into the given folder. The version is the exact one in `.nvmrc`, so the shipped
// runtime is the one the build and the native modules use.
// Usage: `node tools/packaging/fetch-node-runtime.mjs <target folder>`.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { crc32, inflateRawSync } from 'node:zlib';

const DIST_URL = 'https://nodejs.org/dist';
const EXACT_VERSION = /^v?(\d+\.\d+\.\d+)$/;

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

/**
 * The exact Node.js version from the contents of `.nvmrc`.
 * @param {string} nvmrc
 * @returns {string} for example `26.13.0`
 */
export function nodeRuntimeVersion(nvmrc) {
  const match = EXACT_VERSION.exec(nvmrc.trim());
  if (!match?.[1]) throw new Error(`.nvmrc must name an exact Node.js version, found "${nvmrc}"`);
  return match[1];
}

/**
 * The SHA-256 of one file from `SHASUMS256.txt` (`<hex>  <file name>` per line).
 * @param {string} shasums
 * @param {string} fileName
 * @returns {string}
 */
export function expectedSha256(shasums, fileName) {
  for (const line of shasums.split('\n')) {
    const [hash, name] = line.trim().split(/\s+/);
    if (name === fileName && hash && /^[0-9a-f]{64}$/.test(hash)) return hash;
  }
  throw new Error(`SHASUMS256.txt has no checksum for ${fileName}`);
}

/**
 * Contents of one entry of a ZIP archive, checked against its CRC-32. ZIP64 is not needed: the
 * Windows archive of Node.js is far below 4 GB and 65 535 entries.
 * @param {Buffer} zip
 * @param {string} entryName path inside the archive, with `/`
 * @returns {Buffer}
 */
export function extractZipEntry(zip, entryName) {
  const end = zip.lastIndexOf(uint32(END_OF_CENTRAL_DIRECTORY));
  if (end < 0 || end + 22 > zip.length) throw new Error('Not a ZIP archive');
  const entryCount = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);

  for (let i = 0; i < entryCount; i++) {
    if (zip.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new Error('Damaged ZIP central directory');
    }
    const nameLength = zip.readUInt16LE(offset + 28);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === entryName) {
      return readEntry(zip, {
        method: zip.readUInt16LE(offset + 10),
        crc: zip.readUInt32LE(offset + 16),
        compressedSize: zip.readUInt32LE(offset + 20),
        size: zip.readUInt32LE(offset + 24),
        localHeader: zip.readUInt32LE(offset + 42),
        name,
      });
    }
    offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
  }
  throw new Error(`ZIP archive has no entry ${entryName}`);
}

/**
 * @param {Buffer} zip
 * @param {{ method: number, crc: number, compressedSize: number, size: number,
 *   localHeader: number, name: string }} entry
 */
function readEntry(zip, { method, crc, compressedSize, size, localHeader, name }) {
  if (zip.readUInt32LE(localHeader) !== LOCAL_FILE_HEADER) {
    throw new Error(`Damaged ZIP entry ${name}`);
  }
  const dataStart =
    localHeader + 30 + zip.readUInt16LE(localHeader + 26) + zip.readUInt16LE(localHeader + 28);
  const data = zip.subarray(dataStart, dataStart + compressedSize);
  let content;
  if (method === STORED) content = Buffer.from(data);
  else if (method === DEFLATED) content = inflateRawSync(data);
  else throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
  if (content.length !== size || crc32(content) !== crc) {
    throw new Error(`Damaged ZIP entry ${name}: CRC-32 does not match`);
  }
  return content;
}

/** @param {number} value */
function uint32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

/**
 * @typedef {(url: string) => Promise<Response>} Fetch
 */

/**
 * @param {Fetch} fetch
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function download(fetch, url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download of ${url} failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Loads the Windows x64 runtime, checks the archive against `SHASUMS256.txt` before it is
 * opened, and writes `node.exe`; on a mismatch nothing is written.
 * @param {{ version: string, outDir: string, fetch?: Fetch, distUrl?: string }} options
 * @returns {Promise<string>} path of the written `node.exe`
 */
export async function fetchNodeRuntime({ version, outDir, fetch = globalThis.fetch, distUrl }) {
  const base = `${distUrl ?? DIST_URL}/v${version}`;
  const zipName = `node-v${version}-win-x64.zip`;
  const expected = expectedSha256(
    (await download(fetch, `${base}/SHASUMS256.txt`)).toString('utf8'),
    zipName,
  );
  const zip = await download(fetch, `${base}/${zipName}`);
  const actual = createHash('sha256').update(zip).digest('hex');
  if (actual !== expected) {
    throw new Error(`Checksum of ${zipName} does not match SHASUMS256.txt`);
  }

  const nodeExe = extractZipEntry(zip, `node-v${version}-win-x64/node.exe`);
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, 'node.exe');
  writeFileSync(target, nodeExe);
  return target;
}

/** @param {string | undefined} outDir */
async function main(outDir) {
  if (!outDir) {
    process.stderr.write('Usage: fetch-node-runtime.mjs <target folder>\n');
    process.exitCode = 1;
    return;
  }
  try {
    const nvmrc = readFileSync(fileURLToPath(new URL('../../.nvmrc', import.meta.url)), 'utf8');
    const version = nodeRuntimeVersion(nvmrc);
    const target = await fetchNodeRuntime({ version, outDir });
    process.stdout.write(`Node.js ${version} checked against SHASUMS256.txt: ${target}\n`);
  } catch (error) {
    process.stderr.write(`Node.js runtime: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await main(process.argv[2]);
