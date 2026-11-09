import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let sideEffects: number;

beforeEach(async () => {
  t = createTestApp();
  sideEffects = 0;
  const count = async () => {
    sideEffects += 1;
    return { ok: true };
  };
  t.app.get('/api/test/items', count);
  t.app.get('/media/photos/:id', count);
  t.app.get('/datasheets/:name', count);
  t.app.get('/downloads/:name', count);
  t.app.post('/api/test/items', count);
  t.app.put('/api/test/items', count);
  t.app.patch('/api/test/items', count);
  t.app.delete('/api/test/items', count);
  t.app.post('/api/ops/shutdown', count);
  t.app.post('/api/test/upload', { config: { upload: true } }, count);
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

/** The headers of a write from the own user interface without one of them. */
const writeHeadersWithout = (name: keyof typeof SAME_ORIGIN_WRITE) =>
  Object.fromEntries(Object.entries(SAME_ORIGIN_WRITE).filter(([key]) => key !== name));

const errorCode = (body: string) => (JSON.parse(body) as { error: { code: string } }).error.code;

describe('local-guard G-1 host (E2)', () => {
  it.each(['localhost:4310', '127.0.0.1', '127.0.0.1:4311', '192.168.0.20:4310', 'example.com'])(
    'AC-REQ-001-07 rejects Host %s with 403 forbidden_host and no side effect',
    async (host) => {
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/test/items',
        headers: { ...SAME_ORIGIN_WRITE, host },
        payload: {},
      });

      expect(response.statusCode).toBe(403);
      expect(errorCode(response.body)).toBe('forbidden_host');
      expect(sideEffects).toBe(0);
    },
  );

  it('rejects a GET with a foreign host, also for the user interface', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/',
      headers: { host: 'localhost:4310' },
    });

    expect(response.statusCode).toBe(403);
    expect(errorCode(response.body)).toBe('forbidden_host');
  });

  it('AC-REQ-001-05 accepts a request with Host 127.0.0.1:<port> without any login', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/test/items',
      headers: { host: HOST },
    });

    expect(response.statusCode).toBe(200);
    expect(sideEffects).toBe(1);
  });
});

describe('local-guard G-2 origin of writes (E3)', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    '%s without Origin is rejected with 403 forbidden_origin',
    async (method) => {
      const response = await t.app.inject({
        method,
        url: '/api/test/items',
        headers: writeHeadersWithout('origin'),
        payload: {},
      });

      expect(response.statusCode).toBe(403);
      expect(errorCode(response.body)).toBe('forbidden_origin');
      expect(sideEffects).toBe(0);
    },
  );

  it.each([
    'http://localhost:4310',
    'http://127.0.0.1:4311',
    'https://127.0.0.1:4310',
    'null',
    'http://evil.example',
  ])('POST with Origin %s is rejected', async (origin) => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: { ...SAME_ORIGIN_WRITE, origin },
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(errorCode(response.body)).toBe('forbidden_origin');
    expect(sideEffects).toBe(0);
  });

  it.each(['cross-site', 'same-site', 'none'])(
    'POST with Sec-Fetch-Site %s is rejected',
    async (site) => {
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/test/items',
        headers: { ...SAME_ORIGIN_WRITE, 'sec-fetch-site': site },
        payload: {},
      });

      expect(response.statusCode).toBe(403);
      expect(errorCode(response.body)).toBe('forbidden_origin');
    },
  );

  it('POST with the own Origin and without Sec-Fetch-Site is accepted', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: writeHeadersWithout('sec-fetch-site'),
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(sideEffects).toBe(1);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    '%s from the own user interface is accepted',
    async (method) => {
      const response = await t.app.inject({
        method,
        url: '/api/test/items',
        headers: SAME_ORIGIN_WRITE,
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(sideEffects).toBe(1);
    },
  );
});

