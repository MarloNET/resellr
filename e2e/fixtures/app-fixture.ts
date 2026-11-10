import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test as base, expect } from '@playwright/test';
import { CONFIG_FILE_NAME } from '@resellr/runtime-shared/configured-port';
import type { RuntimePaths } from '@resellr/runtime-shared/paths';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SERVER_MAIN = join(REPO_ROOT, 'apps/server/src/main.ts');
const WEB_INDEX = join(REPO_ROOT, 'apps/web/dist/index.html');
const READY_TIMEOUT_MS = 30_000;

/** Length of the data folder path in every E2E run (Technical Specification 6.3, UI-044). */
export const DATA_DIR_PATH_LENGTH = 100;

/** The server of one test worker. */
export interface AppServer {
  port: number;
  /** `http://127.0.0.1:<port>` */
  baseUrl: string;
  paths: RuntimePaths;
  /** Every outbound connection the server has reported since its start (REQ-079). */
  outboundConnections(): OutboundConnection[];
}

/** One outbound connection of a process, reported by the probe below. */
export interface OutboundConnection {
  channel: 'net.client.socket' | 'undici:request:create';
  /** Host name, IP address or pipe path the process connects to. */
  target: string;
}

/** The only destination the server may connect to (REQ-079). */
const LOCAL_TARGET = '127.0.0.1';

/**
 * Test mode of the server in the E2E suite (REQ-079, Technical Specification 6.2): a module the
 * process loads with `--import` before its own code. It subscribes to `node:diagnostics_channel`
 * and appends every outbound connection as one JSON line to `logFile`: for `net.client.socket`
 * (also used by `http`, `https`, `tls` and `fetch`) the host name of a DNS lookup and the
 * address or pipe path of every connection attempt, for `undici:request:create` the host of the
 * request. Returns the `data:` URL of the module.
 */
export function outboundConnectionProbe(logFile: string): string {
  const source = `
    import { subscribe } from 'node:diagnostics_channel';
    import { appendFileSync } from 'node:fs';
    const report = (channel, target) =>
      appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({ channel, target: String(target) }) + '\\n');
    subscribe('net.client.socket', ({ socket }) => {
      socket.on('lookup', (_error, _address, _family, host) => report('net.client.socket', host));
      socket.on('connectionAttempt', (address) => report('net.client.socket', address));
    });
    subscribe('undici:request:create', ({ request }) => {
      let target = request.origin;
      try { target = new URL(String(request.origin)).hostname; } catch {}
      report('undici:request:create', target);
    });
  `;
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

/** The connections to another destination than `127.0.0.1`. */
export function foreignConnections(connections: OutboundConnection[]): OutboundConnection[] {
  return connections.filter(({ target }) => target !== LOCAL_TARGET);
}

/** Reads the log of `outboundConnectionProbe`; no file means no connection. */
export function readOutboundConnections(logFile: string): OutboundConnection[] {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as OutboundConnection);
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (address === null || typeof address === 'string') throw new Error('No free port');
  return address.port;
}

async function waitUntilReady(server: AppServer, process: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`The server ended during the start with exit code ${process.exitCode}`);
    }
    try {
      const response = await fetch(`${server.baseUrl}/api/ops/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok && ((await response.json()) as { state: string }).state === 'ready') return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The server did not report ready within ${READY_TIMEOUT_MS} ms`);
}

/**
 * Data folder below `root` whose path has exactly `DATA_DIR_PATH_LENGTH` characters, so the
 * backup notice UI-044 shows a 100-character path in every row of the matrix (6.3).
 */
function longDataDir(root: string): string {
  const prefix = join(root, 'Daten-');
  const padding = DATA_DIR_PATH_LENGTH - prefix.length;
  if (padding < 1) {
    throw new Error(
      `The temporary folder ${root} is too long for a ${DATA_DIR_PATH_LENGTH}-character data folder path`,
    );
  }
  return prefix + 'x'.repeat(padding);
}

/**
 * Starts `resellr-server` for one test worker (CU-062): own temporary data, log, handover and
 * update-copy folder, `config.json` with a free port, migrated empty database. The data folder
 * path has 100 characters. The user interface comes from `apps/web/dist` (`npm run build`).
 */
