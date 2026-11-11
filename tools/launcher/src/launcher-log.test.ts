import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readDailyFiles } from '@resellr/runtime-shared/daily-jsonl-writer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createLauncherLog } from './launcher-log.ts';

let dir: string;
const now = () => new Date('2026-11-10T09:30:00.000Z');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-launcher-log-'));
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const entriesOf = (kind: 'operations' | 'errors') =>
  readDailyFiles({ dir, kind }).flatMap((file) => file.entries);

describe('launcher log (CU-296, Technical Specification 2.18, 2.19)', () => {
  it('writes the warning chrome_not_found without details, with appVersion and startId null', () => {
    createLauncherLog({ dir, appVersion: '0.1.0', now }).chromeNotFound();

    expect(entriesOf('operations')).toEqual([
      {
        ts: '2026-11-10T09:30:00.000Z',
        level: 'warn',
        event: 'chrome_not_found',
        appVersion: '0.1.0',
        startId: null,
      },
    ]);
    expect(entriesOf('errors')).toEqual([]);
  });

  it('writes crash with its reference number into the operations log and the error log', () => {
    const log = createLauncherLog({ dir, appVersion: '0.1.0', now });

    log.crash({ startId: 'start-1', refNo: 'R-7K3M-Q9TX', exitCode: 1, signal: null });
    log.crash({ startId: 'start-2', refNo: 'R-ABCD-EFGH', exitCode: null, signal: 'SIGKILL' });

    expect(entriesOf('operations')).toEqual([
      {
        ts: '2026-11-10T09:30:00.000Z',
        level: 'warn',
        event: 'crash',
        refNo: 'R-7K3M-Q9TX',
        exitCode: 1,
        signal: null,
        appVersion: '0.1.0',
        startId: 'start-1',
      },
      {
        ts: '2026-11-10T09:30:00.000Z',
        level: 'warn',
        event: 'crash',
        refNo: 'R-ABCD-EFGH',
        exitCode: null,
        signal: 'SIGKILL',
        appVersion: '0.1.0',
        startId: 'start-2',
      },
    ]);
    expect(entriesOf('errors')).toEqual([
      {
        ts: '2026-11-10T09:30:00.000Z',
        level: 'error',
        refNo: 'R-7K3M-Q9TX',
        function: 'launcher.crash',
        message: 'resellr-server ended unexpectedly with exit code 1',
        stack: null,
        appVersion: '0.1.0',
        startId: 'start-1',
      },
      {
        ts: '2026-11-10T09:30:00.000Z',
        level: 'error',
        refNo: 'R-ABCD-EFGH',
        function: 'launcher.crash',
        message: 'resellr-server ended unexpectedly by signal SIGKILL',
        stack: null,
        appVersion: '0.1.0',
        startId: 'start-2',
      },
    ]);
  });
});
