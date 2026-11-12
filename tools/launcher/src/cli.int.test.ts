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
import { fileURLToPath } from 'node:url';

import {
  LAUNCHER_STATE_FILE_NAME,
  readLauncherState,
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
import { TEST_SERVER_ENTRY_ENV } from './supervisor/server-process.ts';

const CLI = fileURLToPath(new URL('./cli.ts', import.meta.url));
/** Preload that sends the launcher's connections to 4310 to the test server (#329). */
const PORT_REDIRECT = fileURLToPath(new URL('../test/port-redirect.ts', import.meta.url));

/** A running test server that answers `GET /api/ops/health` and records each request. */
interface TestServer {
  port: number;
  requests: string[];
  close(): Promise<void>;
}

async function startTestServer(
  port: number,
  state: 'starting' | 'ready' | 'stopping' = 'ready',
): Promise<TestServer> {
  const requests: string[] = [];
  const server: Server = createServer((request, response) => {
    requests.push(`${request.method} http://${request.headers.host}${request.url}`);
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

  /** All entries of the operations log, oldest first. */
  const operationsLog = (): Record<string, unknown>[] =>
    existsSync(logDir)
      ? readdirSync(logDir)
          .filter((name) => name.startsWith('operations-'))
          .flatMap((name) => readFileSync(join(logDir, name), 'utf8').split('\n'))
          .filter((line) => line !== '')
          .map((line) => JSON.parse(line) as Record<string, unknown>)
      : [];

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

    it('opens no LP-01 and writes no launcher-state.js when the own start is aborted at once', async () => {
      writeConfig(JSON.stringify({ port: await freePort() }));
      fakes.registerChrome('HKCU', fakes.chromePath);

      await expect(runOpen(abortingServer())).resolves.toBe(0);

      expect(fakes.chromeCalls()).toEqual([startFailedPage(FAKE_REF_NO)]);
      expect(existsSync(join(launcherPagesDir(programDir), LAUNCHER_STATE_FILE_NAME))).toBe(false);
    });
  });
});

/** A port on 127.0.0.1 that was free a moment ago. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
