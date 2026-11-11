import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';

import type { ChromeOpener } from './chrome-opener.ts';
import type { HealthClient } from './health-client.ts';
import type { PhaseEvent, SubscribeResult } from './supervisor/supervisor-pipe.ts';

export interface OpenCommandDeps {
  healthClient: Pick<HealthClient, 'appUrl' | 'getHealth'>;
  chromeOpener: ChromeOpener;
  /** Address of LP-02 with a reference number (CU-310). */
  startFailedPageUrl(refNo: string | null): string;
  /** Step 2: connect to the pipe and `subscribe`; null if no supervisor listens. */
  subscribe(): Promise<SubscribeResult | null>;
  /**
   * Step 3: open the pipe and run as supervisor until it ends; `taken` at once if another
   * process holds the pipe. `onPhase` gets every phase of the own supervisor.
   */
  becomeSupervisor(onPhase: (event: PhaseEvent) => void): Promise<'taken' | 'ended'>;
}

type StartResultEvent = PhaseEvent & { phase: 'ready' | 'aborted' | 'gave_up' | 'already_running' };

const isStartResult = (event: SubscribeResult): event is StartResultEvent =>
  event.phase === 'ready' ||
  event.phase === 'aborted' ||
  event.phase === 'gave_up' ||
  event.phase === 'already_running';

/**
 * Command `open` (CU-259, Technical Specification 2.18, flow `open` steps 1 to 3):
 *
 * 1. `GET /api/ops/health` with a time limit of 1 s; `ready` → Chrome with the local address.
 * 2. Otherwise connect to the pipe of the supervisor, `subscribe` and wait for the result.
 *    `stopped` or a pipe closed without a result lead to step 3, at most once.
 * 3. Otherwise open the pipe itself (if it is taken, back to step 2), start the server, wait for
 *    the result like in step 2 and run on as supervisor.
 *
 * Steps 4 to 6 (LP-01 after 3 s, time limit of 120 s) follow in #120 and #122.
 */
export async function runOpenCommand(deps: OpenCommandDeps): Promise<LauncherExitCode> {
  if ((await deps.healthClient.getHealth()) === 'ready') {
    await deps.chromeOpener.open(deps.healthClient.appUrl);
    return LauncherExitCode.Success;
  }

  let startedAfterStop = false;
  for (;;) {
    const result = await deps.subscribe();
    if (result !== null) {
      if (isStartResult(result)) {
        await showStartResult(deps, result);
        return LauncherExitCode.Success;
      }
      // `stopped` or closed without a result, e.g. just after "resellr beenden".
      if (startedAfterStop) return LauncherExitCode.Failed;
      startedAfterStop = true;
    }

    let shown: Promise<boolean> | undefined;
    const outcome = await deps.becomeSupervisor((event) => {
      // Showing the result must not end the supervisor, even if the browser cannot be started.
      if (shown === undefined && isStartResult(event)) {
        shown = showStartResult(deps, event).then(
          () => true,
          () => false,
        );
      }
    });
    if (outcome === 'taken') continue;
    // Without a result (e.g. the restart limit, `gave_up` follows in #121) `open` showed nothing.
    return (await shown) ? LauncherExitCode.Success : LauncherExitCode.Failed;
  }
}

/** Opens what the result of a start asks for (2.18 step 2). */
async function showStartResult(deps: OpenCommandDeps, event: StartResultEvent): Promise<void> {
  const { healthClient, chromeOpener } = deps;
  switch (event.phase) {
    case 'ready':
      return chromeOpener.open(healthClient.appUrl);
    case 'aborted':
    case 'gave_up':
      return chromeOpener.open(deps.startFailedPageUrl(event.refNo ?? null));
    case 'already_running':
      // Another server runs: only the request of step 1 once more, without steps 2 and 3; any
      // answer but `ready` leads to LP-02 (DER-102-08, Nachtrag MAR-382).
      if ((await healthClient.getHealth()) === 'ready')
        return chromeOpener.open(healthClient.appUrl);
      return chromeOpener.open(deps.startFailedPageUrl(event.refNo ?? null));
  }
}
