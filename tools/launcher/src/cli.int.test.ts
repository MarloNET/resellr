import { execFile } from 'node:child_process';
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
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createFakePrograms,
  FAKE_REF_NO,
  FAKE_SERVER,
  type FakePrograms,
  waitFor,
} from '../test/fake-programs.ts';
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
  let fakes: FakePrograms;
  let server: TestServer | undefined;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'resellr-launcher-'));
    dataDir = join(root, 'Daten');
    logDir = join(root, 'Protokolle');
    mkdirSync(dataDir);
    fakes = createFakePrograms();
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    fakes.remove();
    rmSync(root, { recursive: true, force: true });
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
    };
    return new Promise((resolve) => {
      const child = execFile(process.execPath, ['--import', PORT_REDIRECT, CLI, 'open'], {
        env,
        windowsHide: true,
      });
      child.on('exit', (code) => resolve(code ?? -1));
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

  const startFailedPage = (refNo: string) =>
    `${pathToFileURL(join(dirname(process.execPath), 'launcher-pages', 'lp-02.html')).href}?ref=${refNo}`;

  it('does not create config.json when it is missing', async () => {
    await expect(runOpen(abortingServer())).resolves.toBe(0);

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
});
