import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { computePeChecksum, patchPeSubsystem, readPeHeader } from './patch-pe-subsystem.mjs';

const SCRIPT = fileURLToPath(new URL('./patch-pe-subsystem.mjs', import.meta.url));

const PE_OFFSET = 0x80;
const OPTIONAL_HEADER = PE_OFFSET + 4 + 20;
const SUBSYSTEM = OPTIONAL_HEADER + 68;
const CHECKSUM = OPTIONAL_HEADER + 64;

interface FakePeOptions {
  magic?: number;
  subsystem?: number;
  /** Length of the certificate table appended at the end; 0 for an unsigned file. */
  certificateLength?: number;
  /** Bytes after the certificate table, which a valid signed file does not have. */
  trailing?: number;
}

/**
 * A minimal PE file: DOS header, PE signature, COFF header, optional header with 16 data
 * directories, a body of pseudo-random bytes and optionally a certificate table at the end.
 */
function fakePe({
  magic = 0x20b,
  subsystem = 3,
  certificateLength = 0,
  trailing = 0,
}: FakePeOptions = {}): Buffer {
  const optionalHeaderSize = magic === 0x20b ? 240 : 224;
  const bodyStart = OPTIONAL_HEADER + optionalHeaderSize;
  const certificateOffset = bodyStart + 1000;
  const file = Buffer.alloc(certificateOffset + certificateLength + trailing);
  for (let i = bodyStart; i < file.length; i++) file[i] = (i * 7919 + 13) & 0xff;

  file.write('MZ', 0, 'latin1');
  file.writeUInt32LE(PE_OFFSET, 0x3c);
  file.write('PE\0\0', PE_OFFSET, 'latin1');
  file.writeUInt16LE(0x8664, PE_OFFSET + 4);
  file.writeUInt16LE(optionalHeaderSize, PE_OFFSET + 4 + 16);
  file.writeUInt16LE(magic, OPTIONAL_HEADER);
  file.writeUInt32LE(0x1234abcd, CHECKSUM);
  file.writeUInt16LE(subsystem, SUBSYSTEM);
  const directories = OPTIONAL_HEADER + (magic === 0x20b ? 112 : 96);
  file.writeUInt32LE(16, directories - 4);
  if (certificateLength > 0) {
    file.writeUInt32LE(certificateOffset, directories + 4 * 8);
    file.writeUInt32LE(certificateLength, directories + 4 * 8 + 4);
  }
  return file;
}

/**
 * Reference PE checksum with 32-bit words, independent of the 16-bit implementation under test
 * (the algorithm of `CheckSumMappedFile`: checksum field counted as 0, folded, plus the length).
 */
function referenceChecksum(file: Buffer, checksumOffset: number): number {
  const padded = Buffer.alloc(Math.ceil(file.length / 4) * 4);
  file.copy(padded);
  padded.writeUInt32LE(0, checksumOffset);
  let sum = 0n;
  for (let i = 0; i < padded.length; i += 4) sum += BigInt(padded.readUInt32LE(i));
  sum = (sum & 0xffffffffn) + (sum >> 32n);
  sum = (sum & 0xffffn) + (sum >> 16n);
  sum = (sum + (sum >> 16n)) & 0xffffn;
  return Number(sum) + file.length;
}

