import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ExitCode } from '@resellr/runtime-shared/exit-codes';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SERVER_MAIN = fileURLToPath(new URL('../main.ts', import.meta.url));
const START_TIMEOUT_MS = 60_000;

async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  await new Promise((resolve) => server.close(resolve));
  return port;
}

let root: string;
let child: ChildProcess | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'resellr-supervisor-ipc-'));
});

afterEach(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
  child = undefined;
  rmSync(root, { recursive: true, force: true });
});

/** Starts the real server as the supervisor does: hidden, with an IPC channel (2.18). */
async function startServer(): Promise<{ server: ChildProcess; port: number }> {
  const port = await freePort();
  const dataDir = join(root, 'Daten');
  mkdirSync(dataDir);
  writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ port }));
  const server = spawn(process.execPath, [SERVER_MAIN], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    windowsHide: true,
    env: {
      ...process.env,
      RESELLR_START_ID: 'start-1',
      RESELLR_DATA_DIR: dataDir,
      RESELLR_LOG_DIR: join(root, 'Protokolle'),
      RESELLR_HANDOVER_DIR: join(root, 'Fotoübergabe'),
      RESELLR_UPDATE_COPY_DIR: join(root, 'Update-Kopien'),
    },
  });
  child = server;
  return { server, port };
}

describe('server under a supervisor (CU-018, CU-040, CU-249)', () => {
  it(
    'reports IPC ready with its startId once it answers, and ends with exit code 12 when the channel closes',
    async () => {
      const { server, port } = await startServer();

      const [message] = (await once(server, 'message')) as [unknown];
      expect(message).toEqual({ type: 'ready', startId: 'start-1' });
      const health = await fetch(`http://127.0.0.1:${port}/api/ops/health`);
      expect(await health.json()).toEqual({ state: 'ready', startId: 'start-1' });

      const exited = once(server, 'exit');
      server.disconnect();

      expect(await exited).toEqual([ExitCode.SupervisorLost, null]);
      await expect(fetch(`http://127.0.0.1:${port}/api/ops/health`)).rejects.toThrow();
      // Checkpoint and close: the WAL file is moved into the database and removed.
      expect(existsSync(join(root, 'Daten', 'resellr.db'))).toBe(true);
      expect(existsSync(join(root, 'Daten', 'resellr.db-wal'))).toBe(false);
    },
    START_TIMEOUT_MS,
  );
});
