import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createOperationsLog } from './operations-log.ts';

let dir: string;
const now = () => new Date('2026-11-09T10:00:00.000Z');

const readLines = () => readFileSync(join(dir, 'operations-2026-11-09.jsonl'), 'utf8').split('\n');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-operations-log-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('operations log (CU-037)', () => {
  it('E6 writes an operating event as one JSON line into operations-<date>.jsonl', () => {
    const log = createOperationsLog({ dir, appVersion: '0.1.0', startId: 'start-1', now });

    log.event('server_started');

    expect(readdirSync(dir)).toEqual(['operations-2026-11-09.jsonl']);
    const [line, rest] = readLines();
    expect(rest).toBe('');
    expect(JSON.parse(line ?? '')).toEqual({
      ts: '2026-11-09T10:00:00.000Z',
      level: 'info',
      event: 'server_started',
      appVersion: '0.1.0',
      startId: 'start-1',
    });
  });

  it('writes a warning with its details, one line per entry', () => {
    const log = createOperationsLog({ dir, appVersion: '0.1.0', startId: null, now });

    log.event('server_started');
    log.warn('handover_dir_rejected', { reason: 'user_folder' });

    const entries = readLines()
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({
      ts: '2026-11-09T10:00:00.000Z',
      level: 'warn',
      event: 'handover_dir_rejected',
      reason: 'user_folder',
      appVersion: '0.1.0',
      startId: null,
    });
  });
});
