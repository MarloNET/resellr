import { type ChildProcess, execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import {
  LAUNCHER_STATE_FILE_NAME,
  readLauncherState,
  readStartResult,
} from '@resellr/runtime-shared/runtime-state-files';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createFakePrograms,
  FAKE_REF_NO,
  FAKE_SERVER,
  type FakePrograms,
  waitFor,
} from '../test/fake-programs.ts';
import { TEST_PROGRAM_DIR_ENV } from './cli.ts';
import { launcherPagesDir, launcherPageUrl } from './launcher-pages-location.ts';
import { TEST_SERVER_ENTRY_ENV, TEST_START_TIMEOUTS_ENV } from './supervisor/server-process.ts';
import { subscribeToSupervisor, supervisorPipePath } from './supervisor/supervisor-pipe.ts';

const CLI = fileURLToPath(new URL('./cli.ts', import.meta.url));
/** Preload that sends the launcher's connections to 4310 to the test server (#329). */
const PORT_REDIRECT = fileURLToPath(new URL('../test/port-redirect.ts', import.meta.url));

/** A running test server that answers `GET /api/ops/health` and records each request. */
interface TestServer {
  port: number;
  requests: string[];
  /** `Origin` header of each request, in the same order. */
  origins: (string | undefined)[];
  close(): Promise<void>;
}

