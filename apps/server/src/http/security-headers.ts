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

const isApiPath = (url: string) => /^\/api(?:[/?#]|$)/.test(url);

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
