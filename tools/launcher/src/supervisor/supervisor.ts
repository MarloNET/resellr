import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { ExitCode } from '@resellr/runtime-shared/exit-codes';
import { createReferenceNumber } from '@resellr/runtime-shared/reference-number';

import { berlinDay } from '../availability/availability-aggregator.ts';
import type { ShutdownResponse } from '../health-client.ts';
import type { HealthProbe } from '../health-probe.ts';
import type { ShownRefNo, StartAbortCause, StopCrashEntry } from '../launcher-log.ts';
import { CRASH_GRACE_MS, createRestartPolicy, type RestartPolicy } from './restart-policy.ts';
import type { ServerEnd, ServerProcess } from './server-process.ts';
import type { PhaseEvent, SupervisorPipeServer } from './supervisor-pipe.ts';

/**
 * Longest wait in `stopping` for the end of the server process; after it the stop has failed
 * (2.18 command `stop`, FIND-234).
 */
export const STOP_TIMEOUT_MS = 30_000;

/** States of the supervisor (2.18 state diagram "Lebenszyklus der Überwachung"). */
type SupervisorState = 'starting' | 'ready' | 'crash_grace' | 'stop_pending' | 'stopping';

/** A crash that outlasted the wait of 5 s (2.18 "Absturz und Neustartgrenze"). */
export interface CrashReport {
  /** Start of the server run that crashed. */
  startId: string;
  refNo: string;
  /** When the server process ended. */
  at: Date;
  exitCode: number | null;
  signal: string | null;
}

export interface SupervisorOptions {
  /** The pipe this process holds; the supervisor closes it when it ends. */
  pipe: SupervisorPipeServer;
  /** Starts one run of `resellr-server` (CU-264). */
  startServer(input: { startId: string; onReady(): void }): ServerProcess;
  /** Called with every phase the supervisor reports, so an own `open` can act on it (2.18 step 3). */
  onPhase?(event: PhaseEvent): void;
  createStartId?: () => string;
  createRefNo?: () => string;
  /** Restart rule after a crash (CU-262). */
  restartPolicy?: RestartPolicy;
  /** The wait after a crash and in `stopping`; ends early when `signal` aborts. Tests replace it. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => Date;
  /** Writes `crash` with its reference number (CU-296) and `state.json.lastCrashAt` (CU-009). */
  onCrash?(crash: CrashReport): void;
  /**
   * Writes `start_aborted` (CU-296), before `aborted` goes out (Nachtrag MAR-498); for the start
   * limit also `start-result.json` with `aborted` (K-07).
   */
  onStartAborted?(entry: ShownRefNo & { startId: string; cause: StartAbortCause }): void;
  /**
   * Writes `gave_up` (CU-296) and `start-result.json` with `state: gave_up` (CU-009), before
   * `gave_up` goes out (Nachtrag MAR-498).
   */
  onGaveUp?(entry: ShownRefNo & { startId: string; at: Date }): void;
  /** Writes the warning `already_running` (CU-296), before it goes out (Nachtrag MAR-382). */
  onAlreadyRunning?(entry: ShownRefNo & { startId: string }): void;
  /**
   * Writes `stop_crash` (CU-296): the server ended after `stop` with a code other than 0 (in
   * `stop_pending` other than 10 and 11) or by the start limit (FIND-234, Nachtrag MAR-764).
   */
  onStopCrash?(entry: StopCrashEntry): void;
  /**
   * Writes `shutdown_failed` (CU-296), before `error` goes out: the server process still runs
   * 30 s after the change to `stopping` (Nachtrag MAR-764).
   */
  onShutdownTimeout?(entry: ShownRefNo & { startId: string }): void;
  /** Starts the availability check (CU-265) while the server is `ready`. */
  startHealthProbe?(onProbe: (at: Date) => void): HealthProbe;
  /** Summarises the missing days of the availability (CU-269). */
  summarizeAvailability?(): void;
  /**
   * `POST /api/ops/shutdown` to the own server (CU-266), the answer to `stop` in `ready`; `signal`
   * aborts the request when `stopping` ends, at the latest after 30 s (Nachtrag MAR-764).
   */
  shutdownServer?(signal: AbortSignal): Promise<ShutdownResponse | null>;
}

