import { join } from 'node:path';

import fastifyMultipart from '@fastify/multipart';
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { channelsRoutes } from './channels/index.ts';
import type { Database } from './db/database.ts';
import type { DB } from './db/schema.ts';
import { createUnitOfWork } from './db/unit-of-work.ts';
import { createFrameworkErrorHandler, type HttpCoreDeps, registerHttpCore } from './http/index.ts';
import { inventoryChecks } from './inventory/index.ts';
import { createMediaFileIntake, mediaRoutes } from './media/index.ts';
import {
  createShutdownService,
  type OperationsLog,
  opsRoutes,
  type OpsRoutesOptions,
} from './ops/index.ts';
import { settingsRoutes } from './settings/index.ts';
import type { Clock } from './shared/clock.ts';

export interface AppDeps extends HttpCoreDeps {
  /** The migrated database, opened by the startup sequence (CU-040). */
  database: Database<DB>;
  /** What `GET /api/ops/health` and `GET /api/ops/status` report besides the lifecycle state. */
  ops: Omit<OpsRoutesOptions, 'lifecycle' | 'shutdownService'>;
  operationsLog: OperationsLog;
  now: () => Date;
  /** Server clock of the services (CU-032); `now` is its `now`. */
  clock: Clock;
  /** Ends the process after an orderly shutdown; `main.ts` passes `process.exit`. */
  exit: (code: number) => void;
}

/**
 * Builds the Fastify instance (CU-019, hotspot 4.5): HTTP core first, then one line
 * `app.register(<component>Routes)` per component. Fastify logs no requests (2.19).
 */
export function buildApp(deps: AppDeps) {
  const app = Fastify({
    logger: false,
    frameworkErrors: createFrameworkErrorHandler(deps.errorLog),
  }).withTypeProvider<ZodTypeProvider>();
  const { writeGate } = registerHttpCore(app, deps);

  // One transaction per action for the services (2.0.4). The handler tables of CU-169 and
  // CU-290 are merged here (Nachtrag MAR-263); CU-169 follows in S5.
  const uow = createUnitOfWork(deps.database.db, { check: { ...inventoryChecks } });

  const shutdownService = createShutdownService({
    lifecycle: deps.lifecycle,
    waitForWrites: writeGate.waitUntilIdle,
    database: deps.database,
    dataDir: deps.ops.dataDirPath,
    appVersion: deps.ops.appVersion,
    startId: deps.ops.startId,
    now: deps.now,
    errorLog: deps.errorLog,
    operationsLog: deps.operationsLog,
    exit: deps.exit,
  });

  // Media folder in the data folder (2.19); the file intake serves the logo (2.2).
  const mediaDir = join(deps.ops.dataDirPath, 'media');
  const mediaFiles = createMediaFileIntake({ mediaDir, clock: deps.clock });

  // Uploads as `multipart/form-data` (2.0.1); each upload route sets its own size limit.
  app.register(fastifyMultipart);
  app.register(opsRoutes, { ...deps.ops, lifecycle: deps.lifecycle, shutdownService });
  app.register(settingsRoutes, { db: deps.database.db, uow, clock: deps.clock, mediaFiles });
  app.register(mediaRoutes, { db: deps.database.db, mediaDir });
  app.register(channelsRoutes, { db: deps.database.db });

  return { app, writeGate, uow };
}
