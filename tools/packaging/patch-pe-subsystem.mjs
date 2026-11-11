// PE switch (CU-274, ADR-008 S1, Technical Specification 2.19 "Build des Pakets", 9.2 S-2,
// FIND-219): writes `resellr-node.exe` as a copy of `node.exe` that starts without a console
// window. Field "Subsystem" 3 (console) → 2 (Windows GUI); the Authenticode signature becomes
// invalid by that and is removed (certificate table cut off the end of the file, data directory
// entry 4 "Security Directory" set to 0); the PE checksum is computed anew. No other byte changes.
// Usage: `node tools/packaging/patch-pe-subsystem.mjs <node.exe> <resellr-node.exe>`.
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const SUBSYSTEM_WINDOWS_GUI = 2;
const SUBSYSTEM_WINDOWS_CUI = 3;
/** Offsets in the optional header, the same for PE32 and PE32+. */
const CHECKSUM_FIELD = 64;
const SUBSYSTEM_FIELD = 68;
/** Start of the data directories in the optional header by its magic (PE32, PE32+). */
const DATA_DIRECTORIES = new Map([
  [0x10b, 96],
  [0x20b, 112],
]);
const SECURITY_DIRECTORY_INDEX = 4;

/**
 * @typedef {object} PeHeader
 * @property {number} checksumOffset file offset of the PE checksum
 * @property {number} subsystemOffset file offset of the field "Subsystem"
 * @property {number} subsystem
 * @property {number} securityDirectoryOffset file offset of data directory entry 4
 * @property {{ address: number, size: number }} securityDirectory file offset and length of the
 *   certificate table (for this entry the address is a file offset, not a virtual address)
 */

/**
 * Reads the fields of the PE header that the switch touches; throws for anything that is not a
 * PE file with a known optional header.
 * @param {Buffer} file
 * @returns {PeHeader}
 */
export function readPeHeader(file) {
  if (file.length < 0x40 || file.toString('latin1', 0, 2) !== 'MZ') {
    throw new Error('Not a PE file: no MZ header');
  }
  const peOffset = file.readUInt32LE(0x3c);
  if (peOffset + 24 > file.length || file.toString('latin1', peOffset, peOffset + 4) !== 'PE\0\0') {
    throw new Error('Not a PE file: no PE signature');
  }
  const optionalHeader = peOffset + 24;
  const optionalHeaderSize = file.readUInt16LE(peOffset + 20);
  const magic = file.readUInt16LE(optionalHeader);
  const directories = DATA_DIRECTORIES.get(magic);
  if (directories === undefined) {
    throw new Error(`Unknown optional header magic 0x${magic.toString(16)}`);
  }
  const directoryCount = file.readUInt32LE(optionalHeader + directories - 4);
  const securityDirectoryOffset = optionalHeader + directories + SECURITY_DIRECTORY_INDEX * 8;
  if (
    directoryCount <= SECURITY_DIRECTORY_INDEX ||
    directories + (SECURITY_DIRECTORY_INDEX + 1) * 8 > optionalHeaderSize
  ) {
    throw new Error('PE file has no security directory entry');
  }
  return {
    checksumOffset: optionalHeader + CHECKSUM_FIELD,
    subsystemOffset: optionalHeader + SUBSYSTEM_FIELD,
    subsystem: file.readUInt16LE(optionalHeader + SUBSYSTEM_FIELD),
    securityDirectoryOffset,
    securityDirectory: {
      address: file.readUInt32LE(securityDirectoryOffset),
      size: file.readUInt32LE(securityDirectoryOffset + 4),
    },
  };
}

/**
 * PE checksum as `CheckSumMappedFile` computes it: 16-bit words with end-around carry, the
 * checksum field itself counted as 0, plus the file length.
 * @param {Buffer} file
 * @param {number} checksumOffset
 * @returns {number}
 */
export function computePeChecksum(file, checksumOffset) {
  let sum = 0;
  for (let i = 0; i < file.length; i += 2) {
    if (i === checksumOffset || i === checksumOffset + 2) continue;
    sum += i + 1 < file.length ? file.readUInt16LE(i) : (file[i] ?? 0);
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  sum = (sum & 0xffff) + (sum >>> 16);
  return (sum + file.length) >>> 0;
}

/**
 * Returns the switched copy of a console program; the input stays unchanged.
 * @param {Buffer} source contents of `node.exe`
 * @returns {Buffer}
 */
export function patchPeSubsystem(source) {
  const header = readPeHeader(source);
  if (header.subsystem !== SUBSYSTEM_WINDOWS_CUI) {
    throw new Error(
      `Expected subsystem ${SUBSYSTEM_WINDOWS_CUI} (console), found ${header.subsystem}`,
    );
  }
  const { address, size } = header.securityDirectory;
  if (address !== 0 && address + size !== source.length) {
    throw new Error('Certificate table is not at the end of the file');
  }

  // Cutting at the certificate table leaves every byte before it in place.
  const file = Buffer.from(address === 0 ? source : source.subarray(0, address));
  file.writeUInt16LE(SUBSYSTEM_WINDOWS_GUI, header.subsystemOffset);
  file.writeUInt32LE(0, header.securityDirectoryOffset);
  file.writeUInt32LE(0, header.securityDirectoryOffset + 4);
  file.writeUInt32LE(computePeChecksum(file, header.checksumOffset), header.checksumOffset);
  return file;
}

/**
 * @param {string | undefined} sourcePath
 * @param {string | undefined} targetPath
 */
function main(sourcePath, targetPath) {
  if (!sourcePath || !targetPath) {
    process.stderr.write('Usage: patch-pe-subsystem.mjs <node.exe> <resellr-node.exe>\n');
    process.exitCode = 1;
    return;
  }
  try {
    writeFileSync(targetPath, patchPeSubsystem(readFileSync(sourcePath)));
  } catch (error) {
    process.stderr.write(`PE switch failed: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) main(process.argv[2], process.argv[3]);