/**
 * Supervisor (CU-261, Technical Specification 2.18, state diagram "Lebenszyklus der
 * Überwachung"): `starting` until the server reports `ready` over IPC, then `ready` with the
 * availability check every 5 minutes. Who subscribes gets the current phase at once and every
 * later one.
 *
 * After a crash (every exit code but 0, 10 and 11) it waits 5 s (`crash_grace`). If it ends
 * itself in that time (logging off, shutting down), nothing is written. Otherwise it writes
 * `crash` with a reference number and `state.json.lastCrashAt` and restarts the server with a new
 * `startId`, at most 3 times in 10 minutes (CU-262). The fourth crash in the window is written as
 * `crash` too; then it writes `gave_up` with another reference number and reports it, without a
 * restart (Nachtrag MAR-498). Every other end of the server leads to `ended`, which frees the pipe.
 *
 * It summarises the days of the availability at its start and at the first check after
 * midnight (2.18 "Verfügbarkeitsauswertung").
 *
 * Every `aborted`, `gave_up` and `already_running` carries a reference number (Nachtrag MAR-382);
 * the supervisor writes it into the logs before it reports the event, so a number LP-02 shows is
 * already logged (FIND-210, Nachtrag MAR-498). A start without `ready` within the start limit of
 * 10 minutes (CU-264) is reported as `aborted` with a number of its own and ends the supervisor
 * without a restart (2.18 step 5, K-07).
 *
 * `stop` over the pipe (2.18 command `stop`, FIND-233, FIND-234, Nachtrag MAR-764) depends on
 * the state:
 * - `ready`: `stopping`, `POST /api/ops/shutdown` once. Every end of the server process then
 *   reports `stopped` and ends the supervisor without a restart; with a code other than 0 it
 *   writes `stop_crash` with a reference number first. `503 shutting_down` (the stop already runs,
 *   e.g. from UI-045), every other answer and none at all change nothing. `500` with a valid
 *   reference number reports `error` with it; a server process that still runs 30 s after the
 *   change writes `shutdown_failed` with an own number and reports `error` with that. After
 *   `error` the supervisor is back in `ready` with the normal restart rule. The request ends with
 *   `stopping`, at the latest after 30 s.
 * - `starting`: `stop_pending`, no restart any more. On `ready` it goes on as in `ready` without
 *   reporting `ready`; only after `error` it reports `ready` and starts the availability check.
 *   Every end of the process reports `stopped`, exit code 11 `already_running`.
 *   A crash and the start limit write `stop_crash`; exit code 10 writes nothing (no
 *   `start_aborted`), the server has logged its cause.
 * - `crash_grace` (no server runs): the wait ends, no restart, no `crash`, `stopped`.
 *
 * Every client that sent `stop` gets the phases from then on, so it learns the result.
 */
