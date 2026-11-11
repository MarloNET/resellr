import { randomUUID } from 'node:crypto';

import { createReferenceNumber } from '@resellr/runtime-shared/reference-number';

import type { ServerEnd, ServerProcess } from './server-process.ts';
import type { PhaseEvent, SupervisorPipeServer } from './supervisor-pipe.ts';

export interface SupervisorOptions {
  /** The pipe this process holds; the supervisor closes it when it ends. */
  pipe: SupervisorPipeServer;
  /** Starts one run of `resellr-server` (CU-264). */
  startServer(input: { startId: string; onReady(): void }): ServerProcess;
  /** Called with every phase the supervisor reports, so an own `open` can act on it (2.18 step 3). */
  onPhase?(event: PhaseEvent): void;
  createStartId?: () => string;
  createRefNo?: () => string;
}

/**
 * Supervisor (CU-261, Technical Specification 2.18, state diagram "Lebenszyklus der
 * Überwachung"): `starting` until the server reports `ready` over IPC, then `ready`; every end of
 * the server process leads to `ended`, which frees the pipe. Who subscribes gets the current phase
 * at once and every later one.
 *
 * Every `aborted` and `already_running` carries a reference number (Nachtrag MAR-382); writing
 * it into the logs follows with CU-296 (#121). Not built yet: the restart rule after a crash (#116; until then a crash ends the supervisor
 * and the pipe closes without a result), the start limit of 10 min (#122) and the answer to
 * `stop` (#123, #124).
 */
export async function runSupervisor({
  pipe,
  startServer,
  onPhase,
  createStartId = randomUUID,
  createRefNo = createReferenceNumber,
}: SupervisorOptions): Promise<void> {
  const startId = createStartId();
  let current: PhaseEvent = { event: 'phase', phase: 'starting', startId };
  const report = (event: PhaseEvent) => {
    current = event;
    pipe.broadcast(event);
    onPhase?.(event);
  };

  pipe.onRequest((request, reply) => {
    if (request.cmd === 'subscribe') reply(current);
  });

  report(current);
  const server = startServer({
    startId,
    onReady: () => report({ event: 'phase', phase: 'ready', startId }),
  });

  const event = finalEvent(await server.ended, startId, createRefNo);
  if (event !== null) report(event);
  await pipe.close();
}

/** Event for the end of the server process (2.18 "Exit-Codes"); null after a crash. */
function finalEvent(end: ServerEnd, startId: string, createRefNo: () => string): PhaseEvent | null {
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
    case 'crashed':
      return null;
  }
}
