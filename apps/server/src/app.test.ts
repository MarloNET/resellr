import type { RouteOptions } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../test/test-app.ts';

/** Words of a login, a user account, an access password or a password reset (OD-02 A). */
const ACCESS_FUNCTION =
  /login|logout|sign-?in|sign-?up|regist|anmeld|auth|account|konto|user|benutzer|passw|session|zugang|credential/i;

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let routes: Pick<RouteOptions, 'method' | 'url'>[];

beforeEach(async () => {
  t = createTestApp();
  routes = [];
  // The routes of the components are registered as plugins, so they all pass this hook.
  t.app.addHook('onRoute', ({ method, url }) => {
    routes.push({ method, url });
  });
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

describe('no login and no accounts (Technical Specification 2.20, OD-02 A)', () => {
  it('AC-REQ-001-05 the route table has no route for login, accounts or password reset', () => {
    expect(routes.map(({ url }) => url)).toContain('/api/ops/health');
    expect(routes.filter(({ url }) => ACCESS_FUNCTION.test(url))).toEqual([]);
    expect(t.app.printRoutes({ commonPrefix: false })).not.toMatch(ACCESS_FUNCTION);
  });

  it('AC-REQ-001-05 every reading route answers without credentials and sets no session', async () => {
    const reads = routes.filter(
      ({ method, url }) => [method].flat().includes('GET') && !url.includes('*'),
    );
    expect(reads.length).toBeGreaterThan(0);

    for (const { url } of reads) {
      const response = await t.app.inject({
        method: 'GET',
        url: url.replace(/:\w+/g, '1'),
        headers: { host: HOST },
      });

      expect([401, 403], url).not.toContain(response.statusCode);
      expect(response.headers, url).not.toHaveProperty('www-authenticate');
      expect(response.headers, url).not.toHaveProperty('set-cookie');
    }
  });

  it.each([
    '/api/login',
    '/api/auth/login',
    '/api/session',
    '/api/users',
    '/api/accounts',
    '/api/password-reset',
    '/api/access-password',
  ])('AC-REQ-001-05 %s does not exist', async (url) => {
    for (const method of ['GET', 'POST'] as const) {
      const response = await t.app.inject({
        method,
        url,
        headers: SAME_ORIGIN_WRITE,
        payload: method === 'POST' ? {} : undefined,
      });

      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }
  });
});
