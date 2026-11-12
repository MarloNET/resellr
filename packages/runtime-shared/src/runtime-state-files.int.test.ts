import { execFile } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LAUNCHER_STATE_FILE_NAME, readLauncherState } from './runtime-state-files.ts';

const MODULE = new URL('./runtime-state-files.ts', import.meta.url).href;
const WRITES_PER_PROCESS = 50;
const REQUESTS_PER_PROCESS = 5;

/**
 * A process that writes `WRITES_PER_PROCESS` times, in turn for its own `REQUESTS_PER_PROCESS`
 * requests, from `startAt` on, so both processes write at the same time.
 */
const writerScript = `
import { writeLauncherState } from ${JSON.stringify(MODULE)};
const [pagesDir, prefix, startAt] = process.argv.slice(1);
while (Date.now() < Number(startAt));
for (let i = 0; i < ${WRITES_PER_PROCESS}; i += 1) {
  writeLauncherState(pagesDir, {
    request: prefix + '-' + (i % ${REQUESTS_PER_PROCESS}),
    phase: 'ready',
    url: 'http://127.0.0.1:4310/' + i,
    refNo: null,
    dataDir: null,
  });
}
`;

describe('launcher-state.js written by two processes at once (F-01, Nachtrag MAR-470)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'resellr-launcher-state-int-'));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('keeps every request with its last written state', async () => {
    const startAt = String(Date.now() + 1000);
    const run = (prefix: string) =>
      promisify(execFile)(process.execPath, [
        '--input-type=module',
        '-e',
        writerScript,
        dir,
        prefix,
        startAt,
      ]);

    await Promise.all([run('a'), run('b')]);

    // The last write for request k is number 45 + k.
    const lastIndex = (k: number) => WRITES_PER_PROCESS - REQUESTS_PER_PROCESS + k;
    const expected = ['a', 'b'].flatMap((prefix) =>
      Array.from({ length: REQUESTS_PER_PROCESS }, (_, k) => ({
        request: `${prefix}-${k}`,
        phase: 'ready',
        url: `http://127.0.0.1:4310/${lastIndex(k)}`,
        refNo: null,
        dataDir: null,
      })),
    );
    const entries = readLauncherState(dir);
    expect(entries).toHaveLength(2 * REQUESTS_PER_PROCESS);
    expect(entries).toEqual(expect.arrayContaining(expected));
    expect(readdirSync(dir)).toEqual([LAUNCHER_STATE_FILE_NAME]);
  });
});