async function startServer(): Promise<{
  server: AppServer;
  /** Ends the server and returns all its outbound connections up to its end. */
  stop(): Promise<OutboundConnection[]>;
}> {
  if (!existsSync(WEB_INDEX)) {
    throw new Error('apps/web/dist is missing: run `npm run build` before the E2E suite');
  }
  const root = mkdtempSync(join(tmpdir(), 'resellr-e2e-'));
  const paths: RuntimePaths = {
    dataDir: longDataDir(root),
    logDir: join(root, 'Protokolle'),
    handoverDir: join(root, 'Fotoübergabe'),
    updateCopyDir: join(root, 'Update-Kopien'),
  };
  const port = await freePort();
  const connectionLog = join(root, 'outbound-connections.jsonl');
  mkdirSync(paths.dataDir);
  writeFileSync(join(paths.dataDir, CONFIG_FILE_NAME), JSON.stringify({ port }));

  const probe = `--import=${outboundConnectionProbe(connectionLog)}`;
  const child = spawn(process.execPath, [probe, SERVER_MAIN], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      RESELLR_DATA_DIR: paths.dataDir,
      RESELLR_LOG_DIR: paths.logDir,
      RESELLR_HANDOVER_DIR: paths.handoverDir,
      RESELLR_UPDATE_COPY_DIR: paths.updateCopyDir,
    },
  });
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  const server: AppServer = {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    paths,
    outboundConnections: () => readOutboundConnections(connectionLog),
  };
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await exited;
    const connections = server.outboundConnections();
    rmSync(root, { recursive: true, force: true });
    return connections;
  };

  try {
    await waitUntilReady(server, child);
  } catch (error) {
    await stop();
    throw error;
  }
  return { server, stop };
}

/** A browser request may only go to the own server or to a local file (REQ-079). */
export function isLocalRequest(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  return protocol === 'file:' || (protocol === 'http:' && hostname === '127.0.0.1');
}

/** Directives of `Content-Security-Policy` every response must carry (REQ-079, 2.0.2). */
export const REQUIRED_CSP_DIRECTIVES = [
  "connect-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
];

/** The required directives a `Content-Security-Policy` value lacks. */
export function missingCspDirectives(policy: string | null): string[] {
  const directives = (policy ?? '').split(';').map((directive) => directive.trim());
  return REQUIRED_CSP_DIRECTIVES.filter((required) => !directives.includes(required));
}

export const test = base.extend<
  { browserRequests: string[]; serverResponseHeaders: void; serverConnections: void },
  { server: AppServer }
>({
  server: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
    async ({}, use) => {
      const { server, stop } = await startServer();
      await use(server);
      // Also during the shutdown the server connects nowhere else (REQ-079).
      const connections = await stop();
      expect(foreignConnections(connections), 'outbound connections of the server').toEqual([]);
    },
    { scope: 'worker' },
  ],

  baseURL: async ({ server }, use) => {
    await use(server.baseUrl);
  },

  /**
   * Every request of the browser in this test (REQ-079, Technical Specification 6.2). After
   * the test, all of them must have gone to `127.0.0.1` or to `file://`.
   */
  browserRequests: [
    async ({ context }, use) => {
      const urls: string[] = [];
      context.on('request', (request) => urls.push(request.url()));
      await use(urls);
      expect(urls.filter((url) => !isLocalRequest(url))).toEqual([]);
    },
    { auto: true },
  ],

  /**
   * Every response of the own server the browser receives in this test carries
   * `Content-Security-Policy` with the directives of REQ-079 (Technical Specification 2.0.2).
   */
  serverResponseHeaders: [
    async ({ context, server }, use) => {
      const checks: Promise<string | null>[] = [];
      context.on('response', (response) => {
        if (!response.url().startsWith(`${server.baseUrl}/`)) return;
        checks.push(
          response.headerValue('content-security-policy').then((policy) => {
            const missing = missingCspDirectives(policy);
            return missing.length === 0 ? null : `${response.url()} lacks ${missing.join(', ')}`;
          }),
        );
      });
      await use();
      expect((await Promise.all(checks)).filter((problem) => problem !== null)).toEqual([]);
    },
    { auto: true },
  ],

  /**
   * The server has reported no outbound connection to another destination than `127.0.0.1`
   * up to the end of this test (REQ-079, Technical Specification 6.2).
   */
  serverConnections: [
    async ({ server }, use) => {
      await use();
      expect(
        foreignConnections(server.outboundConnections()),
        'outbound connections of the server',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
