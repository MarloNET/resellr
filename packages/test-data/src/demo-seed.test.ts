import { createServer, type IncomingMessage, type Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDemoApi,
  type DemoApi,
  SEED_AREAS,
  seedDeviceTypes,
  seedDemoData,
  type SeedArea,
  seedSuppliers,
} from './demo-seed.ts';

interface Received {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

describe('createDemoApi', () => {
  let server: Server;
  let baseUrl: string;
  const received: Received[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk: Buffer) => (body += chunk.toString()));
      request.on('end', () => {
        received.push({
          method: request.method ?? '',
          url: request.url ?? '',
          headers: request.headers,
          body,
        });
        response.setHeader('content-type', 'application/json');
        if (request.url === '/api/conflict') {
          response.statusCode = 409;
          response.end(JSON.stringify({ error: { code: 'version_conflict' } }));
        } else if (request.url === '/api/html-error') {
          response.statusCode = 502;
          response.setHeader('content-type', 'text/html');
          response.end('<html>Bad Gateway</html>');
        } else if (request.url === '/api/empty') {
          response.statusCode = 204;
          response.end();
        } else {
          response.end(JSON.stringify({ id: 7 }));
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sends a write with the own origin and JSON, like the user interface (G-2, G-4)', async () => {
    received.length = 0;
    const api = createDemoApi(baseUrl);

    const answer = await api.request('POST', '/api/manufacturers', { name: 'Lenovo' });

    expect(answer).toEqual({ id: 7 });
    const [request] = received;
    expect(request?.headers.host).toBe(baseUrl.slice('http://'.length));
    expect(request?.headers.origin).toBe(baseUrl);
    expect(request?.headers['content-type']).toBe('application/json');
    expect(request?.headers['sec-fetch-site']).toBeUndefined();
    expect(JSON.parse(request?.body ?? '')).toEqual({ name: 'Lenovo' });
  });

  it('sends a read without origin and body', async () => {
    received.length = 0;

    await createDemoApi(baseUrl).request('GET', '/api/ops/status');

    expect(received[0]?.headers.origin).toBeUndefined();
    expect(received[0]?.body).toBe('');
  });

  it('returns undefined for an answer without content', async () => {
    await expect(createDemoApi(baseUrl).request('DELETE', '/api/empty')).resolves.toBeUndefined();
  });

  it('throws for an answer other than 2xx with method, path, status and error code', async () => {
    await expect(createDemoApi(baseUrl).request('PATCH', '/api/conflict', {})).rejects.toThrow(
      'PATCH /api/conflict failed with 409 version_conflict',
    );
  });

  it('throws with method, path and status for an error answer that is no JSON', async () => {
    await expect(createDemoApi(baseUrl).request('GET', '/api/html-error')).rejects.toThrow(
      'GET /api/html-error failed with 502 unknown',
    );
  });

  it('refuses localhost, which local-guard rejects (G-1)', () => {
    expect(() => createDemoApi('http://localhost:4310')).toThrow('needs 127.0.0.1');
  });
});

describe('seedDemoData', () => {
  const api: DemoApi = {
    baseUrl: 'http://127.0.0.1:4310',
    request: () => Promise.reject(new Error('not called')),
  };

  it('runs the areas of the build steps in their order: S2 device types and suppliers', () => {
    expect(SEED_AREAS).toEqual([seedDeviceTypes, seedSuppliers]);
  });

  it('creates the demo device types through POST /api/device-types', async () => {
    const requests: unknown[][] = [];
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (...args: unknown[]) => {
        requests.push(args);
        return undefined as never;
      },
    };

    await seedDeviceTypes(recording);

    expect(requests).toEqual([
      ['POST', '/api/device-types', { name: 'Beamer', active: true }],
      ['POST', '/api/device-types', { name: 'Drucker', active: false }],
    ]);
  });

  it('creates the demo suppliers through POST /api/suppliers', async () => {
    const requests: unknown[][] = [];
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (...args: unknown[]) => {
        requests.push(args);
        return undefined as never;
      },
    };

    await seedSuppliers(recording);

    expect(requests).toEqual([
      ['POST', '/api/suppliers', { name: 'Lieferant A', active: true }],
      ['POST', '/api/suppliers', { name: 'Lieferant B', active: true }],
      ['POST', '/api/suppliers', { name: 'Lieferant C', active: false }],
    ]);
  });

  it('runs the seed functions one after the other in list order with the API', async () => {
    const calls: string[] = [];
    const area =
      (name: string): SeedArea =>
      async (target) => {
        calls.push(`${name} start ${target.baseUrl}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        calls.push(`${name} end`);
      };

    await seedDemoData(api, [area('settings'), area('catalog')]);

    expect(calls).toEqual([
      'settings start http://127.0.0.1:4310',
      'settings end',
      'catalog start http://127.0.0.1:4310',
      'catalog end',
    ]);
  });

  it('stops at the first area that fails', async () => {
    const calls: string[] = [];
    const failing: SeedArea = async () => {
      calls.push('settings');
      throw new Error('POST /api/x failed with 422 validation_failed');
    };
    const next: SeedArea = async () => {
      calls.push('catalog');
    };

    await expect(seedDemoData(api, [failing, next])).rejects.toThrow('422 validation_failed');
    expect(calls).toEqual(['settings']);
  });
});
