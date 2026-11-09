import { existsSync } from 'node:fs';
import { join } from 'node:path';

import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

import { sendError } from './error-mapper.ts';

/** Paths that never fall back to `index.html` (Technical Specification 2.0.1). */
const NO_FALLBACK = /^\/(?:api|media|datasheets|downloads|assets)(?:\/|$)/;

/**
 * Static user interface (CU-025, ADR-001): bundled files under `/assets/*` from
 * `<webRoot>/assets`, and `index.html` for every other GET path so the client-side router
 * can resolve it. Everything else that has no route answers `404 not_found`.
 */
export function registerStaticWeb(app: FastifyInstance, { webRoot }: { webRoot: string }): void {
  app.register(fastifyStatic, {
    root: join(webRoot, 'assets'),
    prefix: '/assets/',
    index: false,
    dotfiles: 'deny',
  });

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?', 1)[0] ?? '';
    // Without a built user interface the answer stays in the error format.
    if (
      request.method === 'GET' &&
      !NO_FALLBACK.test(path) &&
      existsSync(join(webRoot, 'index.html'))
    ) {
      return reply.sendFile('index.html', webRoot);
    }
    return sendError(reply, 'not_found');
  });
}
