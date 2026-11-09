import {
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

export const STATE_FILE_NAME = 'state.json';
export const START_RESULT_FILE_NAME = 'start-result.json';
export const LAUNCHER_STATE_FILE_NAME = 'launcher-state.js';

/** `Protokolle/state.json` (Technical Specification 2.18, 2.19). */
export interface RuntimeState {
  /** Stamp of the data folder state, compared with `app_meta.data_folder_stamp`. */
  dataFolderStamp?: string;
  appVersion?: string;
  /** ISO instant of the last crash, written by the supervisor. */
  lastCrashAt?: string;
}

/** `Protokolle/start-result.json`; the supervisor writes `gave_up` there too (2.18). */
export interface StartResult {
  startId: string;
  state: 'ready' | 'aborted' | 'gave_up';
  refNo: string | null;
  at: string;
}

export type LauncherPhase = 'ready' | 'aborted' | 'timeout' | 'stopped' | 'error' | 'not_running';

/** Argument of `window.__resellrLauncherState(...)` in `launcher-pages/launcher-state.js` (2.18, T-5). */
export interface LauncherState {
  request: string;
  phase: LauncherPhase;
  url: string | null;
  refNo: string | null;
  dataDir: string | null;
}

const LAUNCHER_STATE_PREFIX = 'window.__resellrLauncherState(';
const LAUNCHER_STATE_SUFFIX = ');\n';

/**
 * Replaces `filePath` atomically: writes a temporary file in the same folder, syncs it
 * with `fsync` and renames it over the target (FIND-217). If anything fails before the
 * rename, the previous file stays unchanged and the temporary file is removed.
 */
export function writeFileAtomic(filePath: string, content: string): void {
  const tempPath = join(dirname(filePath), `.${basename(filePath)}.${randomUUID()}.tmp`);
  try {
    const fd = openSync(tempPath, 'wx');
    try {
      writeSync(fd, content, null, 'utf8');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tempPath, filePath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

/** Reads a file, or returns null when it does not exist. */
function readIfExists(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Parses a JSON object; anything else counts as a missing file. */
function parseObject(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const writeJson = (filePath: string, value: object): void =>
  writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);

export function readRuntimeState(logDir: string): RuntimeState | null {
  return parseObject(readIfExists(join(logDir, STATE_FILE_NAME))) as RuntimeState | null;
}

export function writeRuntimeState(logDir: string, state: RuntimeState): void {
  writeJson(join(logDir, STATE_FILE_NAME), state);
}

/** Merges `patch` into `state.json`, keeping all other fields, and returns the new state. */
export function updateRuntimeState(logDir: string, patch: RuntimeState): RuntimeState {
  const state = { ...readRuntimeState(logDir), ...patch };
  writeRuntimeState(logDir, state);
  return state;
}

export function readStartResult(logDir: string): StartResult | null {
  return parseObject(readIfExists(join(logDir, START_RESULT_FILE_NAME))) as StartResult | null;
}

export function writeStartResult(logDir: string, result: StartResult): void {
  writeJson(join(logDir, START_RESULT_FILE_NAME), result);
}

export function readLauncherState(pagesDir: string): LauncherState | null {
  const script = readIfExists(join(pagesDir, LAUNCHER_STATE_FILE_NAME));
  if (script === null || !script.startsWith(LAUNCHER_STATE_PREFIX)) return null;
  if (!script.endsWith(LAUNCHER_STATE_SUFFIX)) return null;
  const json = script.slice(LAUNCHER_STATE_PREFIX.length, -LAUNCHER_STATE_SUFFIX.length);
  return parseObject(json) as LauncherState | null;
}

/**
 * Writes `launcher-state.js` as a classic script that calls the page callback. The state
 * is embedded as JSON, which is a valid JavaScript expression, so values stay data.
 */
export function writeLauncherState(pagesDir: string, state: LauncherState): void {
  const json = JSON.stringify(state);
  writeFileAtomic(
    join(pagesDir, LAUNCHER_STATE_FILE_NAME),
    `${LAUNCHER_STATE_PREFIX}${json}${LAUNCHER_STATE_SUFFIX}`,
  );
}
