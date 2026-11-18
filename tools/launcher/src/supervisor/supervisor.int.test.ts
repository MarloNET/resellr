import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readDailyFiles } from '@resellr/runtime-shared/daily-jsonl-writer';
import { REFERENCE_NUMBER_PATTERN } from '@resellr/runtime-shared/reference-number';
import {
  readLauncherState,
  readRuntimeState,
  readStartResult,
} from '@resellr/runtime-shared/runtime-state-files';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createFakePrograms,
  FAKE_REF_NO,
  FAKE_SERVER,
  type FakePrograms,
} from '../../test/fake-programs.ts';
import { TEST_PROGRAM_DIR_ENV } from '../cli.ts';
import { launcherPagesDir, launcherPageUrl } from '../launcher-pages-location.ts';
import { CRASH_GRACE_MS } from './restart-policy.ts';
import { TEST_SERVER_ENTRY_ENV } from './server-process.ts';

const CLI = fileURLToPath(new URL('../cli.ts', import.meta.url));
/** Generous: a real server under Node.js with type stripping can take several seconds to start. */
const REAL_START_MS = 90_000;
const POLL = { timeout: 60_000, interval: 100 };
/** Tests with the fake server also wait up to `POLL.timeout`; 5 s is too short on a slow host. */
const FAKE_START_MS = POLL.timeout + 10_000;

/** A line of `starts.jsonl` of the fake server. */
interface FakeStart {
  behaviour: string;
  env: Record<string, string>;
}

/**
 * `resellr-launcher` and `resellr-server` as real processes (#119 test expectation): Unix socket
 * as pipe, fake `reg` and Chrome, temporary folders. The test hook `RESELLR_TEST_SERVER_ENTRY`
 * replaces the server where a test needs a chosen exit code.
 */
