import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readLauncherState } from '@resellr/runtime-shared/runtime-state-files';
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

    expect(written()).toEqual({
      request: REQUEST,
      phase: 'ready',
      url: 'http://127.0.0.1:4311/',
      refNo: null,
      dataDir: null,
    });
  });

  it('writes aborted with the reference number and the address of LP-02 from CU-310', () => {
    createLauncherStateWriter(programDir).aborted(REQUEST, REF_NO);

    expect(written()).toEqual({
      request: REQUEST,
      phase: 'aborted',
      url: launcherPageUrl(programDir, 'lp-02', { ref: REF_NO }),
      refNo: REF_NO,
      dataDir: null,
    });
  });

  it('leaves out a reference number that does not match the pattern of 2.0.5 (H-11)', () => {
    createLauncherStateWriter(programDir).aborted(REQUEST, '<img src=x>');

    expect(written()).toMatchObject({
      phase: 'aborted',
      url: launcherPageUrl(programDir, 'lp-02'),
      refNo: null,
    });
  });

  it('replaces the state of an earlier call', () => {
    const writer = createLauncherStateWriter(programDir);
    writer.aborted('earlier-request', REF_NO);
    writer.ready(REQUEST, 'http://127.0.0.1:4311/');

    expect(written()).toMatchObject({ request: REQUEST, phase: 'ready' });
  });
});
