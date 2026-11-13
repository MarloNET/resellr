import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  LAUNCHER_STATE_FILE_NAME,
  readLauncherState,
} from '@resellr/runtime-shared/runtime-state-files';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { launcherPagesDir, launcherPageUrl } from './launcher-pages-location.ts';
import { createLauncherStateWriter } from './launcher-state-writer.ts';

const REQUEST = '9b3e4f0c-2a8d-4c55-9f61-0d7f2c1b8a10';
const REF_NO = 'R-7K3M-Q9TX';

describe('launcher state writer (CU-268)', () => {
  let programDir: string;

  beforeEach(() => {
    // A user folder with a space, an umlaut and `#`, like under `%LOCALAPPDATA%`.
    programDir = join(mkdtempSync(join(tmpdir(), 'resellr-launcher-state-')), 'Jörg #1 Programs');
    mkdirSync(launcherPagesDir(programDir), { recursive: true });
  });

  afterEach(() => rmSync(join(programDir, '..'), { recursive: true, force: true }));

  const written = () => readLauncherState(launcherPagesDir(programDir));

  it('writes ready with the local address next to the launcher pages', () => {
    createLauncherStateWriter(programDir).ready(REQUEST, 'http://127.0.0.1:4311/');

    expect(written()).toEqual([
      {
        request: REQUEST,
        phase: 'ready',
        url: 'http://127.0.0.1:4311/',
        refNo: null,
        dataDir: null,
      },
    ]);
  });

  it('writes aborted with the reference number and the address of LP-02 from CU-310', () => {
    createLauncherStateWriter(programDir).aborted(REQUEST, REF_NO);

    expect(written()).toEqual([
      {
        request: REQUEST,
        phase: 'aborted',
        url: launcherPageUrl(programDir, 'lp-02', { ref: REF_NO }),
        refNo: REF_NO,
        dataDir: null,
      },
    ]);
  });

  it('DER-103-04 writes timeout with the number of start_timeout and the address of LP-02 for this request', () => {
    createLauncherStateWriter(programDir).timeout(REQUEST, REF_NO);

    expect(written()).toEqual([
      {
        request: REQUEST,
        phase: 'timeout',
        // With `request` LP-02 shows `zeitueberschreitung` and keeps reading the state (K-07).
        url: launcherPageUrl(programDir, 'lp-02', { request: REQUEST, ref: REF_NO }),
        refNo: REF_NO,
        dataDir: null,
      },
    ]);
  });

  it('DER-103-05 replaces timeout of the request by the later result', () => {
    const writer = createLauncherStateWriter(programDir);
    writer.timeout(REQUEST, REF_NO);
    writer.aborted(REQUEST, 'R-ABCD-EFGH');

    expect(written()).toMatchObject([{ request: REQUEST, phase: 'aborted', refNo: 'R-ABCD-EFGH' }]);
  });

  it('leaves out a reference number that does not match the pattern of 2.0.5 (H-11)', () => {
    createLauncherStateWriter(programDir).aborted(REQUEST, '<img src=x>');

    expect(written()).toMatchObject([
      { phase: 'aborted', url: launcherPageUrl(programDir, 'lp-02'), refNo: null },
    ]);
  });

  it('F-01 keeps the state of an earlier call that still waits', () => {
    const writer = createLauncherStateWriter(programDir);
    writer.aborted('earlier-request', REF_NO);
    writer.ready(REQUEST, 'http://127.0.0.1:4311/');

    expect(written()).toMatchObject([
      { request: 'earlier-request', phase: 'aborted' },
      { request: REQUEST, phase: 'ready' },
    ]);
  });

  it('DER-104-01 writes stopped with the data folder and without an address for LP-03', () => {
    const dataDir = 'C:\\Users\\Jörg #1\\AppData\\Local\\resellr\\Daten';
    createLauncherStateWriter(programDir).stopped(REQUEST, dataDir);

    expect(written()).toEqual([
      { request: REQUEST, phase: 'stopped', url: null, refNo: null, dataDir },
    ]);
  });

  it('writes error with the reference number and leaves out one that does not match the pattern', () => {
    const writer = createLauncherStateWriter(programDir);
    writer.error(REQUEST, REF_NO);
    writer.error('another-request', '<img src=x>');

    expect(written()).toEqual([
      { request: REQUEST, phase: 'error', url: null, refNo: REF_NO, dataDir: null },
      { request: 'another-request', phase: 'error', url: null, refNo: null, dataDir: null },
    ]);
  });

  it('DER-104-03 writes not_running without a data folder', () => {
    createLauncherStateWriter(programDir).notRunning(REQUEST);

    expect(written()).toEqual([
      { request: REQUEST, phase: 'not_running', url: null, refNo: null, dataDir: null },
    ]);
  });

  it('prepare creates an empty launcher-state.js and keeps existing entries (FIND-311)', () => {
    const writer = createLauncherStateWriter(programDir);
    const file = join(launcherPagesDir(programDir), LAUNCHER_STATE_FILE_NAME);

    writer.prepare();
    expect(readFileSync(file, 'utf8')).toBe('');

    writer.ready(REQUEST, 'http://127.0.0.1:4311/');
    writer.prepare();
    expect(written()).toMatchObject([{ request: REQUEST, phase: 'ready' }]);
  });
});