async function startTestServer(
  port: number,
  state: 'starting' | 'ready' | 'stopping' = 'ready',
): Promise<TestServer> {
  const requests: string[] = [];
  const origins: (string | undefined)[] = [];
  const server: Server = createServer((request, response) => {
    requests.push(`${request.method} http://${request.headers.host}${request.url}`);
    origins.push(request.headers.origin);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ state, startId: 'start-1' }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    port: (server.address() as AddressInfo).port,
    requests,
    origins,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

describe('launcher open against a running test server (CU-258, CU-259)', () => {
  let root: string;
  let dataDir: string;
  let logDir: string;
  let programDir: string;
  let fakes: FakePrograms;
  let server: TestServer | undefined;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'resellr-launcher-'));
    dataDir = join(root, 'Daten');
    logDir = join(root, 'Protokolle');
    // The installation brings the folder of the launcher pages (2.19); a path with a space,
    // an umlaut and `#` like a user folder.
    programDir = join(root, 'Programs', 'resellr #1 Jörg');
    mkdirSync(launcherPagesDir(programDir), { recursive: true });
    mkdirSync(dataDir);
    fakes = createFakePrograms();
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    fakes.remove();
    rmSync(root, { recursive: true, force: true });
  });

  let launcher: ChildProcess | undefined;

  afterEach(() => {
    launcher?.kill();
    launcher = undefined;
  });

  /** Runs `resellr-launcher open` as its own process and returns its exit code. */
  function runOpen(extraEnv: Record<string, string> = {}): Promise<number> {
    const env = {
      ...extraEnv,
      PATH: fakes.path,
      LOCALAPPDATA: root,
      RESELLR_DATA_DIR: dataDir,
      RESELLR_LOG_DIR: logDir,
      RESELLR_HANDOVER_DIR: join(root, 'Fotoübergabe'),
      RESELLR_UPDATE_COPY_DIR: join(root, 'Update-Kopien'),
      [TEST_PROGRAM_DIR_ENV]: programDir,
    };
    return new Promise((resolve) => {
      launcher = execFile(process.execPath, ['--import', PORT_REDIRECT, CLI, 'open'], {
        env,
        windowsHide: true,
      });
      launcher.on('exit', (code) => resolve(code ?? -1));
    });
  }

  const writeConfig = (text: string) => writeFileSync(join(dataDir, 'config.json'), text);

  /** All entries of the operations or the error log, oldest first. */
  const readLog = (kind: 'operations' | 'errors'): Record<string, unknown>[] =>
    existsSync(logDir)
      ? readdirSync(logDir)
          .filter((name) => name.startsWith(`${kind}-`))
          .flatMap((name) => readFileSync(join(logDir, name), 'utf8').split('\n'))
          .filter((line) => line !== '')
          .map((line) => JSON.parse(line) as Record<string, unknown>)
      : [];
  const operationsLog = () => readLog('operations');
  const errorsLog = () => readLog('errors');

  it('DER-102-01 detects the ready server and opens Chrome with http://127.0.0.1:<port>/', async () => {
    server = await startTestServer(0);
    writeConfig(JSON.stringify({ port: server.port }));
    fakes.registerChrome('HKCU', fakes.chromePath);

    await expect(runOpen()).resolves.toBe(0);

    const url = `http://127.0.0.1:${server.port}/`;
    expect(server.requests).toEqual([`GET ${url}api/ops/health`]);
    expect(await waitFor(fakes.chromeArgs)).toEqual([url]);
    expect(operationsLog()).toEqual([]);
  });

  it('DER-102-05 opens the address through explorer.exe and writes the warning chrome_not_found through CU-296 into the operations log', async () => {
    server = await startTestServer(0);
    writeConfig(JSON.stringify({ port: server.port }));

    await expect(runOpen()).resolves.toBe(0);

    expect(await waitFor(fakes.explorerArgs)).toEqual([`http://127.0.0.1:${server.port}/`]);
    expect(fakes.chromeArgs()).toBeNull();
    // Written by CU-296: level `warn`, no details, `appVersion` and `startId: null` for `open`
    // (2.19, Nachtrag MAR-366).
    expect(operationsLog()).toEqual([
      {
        ts: expect.any(String),
        level: 'warn',
        event: 'chrome_not_found',
        appVersion: '0.1.0',
        startId: null,
      },
    ]);
  });

  it('asks the port from config.json and opens Chrome with http://127.0.0.1:<port>/', async () => {
    server = await startTestServer(0);
    writeConfig(`{ "port": ${server.port} }`);
    fakes.registerChrome('HKCU', fakes.chromePath);

    await expect(runOpen()).resolves.toBe(0);

    expect(server.requests).toEqual([`GET http://127.0.0.1:${server.port}/api/ops/health`]);
    expect(await waitFor(fakes.chromeArgs)).toEqual([`http://127.0.0.1:${server.port}/`]);
  });

  it.each([
    ['an invalid port', '{ "port": "4311" }'],
    ['a config.json that is no JSON object', '[4311]'],
  ])('uses 4310 for %s, leaves config.json unchanged and writes no warning', async (_, text) => {
    // The test server listens on a free port; the launcher's connection to 4310 goes there.
    server = await startTestServer(0);
    writeConfig(text);
    fakes.registerChrome('HKCU', fakes.chromePath);

    await expect(runOpen({ PORT_REDIRECT: `4310:${server.port}` })).resolves.toBe(0);

    expect(server.requests).toEqual(['GET http://127.0.0.1:4310/api/ops/health']);
    expect(await waitFor(fakes.chromeArgs)).toEqual(['http://127.0.0.1:4310/']);
    expect(readFileSync(join(dataDir, 'config.json'), 'utf8')).toBe(text);
    expect(operationsLog()).toEqual([]);
  });

  /** Lets the own supervisor start the fake server, which aborts the start (exit code 10). */
  const abortingServer = () => ({
    [TEST_SERVER_ENTRY_ENV]: FAKE_SERVER,
    FAKE_SERVER_DIR: root,
    FAKE_SERVER_RUNS: 'aborted',
  });

  const startFailedPage = (refNo: string) => launcherPageUrl(programDir, 'lp-02', { ref: refNo });

  const launcherState = () => readLauncherState(launcherPagesDir(programDir));

  it('does not create config.json when it is missing', async () => {
    // Without config.json the launcher asks 4310; that connection goes to a free, closed port.
    await expect(
      runOpen({ ...abortingServer(), PORT_REDIRECT: `4310:${await freePort()}` }),
    ).resolves.toBe(0);

    expect(existsSync(join(dataDir, 'config.json'))).toBe(false);
  });

  it('starts the server itself while another one is only starting and opens LP-02 with the reference number of the abort', async () => {
    server = await startTestServer(0, 'starting');
    writeConfig(JSON.stringify({ port: server.port }));
    fakes.registerChrome('HKCU', fakes.chromePath);

    await expect(runOpen(abortingServer())).resolves.toBe(0);

    expect(server.requests).toHaveLength(1);
    expect(await waitFor(fakes.chromeArgs)).toEqual([startFailedPage(FAKE_REF_NO)]);
    expect(fakes.explorerArgs()).toBeNull();
  });

  describe('LP-01 when waiting takes longer than 3 s (2.18 step 4)', () => {
    /** Generous limit for a start of 3.5 s on a slow host. */
    const LONG_START_TEST_MS = 30_000;

    /** The request of the LP-01 the fake Chrome was opened with. */
    const lp01Request = (calls: string[]): string | null => {
      expect(calls).toHaveLength(1);
      const url = new URL(calls[0]!);
      expect(url.href.split('?')[0]).toBe(launcherPageUrl(programDir, 'lp-01'));
      return url.searchParams.get('request');
    };

    it(
      'opens LP-01 only after 3 s and hands an abort of the own start over through launcher-state.js',
      async () => {
        writeConfig(JSON.stringify({ port: await freePort() }));
        fakes.registerChrome('HKCU', fakes.chromePath);

        const startedAt = Date.now();
        await expect(runOpen({ ...abortingServer(), FAKE_SERVER_DELAY_MS: '3500' })).resolves.toBe(
          0,
        );

        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(3500);
        const request = lp01Request(fakes.chromeCalls());
        expect(request).toMatch(/^[0-9a-f-]{36}$/);
        expect(launcherState()).toEqual([
          {
            request,
            phase: 'aborted',
            url: startFailedPage(FAKE_REF_NO),
            refNo: FAKE_REF_NO,
            dataDir: null,
          },
        ]);
      },
      LONG_START_TEST_MS,
    );

    it(
      'DER-102-04 writes ready with the local address for the open LP-01 when the own start is ready after 3 s',
      async () => {
        const port = await freePort();
        writeConfig(JSON.stringify({ port }));
        fakes.registerChrome('HKCU', fakes.chromePath);

        const exit = runOpen({
          [TEST_SERVER_ENTRY_ENV]: FAKE_SERVER,
          FAKE_SERVER_DIR: root,
          FAKE_SERVER_RUNS: 'ready',
          FAKE_SERVER_DELAY_MS: '3500',
        });

        const [state] = await waitFor(
          () => (launcherState().length > 0 ? launcherState() : null),
          LONG_START_TEST_MS - 5000,
        );
        const request = lp01Request(fakes.chromeCalls());
        expect(state).toEqual({
          request,
          phase: 'ready',
          url: `http://127.0.0.1:${port}/`,
          refNo: null,
          dataDir: null,
        });
        // `open` runs on as supervisor; its end is not part of this test.
        launcher?.kill();
        await exit;
      },
      LONG_START_TEST_MS,
    );

    describe('time-out and start limit with the test hook of 2 s and 6 s (K-07, 6.2 g)', () => {
      /** Runs the own start with the shortened limits; the fake server acts like `runs`. */
      const runWithShortLimits = (runs: string, extraEnv: Record<string, string> = {}) =>
        runOpen({
          [TEST_SERVER_ENTRY_ENV]: FAKE_SERVER,
          [TEST_START_TIMEOUTS_ENV]: '2000,6000',
          FAKE_SERVER_DIR: root,
          FAKE_SERVER_RUNS: runs,
          ...extraEnv,
        });

      const REF_NO = /^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

      /** The entry of `event` in the operations log, once there. */
      const logged = (event: string) =>
        waitFor(() => operationsLog().find((entry) => entry.event === event) ?? null, 15_000);

      it(
        'DER-103-04 writes start_timeout with an own number into both logs and timeout into launcher-state.js, DER-103-05 then ready',
        async () => {
          const port = await freePort();
          writeConfig(JSON.stringify({ port }));
          fakes.registerChrome('HKCU', fakes.chromePath);

          const exit = runWithShortLimits('ready', { FAKE_SERVER_DELAY_MS: '4000' });

          // `open` writes the state after both log entries and after it opened LP-01.
          await waitFor(() => (launcherState()[0]?.phase === 'timeout' ? true : null), 15_000);
          await waitFor(() => (fakes.chromeCalls().length > 0 ? true : null));
          const timeout = await logged('start_timeout');
          const refNo = timeout.refNo as string;
          expect(refNo).toMatch(REF_NO);
          expect(timeout).toMatchObject({ level: 'warn', startId: expect.any(String) });
          expect(errorsLog()).toEqual([
            expect.objectContaining({
              level: 'error',
              refNo,
              function: 'launcher.start_timeout',
              startId: timeout.startId,
            }),
          ]);
          const request = lp01Request(fakes.chromeCalls());
          expect(launcherState()).toEqual([
            {
              request,
              phase: 'timeout',
              url: launcherPageUrl(programDir, 'lp-02', { request: request!, ref: refNo }),
              refNo,
              dataDir: null,
            },
          ]);

          // Later the start reports ready: the page goes on to the local address by itself.
          await waitFor(() => (launcherState()[0]?.phase === 'ready' ? true : null), 15_000);
          expect(launcherState()).toEqual([
            {
              request,
              phase: 'ready',
              url: `http://127.0.0.1:${port}/`,
              refNo: null,
              dataDir: null,
            },
          ]);
          expect(fakes.chromeCalls()).toHaveLength(1);
          launcher?.kill();
          await exit;
        },
        LONG_START_TEST_MS,
      );

      it(
        'DER-103-06 ends a start without ready after the start limit, logs start_aborted (launcher.start_limit), writes aborted, does not restart, and the database stays intact although the limit hits a migration',
        async () => {
          writeConfig(JSON.stringify({ port: await freePort() }));
          fakes.registerChrome('HKCU', fakes.chromePath);
          // A database with data, like before an update with a migration.
          const before = new DatabaseSync(join(dataDir, 'resellr.db'));
          before.exec('PRAGMA journal_mode = WAL');
          before.exec('CREATE TABLE listing (id INTEGER PRIMARY KEY, title TEXT NOT NULL)');
          before.exec(
            'CREATE TABLE app_migration (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)',
          );
          before.exec(`INSERT INTO app_migration VALUES ('20261101_0001_test', '2026-11-01')`);
          for (let id = 1; id <= 100; id++)
            before.prepare('INSERT INTO listing (id, title) VALUES (?, ?)').run(id, `Gerät ${id}`);
          before.close();

          const startedAt = Date.now();
          await expect(runWithShortLimits('hang-in-migration')).resolves.toBe(0);

          expect(Date.now() - startedAt).toBeGreaterThanOrEqual(6000);
          expect(existsSync(join(root, 'in-migration'))).toBe(true);
          // No restart: the fake server was started once, and its process is gone.
          const starts = readFileSync(join(root, 'starts.jsonl'), 'utf8').trim().split('\n');
          expect(starts).toHaveLength(1);
          const { pid } = JSON.parse(starts[0]!) as { pid: number };
          expect(() => process.kill(pid, 0)).toThrow();

          const events = operationsLog().map((entry) => entry.event);
          expect(events).toEqual([
            'supervisor_started',
            'start_timeout',
            'start_aborted',
            'supervisor_ended',
          ]);
          const aborted = operationsLog().find((entry) => entry.event === 'start_aborted')!;
          const timeout = operationsLog().find((entry) => entry.event === 'start_timeout')!;
          const refNo = aborted.refNo as string;
          expect(refNo).toMatch(REF_NO);
          expect(refNo).not.toBe(timeout.refNo);
          expect(errorsLog()).toEqual([
            expect.objectContaining({ refNo: timeout.refNo, function: 'launcher.start_timeout' }),
            expect.objectContaining({
              refNo,
              function: 'launcher.start_limit',
              startId: aborted.startId,
            }),
          ]);
          expect(readStartResult(logDir)).toEqual({
            startId: aborted.startId,
            state: 'aborted',
            refNo,
            at: expect.any(String),
          });
          // The waiting page shows LP-02 `default` with the number of the abort.
          const request = lp01Request(fakes.chromeCalls());
          expect(launcherState()).toEqual([
            { request, phase: 'aborted', url: startFailedPage(refNo), refNo, dataDir: null },
          ]);

          // The next start finds an intact database: the open migration run was rolled back.
          const after = new DatabaseSync(join(dataDir, 'resellr.db'));
          try {
            expect(after.prepare('PRAGMA integrity_check').all()).toEqual([
              { integrity_check: 'ok' },
            ]);
            expect(
              after.prepare(`SELECT name FROM sqlite_master WHERE name = 'half_done'`).all(),
            ).toEqual([]);
            expect(after.prepare('SELECT name FROM app_migration').all()).toEqual([
              { name: '20261101_0001_test' },
            ]);
            expect(after.prepare('SELECT count(*) AS rows FROM listing').get()).toEqual({
              rows: 100,
            });
            after.exec('BEGIN IMMEDIATE');
            after.exec('ROLLBACK');
          } finally {
            after.close();
          }
        },
        LONG_START_TEST_MS,
      );
    });

    it('opens no LP-01 and writes no launcher-state.js when the own start is aborted at once', async () => {
      writeConfig(JSON.stringify({ port: await freePort() }));
      fakes.registerChrome('HKCU', fakes.chromePath);

      await expect(runOpen(abortingServer())).resolves.toBe(0);

      expect(fakes.chromeCalls()).toEqual([startFailedPage(FAKE_REF_NO)]);
      expect(existsSync(join(launcherPagesDir(programDir), LAUNCHER_STATE_FILE_NAME))).toBe(false);
    });
  });
});

