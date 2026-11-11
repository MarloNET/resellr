import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isReferenceNumber } from '@resellr/runtime-shared/reference-number';
import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appFactory } from '../../test/test-app.ts';

import type { Database } from '../db/database.ts';
import { migrations } from '../db/migrations/index.ts';
import type { DB } from '../db/schema.ts';
import type { Migration } from '../db/migrator.ts';
import { createClock } from '../shared/clock.ts';
import { createErrorLog } from './error-log.ts';
import { createLifecycleState, type LifecycleStateName } from './lifecycle-state.ts';
import { createOperationsLog } from './operations-log.ts';
import { runStartup, type StartupOptions, type StartupResult } from './startup.ts';

let root: string;
let paths: StartupOptions['paths'];
let result: StartupResult | undefined;
let blocker: Server | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'resellr-startup-'));
  paths = {
    dataDir: join(root, 'Daten'),
    logDir: join(root, 'Protokolle'),
    handoverDir: join(root, 'Fotoübergabe'),
    updateCopyDir: join(root, 'Update-Kopien'),
  };
  mkdirSync(paths.dataDir);
});

afterEach(async () => {
  if (result?.state === 'ready') await result.close();
  result = undefined;
  await new Promise((resolve) => (blocker ? blocker.close(resolve) : resolve(undefined)));
  blocker = undefined;
  rmSync(root, { recursive: true, force: true });
});

function start(overrides: Partial<StartupOptions> = {}) {
  const clock = createClock();
  const errorLog = createErrorLog({ dir: paths.logDir, appVersion: '0.1.0', startId: 's-1' });
  const lifecycle = createLifecycleState();
  const options: StartupOptions = {
    paths,
    programDir: join(root, 'Programs', 'resellr'),
    homeDir: join(root, 'home'),
    appVersion: '0.1.0',
    startId: 's-1',
    clock,
    errorLog,
    lifecycle,
    host: '127.0.0.1',
    buildApp: appFactory({
      webRoot: join(root, 'web'),
      errorLog,
      lifecycle,
      ops: { startId: 's-1', dataDirPath: paths.dataDir, appVersion: '0.1.0' },
      operationsLog: createOperationsLog({
        dir: paths.logDir,
        appVersion: '0.1.0',
        startId: 's-1',
      }),
      now: clock.now,
      exit: () => {},
    }),
    ...overrides,
  };
  return { lifecycle, options, run: () => runStartup(options) };
}

