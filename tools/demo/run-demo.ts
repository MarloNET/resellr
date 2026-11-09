import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG_FILE_NAME, DEFAULT_PORT } from '@resellr/runtime-shared/configured-port';
import type { RuntimePaths } from '@resellr/runtime-shared/paths';
import { createDemoApi, seedDemoData } from '@resellr/test-data/demo-seed';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SERVER_MAIN = join(REPO_ROOT, 'apps/server/src/main.ts');
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 100;
const REQUEST_TIMEOUT_MS = 1_000;

export interface RunningDemo {
  /** `http://127.0.0.1:<port>` */
  baseUrl: string;
  /** Temporary folder holding the data, log, handover and update-copy folders. */
  root: string;
  paths: RuntimePaths;
  /** Stops the server and removes the temporary folder. */
  stop(): Promise<void>;
}

/** Port from `PORT`; unset or empty gives 4310 (Baseline 11.3). */
export function demoPort(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a port number from 1 to 65535, got "${value}"`);
  }
  return port;
}

/** Builds the application (`npm run build`), above all the user interface `apps/web/dist`. */
export function buildApp(): void {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', 'build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`npm run build failed (exit code ${result.status})`);
}

/**
 * Starts the server with a fresh temporary data folder (CU-004, Baseline 11.3, Nachtrag
 * MAR-305): `config.json` with the port, the server migrates the empty database and listens on
 * `127.0.0.1:<port>`; once it reports `ready`, the demo data (CU-061) goes in through its API.
 * Every run is independent. If the start or the demo data fail, the server is stopped and the
 * error names the temporary folder, which stays for its logs.
 */
export async function startDemo({ port }: { port: number }): Promise<RunningDemo> {
  const root = mkdtempSync(join(tmpdir(), 'resellr-demo-'));
  const paths: RuntimePaths = {
    dataDir: join(root, 'Daten'),
    logDir: join(root, 'Protokolle'),
    handoverDir: join(root, 'Fotoübergabe'),
    updateCopyDir: join(root, 'Update-Kopien'),
  };
  mkdirSync(paths.dataDir);
  writeFileSync(join(paths.dataDir, CONFIG_FILE_NAME), `${JSON.stringify({ port }, null, 2)}\n`);

  const server = spawn(process.execPath, [SERVER_MAIN], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      RESELLR_DATA_DIR: paths.dataDir,
      RESELLR_LOG_DIR: paths.logDir,
      RESELLR_HANDOVER_DIR: paths.handoverDir,
      RESELLR_UPDATE_COPY_DIR: paths.updateCopyDir,
    },
  });
  const exited = new Promise<number | null>((resolve) => server.once('exit', resolve));

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitUntilReady(baseUrl, paths.dataDir, exited);
    await seedDemoData(createDemoApi(baseUrl));
  } catch (error) {
    await stopServer(server, exited);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}; temporary folder with the logs: ${root}`, { cause: error });
  }

  return {
    baseUrl,
    root,
    paths,
    stop: async () => {
      await stopServer(server, exited);
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/**
 * Waits for `ready` of the own server: another program on the port could answer too, so the
 * data folder from `GET /api/ops/status` must be the one of this run.
 */
async function waitUntilReady(
  baseUrl: string,
  dataDir: string,
  exited: Promise<number | null>,
): Promise<void> {
  let exitCode: number | null | undefined;
  void exited.then((code) => (exitCode = code));
  const getJson = async (path: string) => {
    const response = await fetch(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response.ok ? ((await response.json()) as Record<string, unknown>) : {};
  };

  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const { state } = await getJson('/api/ops/health');
      if (state === 'ready' && exitCode === undefined) {
        const { dataDirPath } = await getJson('/api/ops/status');
        if (dataDirPath === dataDir) return;
      }
    } catch {
      // Not listening yet, or something else on the port that does not answer.
    }
    if (exitCode !== undefined) {
      // Exit code 10: start aborted, e.g. the port is taken (2.19 step 8).
      throw new Error(`The server ended during the start with exit code ${exitCode}`);
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }
  throw new Error(`The server did not report ready within ${READY_TIMEOUT_MS} ms`);
}

async function stopServer(server: ChildProcess, exited: Promise<number | null>): Promise<void> {
  if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
  await exited;
}

/**
 * `npm run demo`: build, start, and only then print the address; Ctrl+C stops the server and
 * removes the temporary folder.
 */
async function main(): Promise<void> {
  const port = demoPort(process.env.PORT);
  buildApp();
  const demo = await startDemo({ port });
  console.log(`resellr demo: ${demo.baseUrl}/ (data folder ${demo.paths.dataDir})`);
  console.log('Stop with Ctrl+C; the temporary folder is removed.');

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => void demo.stop().then(() => process.exit(0)));
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