describe('launcher stop (CU-260, Technical Specification 2.18 command stop)', () => {
  let root: string;
  let dataDir: string;
  let logDir: string;
  let programDir: string;
  let fakes: FakePrograms;
  let server: TestServer | undefined;
  const processes: ChildProcess[] = [];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'resellr-launcher-stop-'));
    dataDir = join(root, 'Daten');
    logDir = join(root, 'Protokolle');
    programDir = join(root, 'Programs', 'resellr #1 Jörg');
    mkdirSync(launcherPagesDir(programDir), { recursive: true });
    mkdirSync(dataDir);
    fakes = createFakePrograms();
    fakes.registerChrome('HKCU', fakes.chromePath);
  });

  afterEach(async () => {
    for (const child of processes.splice(0)) child.kill();
    await server?.close();
    server = undefined;
    fakes.remove();
    rmSync(root, { recursive: true, force: true });
  });

  /** Runs `resellr-launcher <args>` as its own process; resolves with its exit code. */
  function runLauncher(args: string[], extraEnv: Record<string, string> = {}): Promise<number> {
    const env = {
      ...extraEnv,
      PATH: fakes.path,
      LOCALAPPDATA: root,
      RESELLR_DATA_DIR: dataDir,
      RESELLR_LOG_DIR: logDir,
      RESELLR_HANDOVER_DIR: join(root, 'Fotoübergabe'),
      RESELLR_UPDATE_COPY_DIR: join(root, 'Update-Kopien'),
      [TEST_PROGRAM_DIR_ENV]: programDir,
      FAKE_SERVER_DIR: root,
      [TEST_SERVER_ENTRY_ENV]: FAKE_SERVER,
      // The pipe is a socket in the temporary folder; the test connects to it too.
      TMPDIR: tmpdir(),
    };
    return new Promise((resolve) => {
      const child = execFile(process.execPath, ['--import', PORT_REDIRECT, CLI, ...args], {
        env,
        windowsHide: true,
      });
      processes.push(child);
      child.on('exit', (code) => resolve(code ?? -1));
    });
  }

  const writeConfig = (text: string) => writeFileSync(join(dataDir, 'config.json'), text);
  const launcherState = () => readLauncherState(launcherPagesDir(programDir));
  const stateFile = () => join(launcherPagesDir(programDir), LAUNCHER_STATE_FILE_NAME);
  const lines = (name: string) =>
    existsSync(join(root, name))
      ? readFileSync(join(root, name), 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
      : [];

  /** The request of the LP-03 the fake Chrome was opened with. */
  const lp03Request = (): string => {
    const calls = fakes.chromeCalls();
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!);
    expect(url.href.split('?')[0]).toBe(launcherPageUrl(programDir, 'lp-03'));
    expect([...url.searchParams.keys()]).toEqual(['request']);
    return url.searchParams.get('request')!;
  };

  /**
   * Starts `supervise` with the fake server and waits until it reports ready over the pipe.
   * Returns the exit of the supervisor wrapped, so awaiting this call does not wait for it.
   */
  async function startSupervisor(): Promise<{ exit: Promise<number> }> {
    writeConfig(JSON.stringify({ port: await freePort() }));
    const exit = runLauncher(['supervise']);
    const pipePath = supervisorPipePath(root);
    // `subscribe` resolves with null until the supervisor holds the pipe, then with `ready`.
    const deadline = Date.now() + 10_000;
    let result = await subscribeToSupervisor(pipePath);
    while (result === null && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      result = await subscribeToSupervisor(pipePath);
    }
    expect(result).toMatchObject({ phase: 'ready' });
    return { exit };
  }

  it('DER-104-01 opens LP-03, sends stop over the pipe, the supervisor stops the server and stop writes stopped with the data folder', async () => {
    const supervisor = await startSupervisor();

    await expect(runLauncher(['stop'])).resolves.toBe(0);

    const request = lp03Request();
    expect(request).toMatch(/^[0-9a-f-]{36}$/);
    expect(launcherState()).toEqual([
      { request, phase: 'stopped', url: null, refNo: null, dataDir },
    ]);
    // The supervisor sent the request without Origin (G-3), and the server ended without a restart.
    expect(lines('shutdowns.jsonl')).toEqual([{ origin: null }]);
    await expect(supervisor.exit).resolves.toBe(0);
    expect(lines('starts.jsonl')).toHaveLength(1);
    expect(operationsLog(logDir).map((entry) => entry.event)).toEqual([
      'supervisor_started',
      'supervisor_ended',
    ]);
  });

  it('stop --for-update stops over the pipe without a page, waits for the free pipe and ends with exit code 0', async () => {
    const supervisor = await startSupervisor();

    await expect(runLauncher(['stop', '--for-update'])).resolves.toBe(0);

    // The pipe is free: the supervisor has ended.
    expect(await subscribeToSupervisor(supervisorPipePath(root))).toBeNull();
    await expect(supervisor.exit).resolves.toBe(0);
    expect(fakes.chromeCalls()).toEqual([]);
    expect(existsSync(stateFile())).toBe(false);
  });

  it('DER-104-03 shows not_running without a data folder when neither a server nor a supervisor runs', async () => {
    writeConfig(JSON.stringify({ port: await freePort() }));

    await expect(runLauncher(['stop'])).resolves.toBe(0);

    const request = lp03Request();
    expect(launcherState()).toEqual([
      { request, phase: 'not_running', url: null, refNo: null, dataDir: null },
    ]);
  });

  it('DER-104-03 stop --for-update ends with exit code 0 when resellr does not run', async () => {
    writeConfig(JSON.stringify({ port: await freePort() }));

    await expect(runLauncher(['stop', '--for-update'])).resolves.toBe(0);

    expect(fakes.chromeCalls()).toEqual([]);
    expect(existsSync(stateFile())).toBe(false);
  });

  it('sends POST /api/ops/shutdown to 127.0.0.1:4311 of config.json when a server runs without a supervisor', async () => {
    // The test server listens on a free port; the launcher's connection to 4311 goes there.
    server = await startTestServer(0);
    const config = '{ "port": 4311 }';
    writeConfig(config);

    await expect(runLauncher(['stop'], { PORT_REDIRECT: `4311:${server.port}` })).resolves.toBe(0);

    expect(server.requests).toEqual(['POST http://127.0.0.1:4311/api/ops/shutdown']);
    expect(server.origins).toEqual([undefined]);
    const request = lp03Request();
    expect(launcherState()).toEqual([
      { request, phase: 'stopped', url: null, refNo: null, dataDir },
    ]);
    // Read only: no warning and no write of config.json (Nachtrag MAR-296).
    expect(readFileSync(join(dataDir, 'config.json'), 'utf8')).toBe(config);
    expect(operationsLog(logDir)).toEqual([]);
  });
});

/** All entries of the operations log in `logDir`, oldest first. */
function operationsLog(logDir: string): Record<string, unknown>[] {
  return existsSync(logDir)
    ? readdirSync(logDir)
        .filter((name) => name.startsWith('operations-'))
        .flatMap((name) => readFileSync(join(logDir, name), 'utf8').split('\n'))
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>)
    : [];
}

/** A port on 127.0.0.1 that was free a moment ago. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
