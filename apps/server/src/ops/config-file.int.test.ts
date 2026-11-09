import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readConfiguredPort } from '@resellr/runtime-shared/configured-port';

import { checkHandoverDir, type HandoverDirContext, loadConfig } from './config-file.ts';
import type { OperationsEventDetails, OperationsLog } from './operations-log.ts';

let root: string;
let folders: HandoverDirContext;
let warnings: { event: string; details?: OperationsEventDetails }[];
const operationsLog: OperationsLog = {
  event: () => undefined,
  warn: (event, details) => warnings.push({ event, details }),
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'resellr-config-'));
  const appData = join(root, 'home', 'AppData', 'Local');
  folders = {
    dataDir: join(appData, 'resellr', 'Daten'),
    logDir: join(appData, 'resellr', 'Protokolle'),
    programDir: join(appData, 'Programs', 'resellr'),
    updateCopyDir: join(appData, 'resellr', 'Update-Kopien'),
    homeDir: join(root, 'home'),
  };
  warnings = [];
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const DEFAULT_HANDOVER = '/default/Fotoübergabe';
const load = () => loadConfig({ defaultHandoverDir: DEFAULT_HANDOVER, folders, operationsLog });
const writeConfig = (values: unknown) => {
  mkdirSync(folders.dataDir, { recursive: true });
  writeFileSync(join(folders.dataDir, 'config.json'), JSON.stringify(values));
};

describe('configuration file (CU-039)', () => {
  it('E3 creates config.json with port 4310 in an empty data folder', () => {
    const config = load();

    expect(config).toEqual({ port: 4310, handoverDir: DEFAULT_HANDOVER });
    expect(JSON.parse(readFileSync(join(folders.dataDir, 'config.json'), 'utf8'))).toEqual({
      port: 4310,
    });
    expect(warnings).toEqual([]);
  });

  it('reads port and a valid handoverDir', () => {
    const handoverDir = join(root, 'Übergabe');
    writeConfig({ port: 4400, handoverDir });

    expect(load()).toEqual({ port: 4400, handoverDir });
    expect(warnings).toEqual([]);
  });

  it.each([
    ['relative', 'Fotos', 'not_absolute'],
    ['not a string', 42, 'not_absolute'],
    ['the data folder', () => folders.dataDir, 'overlaps_app_folder'],
    ['below the log folder', () => join(folders.logDir, 'x'), 'overlaps_app_folder'],
    ['above the data folder', () => join(folders.dataDir, '..'), 'overlaps_app_folder'],
    ['the user profile', () => folders.homeDir, 'overlaps_app_folder'],
    ['Desktop', () => join(folders.homeDir, 'Desktop'), 'user_folder'],
    ['the file system root', '/', 'overlaps_app_folder'],
  ])(
    'E4 rejects a handoverDir that is %s, uses the standard path and warns',
    (_, value, reason) => {
      writeConfig({ port: 4310, handoverDir: typeof value === 'function' ? value() : value });

      expect(load().handoverDir).toBe(DEFAULT_HANDOVER);
      expect(warnings).toEqual([{ event: 'handover_dir_rejected', details: { reason } }]);
    },
  );

  // Technical Specification 6.2 (Betriebsrobustheit b), FIND-266.
  it.each([
    ['no valid JSON', '{ "port": 4311', 'not_a_json_object'],
    ['an array', '[4311]', 'not_a_json_object'],
    ['a number', '4311', 'not_a_json_object'],
    ['null', 'null', 'not_a_json_object'],
    ['port as text "4311"', '{ "port": "4311" }', 'invalid_port'],
    ['port 0', '{ "port": 0 }', 'invalid_port'],
    ['port 4310.5', '{ "port": 4310.5 }', 'invalid_port'],
    ['port 70000', '{ "port": 70000 }', 'invalid_port'],
  ])('falls back to 4310 on %s, warns config_invalid and keeps the file', (_, text, reason) => {
    const filePath = join(folders.dataDir, 'config.json');
    mkdirSync(folders.dataDir, { recursive: true });
    writeFileSync(filePath, text);

    const config = load();

    expect(config.port).toBe(4310);
    expect(config.port).toBe(readConfiguredPort(folders.dataDir).port);
    expect(warnings).toEqual([{ event: 'config_invalid', details: { reason } }]);
    expect(readFileSync(filePath, 'utf8')).toBe(text);
  });

  it('keeps the standard handoverDir for a file that is no JSON object', () => {
    writeConfig([{ handoverDir: join(root, 'Übergabe') }]);

    expect(load()).toEqual({ port: 4310, handoverDir: DEFAULT_HANDOVER });
  });

  it('applies a valid handoverDir even if the port is invalid', () => {
    const handoverDir = join(root, 'Übergabe');
    writeConfig({ port: '4311', handoverDir });

    expect(load()).toEqual({ port: 4310, handoverDir });
  });

  it('uses 4310 without a warning when port is missing and ignores unknown keys', () => {
    writeConfig({ theme: 'dark' });

    expect(load()).toEqual({ port: 4310, handoverDir: DEFAULT_HANDOVER });
    expect(warnings).toEqual([]);
  });

  it('reads a config.json that starts with a UTF-8 BOM (FIND-267)', () => {
    const handoverDir = join(root, 'Übergabe');
    mkdirSync(folders.dataDir, { recursive: true });
    writeFileSync(
      join(folders.dataDir, 'config.json'),
      `\uFEFF${JSON.stringify({ port: 4311, handoverDir })}`,
    );

    expect(load()).toEqual({ port: 4311, handoverDir });
    expect(readConfiguredPort(folders.dataDir).port).toBe(4311);
    expect(warnings).toEqual([]);
  });
});

