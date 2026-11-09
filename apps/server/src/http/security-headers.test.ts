import type { InjectOptions } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';

// Wording of Technical Specification 2.0.2.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; " +
  "base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  t.app.get('/api/test/items', async () => ({ items: [], total: 0 }));
  t.app.get('/api/test/fail', async () => {
    throw new Error('boom');
  });
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const cases: [string, InjectOptions & { url: string }, number][] = [
  ['an API response', { method: 'GET', url: '/api/test/items', headers: { host: HOST } }, 200],
  ['index.html', { method: 'GET', url: '/', headers: { host: HOST } }, 200],
  ['a history fallback', { method: 'GET', url: '/inserate/9', headers: { host: HOST } }, 200],
  ['an asset', { method: 'GET', url: '/assets/app.js', headers: { host: HOST } }, 200],
  ['a missing asset', { method: 'GET', url: '/assets/missing.js', headers: { host: HOST } }, 404],
  ['an unknown API path', { method: 'GET', url: '/api/unknown', headers: { host: HOST } }, 404],
  ['a technical error', { method: 'GET', url: '/api/test/fail', headers: { host: HOST } }, 500],
  [
    'a local-guard rejection',
    { method: 'GET', url: '/api/test/items', headers: { host: 'localhost:4310' } },
    403,
  ],
  ['OPTIONS', { method: 'OPTIONS', url: '/api/test/items', headers: { host: HOST } }, 405],
  [
    'a write rejected by the content type',
    {
      method: 'POST',
      url: '/api/test/items',
      headers: { ...SAME_ORIGIN_WRITE, 'content-type': 'text/plain' },
    },
    415,
  ],
  ['a malformed URL', { method: 'GET', url: '/api/%E0%A4%A', headers: { host: HOST } }, 400],
];

describe('security headers (E9)', () => {
  it.each(cases)('%s carries CSP, nosniff and no-referrer', async (_case, request, status) => {
    const response = await t.app.inject(request);

    expect(response.statusCode).toBe(status);
    expect(response.headers['content-security-policy']).toBe(CSP);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });

  it.each(cases.filter(([, request]) => request.url.startsWith('/api')))(
    '%s under /api is not cached',
    async (_case, request) => {
      const response = await t.app.inject(request);

      expect(response.headers['cache-control']).toBe('no-store');
    },
  );

  it.each(['/', '/assets/app.js'])('%s outside /api has no Cache-Control no-store', async (url) => {
    const response = await t.app.inject({ method: 'GET', url, headers: { host: HOST } });

    expect(response.headers['cache-control']).not.toBe('no-store');
  });
});
