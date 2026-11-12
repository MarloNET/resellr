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

  it('writes supervisor_started with bootTime and supervisor_ended into the operations log only', () => {
    const log = createLauncherLog({ dir, appVersion: '0.1.0', now });

    log.supervisorStarted({ bootTime: new Date('2026-11-10T07:30:00.000Z') });
    log.supervisorEnded({ startId: 'start-1' });

    expect(entriesOf('operations')).toEqual([
      {
        ts: '2026-11-10T09:30:00.000Z',
        level: 'info',
        event: 'supervisor_started',
        bootTime: '2026-11-10T07:30:00.000Z',
        appVersion: '0.1.0',
        startId: null,
      },
      {
        ts: '2026-11-10T09:30:00.000Z',
        level: 'info',
        event: 'supervisor_ended',
        appVersion: '0.1.0',
        startId: 'start-1',
      },
    ]);
    expect(entriesOf('errors')).toEqual([]);
  });

  it.each([
    ['start_aborted', 'launcher.start_aborted'],
    ['start_result_missing', 'launcher.start_result_missing'],
    ['start_limit', 'launcher.start_limit'],
  ] as const)(
    'DER-103-02 writes start_aborted for the cause %s with the same number into both logs, function %s',
    (cause, fn) => {
      createLauncherLog({ dir, appVersion: '0.1.0', now }).startAborted({
        startId: 'start-1',
        refNo: 'R-7K3M-Q9TX',
        cause,
      });

      expect(entriesOf('operations')).toEqual([
        {
          ts: '2026-11-10T09:30:00.000Z',
          level: 'warn',
          event: 'start_aborted',
          refNo: 'R-7K3M-Q9TX',
          appVersion: '0.1.0',
          startId: 'start-1',
        },
      ]);
      expect(entriesOf('errors')).toEqual([
        {
          ts: '2026-11-10T09:30:00.000Z',
          level: 'error',
          refNo: 'R-7K3M-Q9TX',
          function: fn,
          message: expect.stringMatching(/^start of resellr-server /),
          stack: null,
          appVersion: '0.1.0',
          startId: 'start-1',
        },
      ]);
    },
  );

  it.each([
    ['gave_up', 'gaveUp', 'start-4'],
    ['already_running', 'alreadyRunning', 'start-1'],
    ['start_timeout', 'startTimeout', null],
  ] as const)(
    'DER-103-02 writes %s with its reference number into both logs',
    (event, method, startId) => {
      createLauncherLog({ dir, appVersion: '0.1.0', now })[method]({
        startId,
        refNo: 'R-ABCD-EFGH',
      });

      expect(entriesOf('operations')).toEqual([
        {
          ts: '2026-11-10T09:30:00.000Z',
          level: 'warn',
          event,
          refNo: 'R-ABCD-EFGH',
          appVersion: '0.1.0',
          startId,
        },
      ]);
      expect(entriesOf('errors')).toEqual([
        {
          ts: '2026-11-10T09:30:00.000Z',
          level: 'error',
          refNo: 'R-ABCD-EFGH',
          function: `launcher.${event}`,
          message: expect.any(String),
          stack: null,
          appVersion: '0.1.0',
          startId,
        },
      ]);
    },
  );

  it('writes stop_crash with its reference number and exit code into the operations log', () => {
    createLauncherLog({ dir, appVersion: '0.1.0', now }).stopCrash({
      startId: 'start-1',
      refNo: 'R-7K3M-Q9TX',
      exitCode: 3,
      signal: null,
    });

    expect(entriesOf('operations')).toEqual([
      {
        ts: '2026-11-10T09:30:00.000Z',
        level: 'warn',
        event: 'stop_crash',
        refNo: 'R-7K3M-Q9TX',
        exitCode: 3,
        signal: null,
        appVersion: '0.1.0',
        startId: 'start-1',
      },
    ]);
    expect(entriesOf('errors')).toEqual([]);
  });

  it('the messages in the error log hold no paths and no field values', () => {
    const log = createLauncherLog({ dir, appVersion: '0.1.0', now });
    log.startAborted({ startId: 's', refNo: 'R-7K3M-Q9TX', cause: 'start_aborted' });
    log.startAborted({ startId: 's', refNo: 'R-7K3M-Q9TX', cause: 'start_result_missing' });
    log.startAborted({ startId: 's', refNo: 'R-7K3M-Q9TX', cause: 'start_limit' });
    log.gaveUp({ startId: 's', refNo: 'R-7K3M-Q9TX' });
    log.alreadyRunning({ startId: 's', refNo: 'R-7K3M-Q9TX' });
    log.startTimeout({ startId: null, refNo: 'R-7K3M-Q9TX' });

    for (const { message } of entriesOf('errors')) expect(message).not.toMatch(/[\\/]/);
  });
});