describe('local-guard G-3 shutdown without browser (E4)', () => {
  it('POST /api/ops/shutdown without Origin and Sec-Fetch-Site passes G-2', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/ops/shutdown',
      headers: { host: HOST, 'content-type': 'application/json' },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(sideEffects).toBe(1);
  });

  it.each([
    ['with Sec-Fetch-Site but without Origin', { 'sec-fetch-site': 'cross-site' }],
    ['with a foreign Origin but without Sec-Fetch-Site', { origin: 'http://evil.example' }],
  ])('POST /api/ops/shutdown %s is rejected', async (_case, extra) => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/ops/shutdown',
      headers: { host: HOST, 'content-type': 'application/json', ...extra },
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(errorCode(response.body)).toBe('forbidden_origin');
    expect(sideEffects).toBe(0);
  });

  it('the exception holds for no other path', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: { host: HOST, 'content-type': 'application/json' },
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(errorCode(response.body)).toBe('forbidden_origin');
  });
});

describe('local-guard G-4 content type (E5)', () => {
  it.each([
    ['without Content-Type', undefined],
    ['with text/plain', 'text/plain'],
    ['with multipart/form-data', 'multipart/form-data; boundary=x'],
    ['with application/x-www-form-urlencoded', 'application/x-www-form-urlencoded'],
  ])('a write %s is rejected with 415 unsupported_media_type', async (_case, contentType) => {
    const headers = writeHeadersWithout('content-type');
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: contentType === undefined ? headers : { ...headers, 'content-type': contentType },
      payload: '{}',
    });

    expect(response.statusCode).toBe(415);
    expect(errorCode(response.body)).toBe('unsupported_media_type');
    expect(sideEffects).toBe(0);
  });

  it('accepts application/json with charset', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: { ...SAME_ORIGIN_WRITE, 'content-type': 'Application/JSON; charset=utf-8' },
      payload: '{}',
    });

    expect(response.statusCode).toBe(200);
  });

  it('an upload route needs multipart/form-data instead of JSON', async () => {
    const json = await t.app.inject({
      method: 'POST',
      url: '/api/test/upload',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });

    expect(json.statusCode).toBe(415);
    expect(errorCode(json.body)).toBe('unsupported_media_type');
    expect(sideEffects).toBe(0);
  });
});

describe('local-guard G-5 cross-site reads (E6)', () => {
  it.each(['/api/test/items', '/media/photos/abc', '/datasheets/x.pdf', '/downloads/x.zip'])(
    'GET %s with Sec-Fetch-Site cross-site is rejected with 403 forbidden_origin',
    async (url) => {
      const response = await t.app.inject({
        method: 'GET',
        url,
        headers: { host: HOST, 'sec-fetch-site': 'cross-site' },
      });

      expect(response.statusCode).toBe(403);
      expect(errorCode(response.body)).toBe('forbidden_origin');
      expect(sideEffects).toBe(0);
    },
  );

  // The router decodes the path before matching, so G-5 must not depend on the spelling.
  it.each([
    '/%61pi/test/items',
    '/a%70i/test/items?q=1',
    '/%6Dedia/photos/abc',
    '/%64atasheets/x.pdf',
    '/%64ownloads/x.zip',
    'http://127.0.0.1:4310/api/test/items',
    'http://127.0.0.1:4310/%6Dedia/photos/abc',
  ])('GET %s (other spelling) with Sec-Fetch-Site cross-site is rejected', async (url) => {
    const response = await t.app.inject({
      method: 'GET',
      url,
      headers: { host: HOST, 'sec-fetch-site': 'cross-site' },
    });

    expect(response.statusCode).toBe(403);
    expect(errorCode(response.body)).toBe('forbidden_origin');
    expect(sideEffects).toBe(0);
  });

  it.each(['/api/test/items', '/%61pi/test/items', '/media/photos/abc'])(
    'HEAD %s with Sec-Fetch-Site cross-site is rejected like GET',
    async (url) => {
      const response = await t.app.inject({
        method: 'HEAD',
        url,
        headers: { host: HOST, 'sec-fetch-site': 'cross-site' },
      });

      expect(response.statusCode).toBe(403);
      expect(sideEffects).toBe(0);
    },
  );

  it.each(['same-origin', 'none'])('GET /api with Sec-Fetch-Site %s is answered', async (site) => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/test/items',
      headers: { host: HOST, 'sec-fetch-site': site },
    });

    expect(response.statusCode).toBe(200);
  });

  it('GET of the user interface with Sec-Fetch-Site cross-site is answered (link from outside)', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/inserate',
      headers: { host: HOST, 'sec-fetch-site': 'cross-site' },
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('local-guard G-6 no CORS (E7)', () => {
  it.each(['/api/test/items', '/api/ops/health', '/', '/assets/app.js'])(
    'OPTIONS %s is answered with 405 method_not_allowed in the error format',
    async (url) => {
      const response = await t.app.inject({
        method: 'OPTIONS',
        url,
        headers: {
          host: HOST,
          origin: 'http://evil.example',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.statusCode).toBe(405);
      expect(JSON.parse(response.body)).toEqual({
        error: {
          code: 'method_not_allowed',
          message: '',
          fields: [],
          details: {},
          referenceNumber: null,
        },
      });
      expect(
        Object.keys(response.headers).filter((name) => name.startsWith('access-control-')),
      ).toEqual([]);
      expect(response.headers).not.toHaveProperty('allow');
      expect(response.headers).toHaveProperty('content-security-policy');
    },
  );

  it('OPTIONS with a foreign host is rejected by G-1 first', async () => {
    const response = await t.app.inject({
      method: 'OPTIONS',
      url: '/api/ops/health',
      headers: { host: 'localhost:4310' },
    });

    expect(response.statusCode).toBe(403);
    expect(errorCode(response.body)).toBe('forbidden_host');
  });

  it('answers without CORS headers, also to a request with a foreign Origin', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/test/items',
      headers: { host: HOST, origin: 'http://evil.example' },
    });

    expect(
      Object.keys(response.headers).filter((name) => name.startsWith('access-control-')),
    ).toEqual([]);
  });
});

