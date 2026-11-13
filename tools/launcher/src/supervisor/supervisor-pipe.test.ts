import { createHash, randomUUID } from 'node:crypto';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  listenSupervisorPipe,
  parsePhaseEvent,
  parseRequest,
  requestStop,
  subscribeToSupervisor,
  supervisorPipePath,
  type SupervisorPipeServer,
  waitForFreePipe,
} from './supervisor-pipe.ts';

describe('supervisorPipePath (CU-263)', () => {
  const localAppData = 'C:\\Users\\Owner\\AppData\\Local';
  const hash = createHash('sha256').update(localAppData).digest('hex').slice(0, 16);

  it('names the pipe after the first 16 hex characters of SHA-256 over %LOCALAPPDATA% on Windows', () => {
    expect(supervisorPipePath(localAppData, 'win32')).toBe(
      `\\\\.\\pipe\\resellr-supervisor-${hash}`,
    );
  });

  it('uses a Unix socket in the temporary folder under Linux', () => {
    expect(supervisorPipePath(localAppData, 'linux')).toBe(
      join(tmpdir(), `resellr-supervisor-${hash}.sock`),
    );
  });

  it('gives another user another pipe', () => {
    expect(supervisorPipePath('C:\\Users\\Other\\AppData\\Local', 'win32')).not.toBe(
      supervisorPipePath(localAppData, 'win32'),
    );
  });
});

describe('messages', () => {
  it('reads the requests subscribe and stop', () => {
    expect(parseRequest({ cmd: 'subscribe' })).toEqual({ cmd: 'subscribe' });
    expect(parseRequest({ cmd: 'stop' })).toEqual({ cmd: 'stop' });
    expect(parseRequest({ cmd: 'restart' })).toBeNull();
    expect(parseRequest(null)).toBeNull();
  });

  it('reads phase events with startId and refNo and rejects unknown phases', () => {
    expect(parsePhaseEvent({ event: 'phase', phase: 'aborted', refNo: 'R-1', extra: 1 })).toEqual({
      event: 'phase',
      phase: 'aborted',
      refNo: 'R-1',
    });
    expect(parsePhaseEvent({ event: 'phase', phase: 'ready', startId: 's-1' })).toEqual({
      event: 'phase',
      phase: 'ready',
      startId: 's-1',
    });
    expect(parsePhaseEvent({ event: 'phase', phase: 'crash_grace' })).toBeNull();
    expect(parsePhaseEvent({ phase: 'ready' })).toBeNull();
  });
});

