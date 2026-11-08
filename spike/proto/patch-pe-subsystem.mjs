// Creates resellr-node.exe from node.exe (Specification 2.19, FIND-219):
// (1) Subsystem 3 (console) -> 2 (Windows GUI), (2) strip the Authenticode signature,
// (3) recompute the PE checksum. Usage: node patch-pe-subsystem.mjs <node.exe> <out.exe> [report.json]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SUBSYSTEM_GUI = 2;
const SUBSYSTEM_CONSOLE = 3;
const SECURITY_DIRECTORY_INDEX = 4;

export function readPeLayout(buf) {
  if (buf.readUInt16LE(0) !== 0x5a4d) throw new Error('missing MZ signature');
  const peOffset = buf.readUInt32LE(0x3c);
  if (buf.readUInt32LE(peOffset) !== 0x00004550) throw new Error('missing PE signature');
  const optionalHeader = peOffset + 4 + 20;
  const magic = buf.readUInt16LE(optionalHeader);
  let dataDirectories;
  if (magic === 0x20b) dataDirectories = optionalHeader + 112;
  else if (magic === 0x10b) dataDirectories = optionalHeader + 96;
  else throw new Error(`unknown optional header magic 0x${magic.toString(16)}`);
  const securityEntry = dataDirectories + SECURITY_DIRECTORY_INDEX * 8;
  return {
    peOffset,
    magic,
    checkSumOffset: optionalHeader + 64,
    subsystemOffset: optionalHeader + 68,
    securityEntryOffset: securityEntry,
    checkSum: buf.readUInt32LE(optionalHeader + 64),
    subsystem: buf.readUInt16LE(optionalHeader + 68),
    certTableOffset: buf.readUInt32LE(securityEntry),
    certTableSize: buf.readUInt32LE(securityEntry + 4),
  };
}

// Standard PE checksum: 16-bit one's-complement-style sum with carry, checksum field counted as 0, plus file length.
export function computePeChecksum(buf, checkSumOffset) {
  let sum = 0;
  const evenLength = buf.length & ~1;
  for (let i = 0; i < evenLength; i += 2) {
    if (i === checkSumOffset || i === checkSumOffset + 2) continue;
    sum += buf.readUInt16LE(i);
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  if (buf.length & 1) {
    sum += buf[buf.length - 1];
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  sum = (sum & 0xffff) + (sum >>> 16);
  return (sum + buf.length) >>> 0;
}

export function patchPe(source) {
  const before = readPeLayout(source);
  if (before.subsystem !== SUBSYSTEM_CONSOLE) {
    throw new Error(`expected console subsystem 3, found ${before.subsystem}`);
  }
  let out;
  let signatureRemoved = false;
  if (before.certTableOffset === 0 && before.certTableSize === 0) {
    out = Buffer.from(source);
  } else {
    if (before.certTableOffset + before.certTableSize !== source.length) {
      throw new Error(
        `certificate table is not at the end of the file (offset ${before.certTableOffset}, size ${before.certTableSize}, length ${source.length})`,
      );
    }
    out = Buffer.from(source.subarray(0, before.certTableOffset));
    signatureRemoved = true;
  }
  out.writeUInt16LE(SUBSYSTEM_GUI, before.subsystemOffset);
  out.writeUInt32LE(0, before.securityEntryOffset);
  out.writeUInt32LE(0, before.securityEntryOffset + 4);
  const checkSum = computePeChecksum(out, before.checkSumOffset);
  out.writeUInt32LE(checkSum, before.checkSumOffset);
  const after = readPeLayout(out);
  return {
    out,
    report: {
      signatureRemoved,
      note: signatureRemoved ? null : 'node.exe is not signed (security directory is 0); step 2 skipped',
      source: { length: source.length, ...before },
      result: { length: out.length, ...after },
    },
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [sourceFile, outFile, reportFile] = process.argv.slice(2);
  if (!sourceFile || !outFile) {
    console.error('usage: node patch-pe-subsystem.mjs <node.exe> <out.exe> [report.json]');
    process.exit(2);
  }
  const { out, report } = patchPe(fs.readFileSync(sourceFile));
  fs.writeFileSync(outFile, out);
  const text = JSON.stringify(report, null, 2);
  if (reportFile) fs.writeFileSync(reportFile, text);
  console.log(text);
}
