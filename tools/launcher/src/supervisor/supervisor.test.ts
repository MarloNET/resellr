import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { rmSync } from 'node:fs';
import { connect } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import type { ServerEnd } from './server-process.ts';
import { runSupervisor } from './supervisor.ts';
import {
  listenSupervisorPipe,
  type PhaseEvent,
  subscribeToSupervisor,
  supervisorPipePath,
} from './supervisor-pipe.ts';

const REF_NO = 'R-7K3M-Q9TX';

/** A server process the test controls: `ready()` reports readiness, `end()` ends it. */
function fakeServer() {
  let onReady: () => void = () => {};
  let resolveEnded: (end: ServerEnd) => void = () => {};
  const startIds: string[] = [];
  return {
    startIds,
    startServer: ({ startId, onReady: ready }: { startId: string; onReady(): void }) => {
      startIds.push(startId);
      onReady = ready;
      return { ended: new Promise<ServerEnd>((resolve) => (resolveEnded = resolve)) };
    },
    ready: () => onReady(),
    end: (end: ServerEnd) => resolveEnded(end),
  };
}

/** A client that has subscribed; `next()` gives each line in turn, then `closed`. */
async function subscriber(path: string) {
  const socket = connect(path);
  await once(socket, 'connect');
  const lines: unknown[] = [];
  let buffer = '';
  let closed = false;
  socket.setEncoding('utf8');
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    const parts = buffer.split('\n');
    buffer = parts.pop()!;
    lines.push(...parts.map((line) => JSON.parse(line) as unknown));
  });
  socket.on('close', () => (closed = true));
  socket.write('{"cmd":"subscribe"}\n');
  return {
    next: async (): Promise<unknown> => {
      await expect.poll(() => lines.length > 0 || closed).toBe(true);
      return lines.length > 0 ? lines.shift() : 'closed';
    },
  };
}

describe('supervisor (CU-261)', () => {
  let path: string;

  afterEach(() => rmSync(path, { force: true }));

  async function start() {
    path = supervisorPipePath(`/tmp/resellr-test-${randomUUID()}`);
    const pipe = (await listenSupervisorPipe(path))!;
    const server = fakeServer();
    const phases: PhaseEvent[] = [];
    const ended = runSupervisor({
      pipe,
      startServer: server.startServer,
      onPhase: (event) => phases.push(event),
      createStartId: () => 'start-1',
      createRefNo: () => REF_NO,
    });
    return { server, phases, ended };
  }

  it('starts one server in starting and reports ready with the startId of this attempt', async () => {
    const { server, phases } = await start();
    expect(server.startIds).toEqual(['start-1']);

    const subscribed = subscribeToSupervisor(path);
    server.ready();

    await expect(subscribed).resolves.toEqual({
      event: 'phase',
      phase: 'ready',
      startId: 'start-1',
    });
    expect(phases).toEqual([
      { event: 'phase', phase: 'starting', startId: 'start-1' },
      { event: 'phase', phase: 'ready', startId: 'start-1' },
    ]);
    server.end({ kind: 'stopped' });
  });

  it('sends ready at once to a client that subscribes in ready', async () => {
    const { server } = await start();
    server.ready();

    await expect(subscribeToSupervisor(path)).resolves.toMatchObject({ phase: 'ready' });
    server.end({ kind: 'stopped' });
  });

  it.each<[string, ServerEnd, PhaseEvent]>([
    ['exit code 0', { kind: 'stopped' }, { event: 'phase', phase: 'stopped' }],
    [
      'exit code 10',
      { kind: 'aborted', refNo: 'R-ABCD-EFGH' },
      { event: 'phase', phase: 'aborted', startId: 'start-1', refNo: 'R-ABCD-EFGH' },
    ],
    [
      'exit code 10 without a start result of this start, with an own reference number',
      { kind: 'aborted', refNo: null },
      { event: 'phase', phase: 'aborted', startId: 'start-1', refNo: REF_NO },
    ],
    [
      'exit code 11',
      { kind: 'already_running' },
      { event: 'phase', phase: 'already_running', refNo: REF_NO },
    ],
  ])('reports the end by %s, frees the pipe and ends without a restart', async (_, end, event) => {
    const { server, phases, ended } = await start();
    const client = await subscriber(path);
    expect(await client.next()).toEqual({ event: 'phase', phase: 'starting', startId: 'start-1' });

    server.end(end);

    expect(await client.next()).toEqual(event);
    expect(await client.next()).toBe('closed');
    await ended;
    expect(phases.at(-1)).toEqual(event);
    expect(server.startIds).toHaveLength(1);
    expect(await subscribeToSupervisor(path)).toBeNull();
  });

  it.each<[string, Extract<ServerEnd, { kind: 'crashed' }>]>([
    ['exit code 1', { kind: 'crashed', exitCode: 1, signal: null }],
    ['exit code 12', { kind: 'crashed', exitCode: 12, signal: null }],
    ['a signal', { kind: 'crashed', exitCode: null, signal: 'SIGKILL' }],
  ])(
    'ends after a crash by %s without a restart and closes the pipe without a result (until #116)',
    async (_, end) => {
      const { server, ended } = await start();
      server.ready();
      const client = await subscriber(path);
      expect(await client.next()).toMatchObject({ phase: 'ready' });

      server.end(end);

      expect(await client.next()).toBe('closed');
      await ended;
      expect(server.startIds).toHaveLength(1);
      expect(await subscribeToSupervisor(path)).toBeNull();
    },
  );
});