/** A port on 127.0.0.1 that is free right now. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const writeConfig = (values: object) =>
  writeFileSync(join(paths.dataDir, 'config.json'), JSON.stringify(values));

const readLog = (kind: 'operations' | 'errors') =>
  readdirSync(paths.logDir)
    .filter((name) => name.startsWith(`${kind}-`))
    .flatMap((name) => readFileSync(join(paths.logDir, name), 'utf8').split('\n'))
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const appliedMigrations = () => {
  const sqlite = new BetterSqlite3(join(paths.dataDir, 'resellr.db'), { readonly: true });
  try {
    return sqlite.prepare('SELECT name FROM app_migration ORDER BY name').pluck().all();
  } finally {
    sqlite.close();
  }
};

describe('startup sequence (CU-040)', () => {
  it('E3 first start in an empty data folder creates config.json with port 4310 and migrates to 0001', async () => {
    result = await start().run();

    expect(JSON.parse(readFileSync(join(paths.dataDir, 'config.json'), 'utf8'))).toEqual({
      port: 4310,
    });
    // The static list CU-308 is what the startup sequence passes to the migration run.
    expect(appliedMigrations()).toEqual(['20261110_0001_initial_schema']);
  });

  it('E5 health reports starting during the migration and ready after the startup sequence', async () => {
    const port = await freePort();
    writeConfig({ port });
    const states: LifecycleStateName[] = [];
    const { lifecycle, run } = start({
      migrations: [
        ...migrations,
        { name: '29991231_9999_probe', up: async () => void states.push(lifecycle.get()) },
      ] satisfies Migration[],
    });

    result = await run();

    expect(states).toEqual(['starting']);
    expect(result.state).toBe('ready');
    const response = await fetch(`http://127.0.0.1:${port}/api/ops/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: 'ready', startId: 's-1' });
  });

  it('E4 a rejected handoverDir gives the standard path and a warning in the operations log', async () => {
    writeConfig({ port: await freePort(), handoverDir: paths.dataDir });

    result = await start().run();

    expect(result.state === 'ready' && result.handoverDir).toBe(paths.handoverDir);
    expect(readLog('operations')).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        event: 'handover_dir_rejected',
        reason: 'overlaps_app_folder',
      }),
    );
  });

  it('E6 writes server_started and server_ready as JSON lines into operations-<date>.jsonl', async () => {
    writeConfig({ port: await freePort() });

    result = await start().run();

    expect(readdirSync(paths.logDir).filter((name) => name.startsWith('operations-'))).toEqual([
      expect.stringMatching(/^operations-\d{4}-\d{2}-\d{2}\.jsonl$/),
    ]);
    expect(readLog('operations').map((entry) => entry.event)).toEqual([
      'server_started',
      'server_ready',
    ]);
  });

  it('reports IPC ready to the supervisor once the server listens, before server_ready (2.19 step 9)', async () => {
    const port = await freePort();
    writeConfig({ port });
    const seen: { state: LifecycleStateName; events: unknown[] }[] = [];
    const { lifecycle, run } = start({
      supervisorIpc: {
        reportReady: () => {
          seen.push({
            state: lifecycle.get(),
            events: readLog('operations').map((entry) => entry.event),
          });
        },
      },
    });

    result = await run();

    expect(seen).toEqual([{ state: 'ready', events: ['server_started'] }]);
    expect((await fetch(`http://127.0.0.1:${port}/api/ops/health`)).status).toBe(200);
  });

  it('reports no IPC ready when the start is aborted', async () => {
    blocker = createServer();
    await new Promise<void>((resolve) => blocker?.listen(0, '127.0.0.1', resolve));
    writeConfig({ port: (blocker.address() as AddressInfo).port });
    const reportReady = vi.fn();

    result = await start({ supervisorIpc: { reportReady } }).run();

    expect(result.state).toBe('aborted');
    expect(reportReady).not.toHaveBeenCalled();
  });

  it('E7 aborts on a port in use with a reference number in the error log', async () => {
    blocker = createServer();
    await new Promise<void>((resolve) => blocker?.listen(0, '127.0.0.1', resolve));
    writeConfig({ port: (blocker.address() as AddressInfo).port });
    const { lifecycle, run } = start();

    result = await run();

    expect(result.state).toBe('aborted');
    const refNo = result.state === 'aborted' ? result.refNo : null;
    expect(isReferenceNumber(refNo)).toBe(true);
    expect(readLog('errors')).toEqual([
      expect.objectContaining({
        level: 'error',
        refNo,
        function: 'ops.startup.listen',
        message: expect.stringContaining('EADDRINUSE'),
      }),
    ]);
    expect(lifecycle.get()).toBe('starting');
    expect(readLog('operations').map((entry) => entry.event)).not.toContain('server_ready');
  });

  it('close() closes the database even when closing the app fails', async () => {
    writeConfig({ port: await freePort() });
    let database: Database<DB> | undefined;
    const { options } = start();

    const started = await runStartup({
      ...options,
      buildApp: (deps) => {
        database = deps.database;
        const app = options.buildApp(deps);
        app.addHook('onClose', async () => {
          throw new Error('close failed');
        });
        return app;
      },
    });

    expect(started.state).toBe('ready');
    await expect(started.state === 'ready' && started.close()).rejects.toThrow('close failed');
    expect(database?.sqlite.open).toBe(false);
  });

  it('closes the database and rethrows when a migration fails', async () => {
    const failing: Migration = {
      name: '29991231_9999_fail',
      up: async () => {
        throw new Error('broken migration');
      },
    };

    await expect(start({ migrations: [...migrations, failing] }).run()).rejects.toThrow(
      'Migration 29991231_9999_fail failed',
    );
    // A closed connection leaves no WAL lock behind: the file opens for writing again.
    const sqlite = new BetterSqlite3(join(paths.dataDir, 'resellr.db'));
    expect(() => sqlite.exec('BEGIN EXCLUSIVE; COMMIT')).not.toThrow();
    sqlite.close();
  });
});
