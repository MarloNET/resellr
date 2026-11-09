import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ASSET_JS, createTestApp, HOST, INDEX_HTML } from '../../test/test-app.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const get = (url: string) => t.app.inject({ method: 'GET', url, headers: { host: HOST } });

describe('static user interface (E12)', () => {
  it.each([
    '/',
    '/inserate',
    '/inserate/9/kanaele/shop',
    '/geraete/neu?x=1',
    '/beendet',
    '/apiary',
    '/mediathek',
  ])('GET %s answers index.html', async (url) => {
    const response = await get(url);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.body).toBe(INDEX_HTML);
  });

  it('GET /assets/* answers the file', async () => {
    const response = await get('/assets/app.js');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^(text|application)\/javascript/);
    expect(response.body).toBe(ASSET_JS);
  });

  it.each([
    '/assets/missing.js',
    '/assets/..%2findex.html',
    '/assets/..%2F..%2Fweb%2Findex.html',
    '/assets/.hidden',
  ])('GET %s answers 404 not_found, never another file, and logs no error', async (url) => {
    const response = await get(url);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({ error: { code: 'not_found' } });
    expect(t.readErrorLog()).toEqual([]);
  });

  it.each(['/api', '/api/unknown', '/media/photos/abc', '/datasheets/x.pdf', '/downloads/x.zip'])(
    'GET %s answers 404 not_found, not index.html',
    async (url) => {
      const response = await get(url);

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toMatchObject({ error: { code: 'not_found' } });
    },
  );

  it('a write to an unknown path answers 404 not_found', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/inserate',
      headers: {
        host: HOST,
        origin: `http://${HOST}`,
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({ error: { code: 'not_found' } });
  });

  it('without a built user interface GET / answers 404 not_found in the error format', async () => {
    rmSync(join(t.webRoot, 'index.html'));

    const response = await get('/');

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({ error: { code: 'not_found' } });
  });
});
