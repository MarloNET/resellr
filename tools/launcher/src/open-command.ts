import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';

import type { ChromeOpener } from './chrome-opener.ts';
import type { HealthClient } from './health-client.ts';
import type { LauncherStateWriter } from './launcher-state-writer.ts';
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
  /** Identifier of this call; LP-01 reacts only to `launcher-state.js` with it (2.18 `request`). */
  newRequestId(): string;
  /** Address of LP-01 for this call (CU-310). */
  waitingPageUrl(request: string): string;
  /** Hands the result to an open LP-01 through `launcher-state.js` (CU-268). */
  launcherState: LauncherStateWriter;
}

/** Waiting time after which `open` shows LP-01 (2.18 step 4). */
export const WAITING_PAGE_DELAY_MS = 3000;

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
 * 4. If waiting takes longer than 3 s, `open` shows LP-01; the result then reaches the page
 *    through `launcher-state.js`, and the page goes on by itself.
 *
 * Steps 4 (time limit of 120 s) to 6 follow in #122.
 */
export async function runOpenCommand(deps: OpenCommandDeps): Promise<LauncherExitCode> {
  if ((await deps.healthClient.getHealth()) === 'ready') {
    await deps.chromeOpener.open(deps.healthClient.appUrl);
    return LauncherExitCode.Success;
  }

  const waitingPage = showWaitingPageLater(deps);
  try {
    let startedAfterStop = false;
    for (;;) {
      const result = await deps.subscribe();
      if (result !== null) {
        if (isStartResult(result)) {
          await showStartResult(deps, waitingPage, result);
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
          shown = showStartResult(deps, waitingPage, event).then(
            () => true,
            () => false,
          );
        }
      });
      if (outcome === 'taken') continue;
      // Without a result (e.g. a crash, no restart until #116) `open` showed nothing.
      return (await shown) ? LauncherExitCode.Success : LauncherExitCode.Failed;
    }
  } finally {
    void waitingPage.settle();
  }
}

/** LP-01 of this call, opened once waiting takes longer than 3 s (2.18 step 4). */
interface WaitingPage {
  request: string;
  /**
   * Stops the timer; resolves to true if LP-01 was opened, so the result has to go through
   * `launcher-state.js`. A page that is still opening reads the state on its first load.
   */
  settle(): Promise<boolean>;
}

function showWaitingPageLater(deps: OpenCommandDeps): WaitingPage {
  const request = deps.newRequestId();
  let opened: Promise<boolean> | undefined;
  const timer = setTimeout(() => {
    opened = deps.chromeOpener.open(deps.waitingPageUrl(request)).then(
      () => true,
      () => false,
    );
  }, WAITING_PAGE_DELAY_MS);
  return {
    request,
    settle: () => {
      clearTimeout(timer);
      return opened ?? Promise.resolve(false);
    },
  };
}

/** Shows what the result of a start asks for (2.18 step 2): the local address or LP-02. */
async function showStartResult(
  deps: OpenCommandDeps,
  waitingPage: WaitingPage,
  event: StartResultEvent,
): Promise<void> {
  const { healthClient, chromeOpener, launcherState } = deps;
  const pageOpen = await waitingPage.settle();
  const ready =
    event.phase === 'ready' ||
    // Another server runs: only the request of step 1 once more, without steps 2 and 3; any
    // answer but `ready` leads to LP-02 (DER-102-08, Nachtrag MAR-382).
    (event.phase === 'already_running' && (await healthClient.getHealth()) === 'ready');
  const refNo = event.refNo ?? null;

  if (pageOpen) {
    if (ready) launcherState.ready(waitingPage.request, healthClient.appUrl);
    else launcherState.aborted(waitingPage.request, refNo);
    return;
  }
  return chromeOpener.open(ready ? healthClient.appUrl : deps.startFailedPageUrl(refNo));
}
