import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { createReferenceNumber } from '@resellr/runtime-shared/reference-number';

import { berlinDay } from '../availability/availability-aggregator.ts';
import type { HealthProbe } from '../health-probe.ts';
import type { ShownRefNo, StartAbortCause } from '../launcher-log.ts';
import { CRASH_GRACE_MS, createRestartPolicy, type RestartPolicy } from './restart-policy.ts';
import type { ServerEnd, ServerProcess } from './server-process.ts';
import type { PhaseEvent, SupervisorPipeServer } from './supervisor-pipe.ts';

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
  /** The wait after a crash; tests replace it. */
  sleep?: (ms: number) => Promise<void>;
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
  /** Starts the availability check (CU-265) while the server is `ready`. */
  startHealthProbe?(onProbe: (at: Date) => void): HealthProbe;
  /** Summarises the missing days of the availability (CU-269). */
  summarizeAvailability?(): void;
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
 * without a restart (2.18 step 5, K-07). Not built yet: the answer to `stop` (#123, #124).
 */
export async function runSupervisor({
  pipe,
  startServer,
  onPhase,
  createStartId = randomUUID,
  createRefNo = createReferenceNumber,
  restartPolicy = createRestartPolicy(),
  sleep = (ms) => delay(ms),
  now = () => new Date(),
  onCrash = () => {},
  onStartAborted = () => {},
  onGaveUp = () => {},
  onAlreadyRunning = () => {},
  startHealthProbe,
  summarizeAvailability = () => {},
}: SupervisorOptions): Promise<void> {
  let current: PhaseEvent = { event: 'phase', phase: 'starting' };
  const report = (event: PhaseEvent) => {
    current = event;
    pipe.broadcast(event);
    onPhase?.(event);
  };

  pipe.onRequest((request, reply) => {
    if (request.cmd === 'subscribe') reply(current);
  });

  // Neither the summary nor a log entry may end the supervisor or hold back an event.
  const attempt = (write: () => void) => {
    try {
      write();
    } catch {
      // A full disk must not stop the supervisor; the next run tries again.
    }
  };
  const summarize = () => attempt(summarizeAvailability);
  let summarizedDay = berlinDay(now().getTime());
  summarize();
  const onProbe = (at: Date) => {
    const day = berlinDay(at.getTime());
    if (day === summarizedDay) return;
    summarizedDay = day;
    summarize();
  };

  for (;;) {
    const startId = createStartId();
    report({ event: 'phase', phase: 'starting', startId });
    let probe: HealthProbe | undefined;
    const server = startServer({
      startId,
      onReady: () => {
        report({ event: 'phase', phase: 'ready', startId });
        probe = startHealthProbe?.(onProbe);
      },
    });

    const end = await server.ended;
    probe?.stop();
    if (end.kind !== 'crashed') {
      report(logFinalEnd(end, startId));
      break;
    }

    // `crash_grace`: no server runs; a client that subscribes now waits for the restart.
    const crashedAt = now();
    report({ event: 'phase', phase: 'starting' });
    await sleep(CRASH_GRACE_MS);
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