export async function runSupervisor({
  pipe,
  startServer,
  onPhase,
  createStartId = randomUUID,
  createRefNo = createReferenceNumber,
  restartPolicy = createRestartPolicy(),
  sleep = (ms, signal) => delay(ms, undefined, { signal }),
  now = () => new Date(),
  onCrash = () => {},
  onStartAborted = () => {},
  onGaveUp = () => {},
  onAlreadyRunning = () => {},
  onStopCrash = () => {},
  onShutdownTimeout = () => {},
  startHealthProbe,
  summarizeAvailability = () => {},
  shutdownServer,
}: SupervisorOptions): Promise<void> {
  let current: PhaseEvent = { event: 'phase', phase: 'starting' };
  /** Clients that sent `stop`; they get every later phase like a subscriber. */
  const stopClients: ((event: PhaseEvent) => void)[] = [];
  const report = (event: PhaseEvent) => {
    current = event;
    pipe.broadcast(event);
    for (const reply of stopClients) reply(event);
    onPhase?.(event);
  };

  // Neither the summary nor a log entry may end the supervisor or hold back an event.
  const attempt = (write: () => void) => {
    try {
      write();
    } catch {
      // A full disk must not stop the supervisor; the next run tries again.
    }
  };

  let state: SupervisorState = 'starting';
  /** The availability check of the current server run, while it is `ready`. */
  let probe: HealthProbe | undefined;
  /** The server run whose `ready` has gone out; a stop that failed does not report it again. */
  let readyStartId: string | undefined;
  /** Ends the wait of the current `crash_grace` or `stopping`. */
  let waitAbort = new AbortController();
  /** Resolves with false after `ms`, with true as soon as the wait is aborted. */
  const waitUnlessAborted = (ms: number, signal: AbortSignal) =>
    new Promise<boolean>((resolve) => {
      signal.addEventListener('abort', () => resolve(true), { once: true });
      sleep(ms, signal).then(
        () => resolve(false),
        () => resolve(true),
      );
    });

  /** `stopping` (FIND-234): one `POST /api/ops/shutdown`; `error` only on 500 or after 30 s. */
  const enterStopping = (startId: string) => {
    state = 'stopping';
    const abort = new AbortController();
    waitAbort = abort;
    const fail = (refNo: string) => {
      if (state !== 'stopping' || waitAbort !== abort) return;
      abort.abort();
      report({ event: 'phase', phase: 'error', refNo });
      // Those clients have their answer; from now on the server runs on in `ready`.
      stopClients.length = 0;
      enterReady(startId);
    };
    void waitUnlessAborted(STOP_TIMEOUT_MS, abort.signal).then((aborted) => {
      if (aborted) return;
      const refNo = createRefNo();
      attempt(() => onShutdownTimeout({ startId, refNo }));
      fail(refNo);
    });
    // Only a 500 with a valid reference number fails at once; 200, 503, every other answer and
    // none at all wait for the end of the process or the 30 s (Nachtrag MAR-764).
    void shutdownServer?.(abort.signal).then(
      (response) => {
        if (response?.status === 500 && response.refNo !== null) fail(response.refNo);
      },
      () => {},
    );
  };

  pipe.onRequest((request, reply) => {
    if (request.cmd === 'subscribe') {
      reply(current);
      return;
    }
    stopClients.push(reply);
    switch (state) {
      case 'ready':
        enterStopping(current.startId ?? '');
        return;
      case 'starting':
        state = 'stop_pending';
        return;
      case 'crash_grace':
        waitAbort.abort();
        return;
      // `stop_pending` and `stopping`: the stop already runs.
    }
  });

  const summarize = () => attempt(summarizeAvailability);
  let summarizedDay = berlinDay(now().getTime());
  summarize();
  const onProbe = (at: Date) => {
    const day = berlinDay(at.getTime());
    if (day === summarizedDay) return;
    summarizedDay = day;
    summarize();
  };

  /**
   * `ready`: reports it and starts the availability check, once per server run. After a failed
   * stop from `stop_pending` this is the first `ready` of the run, so waiting clients get it.
   */
  function enterReady(startId: string) {
    state = 'ready';
    if (readyStartId === startId) {
      current = { event: 'phase', phase: 'ready', startId };
      return;
    }
    readyStartId = startId;
    report({ event: 'phase', phase: 'ready', startId });
    probe = startHealthProbe?.(onProbe);
  }

  for (;;) {
    const startId = createStartId();
    state = 'starting';
    report({ event: 'phase', phase: 'starting', startId });
    const server = startServer({
      startId,
      onReady: () => {
        if (state === 'stop_pending') {
          enterStopping(startId);
          return;
        }
        enterReady(startId);
      },
    });

    const end = await server.ended;
    probe?.stop();
    probe = undefined;
    // `stop` and `onReady` have changed the state while the server ran.
    const endState = state as SupervisorState;
    if (endState === 'stopping' || endState === 'stop_pending') {
      waitAbort.abort();
      report(logStopEnd(end, startId, endState));
      break;
    }
    if (end.kind !== 'crashed') {
      report(logFinalEnd(end, startId));
      break;
    }

    // `crash_grace`: no server runs; a client that subscribes now waits for the restart.
    state = 'crash_grace';
    waitAbort = new AbortController();
    const crashedAt = now();
    report({ event: 'phase', phase: 'starting' });
    if (await waitUnlessAborted(CRASH_GRACE_MS, waitAbort.signal)) {
      // `stop` ended the wait: no server runs, nothing to restart and no crash to write.
      report({ event: 'phase', phase: 'stopped' });
      break;
    }
    attempt(() =>
      onCrash({
        startId,
        refNo: createRefNo(),
        at: crashedAt,
        exitCode: end.exitCode,
        signal: end.signal,
      }),
    );
    if (!restartPolicy.mayRestart()) {
      // The decision not to restart gets a number of its own; LP-02 shows it (Nachtrag MAR-498).
      const refNo = createRefNo();
      attempt(() => onGaveUp({ startId, refNo, at: now() }));
      report({ event: 'phase', phase: 'gave_up', startId, refNo });
      break;
    }
  }
  await pipe.close();

  /**
   * Logs an end of the server process after `stop` and returns its event: `stopped`, in
   * `stop_pending` with exit code 11 `already_running` (2.18 command `stop`, FIND-233, FIND-234,
   * Nachtrag MAR-764).
   */
  function logStopEnd(
    end: ServerEnd,
    startId: string,
    stopState: 'stop_pending' | 'stopping',
  ): PhaseEvent {
    if (stopState === 'stop_pending' && end.kind === 'already_running') {
      return logFinalEnd(end, startId);
    }
    const exit = stopCrashOf(end, stopState);
    if (exit !== null) attempt(() => onStopCrash({ startId, refNo: createRefNo(), ...exit }));
    return { event: 'phase', phase: 'stopped' };
  }

  /** Logs an end of the server process that is no crash and returns its event (2.18 "Exit-Codes"). */
  function logFinalEnd(end: Exclude<ServerEnd, { kind: 'crashed' }>, startId: string): PhaseEvent {
    switch (end.kind) {
      case 'stopped':
        return { event: 'phase', phase: 'stopped' };
      case 'aborted': {
        // Without a start result of this start the supervisor gives its own number, because LP-02
        // always shows one (Nachtrag MAR-382); until #132 the server writes no start result.
        const refNo = end.refNo ?? createRefNo();
        const cause = end.refNo === null ? 'start_result_missing' : 'start_aborted';
        attempt(() => onStartAborted({ startId, refNo, cause }));
        return { event: 'phase', phase: 'aborted', startId, refNo };
      }
      case 'start_limit': {
        // No `ready` within 10 minutes: a number of its own, like for every abort (K-07).
        const refNo = createRefNo();
        attempt(() => onStartAborted({ startId, refNo, cause: 'start_limit' }));
        return { event: 'phase', phase: 'aborted', startId, refNo };
      }
      case 'already_running': {
        // Reference number of the warning, shown by LP-02 if no server answers (DER-102-08).
        const refNo = createRefNo();
        attempt(() => onAlreadyRunning({ startId, refNo }));
        return { event: 'phase', phase: 'already_running', refNo };
      }
    }
  }
}

/**
 * The end after `stop` that `stop_crash` records, null for none: in `stopping` every exit code but
 * 0; in `stop_pending` every one but 0, 10 and 11, and the start limit (Nachtrag MAR-764). Exit
 * code 10 has its cause in the entry of the server and in `start-result.json`.
 */
function stopCrashOf(
  end: ServerEnd,
  stopState: 'stop_pending' | 'stopping',
): Omit<StopCrashEntry, 'startId' | 'refNo'> | null {
  switch (end.kind) {
    case 'stopped':
      return null;
    case 'aborted':
      return stopState === 'stopping' ? { exitCode: ExitCode.StartAborted, signal: null } : null;
    case 'already_running':
      return { exitCode: ExitCode.AlreadyRunning, signal: null };
    case 'start_limit':
      // CU-264 ended the process, whatever exit code followed.
      return { exitCode: null, signal: null, cause: 'start_limit' };
    case 'crashed':
      return { exitCode: end.exitCode, signal: end.signal };
  }
}
