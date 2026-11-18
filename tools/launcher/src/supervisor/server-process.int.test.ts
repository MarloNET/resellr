import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { RuntimeEnv, RuntimePaths } from '@resellr/runtime-shared/paths';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FAKE_REF_NO, FAKE_SERVER } from '../../test/fake-programs.ts';
import {
  classifyServerExit,
  SERVER_ENTRY,
  START_LIMIT_MS,
  startServerProcess,
  TEST_START_TIMEOUTS_ENV,
  testStartTimeouts,
} from './server-process.ts';

/** How long the fake server may take to report; the test limit leaves room above it. */
const FAKE_POLL = { timeout: 10_000 };
const FAKE_START_MS = FAKE_POLL.timeout + 10_000;

let root: string;
let paths: RuntimePaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'resellr-server-process-'));
  paths = {
    dataDir: join(root, 'Daten'),
    logDir: join(root, 'Protokolle'),
    handoverDir: join(root, 'Fotoübergabe'),
    updateCopyDir: join(root, 'Update-Kopien'),
  };
  mkdirSync(paths.dataDir);
  mkdirSync(paths.logDir);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

/** Starts the fake server with one behaviour; `onReady` records the IPC `ready`. */
function startFake(behaviour: string) {
  const onReady = vi.fn();
  const process = startServerProcess({
    paths,
    startId: 'start-1',
    env: { ...globalThis.process.env, FAKE_SERVER_DIR: root, FAKE_SERVER_RUNS: behaviour },
    serverEntry: FAKE_SERVER,
    onReady,
  });
  return { ...process, onReady };
}

const starts = () =>
  readFileSync(join(root, 'starts.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { ipc: boolean; env: Record<string, string> });

describe('server process (CU-264)', () => {
  it('points to the entry of resellr-server', () => {
    expect(existsSync(SERVER_ENTRY)).toBe(true);
    expect(SERVER_ENTRY.endsWith(join('apps', 'server', 'src', 'main.ts'))).toBe(true);
  });

  it('starts the server with an IPC channel, RESELLR_START_ID and the four folders', async () => {
    const server = startFake('exit-0');
    await expect(server.ended).resolves.toEqual({ kind: 'stopped' });

    expect(starts()).toEqual([
      {
        behaviour: 'exit-0',
        pid: expect.any(Number),
        ipc: true,
        env: expect.objectContaining({
          RESELLR_START_ID: 'start-1',
          RESELLR_DATA_DIR: paths.dataDir,
          RESELLR_LOG_DIR: paths.logDir,
          RESELLR_HANDOVER_DIR: paths.handoverDir,
          RESELLR_UPDATE_COPY_DIR: paths.updateCopyDir,
        }),
      },
    ]);
  });

  it(
    'calls onReady when the server reports ready with the startId of this attempt',
    async () => {
      const server = startFake('ready');
      await expect.poll(() => server.onReady.mock.calls.length, FAKE_POLL).toBe(1);
    },
    FAKE_START_MS,
  );

  it(
    'ignores ready with another startId',
    async () => {
      const server = startFake('ready-other-start');
      await expect.poll(() => existsSync(join(root, 'starts.jsonl')), FAKE_POLL).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(server.onReady).not.toHaveBeenCalled();
    },
    FAKE_START_MS,
  );

  it(
    'reads the reference number of the abort from start-result.json of this start',
    async () => {
      await expect(startFake('aborted').ended).resolves.toEqual({
        kind: 'aborted',
        refNo: FAKE_REF_NO,
      });
    },
    FAKE_START_MS,
  );

  it(
    'never uses the start result of another start (FIND-112 b)',
    async () => {
      await expect(startFake('aborted-other-start').ended).resolves.toEqual({
        kind: 'aborted',
        refNo: null,
      });
    },
    FAKE_START_MS,
  );

  describe('start limit (K-07)', () => {
    /** Starts the fake server with a start limit of `limitMs`. */
    const startWithLimit = (behaviour: string, limitMs: number, env: RuntimeEnv = {}) =>
      startServerProcess({
        paths,
        startId: 'start-1',
        env: {
          ...globalThis.process.env,
          ...env,
          FAKE_SERVER_DIR: root,
          FAKE_SERVER_RUNS: behaviour,
        },
        serverEntry: FAKE_SERVER,
        limitMs,
        onReady: vi.fn(),
      });

    /** Process id of the only start so far. */
    const startedPid = async () => {
      await expect.poll(() => existsSync(join(root, 'starts.jsonl')), FAKE_POLL).toBe(true);
      return (starts()[0] as unknown as { pid: number }).pid;
    };

    it(
      'DER-103-06 ends a start without ready at the limit, also one that ignores SIGTERM, and sorts it as start_limit',
      async () => {
        const server = startWithLimit('hang', 3000);
        const pid = await startedPid();
        let ended = false;
        void server.ended.then(() => (ended = true));

        // Well before the limit the hanging start still runs.
        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(ended).toBe(false);
        expect(isRunning(pid)).toBe(true);

        await expect(server.ended).resolves.toEqual({ kind: 'start_limit' });
        expect(isRunning(pid)).toBe(false);
      },
      FAKE_START_MS,
    );

    it(
      'leaves a server running that reported ready within the limit',
      async () => {
        const port = await freePort();
        writeFileSync(join(paths.dataDir, 'config.json'), JSON.stringify({ port }));
        const server = startWithLimit('ready', 1500);
        const pid = await startedPid();

        await new Promise((resolve) => setTimeout(resolve, 3000));
        expect(isRunning(pid)).toBe(true);
        process.kill(pid, 'SIGKILL');
        await expect(server.ended).resolves.toMatchObject({ kind: 'crashed', signal: 'SIGKILL' });
      },
      FAKE_START_MS,
    );

    it('takes the limit from the test hook RESELLR_TEST_START_TIMEOUTS', () => {
      expect(testStartTimeouts({ [TEST_START_TIMEOUTS_ENV]: '2000,6000' })).toEqual({
        timeoutMs: 2000,
        limitMs: 6000,
      });
      for (const value of [undefined, '', '2000', '2000,x', '-1,6000', '2000,6000,1'])
        expect(testStartTimeouts({ [TEST_START_TIMEOUTS_ENV]: value })).toBeNull();
      expect(START_LIMIT_MS).toBe(10 * 60 * 1000);
    });
  });

  it.each([
    ['exit-11', { kind: 'already_running' }],
    ['exit-12', { kind: 'crashed', exitCode: 12, signal: null }],
    ['exit-3', { kind: 'crashed', exitCode: 3, signal: null }],
  ])('sorts %s', async (behaviour, end) => {
    await expect(startFake(behaviour).ended).resolves.toEqual(end);
  });
});

describe('classifyServerExit', () => {
  it('reads the start result only for exit code 10', () => {
    const read = vi.fn(() => 'R-1');
    expect(classifyServerExit(0, null, read)).toEqual({ kind: 'stopped' });
    expect(classifyServerExit(11, null, read)).toEqual({ kind: 'already_running' });
    expect(read).not.toHaveBeenCalled();
    expect(classifyServerExit(10, null, read)).toEqual({ kind: 'aborted', refNo: 'R-1' });
  });

  it('counts an end by a signal as a crash', () => {
    expect(classifyServerExit(null, 'SIGKILL', () => null)).toEqual({
      kind: 'crashed',
      exitCode: null,
      signal: 'SIGKILL',
    });
  });
});

/** Whether a process with this id still runs. */
function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** A port on 127.0.0.1 that was free a moment ago. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
