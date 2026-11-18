import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';
import { createReferenceNumber } from '@resellr/runtime-shared/reference-number';

import type { ChromeOpener } from './chrome-opener.ts';
import type { HealthClient } from './health-client.ts';
import type { LauncherLog } from './launcher-log.ts';
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
  launcherState: Pick<LauncherStateWriter, 'prepare' | 'ready' | 'aborted' | 'timeout'>;
  /** Writes `start_timeout` into the operations and the error log (CU-296, K-07). */
  log: Pick<LauncherLog, 'startTimeout'>;
  createRefNo?: () => string;
  /** Time-out of step 4, 120 s; the test hook `RESELLR_TEST_START_TIMEOUTS` shortens it. */
  startTimeoutMs?: number;
}

/** Waiting time after which `open` shows LP-01 (2.18 step 4). */
export const WAITING_PAGE_DELAY_MS = 3000;

/** Waiting time after which `open` reports `start_timeout` (2.18 step 4, K-07). */
export const START_TIMEOUT_MS = 120_000;

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
 *    through `launcher-state.js`, and the page goes on by itself. After 120 s without a result
 *    `open` writes `start_timeout` with a reference number of its own into both logs and `timeout`
 *    with this number for the page, which shows `LP-02.zeitueberschreitung` (K-07). It waits on;
 *    a later result reaches the page the same way.
 * 5. The wait ends at the latest with the start limit of 10 minutes in the supervisor (CU-264).
 *
 * Step 6 (fallback S-7) is not built: the spike confirmed the page change (Technical
 * Specification 9.2, S-7).
 */
export async function runOpenCommand(deps: OpenCommandDeps): Promise<LauncherExitCode> {
  if ((await deps.healthClient.getHealth()) === 'ready') {
    await deps.chromeOpener.open(deps.healthClient.appUrl);
    return LauncherExitCode.Success;
  }

  // The start the own supervisor watches, for the entry `start_timeout`; null while subscribed.
  let startId: string | null = null;
  const waitingPage = showWaitingPageLater(deps, () => startId);
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
        startId = event.startId ?? startId;
        // Showing the result must not end the supervisor, even if the browser cannot be started.
        if (shown === undefined && isStartResult(event)) {
          shown = showStartResult(deps, waitingPage, event).then(
            () => true,
            () => false,
          );
        }
      });
      if (outcome === 'taken') continue;
      // Without a result (e.g. the own supervisor ended with `stopped`) `open` showed nothing.
      return (await shown) ? LauncherExitCode.Success : LauncherExitCode.Failed;
    }
  } finally {
    void waitingPage.settle();
  }
}

/**
 * LP-01 of this call, opened once waiting takes longer than 3 s, and the time-out after 120 s
 * (2.18 step 4).
 */
interface WaitingPage {
  request: string;
  /**
   * Stops both timers and waits for a time-out being written, so the result comes after it;
   * resolves to true if LP-01 was opened, so the result has to go through `launcher-state.js`.
   * A page that is still opening reads the state on its first load.
   */
  settle(): Promise<boolean>;
}

function showWaitingPageLater(
  deps: OpenCommandDeps,
  currentStartId: () => string | null,
): WaitingPage {
  const { createRefNo = createReferenceNumber, startTimeoutMs = START_TIMEOUT_MS } = deps;
  const request = deps.newRequestId();
  let opened: Promise<boolean> | undefined;
  let timedOut: Promise<void> | undefined;

  // Without `launcher-state.js` LP-01 would not open; the result then opens directly.
  const openPage = () =>
    (opened ??= Promise.resolve()
      .then(() => deps.launcherState.prepare())
      .then(() => deps.chromeOpener.open(deps.waitingPageUrl(request)))
      .then(
        () => true,
        () => false,
      ));

  const reportTimeout = async () => {
    const refNo = createRefNo();
    // The page shows the number even if the log cannot be written, like for every other number.
    attempt(() => deps.log.startTimeout({ startId: currentStartId(), refNo }));
    // At the latest now LP-01 is open, also when the test hook makes the time-out shorter than 3 s.
    if (await openPage()) attempt(() => deps.launcherState.timeout(request, refNo));
  };

  const pageTimer = setTimeout(openPage, WAITING_PAGE_DELAY_MS);
  const timeoutTimer = setTimeout(() => {
    clearTimeout(pageTimer);
    timedOut = reportTimeout();
  }, startTimeoutMs);
  return {
    request,
    settle: async () => {
      clearTimeout(pageTimer);
      clearTimeout(timeoutTimer);
      await timedOut;
      return opened ?? false;
    },
  };
}

function attempt(write: () => void): void {
  try {
    write();
  } catch {
    // A full disk must not end the wait for the result.
  }
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
