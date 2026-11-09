import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ErrorLog, LifecycleState } from '../ops/index.ts';
import { createErrorHandler, sendError } from './error-mapper.ts';
import { registerLocalGuard } from './local-guard.ts';
import { registerSecurityHeaders, setSecurityHeaders } from './security-headers.ts';
import { registerStaticWeb } from './static-web.ts';
import { registerWriteGate, type WriteGate } from './write-gate.ts';
import { registerZodValidation } from './zod-validation.ts';

export { LISTEN_HOST } from './listen-address.ts';
export type { WriteGate } from './write-gate.ts';

export interface HttpCoreDeps {
  /** Port the server listens on; part of the own origin `http://127.0.0.1:<port>`. */
  port: number;
  /** Folder with the built user interface (`index.html`, `assets/`). */
  webRoot: string;
  errorLog: ErrorLog;
  lifecycle: LifecycleState;
}

/**
 * HTTP core of the server (component http-api): request validation, security headers,
 * `local-guard`, write gate, error mapping and the static user interface. The hooks run in
 * this order for every request: `local-guard`, then the write gate.
 */
export function registerHttpCore(
  app: FastifyInstance,
  deps: HttpCoreDeps,
): { writeGate: WriteGate } {
  registerZodValidation(app);
  registerSecurityHeaders(app);
  registerLocalGuard(app, deps);
  const writeGate = registerWriteGate(app, deps);
  app.setErrorHandler(createErrorHandler(deps.errorLog));
  registerStaticWeb(app, deps);
  return { writeGate };
}

/**
 * Fastify option for errors before routing, e.g. a malformed URL: `400 bad_request`. Such a
 * reply skips the hooks, so it sets the security headers itself.
 */
export function frameworkErrors(
  _error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  setSecurityHeaders(reply, request.url);
  sendError(reply, 'bad_request');
}
