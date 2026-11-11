import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { rmSync } from 'node:fs';
import { connect } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import type { ServerEnd } from './server-process.ts';
import { type CrashReport, runSupervisor, type SupervisorOptions } from './supervisor.ts';
import {
  listenSupervisorPipe,
  type PhaseEvent,
  subscribeToSupervisor,
  supervisorPipePath,
} from './supervisor-pipe.ts';

const REF_NO = 'R-7K3M-Q9TX';
/** The clock of the supervisor stands still: every crash happens at this instant. */
const SUPERVISOR_START = new Date('2026-11-10T09:00:00.000Z');
const CRASH_AT = SUPERVISOR_START;

/** The wait after a crash, released by the test. */
function controlledWaits() {
  const durations: number[] = [];
  const releases: (() => void)[] = [];
  return {
    durations,
    pending: () => releases.length,
    release: () => releases.shift()?.(),
    sleep: (ms: number) => {
      durations.push(ms);
      return new Promise<void>((resolve) => releases.push(resolve));
    },
  };
}

/** Availability check the test drives: `check(at)` reports a check at that instant. */
function fakeProbes() {
  let onProbe: (at: Date) => void = () => {};
  const probes = {
    started: 0,
    stopped: 0,
    check: (at: Date) => onProbe(at),
    start: (callback: (at: Date) => void) => {
      probes.started++;
      onProbe = callback;
      return { stop: () => void probes.stopped++ };
    },
  };
  return probes;
}

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

  async function start(options: Partial<SupervisorOptions> = {}) {
    path = supervisorPipePath(`/tmp/resellr-test-${randomUUID()}`);
    const pipe = (await listenSupervisorPipe(path))!;
    const server = fakeServer();
    const phases: PhaseEvent[] = [];
    const crashes: CrashReport[] = [];
    const waits = controlledWaits();
    const probes = fakeProbes();
    const summaries = { count: 0 };
    let startCount = 0;
    const ended = runSupervisor({
      pipe,
      startServer: server.startServer,
      onPhase: (event) => phases.push(event),
      createStartId: () => `start-${++startCount}`,
      createRefNo: () => REF_NO,
      now: () => SUPERVISOR_START,
      sleep: waits.sleep,
      onCrash: (crash) => crashes.push(crash),
      startHealthProbe: probes.start,
      summarizeAvailability: () => summaries.count++,
      ...options,
    });
    return { server, phases, crashes, waits, probes, summaries, ended };
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
    'after a crash by %s waits 5 s, writes crash with a reference number and restarts with a new startId',
    async (_, end) => {
      const { server, phases, crashes, waits, ended } = await start();
      server.ready();

      server.end(end);
      await expect.poll(() => waits.pending()).toBe(1);
      // Nothing is written during the wait: if the supervisor ends now, no crash is logged.
      expect(crashes).toEqual([]);
      expect(server.startIds).toEqual(['start-1']);
      expect(waits.durations).toEqual([5000]);

      waits.release();
      await expect.poll(() => server.startIds).toEqual(['start-1', 'start-2']);
      expect(crashes).toEqual([
        {
          startId: 'start-1',
          refNo: REF_NO,
          at: CRASH_AT,
          exitCode: end.exitCode,
          signal: end.signal,
        },
      ]);
      server.ready();
      expect(phases).toEqual([
        { event: 'phase', phase: 'starting', startId: 'start-1' },
        { event: 'phase', phase: 'ready', startId: 'start-1' },
        // In the wait after the crash a new subscriber waits instead of opening a dead address.
        { event: 'phase', phase: 'starting' },
        { event: 'phase', phase: 'starting', startId: 'start-2' },
        { event: 'phase', phase: 'ready', startId: 'start-2' },
      ]);
      server.end({ kind: 'stopped' });
      await ended;
    },
  );

  it('sends starting to a client that subscribes in the wait after a crash', async () => {
    const { server, waits, ended } = await start();
    server.ready();
    server.end({ kind: 'crashed', exitCode: 1, signal: null });
    await expect.poll(() => waits.pending()).toBe(1);

    const client = await subscriber(path);

    expect(await client.next()).toEqual({ event: 'phase', phase: 'starting' });
    waits.release();
    expect(await client.next()).toEqual({ event: 'phase', phase: 'starting', startId: 'start-2' });
    server.ready();
    expect(await client.next()).toEqual({ event: 'phase', phase: 'ready', startId: 'start-2' });
    server.end({ kind: 'stopped' });
    await ended;
  });

  it('restarts only as long as the restart rule allows and then ends without a restart', async () => {
    let allowed = 2;
    const { server, crashes, waits, ended } = await start({
      restartPolicy: { mayRestart: () => allowed-- > 0 },
    });

    for (let crash = 1; crash <= 3; crash++) {
      server.end({ kind: 'crashed', exitCode: 1, signal: null });
      await expect.poll(() => waits.pending()).toBe(1);
      waits.release();
      if (crash < 3) await expect.poll(() => server.startIds).toHaveLength(crash + 1);
    }

    await ended;
    // The third crash is logged too; `gave_up` with its reference number follows in #121.
    expect(crashes.map((crash) => crash.startId)).toEqual(['start-1', 'start-2', 'start-3']);
    expect(server.startIds).toEqual(['start-1', 'start-2', 'start-3']);
    expect(await subscribeToSupervisor(path)).toBeNull();
  });

  it('keeps the restart going when writing the crash fails', async () => {
    const { server, waits, ended } = await start({
      onCrash: () => {
        throw new Error('disk full');
      },
    });

    server.end({ kind: 'crashed', exitCode: 1, signal: null });
    await expect.poll(() => waits.pending()).toBe(1);
    waits.release();

    await expect.poll(() => server.startIds).toHaveLength(2);
    server.end({ kind: 'stopped' });
    await ended;
  });

  it('runs the availability check only while the server is ready', async () => {
    const { server, probes, waits, ended } = await start();
    expect(probes.started).toBe(0);

    server.ready();
    expect(probes.started).toBe(1);
    server.end({ kind: 'crashed', exitCode: 1, signal: null });
    await expect.poll(() => probes.stopped).toBe(1);

    await expect.poll(() => waits.pending()).toBe(1);
    waits.release();
    await expect.poll(() => server.startIds).toHaveLength(2);
    server.ready();
    expect(probes.started).toBe(2);
    server.end({ kind: 'stopped' });
    await ended;
    expect(probes.stopped).toBe(2);
  });

  it('summarises the missing days at its start and at the first check after midnight', async () => {
    const { server, probes, summaries, ended } = await start();
    expect(summaries.count).toBe(1);
    server.ready();

    probes.check(new Date('2026-11-10T21:00:00.000Z')); // 22:00 in Berlin, same day
    expect(summaries.count).toBe(1);
    probes.check(new Date('2026-11-10T23:01:00.000Z')); // 0:01 in Berlin, next day
    probes.check(new Date('2026-11-10T23:06:00.000Z'));
    expect(summaries.count).toBe(2);

    server.end({ kind: 'stopped' });
    await ended;
  });

  it('keeps running when the daily summary fails', async () => {
    const { server, ended } = await start({
      summarizeAvailability: () => {
        throw new Error('disk full');
      },
    });

    server.ready();
    server.end({ kind: 'stopped' });
    await expect(ended).resolves.toBeUndefined();
  });
});
