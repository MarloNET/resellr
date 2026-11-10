import { join } from 'node:path';

import { createReferenceNumber } from '@resellr/runtime-shared/reference-number';
import type { RuntimePaths } from '@resellr/runtime-shared/paths';
import type { FastifyInstance } from 'fastify';

import { type Database, openDatabase } from '../db/database.ts';
import { migrations as shippedMigrations } from '../db/migrations/index.ts';
import { type Migration, runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import type { Clock } from '../shared/clock.ts';
import { loadConfig } from './config-file.ts';
import type { ErrorLog } from './error-log.ts';
import type { LifecycleState } from './lifecycle-state.ts';
import { createOperationsLog } from './operations-log.ts';

export const DATABASE_FILE_NAME = 'resellr.db';

export interface StartupOptions {
  paths: RuntimePaths;
  /** Program folder (`%LOCALAPPDATA%\Programs\resellr`), protected by the `handoverDir` check. */
  programDir: string;
  /** User profile, for the `handoverDir` check. */
  homeDir: string;
  appVersion: string;
  /** Start identifier from the supervisor (`RESELLR_START_ID`); null when started directly. */
  startId: string | null;
  clock: Clock;
  errorLog: ErrorLog;
  lifecycle: LifecycleState;
  /**
   * Builds the app on the migrated database; `main.ts` passes `buildApp` of CU-019. The app gets
   * the database itself, because the shutdown closes and on failure reopens it (2.17).
   */
  buildApp: (input: { port: number; database: Database<DB> }) => FastifyInstance;
  /** Loopback address the server listens on (`LISTEN_HOST`, ADR-002). */
  host: string;
  /** Migrations to run; the shipped list CU-308 unless a test adds its own. */
  migrations?: readonly Migration[];
}

export type StartupResult =
  | {
      state: 'ready';
      port: number;
      /** Handover folder for this start: from `config.json` if valid, otherwise the standard path. */
      handoverDir: string;
      app: FastifyInstance;
      /** Closes the app and the database. */
      close(): Promise<void>;
    }
  | {
      state: 'aborted';
      /** Reference number of the entry in the error log. */
      refNo: string;
    };

/**
 * Startup sequence (CU-040) in the order of Technical Specification 2.19, in S1 without the
 * startup check: configuration, open the database, migrations, listen on `127.0.0.1:<port>`,
 * state `ready`. Until then `GET /api/ops/health` reports `starting`.
 *
 * A failure to listen (`EADDRINUSE`, step 8) aborts the start: an entry with a reference number
 * in the error log, the database closed, result `aborted`. Any other error is thrown after the
 * database is closed; turning `MigrationError` into an abort follows in S10 (Nachtrag MAR-263).
 */
export async function runStartup({
  paths,
  programDir,
  homeDir,
  appVersion,
  startId,
  clock,
  errorLog,
  lifecycle,
  buildApp,
  host,
  migrations = shippedMigrations,
}: StartupOptions): Promise<StartupResult> {
  const operationsLog = createOperationsLog({
    dir: paths.logDir,
    appVersion,
    startId,
    now: clock.now,
  });
  operationsLog.event('server_started');

  const config = loadConfig({
    defaultHandoverDir: paths.handoverDir,
    folders: {
      dataDir: paths.dataDir,
      logDir: paths.logDir,
      programDir,
      updateCopyDir: paths.updateCopyDir,
      homeDir,
    },
    operationsLog,
  });

  const database = openDatabase<DB>(join(paths.dataDir, DATABASE_FILE_NAME));
  let app: FastifyInstance;
  try {
    await runMigrations(database, migrations, clock.now);
    app = buildApp({ port: config.port, database });
  } catch (error) {
    await database.close();
    throw error;
  }
  const close = async () => {
    await app.close();
    await database.close();
  };

  try {
    await app.listen({ host, port: config.port });
  } catch (error) {
    const refNo = createReferenceNumber();
    errorLog.error({ refNo, function: 'ops.startup.listen', error });
    await close();
    return { state: 'aborted', refNo };
  }

  lifecycle.set('ready');
  // The kind of the last end and the findings of the startup check follow in S10 (2.19 step 9).
  operationsLog.event('server_ready');

  return { state: 'ready', port: config.port, handoverDir: config.handoverDir, app, close };
}
