import type { FastifyInstance, FastifyReply } from 'fastify';

/** Content Security Policy, wording of Technical Specification 2.0.2 (H-2: inline styles only). */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * The path of a request target as the router matches it: without scheme and authority of an
 * absolute-form target, without query and fragment, and with percent-encoded ASCII decoded
 * (`/%61pi` is `/api`). Path rules (G-5, `no-store`, history fallback) check this path, so
 * a different spelling cannot bypass them. Decoding `%2F` as well can only widen a prefix
 * match, never narrow it.
 */
export function routedPath(url: string): string {
  const target = url.startsWith('/') ? url : url.replace(/^https?:\/\/[^/?#]*/i, '');
  const path = target.split(/[?#]/, 1)[0] || '/';
  return path.replace(/%([0-7][0-9a-f])/gi, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

const isApiPath = (url: string) => /^\/api(?:\/|$)/.test(routedPath(url));

export function setSecurityHeaders(reply: FastifyReply, url: string): void {
  reply.header('content-security-policy', CONTENT_SECURITY_POLICY);
  reply.header('x-content-type-options', 'nosniff');
  reply.header('referrer-policy', 'no-referrer');
  if (isApiPath(url)) reply.header('cache-control', 'no-store');
}

/** Security headers on every response, including rejections and errors (CU-022, TH-03). */
export function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook('onSend', async (request, reply, payload) => {
    setSecurityHeaders(reply, request.url);
    return payload;
  });
}
