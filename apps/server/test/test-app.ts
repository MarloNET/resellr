import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { vi } from 'vitest';

import { type AppDeps, buildApp } from '../src/app.ts';
import { type Database, openDatabase } from '../src/db/database.ts';
import type { DB } from '../src/db/schema.ts';
import { createErrorLog, createLifecycleState, createOperationsLog } from '../src/ops/index.ts';
import { createClock } from '../src/shared/clock.ts';

export const TEST_PORT = 4310;
export const HOST = `127.0.0.1:${TEST_PORT}`;
export const ORIGIN = `http://${HOST}`;

/** Headers Chrome sends with a write request from the own user interface (2.0.2). */
export const SAME_ORIGIN_WRITE = {
  host: HOST,
  origin: ORIGIN,
  'sec-fetch-site': 'same-origin',
  'content-type': 'application/json',
} as const;

export const TEST_APP_VERSION = '0.1.0-test';

export const INDEX_HTML = '<!doctype html><title>resellr</title>';
export const ASSET_JS = 'console.log("resellr");';

/**
 * Builds the app with a temporary log folder and a test web folder holding an `index.html`
 * (the real user interface follows with #113). Routes for a test are added before `ready()`.
 */
export function createTestApp() {
  const root = mkdtempSync(join(tmpdir(), 'resellr-server-'));
  const logDir = join(root, 'Protokolle');
  const webRoot = join(root, 'web');
  mkdirSync(join(webRoot, 'assets'), { recursive: true });
  writeFileSync(join(webRoot, 'index.html'), INDEX_HTML);
  writeFileSync(join(webRoot, 'assets', 'app.js'), ASSET_JS);
  writeFileSync(join(webRoot, 'assets', '.hidden'), 'not served');

  const dataDir = join(root, 'Daten');
  mkdirSync(dataDir);
  // An empty database: the HTTP core needs none of its tables.
  const database = openDatabase<DB>(join(dataDir, 'resellr.db'));

  const errorLog = createErrorLog({ dir: logDir, appVersion: TEST_APP_VERSION, startId: null });
  const operationsLog = createOperationsLog({
    dir: logDir,
    appVersion: TEST_APP_VERSION,
    startId: null,
  });
  const lifecycle = createLifecycleState('ready');
  // A test never ends the test process; it checks the calls instead.
  const exit = vi.fn<(code: number) => void>();
  const { app, writeGate } = buildApp({
    port: TEST_PORT,
    webRoot,
    errorLog,
    lifecycle,
    database,
    ops: { startId: null, dataDirPath: dataDir, appVersion: TEST_APP_VERSION },
    operationsLog,
    now: () => new Date(),
    clock: createClock(),
    exit,
  });

  /** All entries of the error log, oldest first. */
  const readErrorLog = (): Record<string, unknown>[] => {
    let names: string[];
    try {
      names = readdirSync(logDir)
        .filter((name) => name.startsWith('errors-'))
        .sort();
    } catch {
      return [];
    }
    return names.flatMap((name) =>
      readFileSync(join(logDir, name), 'utf8')
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    );
  };

  const close = async () => {
    await app.close();
    await database.close();
    rmSync(root, { recursive: true, force: true });
  };

  return { app, lifecycle, writeGate, database, exit, dataDir, webRoot, readErrorLog, close };
}

/** `buildApp` of CU-019 in the form the startup sequence (CU-040) takes, as `main.ts` passes it. */
export function appFactory(deps: Omit<AppDeps, 'port' | 'database'>) {
  return ({ port, database }: { port: number; database: Database<DB> }) =>
    buildApp({ ...deps, port, database }).app;
}
