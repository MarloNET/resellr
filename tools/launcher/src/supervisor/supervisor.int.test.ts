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
import { readRuntimeState } from '@resellr/runtime-shared/runtime-state-files';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFakePrograms, FAKE_SERVER, type FakePrograms } from '../../test/fake-programs.ts';
import { CRASH_GRACE_MS } from './restart-policy.ts';
import { TEST_SERVER_ENTRY_ENV } from './server-process.ts';

const CLI = fileURLToPath(new URL('../cli.ts', import.meta.url));
/** Generous: a real server under Node.js with type stripping can take several seconds to start. */
const REAL_START_MS = 90_000;
const POLL = { timeout: 60_000, interval: 100 };
/** Tests with the fake server also wait up to `POLL.timeout`; 5 s is too short on a slow host. */
const FAKE_START_MS = POLL.timeout + 10_000;

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
    'DER-102-02 without a server open takes over the pipe, starts the server without a window, opens Chrome on ready and runs on as supervisor; port 4311 from config.json',
    async () => {
      writePort(4311);
      const open = launch('open');

      await expect.poll(() => fakes.chromeCalls(), POLL).toEqual(['http://127.0.0.1:4311/']);
      const health = await healthOf(4311);
      // The server got the startId of this attempt from the supervisor (RESELLR_START_ID).
      expect(health).toEqual({ state: 'ready', startId: expect.any(String) });
      expect(serverStarts()).toHaveLength(1);
      expect(serverStarts()[0]).toContain(`"startId":"${health!.startId}"`);
      expect(running(open)).toBe(true);

      // End of the supervisor ends the server (IPC end, exit code 12).
      open.process.kill('SIGKILL');
      await expect.poll(() => healthOf(4311), POLL).toBeNull();
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

  it(
    'opens LP-02 with an own reference number of the supervisor when the aborted start left no start result',
    async () => {
      writePort(await freePort());

      const open = launch('open', fakeServer('exit-10'));

      expect(await open.exitCode).toBe(0);
      await expect
        .poll(() => fakes.chromeCalls(), POLL)
        .toEqual([expect.stringMatching(startFailedPage)]);
      expect(fakes.chromeCalls()[0]).not.toContain('R-ABCD-EFGH');
    },
    FAKE_START_MS,
  );

  it(
    'opens LP-02 with the reference number of the start result when the start is aborted',
    async () => {
      writePort(await freePort());

      const open = launch('open', fakeServer('aborted'));

      expect(await open.exitCode).toBe(0);
      await expect
        .poll(() => fakes.chromeCalls(), POLL)
        .toEqual([expect.stringMatching(startFailedPage)]);
      expect(fakes.chromeCalls()[0]).toMatch(/\?ref=R-ABCD-EFGH$/);
    },
    FAKE_START_MS,
  );

  const logEntries = (kind: 'operations' | 'errors' | 'availability') =>
    readDailyFiles({ dir: logDir, kind }).flatMap((file) => file.entries);
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
    'restarts at most 3 times in 10 minutes; the fourth crash leads to no further restart',
    async () => {
      writePort(await freePort());
      const supervise = launch(
        'supervise',
        fakeServer('exit-1', 'exit-1', 'exit-1', 'exit-1', 'ready'),
      );

      expect(await supervise.exitCode).toBe(0);

      expect(fakeStarts()).toHaveLength(4);
      // Every crash after the wait is logged; `gave_up` with its reference number follows in #121.
      expect(crashEntries()).toHaveLength(4);
    },
    4 * CRASH_GRACE_MS + FAKE_START_MS,
  );
});
