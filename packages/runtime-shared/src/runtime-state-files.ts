import {
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
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

/**
 * Argument of `window.__resellrLauncherState(...)` in `launcher-pages/launcher-state.js`
 * (2.18, T-5); the file holds one call per `request`.
 */
export interface LauncherState {
  request: string;
  phase: LauncherPhase;
  url: string | null;
  refNo: string | null;
  dataDir: string | null;
}

const LAUNCHER_STATE_PREFIX = 'window.__resellrLauncherState(';
const LAUNCHER_STATE_SUFFIX = ');\n';
export const LAUNCHER_STATE_LOCK_FILE_NAME = `${LAUNCHER_STATE_FILE_NAME}.lock`;
/** At most this many calls keep their entry in `launcher-state.js` (Nachtrag MAR-470). */
export const LAUNCHER_STATE_MAX_ENTRIES = 20;
const LOCK_RETRY_MS = 25;
/** A lock file older than this is left over from an ended process (Nachtrag MAR-470). */
const LOCK_STALE_MS = 10_000;

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
      // writeSync may write fewer bytes than requested; keep writing until all are out.
      const bytes = Buffer.from(content, 'utf8');
      for (let written = 0; written < bytes.length;) {
        written += writeSync(fd, bytes, written, bytes.length - written);
      }
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

/** Parses one line of `launcher-state.js`; null if it is not a launcher state with a `request`. */
function parseLauncherStateLine(line: string): LauncherState | null {
  if (!line.startsWith(LAUNCHER_STATE_PREFIX) || !line.endsWith(LAUNCHER_STATE_SUFFIX)) return null;
  const json = line.slice(LAUNCHER_STATE_PREFIX.length, -LAUNCHER_STATE_SUFFIX.length);
  const state = parseObject(json);
  return state !== null && typeof state.request === 'string'
    ? (state as unknown as LauncherState)
    : null;
}

/**
 * Reads the entries of `launcher-state.js` in file order, one per `request` (Nachtrag MAR-470).
 * A missing file has none; lines that are not a launcher state are skipped, so the next write
 * cleans up a damaged file.
 */
export function readLauncherState(pagesDir: string): LauncherState[] {
  const script = readIfExists(join(pagesDir, LAUNCHER_STATE_FILE_NAME));
  if (script === null) return [];
  return script
    .split(/(?<=\n)/)
    .map(parseLauncherStateLine)
    .filter((state) => state !== null);
}

/**
 * Writes the state of one call into `launcher-state.js`, a classic script with one call of the
 * page callback per `request` (Nachtrag MAR-470). The entry of the same `request` moves to the
 * end, the file keeps the last 20, and reading, changing and writing run under
 * `launcher-state.js.lock`, so calls in other processes do not overwrite each other. The state is
 * embedded as JSON, which is a valid JavaScript expression, so values stay data.
 */
export function writeLauncherState(pagesDir: string, state: LauncherState): void {
  withLock(join(pagesDir, LAUNCHER_STATE_LOCK_FILE_NAME), () => {
    const entries = readLauncherState(pagesDir).filter((entry) => entry.request !== state.request);
    entries.push(state);
    const script = entries
      .slice(-LAUNCHER_STATE_MAX_ENTRIES)
      .map((entry) => `${LAUNCHER_STATE_PREFIX}${JSON.stringify(entry)}${LAUNCHER_STATE_SUFFIX}`)
      .join('');
    writeFileAtomic(join(pagesDir, LAUNCHER_STATE_FILE_NAME), script);
  });
}

/**
 * Creates an empty `launcher-state.js` if there is none, so a launcher page finds the file
 * before the first write (FIND-311). An empty file is a valid script without entries; existing
 * entries stay. No lock: a concurrent rename only replaces the empty file.
 */
export function ensureLauncherStateFile(pagesDir: string): void {
  try {
    closeSync(openSync(join(pagesDir, LAUNCHER_STATE_FILE_NAME), 'wx'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}

const sleepSync = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

/**
 * Runs `action` while holding the lock file `lockPath` between processes. A taken lock is
 * waited for in steps of 25 ms; a lock older than 10 s is left over from an ended process and
 * is taken over.
 */
function withLock(lockPath: string, action: () => void): void {
  for (;;) {
    let fd: number;
    try {
      fd = openSync(lockPath, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (lockAgeMs(lockPath) > LOCK_STALE_MS) rmSync(lockPath, { force: true });
      else sleepSync(LOCK_RETRY_MS);
      continue;
    }
    try {
      try {
        // Only for diagnosis: who holds the lock since when.
        writeSync(fd, `${process.pid} ${new Date().toISOString()}\n`);
      } finally {
        closeSync(fd);
      }
      action();
    } finally {
      rmSync(lockPath, { force: true });
    }
    return;
  }
}

/** Age of the lock file by `mtime`; 0 if it was released meanwhile. */
function lockAgeMs(lockPath: string): number {
  try {
    return Date.now() - statSync(lockPath).mtimeMs;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
}
