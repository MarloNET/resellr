import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { createHealthClient, HEALTH_TIMEOUT_MS } from './health-client.ts';

const REF_NO = 'R-7K3M-Q9TX';

type Handler = (request: IncomingMessage, body: string, response: ServerResponse) => void;

let server: Server | undefined;

/** Starts a loopback test server and returns its port. */
async function startServer(handler: Handler): Promise<number> {
  server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
    request.on('end', () => handler(request, body, response));
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

const json = (response: ServerResponse, status: number, value: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
};

/** A port nobody listens on: taken from a server that is closed again. */
async function closedPort(): Promise<number> {
  const port = await startServer(() => {});
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
  return port;
}

afterEach(async () => {
  server?.closeAllConnections();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe('health client (CU-266)', () => {
  it('builds the local address from the port of the caller (2.0.1)', () => {
    expect(createHealthClient({ port: 4311 }).appUrl).toBe('http://127.0.0.1:4311/');
  });

  it.each(['starting', 'ready', 'stopping'] as const)(
    'returns the state %s from GET /api/ops/health',
    async (state) => {
      const requests: string[] = [];
      const port = await startServer((request, _, response) => {
        requests.push(`${request.method} ${request.url} ${request.headers.host}`);
        json(response, 200, { state, startId: null });
      });

      await expect(createHealthClient({ port }).getHealth()).resolves.toBe(state);
      expect(requests).toEqual([`GET /api/ops/health 127.0.0.1:${port}`]);
    },
  );

  it('returns null when no server listens on the port', async () => {
    const port = await closedPort();
    await expect(createHealthClient({ port }).getHealth()).resolves.toBeNull();
  });

  it.each([
    ['a status other than 200', 403, { code: 'forbidden_host' }],
    ['an unknown state', 200, { state: 'booting' }],
    ['no object', 200, 'ready'],
  ])('returns null for %s', async (_, status, body) => {
    const port = await startServer((_request, _body, response) => json(response, status, body));
    await expect(createHealthClient({ port }).getHealth()).resolves.toBeNull();
  });

  it('returns null for a body that is no JSON', async () => {
    const port = await startServer((_request, _body, response) => response.end('<html>'));
    await expect(createHealthClient({ port }).getHealth()).resolves.toBeNull();
  });

  it('gives up GET /api/ops/health after a time limit of 1 s (2.18, step 1)', async () => {
    expect(HEALTH_TIMEOUT_MS).toBe(1000);
    // The server takes the request but never answers.
    const port = await startServer(() => {});

    const started = performance.now();
    await expect(createHealthClient({ port }).getHealth()).resolves.toBeNull();
    const elapsed = performance.now() - started;

    expect(elapsed).toBeGreaterThanOrEqual(HEALTH_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(HEALTH_TIMEOUT_MS + 900);
  });

  it('waits for the time limit the caller gives, e.g. 2 s instead of 1 s', async () => {
    const port = await startServer(() => {});

    const started = performance.now();
    await expect(createHealthClient({ port }).getHealth(2000)).resolves.toBeNull();
    const elapsed = performance.now() - started;

    expect(elapsed).toBeGreaterThanOrEqual(2000 - 50);
    expect(elapsed).toBeLessThan(2000 + 900);
  });

  it('sends POST /api/ops/shutdown as JSON without Origin and returns status and body', async () => {
    const requests: Record<string, unknown>[] = [];
    const port = await startServer((request, body, response) => {
      requests.push({
        line: `${request.method} ${request.url}`,
        host: request.headers.host,
        contentType: request.headers['content-type'],
        origin: request.headers.origin,
        secFetchSite: request.headers['sec-fetch-site'],
        body,
      });
      json(response, 200, { dataDirPath: 'C:\\Daten' });
    });

    await expect(createHealthClient({ port }).shutdown()).resolves.toEqual({
      status: 200,
      body: { dataDirPath: 'C:\\Daten' },
      refNo: null,
    });
    // Without Origin and Sec-Fetch-Site the request is no browser request (2.0.2, G-3).
    expect(requests).toEqual([
      {
        line: 'POST /api/ops/shutdown',
        host: `127.0.0.1:${port}`,
        contentType: 'application/json',
        origin: undefined,
        secFetchSite: undefined,
        body: '{}',
      },
    ]);
  });

  it('returns the status of a failed shutdown with a null body if it is no JSON', async () => {
    const port = await startServer((_request, _body, response) => {
      response.writeHead(500);
      response.end('oops');
    });
    await expect(createHealthClient({ port }).shutdown()).resolves.toEqual({
      status: 500,
      body: null,
      refNo: null,
    });
  });

  it('returns the reference number of a failed shutdown from the error body', async () => {
    const error = { code: 'internal_error', message: 'x', details: [], referenceNumber: REF_NO };
    const port = await startServer((_request, _body, response) => json(response, 500, { error }));

    await expect(createHealthClient({ port }).shutdown()).resolves.toEqual({
      status: 500,
      body: { error },
      refNo: REF_NO,
    });
  });

  it('ignores a reference number that does not match the pattern (H-11)', async () => {
    const port = await startServer((_request, _body, response) =>
      json(response, 500, { error: { referenceNumber: '<b>R-7K3M-Q9TX</b>' } }),
    );

    await expect(createHealthClient({ port }).shutdown()).resolves.toMatchObject({ refNo: null });
  });

  it('DER-104-02 ends POST /api/ops/shutdown with null when the signal of the caller aborts it', async () => {
    let requested: () => void = () => {};
    const received = new Promise<void>((resolve) => (requested = resolve));
    // The server takes the request but never answers.
    const port = await startServer(() => requested());
    const abort = new AbortController();

    const shutdown = createHealthClient({ port }).shutdown(abort.signal);
    await received;
    abort.abort();

    await expect(shutdown).resolves.toBeNull();
  });

  it('returns null from shutdown when no server listens on the port', async () => {
    const port = await closedPort();
    await expect(createHealthClient({ port }).shutdown()).resolves.toBeNull();
  });
});
