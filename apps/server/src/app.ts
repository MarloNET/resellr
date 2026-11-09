import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { createFrameworkErrorHandler, type HttpCoreDeps, registerHttpCore } from './http/index.ts';

export type AppDeps = HttpCoreDeps;

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

  // Routes of the components, one line each, follow with their tasks (#112 ff.).

  return { app, writeGate };
}
