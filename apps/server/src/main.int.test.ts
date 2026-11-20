import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import {
  closeSync,
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { connect, createServer, type AddressInfo, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_STOCK_COLUMNS } from '../test/stock.ts';

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

  it('AC-REQ-105-04 after the shutdown a copy of the data folder holds the shop price 279,00 € of MI-A in a second, empty installation', async () => {
    const port = await freePort();

    // First installation: running, MI-A with its shop price written while it runs.
    const first = installation(join(root, 'first'), port);
    const server = startServer(first, 'start-first');
    await waitUntilReady(port);
    writeMiAShopPrice(join(first.dataDir, 'resellr.db'));
    // The price is in the WAL so far, not yet in resellr.db.
    expect(statSync(join(first.dataDir, 'resellr.db-wal')).size).toBeGreaterThan(0);

    // Like the launcher (G-3): without Origin and Sec-Fetch-Site.
    const response = await fetch(`http://127.0.0.1:${port}/api/ops/shutdown`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ dataDirPath: first.dataDir });
    expect(await server.exited).toBe(0);
    expect(readdirSync(first.dataDir).sort()).toEqual([
      'config.json',
      'resellr.db',
      'shutdown-marker.json',
    ]);
    expect(JSON.parse(readFileSync(join(first.dataDir, 'shutdown-marker.json'), 'utf8'))).toEqual({
      endedAt: expect.any(String),
      appVersion: '0.1.0',
      startId: 'start-first',
    });
    expect(readOperationsEvents(first.logDir)).toContain('stopped_by_user');

    // Second, empty installation of the same version with the copied data folder.
    const second = installation(join(root, 'second'), port);
    rmSync(second.dataDir, { recursive: true });
    cpSync(first.dataDir, second.dataDir, { recursive: true });
    const copy = startServer(second, 'start-second');
    try {
      await waitUntilReady(port);
      const db = new BetterSqlite3(join(second.dataDir, 'resellr.db'), { readonly: true });
      let cents: unknown;
      try {
        cents = db
          .prepare(
            `SELECT p.amount_cents FROM listing_price p
             JOIN listing l ON l.id = p.listing_id
             JOIN channel c ON c.id = p.channel_id
             WHERE l.article_number = '626198' AND c.code = 'shop'`,
          )
          .pluck()
          .get();
      } finally {
        db.close();
      }
      // Prices are stored in cents: 27900 is 279,00 €.
      expect(cents).toBe(27900);
    } finally {
      copy.process.kill('SIGTERM');
      await copy.exited;
    }
  }, 60_000);

  it('AC-REQ-104-05 after a complete copy of the data folder at ended resellr and a new start the status of the notice is unchanged, and nothing of the notice is stored', async () => {
    const port = await freePort();
    const own = installation(join(root, 'own'), port);
    const status = () =>
      fetch(`http://127.0.0.1:${port}/api/ops/status`).then(async (response) => ({
        status: response.status,
        body: (await response.json()) as unknown,
      }));

    const first = startServer(own, 'start-first');
    await waitUntilReady(port);
    const before = await status();
    expect(before).toStrictEqual({
      status: 200,
      body: { dataDirPath: own.dataDir, appVersion: '0.1.0' },
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/ops/shutdown`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(200);
    expect(await first.exited).toBe(0);

    // The user copies the data folder completely to the backup location.
    const backup = join(root, 'Sicherung', 'Daten');
    cpSync(own.dataDir, backup, { recursive: true });
    expect(readdirSync(backup).sort()).toEqual(readdirSync(own.dataDir).sort());
    // `config.json` holds only the port (2.19), the database no state of the notice (2.17).
    expect(JSON.parse(readFileSync(join(own.dataDir, 'config.json'), 'utf8'))).toStrictEqual({
      port,
    });
    const db = new BetterSqlite3(join(own.dataDir, 'resellr.db'), { readonly: true });
    try {
      const names = [
        ...(db.prepare(`SELECT name FROM sqlite_master`).pluck().all() as string[]),
        ...(db.prepare(`SELECT key FROM app_meta`).pluck().all() as string[]),
      ];
      expect(names.filter((name) => /backup|notice|hinweis|sicherung/i.test(name))).toEqual([]);
    } finally {
      db.close();
    }

    const second = startServer(own, 'start-second');
    try {
      await waitUntilReady(port);
      expect(await status()).toStrictEqual(before);
      expect(JSON.parse(readFileSync(join(own.dataDir, 'config.json'), 'utf8'))).toStrictEqual({
        port,
      });
    } finally {
      second.process.kill('SIGTERM');
      await second.exited;
    }
  }, 60_000);

  it('E1 after SIGTERM ends with exit code 0 in under 5 s while a client holds a connection without a request', async () => {
    const port = await freePort();
    const server = startServer(installation(join(root, 'own'), port), 'start-e1');
    await waitUntilReady(port);
    const socket = connect(port, '127.0.0.1');
    await new Promise<void>((resolve, reject) =>
      socket.once('connect', resolve).once('error', reject),
    );
    socket.on('error', () => {});

    try {
      const signalledAt = Date.now();
      server.process.kill('SIGTERM');
      const exitCode = await Promise.race([
        server.exited,
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 5_000)),
      ]);

      expect(exitCode).toBe(0);
      expect(Date.now() - signalledAt).toBeLessThan(5_000);
    } finally {
      socket.destroy();
      server.process.kill('SIGKILL');
      await server.exited;
    }
  }, 30_000);

  it.each(['2027-02-30T10:00:00Z', 'morgen'])(
    'E2 --test-clock=%s ends with exit code 10 and a message on stderr before the startup sequence',
    async (value) => {
      const own = installation(join(root, 'own'), await freePort());

      const server = startServer(own, 'start-e2', [`--test-clock=${value}`]);

      expect(await server.exited).toBe(10);
      expect(server.stderr()).toContain(`--test-clock=${value} is no ISO 8601 instant`);
      // Nothing in the data and log folder is touched: no resellr.db, no log, no start-result.json.
      expect(readdirSync(own.dataDir)).toEqual(['config.json']);
      expect(existsSync(own.logDir)).toBe(false);
    },
    20_000,
  );

  it('E1 (#320) a SIGTERM sent in the handler of the IPC message ready ends the server with exit code 0, not by the signal, and leaves no -wal/-shm (10 runs)', async () => {
    const own = installation(join(root, 'own'), await freePort());

    for (let run = 0; run < 10; run += 1) {
      const server = startServer(own, `start-ready-${run}`, [], { ipc: true });
      server.process.on('message', (message) => {
        if ((message as { type?: unknown }).type === 'ready') server.process.kill('SIGTERM');
      });

      expect(await server.ended).toStrictEqual({ code: 0, signal: null });
      expect(readdirSync(own.dataDir).filter((name) => /-(wal|shm)$/.test(name))).toEqual([]);
    }
  }, 120_000);

  it('E2 (#320) a SIGTERM after server_started and before ready ends the server after the start with exit code 0, integrity_check ok', async () => {
    const port = await freePort();
    const own = installation(join(root, 'own'), port);
    const configFile = pauseStartAtConfig(own);
    const server = startServer(own, 'start-during', [], { ipc: true });
    let reportedReady = false;
    server.process.on('message', (message) => {
      if ((message as { type?: unknown }).type === 'ready') reportedReady = true;
    });

    await waitForOperationsEvent(own.logDir, 'server_started');
    server.process.kill('SIGTERM');
    await resumeStart(configFile, { port }, server);

    expect(await server.ended).toStrictEqual({ code: 0, signal: null });
    // Ended after the start, not during it.
    expect(reportedReady).toBe(true);
    expect(readOperationsEvents(own.logDir)).toContain('server_ready');
    const db = new BetterSqlite3(join(own.dataDir, 'resellr.db'), { readonly: true });
    try {
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    } finally {
      db.close();
    }
  }, 30_000);

  it('E3 (#320) a SIGTERM during a start that is aborted (port in use) leaves the exit code 10', async () => {
    const { port } = blocker.address() as AddressInfo;
    const own = installation(join(root, 'own'), port);
    const configFile = pauseStartAtConfig(own);
    const server = startServer(own, 'start-aborted');

    await waitForOperationsEvent(own.logDir, 'server_started');
    server.process.kill('SIGTERM');
    await resumeStart(configFile, { port }, server);

    expect(await server.ended).toStrictEqual({ code: 10, signal: null });
  }, 30_000);
});

/**
 * Replaces `config.json` by a FIFO: the start reads it synchronously right after `server_started`
 * and so stops there until the test writes the content (`resumeStart`), without a `sleep`.
 */
function pauseStartAtConfig({ dataDir }: Installation): string {
  const configFile = join(dataDir, 'config.json');
  rmSync(configFile);
  execFileSync('mkfifo', [configFile]);
  return configFile;
}

/**
 * Writes the content once the server has opened the FIFO for reading: `server_started` is logged
 * just before that. Opening without a reader fails with `ENXIO` instead of blocking the test, and
 * is repeated only while the server runs.
 */
async function resumeStart(
  configFile: string,
  config: { port: number },
  server: { process: ChildProcess },
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    let fd: number;
    try {
      fd = openSync(configFile, constants.O_WRONLY | constants.O_NONBLOCK);
    } catch (error) {
      const running = server.process.exitCode === null && server.process.signalCode === null;
      if ((error as NodeJS.ErrnoException).code !== 'ENXIO' || !running || attempt >= 500) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      continue;
    }
    try {
      writeSync(fd, JSON.stringify(config));
    } finally {
      closeSync(fd);
    }
    return;
  }
}

async function waitForOperationsEvent(logDir: string, event: string): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (existsSync(logDir) && readOperationsEvents(logDir).includes(event)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`no ${event} in the operations log`);
}

/** A port on 127.0.0.1 that is free right now. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

interface Installation {
  dataDir: string;
  logDir: string;
  root: string;
}

/** Folders of one installation, with `config.json` for the port. */
function installation(dir: string, port: number): Installation {
  const dataDir = join(dir, 'Daten');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ port }));
  return { dataDir, logDir: join(dir, 'Protokolle'), root: dir };
}

function startServer(
  { dataDir, logDir, root: dir }: Installation,
  startId: string,
  args: readonly string[] = [],
  { ipc = false }: { ipc?: boolean } = {},
): {
  process: ChildProcess;
  exited: Promise<number | null>;
  ended: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  stderr: () => string;
} {
  // With `ipc` like the supervisor (2.18): the server reports `ready` over the channel.
  const child = spawn(process.execPath, [MAIN, ...args], {
    stdio: ipc ? ['ignore', 'ignore', 'pipe', 'ipc'] : ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      RESELLR_DATA_DIR: dataDir,
      RESELLR_LOG_DIR: logDir,
      RESELLR_HANDOVER_DIR: join(dir, 'Fotoübergabe'),
      RESELLR_UPDATE_COPY_DIR: join(dir, 'Update-Kopien'),
      RESELLR_START_ID: startId,
    },
  });
  let stderr = '';
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  const ended = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
    child.once('exit', (code, signal) => resolve({ code, signal })),
  );
  const exited = ended.then(({ code }) => code);
  return { process: child, exited, ended, stderr: () => stderr };
}

async function waitUntilReady(port: number): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/ops/health`);
      if (((await response.json()) as { state: string }).state === 'ready') return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server not ready');
}

const readOperationsEvents = (logDir: string): unknown[] =>
  readdirSync(logDir)
    .filter((name) => name.startsWith('operations-'))
    .flatMap((name) =>
      readFileSync(join(logDir, name), 'utf8')
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => (JSON.parse(line) as { event: unknown }).event),
    );

/**
 * MI-A of the requirements test data (REQ-105) with the shop price 279,00 €. There is no API
 * for listings and prices before S3, so the rows are written through a second connection.
 */
function writeMiAShopPrice(file: string): void {
  const ts = '2026-11-10T08:00:00.000Z';
  const db = new BetterSqlite3(file);
  try {
    // Device type Notebook, condition "gebraucht" and channel Shop come with the initial
    // settings (CU-071).
    db.exec(`
      INSERT INTO manufacturer (id, name, name_key, active, gpsr_complete, version, created_at, updated_at)
        VALUES (1, 'Apple', 'apple', 1, 0, 1, '${ts}', '${ts}');
      INSERT INTO model_template (id, device_type_id, manufacturer_id, model_name, model_name_key,
          type_designation, mpn_unknown, model_values, default_device_values, search_key,
          import_review_pending, import_review_keys, version, created_at, updated_at)
        SELECT 1, id, 1, 'MacBook Pro 13', 'macbook pro 13', 'A1989', 1, '{}', '{}',
          'apple macbook pro 13 a1989', 0, '[]', 1, '${ts}', '${ts}'
        FROM device_type WHERE name_key = 'notebook';
      INSERT INTO listing (id, model_template_id, condition_value_id, visual_grade,
          condition_description, condition_description_key, variant_values, other_device_values,
          article_number, article_number_key, ean_mode, display_title, quantity, stock_json,
          stock_hash, version, created_at, updated_at)
        SELECT 1, 1, v.id, 2, 'leichte Gebrauchsspuren', 'leichte gebrauchsspuren', '{}', '{}',
          '626198', '626198', 'original', 'MI-A', 0, '${EMPTY_STOCK_COLUMNS.stock_json}',
          '${EMPTY_STOCK_COLUMNS.stock_hash}', 1, '${ts}', '${ts}'
        FROM pick_list_value v JOIN pick_list l ON l.id = v.pick_list_id
        WHERE l.key = 'condition' AND v.label_key = 'gebraucht';
      INSERT INTO listing_price (listing_id, channel_id, amount_cents, vb, source)
        SELECT 1, id, 27900, 0, 'manual' FROM channel WHERE code = 'shop';
    `);
  } finally {
    db.close();
  }
}
