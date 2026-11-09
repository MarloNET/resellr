import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';

import type { DB } from './db/schema.ts';
import { createUnitOfWork } from './db/unit-of-work.ts';
import { createFrameworkErrorHandler, type HttpCoreDeps, registerHttpCore } from './http/index.ts';
import { opsRoutes, type OpsRoutesOptions } from './ops/index.ts';

export interface AppDeps extends HttpCoreDeps {
  /** The migrated database, opened by the startup sequence (CU-040). */
  db: Kysely<DB>;
  /** What `GET /api/ops/health` and `GET /api/ops/status` report besides the lifecycle state. */
  ops: Omit<OpsRoutesOptions, 'lifecycle'>;
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
  const uow = createUnitOfWork(deps.db, {});

  app.register(opsRoutes, { ...deps.ops, lifecycle: deps.lifecycle });

  return { app, writeGate, uow };
}
