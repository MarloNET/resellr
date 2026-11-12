import * as fs from 'node:fs';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LAUNCHER_STATE_FILE_NAME,
  LAUNCHER_STATE_LOCK_FILE_NAME,
  LAUNCHER_STATE_MAX_ENTRIES,
  START_RESULT_FILE_NAME,
  STATE_FILE_NAME,
  ensureLauncherStateFile,
  readLauncherState,
  readRuntimeState,
  readStartResult,
  updateRuntimeState,
  writeFileAtomic,
  writeLauncherState,
  writeRuntimeState,
  writeStartResult,
} from './runtime-state-files.ts';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    renameSync: vi.fn(actual.renameSync),
    fsyncSync: vi.fn(actual.fsyncSync),
    writeSync: vi.fn(actual.writeSync),
  };
});

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-state-files-'));
});

afterEach(() => {
  vi.mocked(fs.renameSync).mockClear();
  vi.mocked(fs.fsyncSync).mockClear();
  vi.mocked(fs.writeSync).mockClear();
  rmSync(dir, { recursive: true, force: true });
});

describe('atomic write (E5)', () => {
  it('writes a temporary file in the same folder, syncs it and renames it over the target', () => {
    const target = join(dir, STATE_FILE_NAME);
    writeFileSync(target, '{"old":true}');

    writeFileAtomic(target, '{"new":true}');

    expect(readFileSync(target, 'utf8')).toBe('{"new":true}');
    expect(readdirSync(dir)).toEqual([STATE_FILE_NAME]);
    const renameMock = vi.mocked(fs.renameSync);
    expect(renameMock).toHaveBeenCalledTimes(1);
    const [from, to] = renameMock.mock.calls[0]!;
    expect(String(from).startsWith(join(dir, '.'))).toBe(true);
    expect(to).toBe(target);
    expect(vi.mocked(fs.fsyncSync).mock.invocationCallOrder[0]).toBeLessThan(
      renameMock.mock.invocationCallOrder[0]!,
    );
  });

  it('writes the whole content when the system writes only part of it at a time', async () => {
    const target = join(dir, STATE_FILE_NAME);
    const content = '{"appVersion":"1.0.0","dataFolderStamp":"äöü"}';
    const { writeSync } = await vi.importActual<typeof import('node:fs')>('node:fs');
    // Write at most 5 bytes per call, whichever call form is used.
    vi.mocked(fs.writeSync).mockImplementation(((
      fd: number,
      data: string | Uint8Array,
      offset?: number | null,
      length?: number | string,
    ) => {
      const bytes: Uint8Array = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      const start = typeof data === 'string' ? 0 : (offset ?? 0);
      const rest = typeof length === 'number' ? length : bytes.byteLength - start;
      return writeSync(fd, bytes, start, Math.min(rest, 5));
    }) as typeof fs.writeSync);

    try {
      writeFileAtomic(target, content);
    } finally {
      vi.mocked(fs.writeSync).mockImplementation(writeSync);
    }

    expect(readFileSync(target, 'utf8')).toBe(content);
  });

  it('leaves the old file unchanged when the write is aborted before the rename', () => {
    const target = join(dir, START_RESULT_FILE_NAME);
    writeFileSync(target, '{"state":"ready"}');
    vi.mocked(fs.renameSync).mockImplementationOnce(() => {
      throw new Error('aborted before rename');
    });

    expect(() => writeFileAtomic(target, '{"state":"aborted"}')).toThrow('aborted before rename');

    expect(readFileSync(target, 'utf8')).toBe('{"state":"ready"}');
    expect(readdirSync(dir)).toEqual([START_RESULT_FILE_NAME]);
  });

  it('leaves the old file unchanged when syncing fails', () => {
    const target = join(dir, STATE_FILE_NAME);
    writeFileSync(target, 'old');
    vi.mocked(fs.fsyncSync).mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    expect(() => writeFileAtomic(target, 'new')).toThrow('disk full');

    expect(readFileSync(target, 'utf8')).toBe('old');
    expect(readdirSync(dir)).toEqual([STATE_FILE_NAME]);
  });

  it('creates the target file when it does not exist yet', () => {
    const target = join(dir, STATE_FILE_NAME);

    writeFileAtomic(target, 'first');

    expect(readFileSync(target, 'utf8')).toBe('first');
  });
});

