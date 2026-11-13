import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { rmSync } from 'node:fs';
import { connect } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import type { ShutdownResponse } from '../health-client.ts';
import type { ServerEnd } from './server-process.ts';
import {
  type CrashReport,
  runSupervisor,
  STOP_TIMEOUT_MS,
  type SupervisorOptions,
} from './supervisor.ts';
import {
  listenSupervisorPipe,
  type PhaseEvent,
  requestStop,
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
  const signals: (AbortSignal | undefined)[] = [];
  const releases: (() => void)[] = [];
  return {
    durations,
    signals,
    pending: () => releases.length,
    release: () => releases.shift()?.(),
    sleep: (ms: number, signal?: AbortSignal) => {
      durations.push(ms);
      signals.push(signal);
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
    /** Log entries and reported phases in the order they happen. */
    const order: string[] = [];
    const logged: Record<string, unknown>[] = [];
    const log = (kind: string) => (entry: object) => {
      order.push(`log ${kind}`);
      logged.push({ kind, ...entry });
    };
    const waits = controlledWaits();
    const probes = fakeProbes();
    const summaries = { count: 0 };
    let startCount = 0;
    const ended = runSupervisor({
      pipe,
      startServer: server.startServer,
      onPhase: (event) => {
        phases.push(event);
        order.push(`phase ${event.phase}`);
      },
      createStartId: () => `start-${++startCount}`,
      createRefNo: () => REF_NO,
      now: () => SUPERVISOR_START,
      sleep: waits.sleep,
      onCrash: (crash) => {
        crashes.push(crash);
        order.push('log crash');
      },
      onStartAborted: log('start_aborted'),
      onGaveUp: log('gave_up'),
      onAlreadyRunning: log('already_running'),
      onStopCrash: log('stop_crash'),
      onShutdownTimeout: log('shutdown_timeout'),
      startHealthProbe: probes.start,
      summarizeAvailability: () => summaries.count++,
      ...options,
    });
    return { server, phases, crashes, order, logged, waits, probes, summaries, ended };
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

  it.each<[string, ServerEnd, Record<string, unknown>]>([
    [
      'exit code 10 with a start result of this start',
      { kind: 'aborted', refNo: 'R-ABCD-EFGH' },
      { kind: 'start_aborted', startId: 'start-1', refNo: 'R-ABCD-EFGH', cause: 'start_aborted' },
    ],
    [
      'exit code 10 without a start result of this start',
      { kind: 'aborted', refNo: null },
      { kind: 'start_aborted', startId: 'start-1', refNo: REF_NO, cause: 'start_result_missing' },
    ],
    [
      'exit code 11',
      { kind: 'already_running' },
      { kind: 'already_running', startId: 'start-1', refNo: REF_NO },
    ],
  ])(
    'DER-103-02 logs the reference number of %s before it reports the event',
    async (_, end, entry) => {
      const { server, order, logged, ended } = await start();

      server.end(end);
      await ended;

      expect(logged).toEqual([entry]);
      expect(order).toEqual(['phase starting', `log ${String(entry.kind)}`, `phase ${end.kind}`]);
    },
  );

  it('DER-103-06 logs start_aborted with an own reference number (launcher.start_limit) before it reports aborted, then ends without a restart', async () => {
    const { server, order, logged, phases, ended } = await start();
    const client = await subscriber(path);
    expect(await client.next()).toEqual({ event: 'phase', phase: 'starting', startId: 'start-1' });

    server.end({ kind: 'start_limit' });

    const aborted = { event: 'phase', phase: 'aborted', startId: 'start-1', refNo: REF_NO };
    expect(await client.next()).toEqual(aborted);
    expect(await client.next()).toBe('closed');
    await ended;
    expect(logged).toEqual([
      { kind: 'start_aborted', startId: 'start-1', refNo: REF_NO, cause: 'start_limit' },
    ]);
    expect(order).toEqual(['phase starting', 'log start_aborted', 'phase aborted']);
    expect(phases.at(-1)).toEqual(aborted);
    expect(server.startIds).toHaveLength(1);
    expect(await subscribeToSupervisor(path)).toBeNull();
  });

  it('reports aborted with its reference number also when writing the log fails', async () => {
    const { server, phases, ended } = await start({
      onStartAborted: () => {
        throw new Error('disk full');
      },
    });

    server.end({ kind: 'aborted', refNo: 'R-ABCD-EFGH' });
    await ended;

    expect(phases.at(-1)).toEqual({
      event: 'phase',
      phase: 'aborted',
      startId: 'start-1',
      refNo: 'R-ABCD-EFGH',
    });
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

  it('DER-103-03 restarts only as long as the restart rule allows, then logs crash and gave_up with numbers of their own, reports gave_up and ends', async () => {
    let allowed = 2;
    const refNos = ['R-0000-0001', 'R-0000-0002', 'R-0000-0003', 'R-0000-0004'];
    const { server, crashes, order, logged, waits, ended } = await start({
      restartPolicy: { mayRestart: () => allowed-- > 0 },
      createRefNo: () => refNos.shift()!,
    });
    const client = await subscriber(path);
    expect(await client.next()).toMatchObject({ phase: 'starting', startId: 'start-1' });

    for (let crash = 1; crash <= 3; crash++) {
      server.end({ kind: 'crashed', exitCode: 1, signal: null });
      await expect.poll(() => waits.pending()).toBe(1);
      waits.release();
      if (crash < 3) await expect.poll(() => server.startIds).toHaveLength(crash + 1);
    }

    await ended;
    // The last crash is logged too, with its own number (Nachtrag MAR-498).
    expect(crashes.map(({ startId, refNo }) => [startId, refNo])).toEqual([
      ['start-1', 'R-0000-0001'],
      ['start-2', 'R-0000-0002'],
      ['start-3', 'R-0000-0003'],
    ]);
    expect(logged).toEqual([
      { kind: 'gave_up', startId: 'start-3', refNo: 'R-0000-0004', at: CRASH_AT },
    ]);
    // `gave_up` is written before it goes out, after the crash of the last start.
    expect(order.slice(-3)).toEqual(['log crash', 'log gave_up', 'phase gave_up']);
    expect(server.startIds).toEqual(['start-1', 'start-2', 'start-3']);
    const events: unknown[] = [];
    for (let next = await client.next(); next !== 'closed'; next = await client.next()) {
      events.push(next);
    }
    expect(events.at(-1)).toEqual({
      event: 'phase',
      phase: 'gave_up',
      startId: 'start-3',
      refNo: 'R-0000-0004',
    });
    expect(await subscribeToSupervisor(path)).toBeNull();
  });

  it('reports gave_up also when writing it fails', async () => {
    const { server, phases, waits, ended } = await start({
      restartPolicy: { mayRestart: () => false },
      onGaveUp: () => {
        throw new Error('disk full');
      },
    });

    server.end({ kind: 'crashed', exitCode: 1, signal: null });
    await expect.poll(() => waits.pending()).toBe(1);
    waits.release();
    await ended;

    expect(phases.at(-1)).toEqual({
      event: 'phase',
      phase: 'gave_up',
      startId: 'start-1',
      refNo: REF_NO,
    });
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

  describe('stop over the pipe in ready (2.18 command stop)', () => {
    /** `POST /api/ops/shutdown` the test answers; `answer(response)` settles the open call. */
    function fakeShutdown() {
      const answers: ((response: ShutdownResponse | null) => void)[] = [];
      return {
        calls: () => answers.length,
        answer: (response: ShutdownResponse | null) => answers.at(-1)!(response),
        shutdownServer: () =>
          new Promise<ShutdownResponse | null>((resolve) => answers.push(resolve)),
      };
    }

    it('DER-104-01 sends POST /api/ops/shutdown, reports stopped to the stop client after the process end and ends without a restart', async () => {
      const shutdown = fakeShutdown();
      const { server, phases, ended } = await start({ shutdownServer: shutdown.shutdownServer });
      server.ready();
      const subscribed = await subscriber(path);
      expect(await subscribed.next()).toMatchObject({ phase: 'ready' });

      const stopped = requestStop(path);
      await expect.poll(shutdown.calls).toBe(1);
      shutdown.answer({ status: 200, body: { dataDirPath: 'C:\\Daten' }, refNo: null });
      // The server ends with exit code 0 after its answer (2.17 step 7).
      server.end({ kind: 'stopped' });

      await expect(stopped).resolves.toEqual({ event: 'phase', phase: 'stopped' });
      expect(await subscribed.next()).toEqual({ event: 'phase', phase: 'stopped' });
      await ended;
      expect(phases.at(-1)).toEqual({ event: 'phase', phase: 'stopped' });
      expect(server.startIds).toEqual(['start-1']);
      expect(await subscribeToSupervisor(path)).toBeNull();
    });

    it('sends POST /api/ops/shutdown once for two stop requests and answers both', async () => {
      const shutdown = fakeShutdown();
      const { server, ended } = await start({ shutdownServer: shutdown.shutdownServer });
      server.ready();

      const first = requestStop(path);
      const second = requestStop(path);
      await expect.poll(shutdown.calls).toBe(1);
      shutdown.answer({ status: 200, body: {}, refNo: null });
      server.end({ kind: 'stopped' });

      await expect(Promise.all([first, second])).resolves.toEqual([
        { event: 'phase', phase: 'stopped' },
        { event: 'phase', phase: 'stopped' },
      ]);
      expect(shutdown.calls()).toBe(1);
      await ended;
    });

    it('keeps waiting without a second POST /api/ops/shutdown when the connection breaks without an answer', async () => {
      const shutdown = fakeShutdown();
      const { server, phases, ended } = await start({ shutdownServer: shutdown.shutdownServer });
      server.ready();

      const stopped = requestStop(path);
      await expect.poll(shutdown.calls).toBe(1);
      shutdown.answer(null);
      void requestStop(path);
      server.end({ kind: 'stopped' });

      await expect(stopped).resolves.toEqual({ event: 'phase', phase: 'stopped' });
      await ended;
      expect(shutdown.calls()).toBe(1);
      expect(phases.map(({ phase }) => phase)).not.toContain('error');
    });

    it.each<[string, ShutdownResponse]>([
      ['403', { status: 403, body: {}, refNo: null }],
      ['500 without a valid reference number', { status: 500, body: {}, refNo: null }],
    ])(
      'DER-104-02 reports no error and sends no second POST /api/ops/shutdown on %s, but waits for the process end',
      async (_, response) => {
        const shutdown = fakeShutdown();
        const { server, phases, ended } = await start({ shutdownServer: shutdown.shutdownServer });
        server.ready();

        const stopped = requestStop(path);
        await expect.poll(shutdown.calls).toBe(1);
        shutdown.answer(response);
        void requestStop(path);
        server.end({ kind: 'stopped' });

        await expect(stopped).resolves.toEqual({ event: 'phase', phase: 'stopped' });
        await ended;
        expect(shutdown.calls()).toBe(1);
        expect(phases.map(({ phase }) => phase)).not.toContain('error');
      },
    );

    it('DER-104-02 reports error with the reference number of 500 internal_error and stays in ready', async () => {
      const shutdown = fakeShutdown();
      const { server, ended } = await start({ shutdownServer: shutdown.shutdownServer });
      server.ready();

      const stopped = requestStop(path);
      await expect.poll(shutdown.calls).toBe(1);
      shutdown.answer({ status: 500, body: {}, refNo: 'R-SRVR-0500' });

      await expect(stopped).resolves.toEqual({
        event: 'phase',
        phase: 'error',
        refNo: 'R-SRVR-0500',
      });
      // The server runs on: a new client sees ready, and a later stop asks the server again.
      await expect(subscribeToSupervisor(path)).resolves.toEqual({
        event: 'phase',
        phase: 'ready',
        startId: 'start-1',
      });
      const second = requestStop(path);
      await expect.poll(shutdown.calls).toBe(2);
      shutdown.answer({ status: 200, body: {}, refNo: null });
      server.end({ kind: 'stopped' });
      await expect(second).resolves.toEqual({ event: 'phase', phase: 'stopped' });
      await ended;
    });

    it('DER-104-02 logs and reports error with an own reference number when the server process still runs 30 s after the change to stopping', async () => {
      const shutdown = fakeShutdown();
      const { server, order, logged, waits, ended } = await start({
        shutdownServer: shutdown.shutdownServer,
      });
      server.ready();

      const stopped = requestStop(path);
      await expect.poll(shutdown.calls).toBe(1);
      shutdown.answer({ status: 200, body: {}, refNo: null });
      await expect.poll(() => waits.durations).toEqual([STOP_TIMEOUT_MS]);
      expect(STOP_TIMEOUT_MS).toBe(30_000);
      waits.release();

      await expect(stopped).resolves.toEqual({ event: 'phase', phase: 'error', refNo: REF_NO });
      expect(logged).toEqual([{ kind: 'shutdown_timeout', startId: 'start-1', refNo: REF_NO }]);
      expect(order.slice(-2)).toEqual(['log shutdown_timeout', 'phase error']);
      await expect(subscribeToSupervisor(path)).resolves.toMatchObject({ phase: 'ready' });
      // A late end of the server after the error is an ordinary end in ready.
      server.end({ kind: 'stopped' });
      await ended;
    });

    it('DER-104-02 applies the normal restart rule after error', async () => {
      const shutdown = fakeShutdown();
      const { server, waits, crashes, ended } = await start({
        shutdownServer: shutdown.shutdownServer,
      });
      server.ready();
      void requestStop(path);
      await expect.poll(shutdown.calls).toBe(1);
      shutdown.answer({ status: 500, body: {}, refNo: 'R-SRVR-0500' });
      await expect.poll(() => waits.pending()).toBe(1);

      server.end({ kind: 'crashed', exitCode: 1, signal: null });
      await expect.poll(() => waits.durations).toEqual([STOP_TIMEOUT_MS, 5000]);
      waits.release();
      waits.release();

      await expect.poll(() => server.startIds).toEqual(['start-1', 'start-2']);
      expect(crashes).toHaveLength(1);
      server.end({ kind: 'stopped' });
      await ended;
    });

    it('DER-104-04 keeps waiting on 503 shutting_down, reports no error and stopped after the process end', async () => {
      const shutdown = fakeShutdown();
      const { server, phases, logged, waits, ended } = await start({
        shutdownServer: shutdown.shutdownServer,
      });
      server.ready();

      const stopped = requestStop(path);
      await expect.poll(shutdown.calls).toBe(1);
      shutdown.answer({ status: 503, body: {}, refNo: null });
      server.end({ kind: 'stopped' });

      await expect(stopped).resolves.toEqual({ event: 'phase', phase: 'stopped' });
      await ended;
      expect(phases.map(({ phase }) => phase)).toEqual(['starting', 'ready', 'stopped']);
      expect(logged).toEqual([]);
      expect(server.startIds).toEqual(['start-1']);
      // The wait of 30 s ends with the process.
      expect(waits.signals[0]?.aborted).toBe(true);
    });

    it.each<[string, ServerEnd, { exitCode: number | null; signal: string | null }]>([
      [
        'exit code 1',
        { kind: 'crashed', exitCode: 1, signal: null },
        { exitCode: 1, signal: null },
      ],
      [
        'a signal',
        { kind: 'crashed', exitCode: null, signal: 'SIGKILL' },
        { exitCode: null, signal: 'SIGKILL' },
      ],
      ['exit code 10', { kind: 'aborted', refNo: null }, { exitCode: 10, signal: null }],
    ])(
      'DER-104-04 logs stop_crash with a reference number and reports stopped without a restart when the process ends in stopping by %s',
      async (_, end, exit) => {
        const shutdown = fakeShutdown();
        const { server, order, logged, crashes, waits, ended } = await start({
          shutdownServer: shutdown.shutdownServer,
        });
        server.ready();

        const stopped = requestStop(path);
        await expect.poll(shutdown.calls).toBe(1);
        shutdown.answer({ status: 503, body: {}, refNo: null });
        server.end(end);

        await expect(stopped).resolves.toEqual({ event: 'phase', phase: 'stopped' });
        await ended;
        expect(logged).toEqual([
          { kind: 'stop_crash', startId: 'start-1', refNo: REF_NO, ...exit },
        ]);
        expect(order.slice(-2)).toEqual(['log stop_crash', 'phase stopped']);
        expect(crashes).toEqual([]);
        expect(waits.durations).toEqual([STOP_TIMEOUT_MS]);
        expect(server.startIds).toEqual(['start-1']);
        expect(await subscribeToSupervisor(path)).toBeNull();
      },
    );
  });

  describe('stop over the pipe in the wait after a crash (crash_grace)', () => {
    it('DER-104-05 ends the wait, restarts nothing, writes no crash, reports stopped and ends', async () => {
      const { server, crashes, phases, waits, ended } = await start();
      server.ready();
      server.end({ kind: 'crashed', exitCode: 1, signal: null });
      await expect.poll(() => waits.pending()).toBe(1);

      await expect(requestStop(path)).resolves.toEqual({ event: 'phase', phase: 'stopped' });

      await ended;
      expect(waits.signals[0]?.aborted).toBe(true);
      expect(server.startIds).toEqual(['start-1']);
      expect(crashes).toEqual([]);
      expect(phases.at(-1)).toEqual({ event: 'phase', phase: 'stopped' });
      expect(await subscribeToSupervisor(path)).toBeNull();
    });
  });

  describe('stop over the pipe in starting (stop_pending)', () => {
    it('DER-104-06 waits for the running start and on ready sends POST /api/ops/shutdown, then reports stopped', async () => {
      const shutdown = {
        calls: 0,
        shutdownServer: async (): Promise<ShutdownResponse> => {
          shutdown.calls++;
          return { status: 200, body: {}, refNo: null };
        },
      };
      const { server, phases, probes, ended } = await start({
        shutdownServer: shutdown.shutdownServer,
      });

      const stopped = requestStop(path);
      await expect.poll(() => phases.length).toBe(1);
      // Wait until the supervisor has the request before the server reports ready.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(shutdown.calls).toBe(0);
      server.ready();
      await expect.poll(() => shutdown.calls).toBe(1);
      server.end({ kind: 'stopped' });

      await expect(stopped).resolves.toEqual({ event: 'phase', phase: 'stopped' });
      await ended;
      // The server is stopped at once: no ready goes out and no availability check starts.
      expect(phases.map(({ phase }) => phase)).toEqual(['starting', 'stopped']);
      expect(probes.started).toBe(0);
      expect(server.startIds).toEqual(['start-1']);
    });

    it.each<[string, ServerEnd, Record<string, unknown>[]]>([
      [
        'a crash, with stop_crash',
        { kind: 'crashed', exitCode: 1, signal: null },
        [{ kind: 'stop_crash', startId: 'start-1', refNo: REF_NO, exitCode: 1, signal: null }],
      ],
      // The cause of the abort stands in the entry of the server; no start_aborted (MAR-764).
      ['an abort (exit code 10), without an entry', { kind: 'aborted', refNo: 'R-ABCD-EFGH' }, []],
      [
        'the start limit, with stop_crash and its cause',
        { kind: 'start_limit' },
        [
          {
            kind: 'stop_crash',
            startId: 'start-1',
            refNo: REF_NO,
            exitCode: null,
            signal: null,
            cause: 'start_limit',
          },
        ],
      ],
    ])(
      'DER-104-06 reports stopped without a restart when the process ends by %s',
      async (_, end, entries) => {
        const { server, phases, crashes, logged, waits, ended } = await start();

        const stopped = requestStop(path);
        await new Promise((resolve) => setTimeout(resolve, 50));
        server.end(end);

        await expect(stopped).resolves.toEqual({ event: 'phase', phase: 'stopped' });
        await ended;
        expect(phases.map(({ phase }) => phase)).toEqual(['starting', 'stopped']);
        expect(server.startIds).toEqual(['start-1']);
        expect(waits.durations).toEqual([]);
        expect(crashes).toEqual([]);
        expect(logged).toEqual(entries);
        expect(await subscribeToSupervisor(path)).toBeNull();
      },
    );

    it('DER-104-07 logs and reports already_running with its reference number and ends when the process ends with exit code 11', async () => {
      const { server, order, logged, ended } = await start();

      const stopped = requestStop(path);
      await new Promise((resolve) => setTimeout(resolve, 50));
      server.end({ kind: 'already_running' });

      await expect(stopped).resolves.toEqual({
        event: 'phase',
        phase: 'already_running',
        refNo: REF_NO,
      });
      await ended;
      expect(logged).toEqual([{ kind: 'already_running', startId: 'start-1', refNo: REF_NO }]);
      expect(order).toEqual(['phase starting', 'log already_running', 'phase already_running']);
      expect(server.startIds).toEqual(['start-1']);
    });
  });
});
