import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CONFIG_FILE_NAME,
  DEFAULT_PORT,
  parseConfigText,
  readConfiguredPort,
  resolvePort,
} from './configured-port.ts';

describe('parseConfigText (CU-309)', () => {
  it('returns the JSON object', () => {
    expect(parseConfigText('{ "port": 4311, "handoverDir": "D:\\\\x" }')).toEqual({
      port: 4311,
      handoverDir: 'D:\\x',
    });
  });

  it('removes a leading UTF-8 BOM (FIND-267)', () => {
    expect(parseConfigText('\uFEFF{ "port": 4311 }')).toEqual({ port: 4311 });
  });

  it.each([
    ['invalid JSON', '{ "port": 4311'],
    ['an empty text', ''],
    ['an array', '[4311]'],
    ['a number', '4311'],
    ['a string', '"4311"'],
    ['null', 'null'],
  ])('returns null for %s', (_, text) => {
    expect(parseConfigText(text)).toBeNull();
  });
});

describe('resolvePort (CU-309)', () => {
  it.each([1, 4311, 65535])('accepts %s', (port) => {
    expect(resolvePort({ port })).toEqual({ port, problem: null });
  });

  it('uses 4310 without a problem when port is missing', () => {
    expect(resolvePort({ handoverDir: 'D:\\x' })).toEqual({ port: 4310, problem: null });
  });

  it.each([['4311'], [0], [4310.5], [70000], [65536], [-1], [null], [true]])(
    'uses 4310 with invalid_port for %j',
    (port) => {
      expect(resolvePort({ port })).toEqual({ port: 4310, problem: 'invalid_port' });
    },
  );
});

describe('readConfiguredPort (CU-309)', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'resellr-configured-port-'));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  const write = (text: string) => writeFileSync(join(dataDir, CONFIG_FILE_NAME), text);

  it('uses 4310 without a problem and creates nothing when config.json is missing', () => {
    expect(readConfiguredPort(dataDir)).toEqual({ port: DEFAULT_PORT, problem: null });
    expect(readdirSync(dataDir)).toEqual([]);
  });

  it('reads the port, also behind a BOM', () => {
    write('\uFEFF{ "port": 4311 }');

    expect(readConfiguredPort(dataDir)).toEqual({ port: 4311, problem: null });
  });

  it.each([
    ['no JSON object', '[4311]', 'not_a_json_object'],
    ['port as text', '{ "port": "4311" }', 'invalid_port'],
    ['port 0', '{ "port": 0 }', 'invalid_port'],
    ['port 4310.5', '{ "port": 4310.5 }', 'invalid_port'],
    ['port 70000', '{ "port": 70000 }', 'invalid_port'],
  ])('uses 4310 on %s and leaves the file unchanged', (_, text, problem) => {
    write(text);

    expect(readConfiguredPort(dataDir)).toEqual({ port: 4310, problem });
    expect(readFileSync(join(dataDir, CONFIG_FILE_NAME), 'utf8')).toBe(text);
  });
});