describe('local-guard rejections in the error log (E8)', () => {
  it('writes each rejection as a warning without request content', async () => {
    await t.app.inject({
      method: 'POST',
      url: '/api/test/items?search=geheim',
      headers: { ...SAME_ORIGIN_WRITE, host: 'localhost:4310' },
      payload: { wiNr: '626198' },
    });
    await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: { ...SAME_ORIGIN_WRITE, origin: 'http://evil.example' },
      payload: { wiNr: '626198' },
    });
    await t.app.inject({
      method: 'PUT',
      url: '/api/test/items',
      headers: { ...SAME_ORIGIN_WRITE, 'content-type': 'text/plain' },
      payload: 'wiNr=626198',
    });
    await t.app.inject({
      method: 'GET',
      url: '/api/test/items',
      headers: { host: HOST, 'sec-fetch-site': 'cross-site' },
    });
    await t.app.inject({ method: 'OPTIONS', url: '/api/test/items', headers: { host: HOST } });

    const entries = t.readErrorLog();
    expect(
      entries.map(({ level, refNo, function: fn, message }) => ({ level, refNo, fn, message })),
    ).toEqual([
      { level: 'warn', refNo: null, fn: 'http.local-guard', message: 'G-1 forbidden_host POST' },
      { level: 'warn', refNo: null, fn: 'http.local-guard', message: 'G-2 forbidden_origin POST' },
      {
        level: 'warn',
        refNo: null,
        fn: 'http.local-guard',
        message: 'G-4 unsupported_media_type PUT',
      },
      { level: 'warn', refNo: null, fn: 'http.local-guard', message: 'G-5 forbidden_origin GET' },
      {
        level: 'warn',
        refNo: null,
        fn: 'http.local-guard',
        message: 'G-6 method_not_allowed OPTIONS',
      },
    ]);
    const logged = JSON.stringify(entries);
    for (const content of ['626198', 'geheim', 'localhost', 'evil.example', '/api/test/items']) {
      expect(logged).not.toContain(content);
    }
  });

  it('writes nothing for an accepted request', async () => {
    await t.app.inject({
      method: 'POST',
      url: '/api/test/items',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });

    expect(t.readErrorLog()).toEqual([]);
  });
});