describe('state.json', () => {
  it('returns null when the file is missing or unreadable', () => {
    expect(readRuntimeState(dir)).toBeNull();
    writeFileSync(join(dir, STATE_FILE_NAME), '{not json');
    expect(readRuntimeState(dir)).toBeNull();
    writeFileSync(join(dir, STATE_FILE_NAME), '[]');
    expect(readRuntimeState(dir)).toBeNull();
  });

  it('round-trips the state', () => {
    writeRuntimeState(dir, { dataFolderStamp: 'stamp-1', appVersion: '0.1.0' });

    expect(readRuntimeState(dir)).toEqual({ dataFolderStamp: 'stamp-1', appVersion: '0.1.0' });
  });

  it('updates single fields and keeps the others', () => {
    writeRuntimeState(dir, { dataFolderStamp: 'stamp-1', appVersion: '0.1.0' });

    const updated = updateRuntimeState(dir, { lastCrashAt: '2026-11-09T10:00:00.000Z' });

    const expected = {
      dataFolderStamp: 'stamp-1',
      appVersion: '0.1.0',
      lastCrashAt: '2026-11-09T10:00:00.000Z',
    };
    expect(updated).toEqual(expected);
    expect(readRuntimeState(dir)).toEqual(expected);
  });

  it('creates the state when updating a missing file', () => {
    updateRuntimeState(dir, { dataFolderStamp: 'stamp-2' });

    expect(readRuntimeState(dir)).toEqual({ dataFolderStamp: 'stamp-2' });
  });
});

describe('start-result.json', () => {
  it('round-trips the start result', () => {
    const result = {
      startId: 'start-1',
      state: 'aborted',
      refNo: 'R-7K2M-9QX4',
      at: '2026-11-09T10:00:00.000Z',
    } as const;

    writeStartResult(dir, result);

    expect(readStartResult(dir)).toEqual(result);
  });

  it('returns null when the file is missing or unreadable', () => {
    expect(readStartResult(dir)).toBeNull();
    writeFileSync(join(dir, START_RESULT_FILE_NAME), '');
    expect(readStartResult(dir)).toBeNull();
  });
});

