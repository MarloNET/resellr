import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';

import type { ChromeOpener } from './chrome-opener.ts';
import type { HealthClient } from './health-client.ts';
import type { LauncherStateWriter } from './launcher-state-writer.ts';
import type { SubscribeResult } from './supervisor/supervisor-pipe.ts';

export interface StopCommandDeps {
  /** `stop --for-update`: no page; waits for the free pipe afterwards (2.18). */
  forUpdate: boolean;
  /** Data folder of the launcher's runtime paths (CU-005), shown by `LP-03.success`. */
  dataDir: string;
  /** Sends `stop` over the pipe and waits for the result; null if no supervisor listens. */
  stopSupervisor(): Promise<SubscribeResult | null>;
  /** `POST /api/ops/shutdown` to the port of `config.json` (CU-266, CU-309). */
  healthClient: Pick<HealthClient, 'shutdown'>;
  /** True once no supervisor holds the pipe, false if it is still held after `timeoutMs`. */
  waitForFreePipe(timeoutMs: number): Promise<boolean>;
  chromeOpener: ChromeOpener;
  /** Identifier of this call; LP-03 reacts only to `launcher-state.js` with it (2.18 `request`). */
  newRequestId(): string;
  /** Address of LP-03 for this call (CU-310). */
  resultPageUrl(request: string): string;
  /** Hands the result to the open LP-03 through `launcher-state.js` (CU-268). */
  launcherState: Pick<LauncherStateWriter, 'prepare' | 'stopped' | 'error' | 'notRunning'>;
}

/** Longest wait of `stop --for-update` for the free pipe of the supervisor (2.18, FIND-217). */
export const FREE_PIPE_TIMEOUT_MS = 30_000;

/** Result of stopping, as LP-03 shows it (2.18 "Launcher-Seiten"). */
type StopOutcome =
  | { state: 'stopped'; overPipe: boolean }
  | { state: 'error'; refNo: string | null }
  | { state: 'not_running' };

/**
 * Command `stop` and `stop --for-update` (CU-260, Technical Specification 2.18, command table):
 *
 * 1. `stop` creates `launcher-state.js` (CU-268) and opens LP-03 in the state `loading`;
 *    `--for-update` opens no page.
 * 2. If a supervisor listens on the pipe, it sends `{"cmd":"stop"}` and waits for `stopped` or
 *    `error`. Otherwise, and if the supervisor ends without either, it sends
 *    `POST /api/ops/shutdown` directly; no answer means resellr does not run.
 * 3. `stop` writes the result for LP-03: `stopped` with the data folder, `error` with the
 *    reference number or `not_running`.
 * 4. `--for-update` waits after `stopped` over the pipe until the pipe is free, at most 30 s.
 *
 * Exit code 0: stopped or not running; 1: stopping failed or the pipe is still held after 30 s.
 */
export async function runStopCommand(deps: StopCommandDeps): Promise<LauncherExitCode> {
  const request = deps.forUpdate ? null : deps.newRequestId();
  if (request !== null) await openResultPage(deps, request);

  const outcome = await stop(deps);

  if (request !== null) showOutcome(deps, request, outcome);
  if (outcome.state === 'error') return LauncherExitCode.Failed;
  if (deps.forUpdate && outcome.state === 'stopped' && outcome.overPipe) {
    return (await deps.waitForFreePipe(FREE_PIPE_TIMEOUT_MS))
      ? LauncherExitCode.Success
      : LauncherExitCode.Failed;
  }
  return LauncherExitCode.Success;
}

/** Opens LP-03 in `loading`; a page that cannot be opened does not keep `stop` from stopping. */
async function openResultPage(deps: StopCommandDeps, request: string): Promise<void> {
  try {
    // Without `launcher-state.js` the page would report a missing file every second (FIND-311).
    deps.launcherState.prepare();
    await deps.chromeOpener.open(deps.resultPageUrl(request));
  } catch {
    // The result still goes into `launcher-state.js` for a page that opens later.
  }
}

async function stop(deps: StopCommandDeps): Promise<StopOutcome> {
  const result = await deps.stopSupervisor();
  if (result?.phase === 'stopped') return { state: 'stopped', overPipe: true };
  if (result?.phase === 'error') return { state: 'error', refNo: result.refNo ?? null };

  // No supervisor, or it ended without a result of the stop: maybe a server runs without one.
  const response = await deps.healthClient.shutdown();
  if (response === null) return { state: 'not_running' };
  if (response.status === 200) return { state: 'stopped', overPipe: false };
  return { state: 'error', refNo: response.refNo };
}

function showOutcome(deps: StopCommandDeps, request: string, outcome: StopOutcome): void {
  try {
    switch (outcome.state) {
      case 'stopped':
        deps.launcherState.stopped(request, deps.dataDir);
        return;
      case 'error':
        deps.launcherState.error(request, outcome.refNo);
        return;
      case 'not_running':
        deps.launcherState.notRunning(request);
    }
  } catch {
    // A full disk must not turn a successful stop into a failure.
  }
}