describe('handoverDir check under Windows (E4, FIND-212)', () => {
  const windows: HandoverDirContext = {
    dataDir: 'C:\\Users\\Max\\AppData\\Local\\resellr\\Daten',
    logDir: 'C:\\Users\\Max\\AppData\\Local\\resellr\\Protokolle',
    programDir: 'C:\\Users\\Max\\AppData\\Local\\Programs\\resellr',
    updateCopyDir: 'C:\\Users\\Max\\AppData\\Local\\resellr\\Update-Kopien',
    homeDir: 'C:\\Users\\Max',
  };
  const check = (value: unknown) => checkHandoverDir(value, windows, path.win32);

  it.each([
    'D:\\resellr\\Fotoübergabe',
    'C:\\Users\\Max\\Bilder\\resellr',
    'C:\\Users\\Max\\AppData\\Local\\resellr\\Fotoübergabe',
    '\\\\nas\\share\\resellr',
  ])('accepts %s', (value) => {
    expect(check(value)).toBeNull();
  });

  it.each([
    ['relative', 'Fotos', 'not_absolute'],
    ['drive-relative', '\\Fotos', 'not_absolute'],
    ['without separator after the drive', 'C:Fotos', 'not_absolute'],
    ['empty', '', 'not_absolute'],
    // FIND-265: device paths would bypass the comparison with the protected folders.
    [
      'the data folder as \\\\?\\ path',
      '\\\\?\\C:\\Users\\Max\\AppData\\Local\\resellr\\Daten',
      'not_absolute',
    ],
    [
      'the data folder as \\\\.\\ path',
      '\\\\.\\C:\\Users\\Max\\AppData\\Local\\resellr\\Daten',
      'not_absolute',
    ],
    ['Desktop as \\\\?\\ path', '\\\\?\\C:\\Users\\Max\\Desktop', 'not_absolute'],
    ['Desktop as \\\\.\\ path', '\\\\.\\C:\\Users\\Max\\Desktop', 'not_absolute'],
    ['Desktop as //?/ path', '//?/C:/Users/Max/Desktop', 'not_absolute'],
    ['a \\\\?\\UNC path', '\\\\?\\UNC\\nas\\share\\resellr', 'not_absolute'],
    ['the data folder', 'C:\\Users\\Max\\AppData\\Local\\resellr\\Daten', 'overlaps_app_folder'],
    [
      'the data folder in other case',
      'c:\\users\\max\\appdata\\local\\RESELLR\\daten\\',
      'overlaps_app_folder',
    ],
    [
      'below the data folder',
      'C:\\Users\\Max\\AppData\\Local\\resellr\\Daten\\media',
      'overlaps_app_folder',
    ],
    [
      'the log folder',
      'C:\\Users\\Max\\AppData\\Local\\resellr\\Protokolle',
      'overlaps_app_folder',
    ],
    [
      'below the program folder',
      'C:\\Users\\Max\\AppData\\Local\\Programs\\resellr\\app',
      'overlaps_app_folder',
    ],
    [
      'the update-copy folder',
      'C:\\Users\\Max\\AppData\\Local\\resellr\\Update-Kopien',
      'overlaps_app_folder',
    ],
    ['above the app folders', 'C:\\Users\\Max\\AppData\\Local\\resellr', 'overlaps_app_folder'],
    ['the user profile', 'C:\\Users\\Max', 'overlaps_app_folder'],
    ['a drive root', 'C:\\', 'overlaps_app_folder'],
    ['another drive root', 'D:\\', 'user_folder'],
    ['Desktop', 'C:\\Users\\Max\\Desktop', 'user_folder'],
    ['Downloads', 'C:\\Users\\Max\\downloads', 'user_folder'],
    ['Dokumente', 'C:\\Users\\Max\\Dokumente', 'user_folder'],
    ['Documents (shown as Dokumente)', 'C:\\Users\\Max\\Documents', 'user_folder'],
  ])('rejects %s', (_, value, reason) => {
    expect(check(value)).toBe(reason);
  });
});