describe('launcher-state.js', () => {
  const state = {
    request: 'req-1',
    phase: 'aborted',
    url: null,
    refNo: 'R-7K2M-9QX4',
    dataDir: 'C:\\Users\\haendler\\AppData\\Local\\resellr\\Daten',
  } as const;

  const ready = (request: string, url = 'http://127.0.0.1:4310/') =>
    ({ request, phase: 'ready', url, refNo: null, dataDir: null }) as const;

  const stateFile = () => join(dir, LAUNCHER_STATE_FILE_NAME);
  const lockFile = () => join(dir, LAUNCHER_STATE_LOCK_FILE_NAME);

  /** Runs the file like a launcher page does and returns the states it hands over. */
  const runScript = (): unknown[] => {
    const received: unknown[] = [];
    new Function('window', readFileSync(stateFile(), 'utf8'))({
      __resellrLauncherState: (value: unknown) => received.push(value),
    });
    return received;
  };

  it('writes a classic script that hands the state to the launcher page', () => {
    writeLauncherState(dir, state);

    expect(runScript()).toEqual([state]);
  });

  it('keeps hostile values as data', () => {
    const hostile = { ...state, request: '"});alert(1);({"', dataDir: '</script>\u2028\n' };

    writeLauncherState(dir, hostile);

    expect(runScript()).toEqual([hostile]);
    expect(readLauncherState(dir)).toEqual([hostile]);
  });

  it('F-01 appends the state of another request, one line each', () => {
    writeLauncherState(dir, state);
    writeLauncherState(dir, ready('req-2'));

    expect(runScript()).toEqual([state, ready('req-2')]);
    expect(readFileSync(stateFile(), 'utf8').split('\n')).toHaveLength(3);
    expect(readLauncherState(dir)).toEqual([state, ready('req-2')]);
  });

  it('replaces the entry of the same request and moves it to the end', () => {
    writeLauncherState(dir, ready('req-1', 'http://127.0.0.1:1/'));
    writeLauncherState(dir, ready('req-2'));

    writeLauncherState(dir, ready('req-1', 'http://127.0.0.1:2/'));

    expect(readLauncherState(dir)).toEqual([ready('req-2'), ready('req-1', 'http://127.0.0.1:2/')]);
  });

  it(`keeps the last ${LAUNCHER_STATE_MAX_ENTRIES} entries; the next one drops the oldest`, () => {
    for (let i = 1; i <= LAUNCHER_STATE_MAX_ENTRIES + 1; i += 1)
      writeLauncherState(dir, ready(`req-${i}`));

    const requests = readLauncherState(dir).map((entry) => entry.request);
    expect(requests).toHaveLength(LAUNCHER_STATE_MAX_ENTRIES);
    expect(requests[0]).toBe('req-2');
    expect(requests.at(-1)).toBe(`req-${LAUNCHER_STATE_MAX_ENTRIES + 1}`);
  });

  it('skips damaged lines when reading and drops them with the next write', () => {
    writeFileSync(
      stateFile(),
      [
        'alert(1);\n',
        'window.__resellrLauncherState({not json});\n',
        'window.__resellrLauncherState([1]);\n',
        'window.__resellrLauncherState({"request":7,"phase":"ready"});\n',
        `window.__resellrLauncherState(${JSON.stringify(state)});\n`,
        'window.__resellrLauncherState({"request":"cut',
      ].join(''),
    );

    expect(readLauncherState(dir)).toEqual([state]);

    writeLauncherState(dir, ready('req-2'));
    expect(runScript()).toEqual([state, ready('req-2')]);
  });

  it('returns no entries when the file is missing or empty', () => {
    expect(readLauncherState(dir)).toEqual([]);
    writeFileSync(stateFile(), '');
    expect(readLauncherState(dir)).toEqual([]);
  });

  it('ensureLauncherStateFile creates an empty file and leaves existing entries unchanged', () => {
    ensureLauncherStateFile(dir);
    expect(readFileSync(stateFile(), 'utf8')).toBe('');
    expect(runScript()).toEqual([]);

    writeLauncherState(dir, state);
    const before = readFileSync(stateFile(), 'utf8');
    ensureLauncherStateFile(dir);
    expect(readFileSync(stateFile(), 'utf8')).toBe(before);
  });

  it('releases the lock after writing', () => {
    writeLauncherState(dir, state);

    expect(existsSync(lockFile())).toBe(false);
    expect(readdirSync(dir)).toEqual([LAUNCHER_STATE_FILE_NAME]);
  });

  it('waits for a lock that another process holds', async () => {
    writeFileSync(lockFile(), '4711 2026-11-11T19:00:00.000Z\n');
    // Another process releases the lock after 400 ms; this one blocks synchronously meanwhile.
    const holder = spawn(process.execPath, [
      '-e',
      `setTimeout(() => require('node:fs').rmSync(${JSON.stringify(lockFile())}), 400)`,
    ]);
    const holderEnded = new Promise((resolve) => holder.on('exit', resolve));

    const startedAt = Date.now();
    writeLauncherState(dir, state);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(300);
    expect(readLauncherState(dir)).toEqual([state]);
    expect(existsSync(lockFile())).toBe(false);
    await holderEnded;
  });

  it('takes over a lock older than 10 s', () => {
    writeFileSync(lockFile(), '4711 2026-11-11T19:00:00.000Z\n');
    const elevenSecondsAgo = new Date(Date.now() - 11_000);
    utimesSync(lockFile(), elevenSecondsAgo, elevenSecondsAgo);

    const startedAt = Date.now();
    writeLauncherState(dir, state);

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(readLauncherState(dir)).toEqual([state]);
    expect(existsSync(lockFile())).toBe(false);
  });

  it('releases the lock when writing fails and keeps the previous entries', () => {
    writeLauncherState(dir, state);
    vi.mocked(fs.renameSync).mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    expect(() => writeLauncherState(dir, ready('req-2'))).toThrow('disk full');

    expect(existsSync(lockFile())).toBe(false);
    expect(readLauncherState(dir)).toEqual([state]);
  });
});
