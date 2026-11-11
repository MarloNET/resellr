import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  expectedSha256,
  extractZipEntry,
  fetchNodeRuntime,
  nodeRuntimeVersion,
} from './fetch-node-runtime.mjs';

const VERSION = '26.13.0';
const ZIP_NAME = `node-v${VERSION}-win-x64.zip`;
const NODE_EXE = Buffer.from('MZ fake node.exe '.repeat(500));

/** A ZIP archive with one central directory, like the archives on nodejs.org. */
function zipOf(entries: Record<string, Buffer>, { store = false } = {}): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = store ? content : deflateRawSync(content);
    const method = store ? 0 : 8;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(content), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc32(content), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

function shasums(zip: Buffer): string {
  return [
    `${'a'.repeat(64)}  node-v${VERSION}-linux-x64.tar.xz`,
    `${sha256(zip)}  ${ZIP_NAME}`,
    `${'b'.repeat(64)}  node-v${VERSION}-win-x64.7z`,
    '',
  ].join('\n');
}

/** A `fetch` that serves fixed files and records the requested URLs. */
function fakeFetch(files: Record<string, Buffer | string>) {
  const requested: string[] = [];
  const fetch = async (url: string | URL) => {
    requested.push(String(url));
    const body = files[String(url)];
    if (body === undefined) return new Response('not found', { status: 404 });
    return new Response(typeof body === 'string' ? body : new Uint8Array(body));
  };
  return { fetch, requested };
}

describe('nodeRuntimeVersion', () => {
  it('reads an exact version from .nvmrc', () => {
    expect(nodeRuntimeVersion('26.13.0\n')).toBe('26.13.0');
    expect(nodeRuntimeVersion('v26.13.0')).toBe('26.13.0');
  });

  it.each(['26', '26.13', 'lts/*', ''])('rejects the inexact version %j', (text) => {
    expect(() => nodeRuntimeVersion(text)).toThrow();
  });
});

describe('expectedSha256', () => {
  it('finds the line of the archive in SHASUMS256.txt', () => {
    const zip = zipOf({ 'x.txt': Buffer.from('x') });
    expect(expectedSha256(shasums(zip), ZIP_NAME)).toBe(sha256(zip));
  });

  it('fails if the archive has no line', () => {
    expect(() => expectedSha256(`${'a'.repeat(64)}  other.zip\n`, ZIP_NAME)).toThrow(ZIP_NAME);
  });
});

describe('extractZipEntry', () => {
  it('extracts a deflated and a stored entry', () => {
    const entries = { 'a/node.exe': NODE_EXE, 'a/README.md': Buffer.from('readme') };
    expect(extractZipEntry(zipOf(entries), 'a/node.exe').equals(NODE_EXE)).toBe(true);
    expect(extractZipEntry(zipOf(entries, { store: true }), 'a/README.md').toString()).toBe(
      'readme',
    );
  });

  it('fails for a missing entry and for a damaged entry', () => {
    const zip = zipOf({ 'a/node.exe': NODE_EXE }, { store: true });
    expect(() => extractZipEntry(zip, 'a/other.exe')).toThrow('a/other.exe');

    const damaged = Buffer.from(zip);
    damaged[40] = (damaged[40] ?? 0) ^ 0xff;
    expect(() => extractZipEntry(damaged, 'a/node.exe')).toThrow();
  });
});

describe('fetchNodeRuntime', () => {
  let outDir: string;
  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'resellr-runtime-'));
  });
  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  const base = `https://nodejs.org/dist/v${VERSION}`;

  it('checks the loaded runtime against SHASUMS256.txt and writes node.exe', async () => {
    const zip = zipOf({ [`node-v${VERSION}-win-x64/node.exe`]: NODE_EXE });
    const { fetch, requested } = fakeFetch({
      [`${base}/SHASUMS256.txt`]: shasums(zip),
      [`${base}/${ZIP_NAME}`]: zip,
    });

    const target = await fetchNodeRuntime({ version: VERSION, outDir, fetch });

    expect(target).toBe(join(outDir, 'node.exe'));
    expect(readFileSync(target).equals(NODE_EXE)).toBe(true);
    expect(requested).toEqual([`${base}/SHASUMS256.txt`, `${base}/${ZIP_NAME}`]);
  });

  it('fails and writes nothing if the checksum of the archive does not match', async () => {
    const zip = zipOf({ [`node-v${VERSION}-win-x64/node.exe`]: NODE_EXE });
    const tampered = zipOf({ [`node-v${VERSION}-win-x64/node.exe`]: Buffer.from('MZ evil') });
    const { fetch } = fakeFetch({
      [`${base}/SHASUMS256.txt`]: shasums(zip),
      [`${base}/${ZIP_NAME}`]: tampered,
    });

    await expect(fetchNodeRuntime({ version: VERSION, outDir, fetch })).rejects.toThrow(
      /checksum/i,
    );
    expect(existsSync(join(outDir, 'node.exe'))).toBe(false);
  });

  it('fails if a download does not succeed', async () => {
    const { fetch } = fakeFetch({});

    await expect(fetchNodeRuntime({ version: VERSION, outDir, fetch })).rejects.toThrow('404');
  });
});
