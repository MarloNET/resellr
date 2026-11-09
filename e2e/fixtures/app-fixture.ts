import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

/** The server of one test worker. */
export interface AppServer {
  port: number;
  /** `http://127.0.0.1:<port>` */
  baseUrl: string;
  paths: RuntimePaths;
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
 * Starts `resellr-server` for one test worker (CU-062): own temporary data, log, handover and
 * update-copy folder, `config.json` with a free port, migrated empty database. The user
 * interface comes from `apps/web/dist` (`npm run build`).
 */
async function startServer(): Promise<{ server: AppServer; stop(): Promise<void> }> {
  if (!existsSync(WEB_INDEX)) {
    throw new Error('apps/web/dist is missing: run `npm run build` before the E2E suite');
  }
  const root = mkdtempSync(join(tmpdir(), 'resellr-e2e-'));
  const paths: RuntimePaths = {
    dataDir: join(root, 'Daten'),
    logDir: join(root, 'Protokolle'),
    handoverDir: join(root, 'Fotoübergabe'),
    updateCopyDir: join(root, 'Update-Kopien'),
  };
  const port = await freePort();
  mkdirSync(paths.dataDir);
  writeFileSync(join(paths.dataDir, CONFIG_FILE_NAME), JSON.stringify({ port }));

  const child = spawn(process.execPath, [SERVER_MAIN], {
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
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await exited;
    rmSync(root, { recursive: true, force: true });
  };

  const server: AppServer = { port, baseUrl: `http://127.0.0.1:${port}`, paths };
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

export const test = base.extend<{ browserRequests: string[] }, { server: AppServer }>({
  server: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
    async ({}, use) => {
      const { server, stop } = await startServer();
      await use(server);
      await stop();
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
});

export { expect };