describe('pipe of the supervisor (CU-263)', () => {
  let path: string;
  const servers: SupervisorPipeServer[] = [];

  const listen = async () => {
    const server = await listenSupervisorPipe(path);
    if (server !== null) servers.push(server);
    return server;
  };

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    rmSync(path, { force: true });
  });

  const newPath = () => (path = supervisorPipePath(`/tmp/resellr-test-${randomUUID()}`));

  it('gives the pipe to one process only', async () => {
    newPath();
    expect(await listen()).not.toBeNull();
    expect(await listen()).toBeNull();
  });

  it('frees the pipe on close', async () => {
    newPath();
    const first = await listenSupervisorPipe(path);
    await first!.close();

    expect(await listen()).not.toBeNull();
  });

  it('replaces a socket file nobody accepts on, as left behind by a crash', async () => {
    newPath();
    writeFileSync(path, '');

    expect(await listen()).not.toBeNull();
  });

  it('resolves subscribe with null when no supervisor listens', async () => {
    newPath();
    await expect(subscribeToSupervisor(path)).resolves.toBeNull();
  });

  it('sends the current phase on subscribe and waits for a final event', async () => {
    newPath();
    const server = (await listen())!;
    server.onRequest((request, reply) => {
      if (request.cmd !== 'subscribe') return;
      reply({ event: 'phase', phase: 'starting', startId: 's-1' });
      // `error` is the answer to a failed stop and does not end the wait.
      server.broadcast({ event: 'phase', phase: 'error' });
      server.broadcast({ event: 'phase', phase: 'ready', startId: 's-1' });
    });

    await expect(subscribeToSupervisor(path)).resolves.toEqual({
      event: 'phase',
      phase: 'ready',
      startId: 's-1',
    });
  });

  it('broadcasts only to connections that sent subscribe', async () => {
    newPath();
    const server = (await listen())!;
    const requests: string[] = [];
    server.onRequest((request) => requests.push(request.cmd));

    const silent = connect(path);
    await once(silent, 'connect');
    const received: string[] = [];
    silent.setEncoding('utf8').on('data', (chunk: string) => received.push(chunk));
    silent.write('no json\n{"cmd":"stop"}\n');

    const result = subscribeToSupervisor(path);
    await expect.poll(() => requests).toEqual(['stop', 'subscribe']);
    server.broadcast({ event: 'phase', phase: 'stopped' });

    await expect(result).resolves.toEqual({ event: 'phase', phase: 'stopped' });
    expect(received).toEqual([]);
    silent.destroy();
  });

  it('reports closed when the supervisor ends without a result', async () => {
    newPath();
    const server = (await listenSupervisorPipe(path))!;
    server.onRequest(() => void server.close());

    await expect(subscribeToSupervisor(path)).resolves.toEqual({ phase: 'closed' });
    expect(existsSync(path)).toBe(false);
  });

  it('delivers the final event before closing', async () => {
    newPath();
    const server = (await listenSupervisorPipe(path))!;
    server.onRequest(() => {
      server.broadcast({ event: 'phase', phase: 'aborted', refNo: 'R-1' });
      void server.close();
    });

    await expect(subscribeToSupervisor(path)).resolves.toEqual({
      event: 'phase',
      phase: 'aborted',
      refNo: 'R-1',
    });
  });

  it('keeps a socket file another server accepts on', async () => {
    newPath();
    const other = createServer();
    other.listen(path);
    await once(other, 'listening');

    expect(await listen()).toBeNull();
    other.close();
  });

  it('resolves stop with null when no supervisor listens', async () => {
    newPath();
    await expect(requestStop(path)).resolves.toBeNull();
  });

  it('sends stop and waits for stopped, ignoring the phases before it', async () => {
    newPath();
    const server = (await listen())!;
    server.onRequest((request, reply) => {
      if (request.cmd !== 'stop') return;
      reply({ event: 'phase', phase: 'ready', startId: 's-1' });
      reply({ event: 'phase', phase: 'stopped' });
    });

    await expect(requestStop(path)).resolves.toEqual({ event: 'phase', phase: 'stopped' });
  });

  it('ends the wait of stop with error and its reference number', async () => {
    newPath();
    const server = (await listen())!;
    server.onRequest((_, reply) => reply({ event: 'phase', phase: 'error', refNo: 'R-1' }));

    await expect(requestStop(path)).resolves.toEqual({
      event: 'phase',
      phase: 'error',
      refNo: 'R-1',
    });
  });

  it('reports closed when the supervisor ends without an answer to stop', async () => {
    newPath();
    const server = (await listenSupervisorPipe(path))!;
    server.onRequest(() => void server.close());

    await expect(requestStop(path)).resolves.toEqual({ phase: 'closed' });
  });

  it('waitForFreePipe resolves true once the supervisor frees the pipe', async () => {
    newPath();
    const server = (await listenSupervisorPipe(path))!;
    setTimeout(() => void server.close(), 300);

    await expect(waitForFreePipe(path, 5000)).resolves.toBe(true);
  });

  it('waitForFreePipe resolves false when the pipe is still held after the time limit', async () => {
    newPath();
    await listen();

    const startedAt = Date.now();
    await expect(waitForFreePipe(path, 300)).resolves.toBe(false);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(300);
  });
});
