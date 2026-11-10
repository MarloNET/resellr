import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import type { Database } from './db/database.ts';
import type { DB } from './db/schema.ts';
import { createUnitOfWork } from './db/unit-of-work.ts';
import { createFrameworkErrorHandler, type HttpCoreDeps, registerHttpCore } from './http/index.ts';
import {
  createShutdownService,
  type OperationsLog,
  opsRoutes,
  type OpsRoutesOptions,
} from './ops/index.ts';

export interface AppDeps extends HttpCoreDeps {
  /** The migrated database, opened by the startup sequence (CU-040). */
  database: Database<DB>;
  /** What `GET /api/ops/health` and `GET /api/ops/status` report besides the lifecycle state. */
  ops: Omit<OpsRoutesOptions, 'lifecycle' | 'shutdownService'>;
  operationsLog: OperationsLog;
  now: () => Date;
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
  // CU-290 are merged here once they exist; in S1 there are none (Nachtrag MAR-263).
  const uow = createUnitOfWork(deps.database.db, {});

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

  app.register(opsRoutes, { ...deps.ops, lifecycle: deps.lifecycle, shutdownService });

  return { app, writeGate, uow };
}
