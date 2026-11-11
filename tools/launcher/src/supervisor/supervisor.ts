import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { createReferenceNumber } from '@resellr/runtime-shared/reference-number';

import { berlinDay } from '../availability/availability-aggregator.ts';
import type { HealthProbe } from '../health-probe.ts';
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
 * `startId`, at most 3 times in 10 minutes (CU-262); after that it ends without a restart. Every
 * other end of the server leads to `ended`, which frees the pipe.
 *
 * It summarises the days of the availability at its start and at the first check after
 * midnight (2.18 "Verfügbarkeitsauswertung").
 *
 * Every `aborted` and `already_running` carries a reference number (Nachtrag MAR-382); writing
 * it into the logs follows with CU-296 (#121), like `gave_up` after the restart limit. Not built
 * yet: the start limit of 10 min (#122) and the answer to `stop` (#123, #124).
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

  // Neither the summary nor a log entry may end the supervisor; the next run tries again.
  const summarize = () => {
    try {
      summarizeAvailability();
    } catch {
      // ignored
    }
  };
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
      report(finalEvent(end, startId, createRefNo));
      break;
    }

    // `crash_grace`: no server runs; a client that subscribes now waits for the restart.
    const crashedAt = now();
    report({ event: 'phase', phase: 'starting' });
    await sleep(CRASH_GRACE_MS);
    try {
      onCrash({
        startId,
        refNo: createRefNo(),
        at: crashedAt,
        exitCode: end.exitCode,
        signal: end.signal,
      });
    } catch {
      // A full disk must not stop the restart.
    }
    if (!restartPolicy.mayRestart()) break;
  }
  await pipe.close();
}

/** Event for an end of the server process that is no crash (2.18 "Exit-Codes"). */
function finalEvent(
  end: Exclude<ServerEnd, { kind: 'crashed' }>,
  startId: string,
  createRefNo: () => string,
): PhaseEvent {
  switch (end.kind) {
    case 'stopped':
      return { event: 'phase', phase: 'stopped' };
    case 'aborted':
      // Without a start result of this start the supervisor gives its own number, because LP-02
      // always shows one (Nachtrag MAR-382); until #132 the server writes no start result.
      return { event: 'phase', phase: 'aborted', startId, refNo: end.refNo ?? createRefNo() };
    case 'already_running':
      // Reference number of the warning, shown by LP-02 if no server answers (DER-102-08).
      return { event: 'phase', phase: 'already_running', refNo: createRefNo() };
  }
}
