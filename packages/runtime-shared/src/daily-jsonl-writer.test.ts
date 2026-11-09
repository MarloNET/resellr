import * as fs from 'node:fs';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDailyJsonlWriter } from './daily-jsonl-writer.ts';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, unlinkSync: vi.fn(actual.unlinkSync) };
});

let dir: string;
let clock: Date;
const now = () => clock;

const readLines = (name: string) =>
  readFileSync(join(dir, name), 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-daily-jsonl-'));
  clock = new Date('2026-11-09T10:00:00.000Z');
});

afterEach(() => {
  vi.mocked(fs.unlinkSync).mockReset();
  rmSync(dir, { recursive: true, force: true });
});

describe('daily JSON Lines writer (E6)', () => {
  it('writes one JSON line per entry into the file of the day', () => {
    const writer = createDailyJsonlWriter({ dir, kind: 'operations', now });

    writer.write({ event: 'server_started' });
    clock = new Date('2026-11-09T18:30:00.000Z');
    writer.write({ event: 'server_ready', findings: [] });

    expect(readdirSync(dir)).toEqual(['operations-2026-11-09.jsonl']);
    expect(readLines('operations-2026-11-09.jsonl')).toEqual([
      { ts: '2026-11-09T10:00:00.000Z', event: 'server_started' },
      { ts: '2026-11-09T18:30:00.000Z', event: 'server_ready', findings: [] },
    ]);
  });

  it('starts a new file when the day changes', () => {
    const writer = createDailyJsonlWriter({ dir, kind: 'errors', now });

    writer.write({ refNo: 'R-7K2M-9QX4' });
    clock = new Date('2026-11-10T08:00:00.000Z');
    writer.write({ refNo: 'R-0000-0001' });

    expect(readdirSync(dir).sort()).toEqual(['errors-2026-11-09.jsonl', 'errors-2026-11-10.jsonl']);
    expect(readLines('errors-2026-11-10.jsonl')).toEqual([
      { ts: '2026-11-10T08:00:00.000Z', refNo: 'R-0000-0001' },
    ]);
  });

  it.each([
    ['winter time', '2026-11-09T23:30:00.000Z', 'availability-2026-11-10.jsonl'],
    ['summer time', '2026-06-30T22:30:00.000Z', 'availability-2026-07-01.jsonl'],
    ['before midnight', '2026-11-09T22:59:59.999Z', 'availability-2026-11-09.jsonl'],
  ])('uses the calendar day in Europe/Berlin (%s)', (_, instant, fileName) => {
    clock = new Date(instant);
    createDailyJsonlWriter({ dir, kind: 'availability', now }).write({ ok: true });

    expect(readdirSync(dir)).toEqual([fileName]);
  });

  it('creates the folder when it does not exist yet', () => {
    const nested = join(dir, 'Protokolle');
    createDailyJsonlWriter({ dir: nested, kind: 'operations', now }).write({ event: 'x' });

    expect(readdirSync(nested)).toEqual(['operations-2026-11-09.jsonl']);
  });

  it('deletes daily files of its kind that are older than 30 days', () => {
    const keep = [
      'operations-2026-10-10.jsonl', // exactly 30 days old
      'operations-2026-11-09.jsonl',
      'errors-2026-09-01.jsonl', // another kind, cleaned up by its own writer
      'availability-days.jsonl',
      'state.json',
      'operations-2026-01-01.jsonl.bak',
    ];
    const expired = ['operations-2026-10-09.jsonl', 'operations-2025-12-31.jsonl'];
    for (const name of [...keep, ...expired]) writeFileSync(join(dir, name), '');

    const deleted = createDailyJsonlWriter({ dir, kind: 'operations', now }).deleteExpiredFiles();

    expect(deleted.sort()).toEqual(expired.sort());
    expect(readdirSync(dir).sort()).toEqual(keep.sort());
  });

  it('deletes expired files on the first write of each day', () => {
    writeFileSync(join(dir, 'operations-2026-10-09.jsonl'), '');
    writeFileSync(join(dir, 'operations-2026-10-10.jsonl'), '');
    const writer = createDailyJsonlWriter({ dir, kind: 'operations', now });

    writer.write({ event: 'supervisor_started' });
    expect(readdirSync(dir).sort()).toEqual([
      'operations-2026-10-10.jsonl',
      'operations-2026-11-09.jsonl',
    ]);

    clock = new Date('2026-11-10T06:00:00.000Z');
    writer.write({ event: 'server_ready' });
    expect(readdirSync(dir).sort()).toEqual([
      'operations-2026-11-09.jsonl',
      'operations-2026-11-10.jsonl',
    ]);
  });

  it('still writes every entry of the day when an expired file cannot be deleted', () => {
    // A directory with a daily file name stands in for a locked file: unlink fails.
    mkdirSync(join(dir, 'errors-2026-01-01.jsonl'));
    writeFileSync(join(dir, 'errors-2026-01-02.jsonl'), '');
    const writer = createDailyJsonlWriter({ dir, kind: 'errors', now });

    writer.write({ refNo: 'R-7K2M-9QX4' });
    writer.write({ refNo: 'R-0000-0001' });

    expect(readLines('errors-2026-11-09.jsonl')).toEqual([
      { ts: '2026-11-09T10:00:00.000Z', refNo: 'R-7K2M-9QX4' },
      { ts: '2026-11-09T10:00:00.000Z', refNo: 'R-0000-0001' },
    ]);
    expect(readdirSync(dir).sort()).toEqual(['errors-2026-01-01.jsonl', 'errors-2026-11-09.jsonl']);
  });

  it('reports a failed deletion only after trying every expired file', () => {
    mkdirSync(join(dir, 'errors-2026-01-01.jsonl'));
    writeFileSync(join(dir, 'errors-2026-01-02.jsonl'), '');
    const writer = createDailyJsonlWriter({ dir, kind: 'errors', now });

    expect(() => writer.deleteExpiredFiles()).toThrow();
    expect(readdirSync(dir)).toEqual(['errors-2026-01-01.jsonl']);
  });

  it('treats an expired file that another process deleted first as deleted', () => {
    writeFileSync(join(dir, 'operations-2026-01-01.jsonl'), '');
    vi.mocked(fs.unlinkSync).mockImplementationOnce((path) => {
      rmSync(path);
      throw Object.assign(
        new Error(`ENOENT: no such file or directory, unlink '${String(path)}'`),
        {
          code: 'ENOENT',
        },
      );
    });
    const writer = createDailyJsonlWriter({ dir, kind: 'operations', now });

    expect(writer.deleteExpiredFiles()).toEqual(['operations-2026-01-01.jsonl']);
    writer.write({ event: 'server_started' });
    expect(readdirSync(dir)).toEqual(['operations-2026-11-09.jsonl']);
  });

  it('always sets ts to the current instant, even when the entry has a ts field', () => {
    createDailyJsonlWriter({ dir, kind: 'operations', now }).write({ ts: 'bogus', event: 'x' });

    expect(readLines('operations-2026-11-09.jsonl')).toEqual([
      { ts: '2026-11-09T10:00:00.000Z', event: 'x' },
    ]);
  });

  it('returns no deleted files when the folder does not exist yet', () => {
    const writer = createDailyJsonlWriter({ dir: join(dir, 'missing'), kind: 'errors', now });

    expect(writer.deleteExpiredFiles()).toEqual([]);
  });

  it('rejects a kind that would not form a valid daily file name', () => {
    expect(() => createDailyJsonlWriter({ dir, kind: '../errors', now })).toThrow(/kind/);
  });
});
