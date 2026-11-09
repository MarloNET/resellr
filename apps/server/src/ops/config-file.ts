import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { writeFileAtomic } from '@resellr/runtime-shared/runtime-state-files';

import type { OperationsLog } from './operations-log.ts';

export const CONFIG_FILE_NAME = 'config.json';
/** Standard port (Technical Specification 2.0.1, Baseline 10.1). */
export const DEFAULT_PORT = 4310;

/** The configuration that applies for this start. */
export interface Config {
  port: number;
  /** `handoverDir` of `config.json` if it passed the check, otherwise the standard path. */
  handoverDir: string;
}

/** Folders the check of `handoverDir` protects (2.19, FIND-212). */
export interface HandoverDirContext {
  dataDir: string;
  logDir: string;
  programDir: string;
  updateCopyDir: string;
  /** User profile; `Desktop`, `Downloads` and `Dokumente` are taken below it. */
  homeDir: string;
}

export type HandoverDirRejection = 'not_absolute' | 'overlaps_app_folder' | 'user_folder';

type PathApi = Pick<
  typeof path.win32,
  'isAbsolute' | 'resolve' | 'relative' | 'parse' | 'join' | 'sep'
>;

/**
 * Checks a `handoverDir` from `config.json` (CU-039, 2.19, FIND-212): it must be an absolute
 * path that is neither equal to, below nor above the data, log, program or update-copy folder,
 * and not equal to the user profile, `Desktop`, `Downloads`, `Dokumente` or a drive root.
 * Returns null if it passes. `pathApi` is `path.win32` under Windows, so the comparison ignores
 * case there.
 */
export function checkHandoverDir(
  value: unknown,
  context: HandoverDirContext,
  pathApi: PathApi = path,
): HandoverDirRejection | null {
  if (typeof value !== 'string' || !isFullyAbsolute(value, pathApi)) return 'not_absolute';
  const candidate = pathApi.resolve(value);

  const isSame = (other: string) => pathApi.relative(pathApi.resolve(other), candidate) === '';
  const isBelow = (parent: string, child: string) => {
    const relative = pathApi.relative(pathApi.resolve(parent), pathApi.resolve(child));
    return (
      relative !== '' &&
      relative !== '..' &&
      !relative.startsWith(`..${pathApi.sep}`) &&
      !pathApi.isAbsolute(relative)
    );
  };

  const appFolders = [context.dataDir, context.logDir, context.programDir, context.updateCopyDir];
  if (appFolders.some((dir) => isSame(dir) || isBelow(dir, candidate) || isBelow(candidate, dir))) {
    return 'overlaps_app_folder';
  }

  // The folder shown as "Dokumente" is named `Documents` on disk; both are rejected.
  const userFolders = [
    context.homeDir,
    ...['Desktop', 'Downloads', 'Dokumente', 'Documents'].map((name) =>
      pathApi.join(context.homeDir, name),
    ),
  ];
  if (userFolders.some(isSame) || pathApi.parse(candidate).root === candidate) {
    return 'user_folder';
  }
  return null;
}

/**
 * Absolute including the drive: under Windows `C:\…` or `\\server\share\…`, not the
 * drive-relative `\…` that `isAbsolute` also accepts. Device paths (`\\?\…`, `\\.\…`) are
 * rejected too: `path.win32` reads them as UNC, so they would slip past the comparison with
 * the protected folders (FIND-265).
 */
function isFullyAbsolute(value: string, pathApi: PathApi): boolean {
  if (!pathApi.isAbsolute(value)) return false;
  if (pathApi.sep !== '\\') return true;
  if (/^[\\/]{2}[?.][\\/]/.test(value)) return false;
  return /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/])/.test(value);
}

export interface LoadConfigOptions {
  /** Standard path of the handover folder (`RESELLR_HANDOVER_DIR` or `%LOCALAPPDATA%`). */
  defaultHandoverDir: string;
  folders: HandoverDirContext;
  operationsLog: OperationsLog;
  pathApi?: PathApi;
}

/**
 * Reads `config.json` from the data folder, or creates it with the standard values
 * (`{ "port": 4310 }`) if it does not exist (CU-039, 2.19). An invalid `port` or a file that is
 * no JSON object falls back to the standard value with a warning, like an invalid `handoverDir`;
 * the file itself stays unchanged.
 */
export function loadConfig({
  defaultHandoverDir,
  folders,
  operationsLog,
  pathApi = path,
}: LoadConfigOptions): Config {
  const filePath = path.join(folders.dataDir, CONFIG_FILE_NAME);
  const raw = readConfigFile(filePath);
  if (raw === null) {
    mkdirSync(folders.dataDir, { recursive: true });
    writeFileAtomic(filePath, `${JSON.stringify({ port: DEFAULT_PORT }, null, 2)}\n`);
    return { port: DEFAULT_PORT, handoverDir: defaultHandoverDir };
  }

  const values = parseObject(raw);
  if (values === null) {
    operationsLog.warn('config_invalid', { reason: 'not_a_json_object' });
    return { port: DEFAULT_PORT, handoverDir: defaultHandoverDir };
  }

  let port = DEFAULT_PORT;
  if (values.port !== undefined) {
    if (isPort(values.port)) port = values.port;
    else operationsLog.warn('config_invalid', { reason: 'invalid_port' });
  }

  let handoverDir = defaultHandoverDir;
  if (values.handoverDir !== undefined) {
    const rejection = checkHandoverDir(values.handoverDir, folders, pathApi);
    if (rejection === null) handoverDir = pathApi.resolve(values.handoverDir as string);
    else operationsLog.warn('handover_dir_rejected', { reason: rejection });
  }

  return { port, handoverDir };
}

function readConfigFile(filePath: string): string | null {
  try {
    // Windows editors such as Notepad may save a leading BOM, which JSON.parse rejects (FIND-267).
    return readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const isPort = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 65535;
