import type { ErrorCode } from '@resellr/domain/errors/error-codes';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ErrorLog } from '../ops/index.ts';
import { sendError } from './error-mapper.ts';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** The route takes a file as `multipart/form-data` instead of JSON (G-4). */
    upload?: boolean;
  }
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PROTECTED_READ_PATH = /^\/(?:api|media|datasheets|downloads)(?:\/|$)/;
const SHUTDOWN_PATH = '/api/ops/shutdown';

interface Rejection {
  rule: string;
  code: ErrorCode;
}

const mediaType = (contentType: string | undefined) =>
  contentType?.split(';', 1)[0]?.trim().toLowerCase();

/**
 * Rules G-1 to G-6 of Technical Specification 2.0.2 in this order; returns the first one
 * the request breaks, or null.
 */
function check(request: FastifyRequest, port: number): Rejection | null {
  const { headers, method } = request;
  const path = request.url.split('?', 1)[0];
  const ownHost = `127.0.0.1:${port}`;

  // G-1: exactly 127.0.0.1:<port>, not localhost (DNS rebinding).
  if (headers.host !== ownHost) return { rule: 'G-1', code: 'forbidden_host' };

  const fetchSite = headers['sec-fetch-site'];
  if (WRITE_METHODS.has(method)) {
    // G-3: a request without both headers does not come from a browser.
    const fromTool =
      method === 'POST' &&
      path === SHUTDOWN_PATH &&
      headers.origin === undefined &&
      fetchSite === undefined;
    // G-2: writes need the own origin, and Sec-Fetch-Site same-origin if present.
    const sameOrigin =
      headers.origin === `http://${ownHost}` &&
      (fetchSite === undefined || fetchSite === 'same-origin');
    if (!fromTool && !sameOrigin) return { rule: 'G-2', code: 'forbidden_origin' };

    // G-4: JSON, or multipart/form-data for uploads.
    const expected = request.routeOptions.config?.upload
      ? 'multipart/form-data'
      : 'application/json';
    if (mediaType(headers['content-type']) !== expected) {
      return { rule: 'G-4', code: 'unsupported_media_type' };
    }
  }

  // G-5: no cross-site reads of data, images, data sheets and downloads.
  if (method === 'GET' && fetchSite === 'cross-site' && PROTECTED_READ_PATH.test(path ?? '')) {
    return { rule: 'G-5', code: 'forbidden_origin' };
  }

  // G-6: no CORS; preflights are refused.
  if (method === 'OPTIONS') return { rule: 'G-6', code: 'method_not_allowed' };

  return null;
}

/**
 * `local-guard` (CU-021): checks every request before routing work starts. A rejection has
 * no side effect and is written to the error log as a warning without request content.
 */
export function registerLocalGuard(
  app: FastifyInstance,
  { port, errorLog }: { port: number; errorLog: ErrorLog },
): void {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const rejection = check(request, port);
    if (rejection === null) return;
    errorLog.warn({
      function: 'http.local-guard',
      message: `${rejection.rule} ${rejection.code} ${request.method}`,
    });
    return sendError(reply, rejection.code);
  });
}
