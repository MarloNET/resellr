import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const MAIN = fileURLToPath(new URL('./main.ts', import.meta.url));

let root: string;
let blocker: Server;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'resellr-main-'));
  blocker = createServer();
  await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
});

afterEach(async () => {
  await new Promise((resolve) => blocker.close(resolve));
  rmSync(root, { recursive: true, force: true });
});

describe('server entry (CU-018)', () => {
  it('E7 ends with exit code 10 and an error log entry when the port is in use', async () => {
    const dataDir = join(root, 'Daten');
    const logDir = join(root, 'Protokolle');
    mkdirSync(dataDir);
    const { port } = blocker.address() as AddressInfo;
    writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ port }));

    const child = spawn(process.execPath, [MAIN], {
      stdio: 'ignore',
      env: {
        ...process.env,
        RESELLR_DATA_DIR: dataDir,
        RESELLR_LOG_DIR: logDir,
        RESELLR_HANDOVER_DIR: join(root, 'Fotoübergabe'),
        RESELLR_UPDATE_COPY_DIR: join(root, 'Update-Kopien'),
        RESELLR_START_ID: 'start-e7',
      },
    });
    const exitCode = await new Promise<number | null>((resolve) => child.once('exit', resolve));

    expect(exitCode).toBe(10);
    const [errorFile] = readdirSync(logDir).filter((name) => name.startsWith('errors-'));
    const entries = readFileSync(join(logDir, errorFile ?? ''), 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries).toEqual([
      expect.objectContaining({
        refNo: expect.stringMatching(/^R-/),
        function: 'ops.startup.listen',
        startId: 'start-e7',
      }),
    ]);
  }, 20_000);
});
