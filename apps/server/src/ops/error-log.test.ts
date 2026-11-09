import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createErrorLog } from './error-log.ts';

let dir: string;
const now = () => new Date('2026-11-09T10:00:00.000Z');

const readEntries = () =>
  readFileSync(join(dir, 'errors-2026-11-09.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-error-log-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('error log (CU-036)', () => {
  it('writes an error with reference number, function, message and stack', () => {
    const log = createErrorLog({ dir, appVersion: '0.1.0', startId: 'start-1', now });
    const error = new Error('disk full');

    log.error({ refNo: 'R-7K2M-9QX4', function: 'datasheet.generate', error });

    expect(readdirSync(dir)).toEqual(['errors-2026-11-09.jsonl']);
    expect(readEntries()).toEqual([
      {
        ts: '2026-11-09T10:00:00.000Z',
        level: 'error',
        refNo: 'R-7K2M-9QX4',
        function: 'datasheet.generate',
        message: 'Error: disk full',
        stack: error.stack,
        appVersion: '0.1.0',
        startId: 'start-1',
      },
    ]);
  });

  it('writes a value that is not an Error as its type only, never as content', () => {
    const log = createErrorLog({ dir, appVersion: '0.1.0', startId: null, now });

    log.error({ refNo: 'R-0000-0001', function: 'http.request', error: { wiNr: '626198' } });

    const [entry] = readEntries();
    expect(entry).toMatchObject({ message: 'non-Error value of type object', stack: null });
    expect(JSON.stringify(entry)).not.toContain('626198');
  });

  it('writes a warning without reference number and stack', () => {
    const log = createErrorLog({ dir, appVersion: '0.1.0', startId: null, now });

    log.warn({ function: 'http.local-guard', message: 'G-1 forbidden_host' });

    expect(readEntries()).toEqual([
      {
        ts: '2026-11-09T10:00:00.000Z',
        level: 'warn',
        refNo: null,
        function: 'http.local-guard',
        message: 'G-1 forbidden_host',
        stack: null,
        appVersion: '0.1.0',
        startId: null,
      },
    ]);
  });
});