describe('launcher as supervisor (CU-258, CU-259, CU-261, CU-263, CU-264)', () => {
  let root: string;
  let dataDir: string;
  let logDir: string;
  let fakes: FakePrograms;
  let launchers: Launcher[];

  interface Launcher {
    process: ChildProcess;
    exitCode: Promise<number | null>;
    output: () => string;
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'resellr-supervisor-'));
    dataDir = join(root, 'Daten');
    logDir = join(root, 'Protokolle');
    mkdirSync(dataDir);
    fakes = createFakePrograms();
    fakes.registerChrome('HKCU', fakes.chromePath);
    launchers = [];
  });

  afterEach(async () => {
    // The end of the supervisor also ends its server (IPC channel, exit code 12).
    for (const { process: child, exitCode } of launchers) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await exitCode;
    }
    const port = configuredPort();
    if (port !== null) await expect.poll(() => healthOf(port), POLL).toBeNull();
    fakes.remove();
    rmSync(root, { recursive: true, force: true });
  });

  function launch(command: 'open' | 'supervise', extraEnv: Record<string, string> = {}): Launcher {
    const child = spawn(process.execPath, [CLI, command], {
      env: {
        ...extraEnv,
        PATH: fakes.path,
        LOCALAPPDATA: root,
        RESELLR_DATA_DIR: dataDir,
        RESELLR_LOG_DIR: logDir,
        RESELLR_HANDOVER_DIR: join(root, 'Fotoübergabe'),
        RESELLR_UPDATE_COPY_DIR: join(root, 'Update-Kopien'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    const exitCode = once(child, 'exit').then(([code]) => code as number | null);
    const launcher = { process: child, exitCode, output: () => output };
    launchers.push(launcher);
    return launcher;
  }

  /** Test hook: the supervisor starts the fake server with one behaviour per start. */
  const fakeServer = (...runs: string[]) => ({
    [TEST_SERVER_ENTRY_ENV]: FAKE_SERVER,
    FAKE_SERVER_DIR: root,
    FAKE_SERVER_RUNS: runs.join(','),
  });

  const fakeStarts = (): string[] => {
    const file = join(root, 'starts.jsonl');
    return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  };

  async function freePort(): Promise<number> {
    const server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as { port: number };
    await new Promise((resolve) => server.close(resolve));
    return port;
  }

  const writePort = (port: number) =>
    writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ port }));

  function configuredPort(): number | null {
    const file = join(dataDir, 'config.json');
    return existsSync(file)
      ? (JSON.parse(readFileSync(file, 'utf8')) as { port: number }).port
      : null;
  }

  /** Answer of `GET /api/ops/health`, or null if no server answers. */
  async function healthOf(port: number): Promise<{ state: string; startId: string | null } | null> {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/ops/health`, {
        signal: AbortSignal.timeout(1000),
      });
      return (await response.json()) as { state: string; startId: string | null };
    } catch {
      return null;
    }
  }

  /** `server_started` entries the real server wrote into the operations log. */
  const serverStarts = () =>
    existsSync(logDir)
      ? readdirSync(logDir)
          .filter((name) => name.startsWith('operations-'))
          .flatMap((name) => readFileSync(join(logDir, name), 'utf8').split('\n'))
          .filter((line) => line.includes('"server_started"'))
      : [];

  const startFailedPage = new RegExp(
    `^${pathToFileURL(join(dirname(process.execPath), 'launcher-pages', 'lp-02.html')).href.replace(/[.?]/g, '\\$&')}\\?ref=(${REFERENCE_NUMBER_PATTERN.source.slice(1, -1)})$`,
  );

  const running = (launcher: Launcher) =>
    launcher.process.exitCode === null && launcher.process.signalCode === null;

  it(
    'DER-102-02 without a server open takes over the pipe, starts the server without a window, opens Chrome on ready and runs on as supervisor; port from config.json',
    async () => {
      const port = await freePort();
      writePort(port);
      const open = launch('open');

      await expect.poll(() => fakes.chromeCalls(), POLL).toEqual([`http://127.0.0.1:${port}/`]);
      const health = await healthOf(port);
      // The server got the startId of this attempt from the supervisor (RESELLR_START_ID).
      expect(health).toEqual({ state: 'ready', startId: expect.any(String) });
      expect(serverStarts()).toHaveLength(1);
      expect(serverStarts()[0]).toContain(`"startId":"${health!.startId}"`);
      expect(running(open)).toBe(true);

      // End of the supervisor ends the server (IPC end, exit code 12).
      open.process.kill('SIGKILL');
      await expect.poll(() => healthOf(port), POLL).toBeNull();
    },
    REAL_START_MS,
  );

  it(
    'DER-102-06 ten calls at once give exactly one supervisor and one server; the others wait on the pipe',
    async () => {
      const port = await freePort();
      writePort(port);
      const opens = Array.from({ length: 10 }, () => launch('open'));

      await expect
        .poll(() => fakes.chromeCalls(), { ...POLL, timeout: 80_000 })
        .toEqual(Array.from({ length: 10 }, () => `http://127.0.0.1:${port}/`));
      expect(serverStarts()).toHaveLength(1);
      await expect.poll(() => opens.filter(running).length, POLL).toBe(1);
      const ended = await Promise.all(
        opens.filter((open) => !running(open)).map((o) => o.exitCode),
      );
      expect(ended).toEqual(Array.from({ length: 9 }, () => 0));
    },
    REAL_START_MS + 30_000,
  );

  it(
    'DER-102-07 supervise becomes supervisor and starts the server without Chrome; a second supervise ends at once without a message',
    async () => {
      const port = await freePort();
      writePort(port);
      const first = launch('supervise');

      await expect.poll(() => healthOf(port), POLL).toMatchObject({ state: 'ready' });
      const second = launch('supervise');

      expect(await second.exitCode).toBe(0);
      expect(second.output()).toBe('');
      expect(running(first)).toBe(true);
      expect(serverStarts()).toHaveLength(1);
      expect(fakes.chromeCalls()).toEqual([]);
      expect(fakes.explorerArgs()).toBeNull();
    },
    REAL_START_MS,
  );

  it(
    'DER-102-08 after already_running open asks the health once more and hands over to LP-02 with the reference number of the warning',
    async () => {
      writePort(await freePort());
      // The server answers `starting` and ends with exit code 11 shortly after the health request of `open`.
      const supervise = launch('supervise', fakeServer('exit-11-after-health'));
      await expect.poll(() => fakeStarts().length, POLL).toBe(1);

      const open = launch('open', fakeServer('exit-11-after-health'));

      expect(await open.exitCode).toBe(0);
      expect(await supervise.exitCode).toBe(0);
      await expect
        .poll(() => fakes.chromeCalls(), POLL)
        .toEqual([expect.stringMatching(startFailedPage)]);
      expect(fakeStarts()).toHaveLength(1);

      // DER-103-07: the number LP-02 shows is the one of the warning, in both logs.
      const refNo = startFailedPage.exec(fakes.chromeCalls()[0]!)![1];
      expect(logEntries('operations')).toContainEqual(
        expect.objectContaining({ level: 'warn', event: 'already_running', refNo }),
      );
      expect(logEntries('errors')).toEqual([
        expect.objectContaining({ refNo, function: 'launcher.already_running' }),
      ]);
    },
    FAKE_START_MS,
  );

  it(
    'DER-102-09 after stopped open goes on with step 3: takes over the pipe, starts the server and runs on as supervisor',
    async () => {
      const port = await freePort();
      writePort(port);
      const runs = fakeServer('exit-0-after-health', 'ready');
      const supervise = launch('supervise', runs);
      await expect.poll(() => fakeStarts().length, POLL).toBe(1);

      const open = launch('open', runs);

      expect(await supervise.exitCode).toBe(0);
      await expect.poll(() => fakes.chromeCalls(), POLL).toEqual([`http://127.0.0.1:${port}/`]);
      expect(fakeStarts()).toHaveLength(2);
      expect(running(open)).toBe(true);
    },
    FAKE_START_MS,
  );

  const logEntries = (kind: 'operations' | 'errors' | 'availability') =>
    readDailyFiles({ dir: logDir, kind }).flatMap((file) => file.entries);
  const eventsOf = (event: string) =>
    logEntries('operations').filter((entry) => entry.event === event);

  it(
    'DER-103-02 opens LP-02 with an own reference number of the supervisor when the aborted start left no start result and writes start_aborted with it into both logs',
    async () => {
      writePort(await freePort());

      const open = launch('open', fakeServer('exit-10'));

      expect(await open.exitCode).toBe(0);
      await expect
        .poll(() => fakes.chromeCalls(), POLL)
        .toEqual([expect.stringMatching(startFailedPage)]);
      const refNo = startFailedPage.exec(fakes.chromeCalls()[0]!)![1];
      expect(refNo).not.toBe(FAKE_REF_NO);
      const [{ env }] = fakeStarts().map((line) => JSON.parse(line) as FakeStart) as [FakeStart];
      expect(eventsOf('start_aborted')).toEqual([
        {
          ts: expect.any(String),
          level: 'warn',
          event: 'start_aborted',
          refNo,
          appVersion: '0.1.0',
          startId: env.RESELLR_START_ID,
        },
      ]);
      expect(logEntries('errors')).toEqual([
        expect.objectContaining({
          level: 'error',
          refNo,
          function: 'launcher.start_result_missing',
          startId: env.RESELLR_START_ID,
        }),
      ]);
    },
    FAKE_START_MS,
  );

  it(
    'DER-103-02 opens LP-02 with the reference number of the start result when the start is aborted and writes start_aborted with it into both logs',
    async () => {
      writePort(await freePort());

      const open = launch('open', fakeServer('aborted'));

      expect(await open.exitCode).toBe(0);
      await expect
        .poll(() => fakes.chromeCalls(), POLL)
        .toEqual([expect.stringMatching(startFailedPage)]);
      expect(fakes.chromeCalls()[0]).toMatch(/\?ref=R-ABCD-EFGH$/);
      expect(eventsOf('start_aborted')).toEqual([
        expect.objectContaining({ level: 'warn', refNo: FAKE_REF_NO }),
      ]);
      expect(logEntries('errors')).toEqual([
        expect.objectContaining({ refNo: FAKE_REF_NO, function: 'launcher.start_aborted' }),
      ]);
      // The supervisor of `open` logs its start with the Windows start and its end.
      const operations = logEntries('operations');
      expect(operations[0]).toEqual({
        ts: expect.any(String),
        level: 'info',
        event: 'supervisor_started',
        bootTime: expect.any(String),
        appVersion: '0.1.0',
        startId: null,
      });
      expect(Date.parse(operations[0]!.bootTime as string)).toBeLessThan(Date.now());
      expect(operations.at(-1)).toMatchObject({
        event: 'supervisor_ended',
        startId: eventsOf('start_aborted')[0]!.startId,
      });
    },
    FAKE_START_MS,
  );
  const crashEntries = () => logEntries('operations').filter((entry) => entry.event === 'crash');

  it(
    'restarts the server 5 s after a crash and writes crash with a reference number, lastCrashAt and the availability check',
    async () => {
      const port = await freePort();
      writePort(port);
      const supervise = launch('supervise', fakeServer('exit-1', 'ready'));

      await expect.poll(() => fakeStarts().length, POLL).toBe(1);
      const crashedAt = Date.now();
      await expect.poll(() => fakeStarts().length, POLL).toBe(2);
      // The restart follows the wait of 5 s (2.18, H-12).
      expect(Date.now() - crashedAt).toBeGreaterThanOrEqual(CRASH_GRACE_MS - 500);

      await expect.poll(() => healthOf(port), POLL).toMatchObject({ state: 'ready' });
      const [crash] = crashEntries();
      expect(crash).toMatchObject({
        level: 'warn',
        event: 'crash',
        refNo: expect.stringMatching(REFERENCE_NUMBER_PATTERN),
        exitCode: 1,
        signal: null,
        appVersion: '0.1.0',
        startId: expect.any(String),
      });
      // The same reference number in the error log (FIND-210).
      expect(logEntries('errors')).toEqual([
        expect.objectContaining({ refNo: crash!.refNo, function: 'launcher.crash' }),
      ]);
      expect(readRuntimeState(logDir)?.lastCrashAt).toEqual(expect.any(String));
      // In `ready` the availability check writes its first entry at once.
      await expect
        .poll(() => logEntries('availability'), POLL)
        .toEqual([{ ts: expect.any(String), ok: true }]);
      expect(running(supervise)).toBe(true);
    },
    FAKE_START_MS,
  );

  it(
    'writes no crash when the supervisor itself ends in the wait after a crash',
    async () => {
      writePort(await freePort());
      const supervise = launch('supervise', fakeServer('exit-1', 'ready'));
      await expect.poll(() => fakeStarts().length, POLL).toBe(1);
      // The server crashed at once; 1 s later the supervisor is in the wait of 5 s.
      await sleep(1000);

      // Logging off or shutting down ends the supervisor within the 5 s.
      supervise.process.kill('SIGKILL');
      await supervise.exitCode;

      expect(crashEntries()).toEqual([]);
      expect(readRuntimeState(logDir)?.lastCrashAt).toBeUndefined();
      expect(fakeStarts()).toHaveLength(1);
    },
    FAKE_START_MS,
  );

  it(
    'DER-103-03 restarts at most 3 times in 10 minutes; the fourth crash leads to gave_up with its own reference number in both logs and the start result, and a waiting open shows LP-02 with it',
    async () => {
      writePort(await freePort());
      // The program folder of `open`, so the waiting call can show LP-01 (2.18 step 4).
      const programDir = join(root, 'Programme', 'resellr');
      mkdirSync(launcherPagesDir(programDir), { recursive: true });
      const runs = fakeServer('exit-1-after-health', 'exit-1', 'exit-1', 'exit-1', 'ready');
      const supervise = launch('supervise', runs);
      await expect.poll(() => fakeStarts().length, POLL).toBe(1);

      const open = launch('open', { ...runs, [TEST_PROGRAM_DIR_ENV]: programDir });

      expect(await supervise.exitCode).toBe(0);
      expect(await open.exitCode).toBe(0);
      // No restart after the fourth crash.
      expect(fakeStarts()).toHaveLength(4);
      const startIds = fakeStarts().map(
        (line) => (JSON.parse(line) as FakeStart).env.RESELLR_START_ID,
      );

      // Every crash after the wait is logged with its own number, the fourth too (Nachtrag MAR-498).
      const crashes = crashEntries();
      expect(crashes.map((crash) => crash.startId)).toEqual(startIds);
      expect(readRuntimeState(logDir)?.lastCrashAt).toEqual(expect.any(String));
      const [gaveUp, ...more] = eventsOf('gave_up');
      expect(more).toEqual([]);
      expect(gaveUp).toEqual({
        ts: expect.any(String),
        level: 'warn',
        event: 'gave_up',
        refNo: expect.stringMatching(REFERENCE_NUMBER_PATTERN),
        appVersion: '0.1.0',
        startId: startIds[3],
      });
      const refNo = gaveUp!.refNo as string;
      expect(new Set([...crashes.map((crash) => crash.refNo), refNo]).size).toBe(5);
      expect(logEntries('errors')).toContainEqual(
        expect.objectContaining({ refNo, function: 'launcher.gave_up', startId: startIds[3] }),
      );
      expect(readStartResult(logDir)).toEqual({
        startId: startIds[3],
        state: 'gave_up',
        refNo,
        at: expect.any(String),
      });

      // The waiting `open` showed LP-01 and hands the number of `gave_up` over to LP-02.
      const [waitingPage] = fakes.chromeCalls();
      expect(waitingPage!.split('?')[0]).toBe(launcherPageUrl(programDir, 'lp-01'));
      const request = new URL(waitingPage!).searchParams.get('request');
      expect(readLauncherState(launcherPagesDir(programDir))).toEqual([
        {
          request,
          phase: 'aborted',
          url: launcherPageUrl(programDir, 'lp-02', { ref: refNo }),
          refNo,
          dataDir: null,
        },
      ]);
    },
    4 * CRASH_GRACE_MS + FAKE_START_MS,
  );
});