describe('patchPeSubsystem', () => {
  it('DER-105-02 sets the subsystem from 3 (console) to 2 (Windows GUI)', () => {
    const patched = patchPeSubsystem(fakePe({ certificateLength: 4096 }));

    expect(patched.readUInt16LE(SUBSYSTEM)).toBe(2);
    expect(readPeHeader(patched).subsystem).toBe(2);
  });

  it('DER-105-02 removes the signature: security directory 0, file cut at the certificate table', () => {
    const original = fakePe({ certificateLength: 4096 });
    const { securityDirectory } = readPeHeader(original);

    const patched = patchPeSubsystem(original);

    // Without a certificate table the file is "NotSigned" for Authenticode.
    expect(readPeHeader(patched).securityDirectory).toMatchObject({ address: 0, size: 0 });
    expect(patched.length).toBe(securityDirectory.address);
  });

  it('DER-105-02 writes the newly computed PE checksum', () => {
    const patched = patchPeSubsystem(fakePe({ certificateLength: 4096 }));

    const stored = patched.readUInt32LE(CHECKSUM);
    expect(stored).toBe(referenceChecksum(patched, CHECKSUM));
    expect(stored).toBe(computePeChecksum(patched, CHECKSUM));
  });

  it('changes nothing else than the 14 fixed bytes before the certificate table (FIND-219)', () => {
    const original = fakePe({ certificateLength: 4096 });
    const patched = patchPeSubsystem(original);

    const differing = [];
    for (let i = 0; i < patched.length; i++) if (patched[i] !== original[i]) differing.push(i);

    const allowed = new Set<number>();
    const directory = readPeHeader(original).securityDirectoryOffset;
    for (let i = 0; i < 4; i++) allowed.add(CHECKSUM + i);
    for (let i = 0; i < 2; i++) allowed.add(SUBSYSTEM + i);
    for (let i = 0; i < 8; i++) allowed.add(directory + i);
    expect(differing.every((offset) => allowed.has(offset))).toBe(true);
    expect(differing.length).toBeLessThanOrEqual(14);
  });

  it('handles an unsigned file and a PE32 file', () => {
    const unsigned = patchPeSubsystem(fakePe());
    expect(readPeHeader(unsigned).subsystem).toBe(2);
    expect(unsigned.length).toBe(fakePe().length);

    const pe32 = patchPeSubsystem(fakePe({ magic: 0x10b, certificateLength: 512 }));
    expect(readPeHeader(pe32)).toMatchObject({ subsystem: 2, securityDirectory: { size: 0 } });
    expect(pe32.readUInt32LE(CHECKSUM)).toBe(referenceChecksum(pe32, CHECKSUM));
  });

  it('does not change the input buffer', () => {
    const original = fakePe({ certificateLength: 4096 });
    const copy = Buffer.from(original);

    patchPeSubsystem(original);

    expect(original.equals(copy)).toBe(true);
  });

  it.each([
    ['no MZ header', () => Buffer.from('not an executable file at all, just some text here')],
    [
      'no PE signature',
      () => {
        const file = fakePe();
        file.write('XX', PE_OFFSET, 'latin1');
        return file;
      },
    ],
    ['an unknown optional header', () => fakePe({ magic: 0x107 })],
    ['a file that is not a console program', () => fakePe({ subsystem: 2 })],
    [
      'a certificate table that is not at the end',
      () => fakePe({ certificateLength: 512, trailing: 16 }),
    ],
  ])('rejects %s', (_name, file) => {
    expect(() => patchPeSubsystem(file())).toThrow();
  });
});

describe('computePeChecksum', () => {
  it('matches the 32-bit reference for odd and even lengths', () => {
    for (const length of [1001, 1002, 1003, 4096]) {
      const file = Buffer.alloc(length);
      for (let i = 0; i < length; i++) file[i] = (i * 31 + 7) & 0xff;
      expect(computePeChecksum(file, 64)).toBe(referenceChecksum(file, 64));
    }
  });
});

describe('command line', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'resellr-pe-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes resellr-node.exe from node.exe', () => {
    const source = join(dir, 'node.exe');
    const target = join(dir, 'resellr-node.exe');
    writeFileSync(source, fakePe({ certificateLength: 4096 }));

    const run = spawnSync(process.execPath, [SCRIPT, source, target], { encoding: 'utf8' });

    expect(run.status).toBe(0);
    expect(readPeHeader(readFileSync(target)).subsystem).toBe(2);
    expect(readPeHeader(readFileSync(source)).subsystem).toBe(3);
  });

  it('ends with exit code 1 and writes nothing for an invalid file', () => {
    const source = join(dir, 'node.exe');
    const target = join(dir, 'resellr-node.exe');
    writeFileSync(source, fakePe({ subsystem: 2 }));

    const run = spawnSync(process.execPath, [SCRIPT, source, target], { encoding: 'utf8' });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('subsystem');
    expect(() => readFileSync(target)).toThrow();
  });
});
