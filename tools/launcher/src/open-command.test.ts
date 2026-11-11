import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HealthState } from './health-client.ts';
import { type OpenCommandDeps, runOpenCommand, WAITING_PAGE_DELAY_MS } from './open-command.ts';
import type { PhaseEvent, SubscribeResult } from './supervisor/supervisor-pipe.ts';

const APP_URL = 'http://127.0.0.1:4311/';
const REF_NO = 'R-7K3M-Q9TX';
const REQUEST = 'request-1';
const LP_01_URL = `file:///pages/lp-01.html?request=${REQUEST}`;

const phase = (name: PhaseEvent['phase'], fields: Partial<PhaseEvent> = {}): PhaseEvent => ({
  event: 'phase',
  phase: name,
  ...fields,
});

interface Setup {
  /** Answers of `GET /api/ops/health`, one per call; the last one repeats. */
  health?: (HealthState | null)[];
  /** Results of step 2, one per call; null = no supervisor listens. */
  subscribe?: (SubscribeResult | null)[];
  /** Outcomes of step 3, one per call; `ended` runs the phases first. */
  supervisor?: ('taken' | { phases: PhaseEvent[] })[];
  /** Time until a result of step 2 or a phase of the own supervisor arrives. */
  waitMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function setup({ health = [null], subscribe = [null], supervisor = [], waitMs = 0 }: Setup = {}) {
  const healthAnswers = [...health];
  const subscribeResults = [...subscribe];
  const supervisorRuns = [...supervisor];
  const deps = {
    healthClient: {
      appUrl: APP_URL,
      getHealth: vi.fn(async () =>
        healthAnswers.length > 1 ? healthAnswers.shift()! : healthAnswers[0]!,
      ),
    },
    chromeOpener: { open: vi.fn<(target: string) => Promise<void>>(async () => {}) },
    startFailedPageUrl: (refNo: string | null) => `file:///pages/lp-02.html?ref=${refNo}`,
    subscribe: vi.fn(async () => {
      if (subscribeResults.length === 0) throw new Error('unexpected subscribe');
      const result = subscribeResults.shift()!;
      if (result !== null && waitMs > 0) await sleep(waitMs);
      return result;
    }),
    becomeSupervisor: vi.fn(async (onPhase: (event: PhaseEvent) => void) => {
      const run = supervisorRuns.shift();
      if (run === undefined) throw new Error('unexpected step 3');
      if (run === 'taken') return 'taken' as const;
      if (waitMs > 0) await sleep(waitMs);
      for (const event of run.phases) onPhase(event);
      return 'ended' as const;
    }),
    newRequestId: () => REQUEST,
    waitingPageUrl: (request: string) => `file:///pages/lp-01.html?request=${request}`,
    launcherState: {
      ready: vi.fn<(request: string, url: string) => void>(),
      aborted: vi.fn<(request: string, refNo: string | null) => void>(),
    },
  } satisfies OpenCommandDeps;
  return deps;
}

describe('open command (CU-259)', () => {
  it('DER-102-01 opens Chrome with the local address when the server reports ready', async () => {
    const deps = setup({ health: ['ready'] });

    await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
    expect(deps.healthClient.getHealth).toHaveBeenCalledOnce();
    expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(APP_URL);
    expect(deps.subscribe).not.toHaveBeenCalled();
  });

  it('passes on an error of the chrome opener', async () => {
    const deps = setup({ health: ['ready'] });
    deps.chromeOpener.open.mockRejectedValue(new Error('spawn explorer.exe ENOENT'));

    await expect(runOpenCommand(deps)).rejects.toThrow('ENOENT');
  });

  it.each([['starting'], ['stopping'], [null]] as const)(
    'DER-102-06 subscribes to the running supervisor when the health state is %s and opens Chrome on ready',
    async (state) => {
      const deps = setup({ health: [state], subscribe: [phase('ready', { startId: 's-1' })] });

      await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
      expect(deps.subscribe).toHaveBeenCalledOnce();
      expect(deps.becomeSupervisor).not.toHaveBeenCalled();
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(APP_URL);
    },
  );

  it.each([['aborted'], ['gave_up']] as const)(
    'hands over to LP-02 with the reference number on %s',
    async (name) => {
      const deps = setup({ subscribe: [phase(name, { refNo: REF_NO })] });

      await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(
        `file:///pages/lp-02.html?ref=${REF_NO}`,
      );
    },
  );

  it('DER-102-02 takes over the pipe without a supervisor, opens Chrome on ready and runs on as supervisor', async () => {
    const deps = setup({
      supervisor: [{ phases: [phase('starting'), phase('ready', { startId: 's-1' })] }],
    });

    await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
    expect(deps.becomeSupervisor).toHaveBeenCalledOnce();
    expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(APP_URL);
  });

  it('opens LP-02 when the own start is aborted', async () => {
    const deps = setup({ supervisor: [{ phases: [phase('aborted', { refNo: REF_NO })] }] });

    await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
    expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(
      `file:///pages/lp-02.html?ref=${REF_NO}`,
    );
  });

  it('shows only the first result of the own supervisor', async () => {
    const deps = setup({
      supervisor: [{ phases: [phase('ready', { startId: 's-1' }), phase('stopped')] }],
    });

    await runOpenCommand(deps);
    expect(deps.chromeOpener.open).toHaveBeenCalledOnce();
  });

  it('ends with Failed when the own supervisor ends without a result', async () => {
    const deps = setup({ supervisor: [{ phases: [phase('starting')] }] });

    await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Failed);
    expect(deps.chromeOpener.open).not.toHaveBeenCalled();
  });

  it('keeps supervising when Chrome cannot be opened and ends with Failed', async () => {
    const deps = setup({ supervisor: [{ phases: [phase('ready', { startId: 's-1' })] }] });
    deps.chromeOpener.open.mockRejectedValue(new Error('spawn explorer.exe ENOENT'));

    await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Failed);
    expect(deps.becomeSupervisor).toHaveBeenCalledOnce();
  });

  describe('DER-102-08 already_running', () => {
    it('asks GET /api/ops/health once more and hands over to LP-02 with the reference number of the warning', async () => {
      const deps = setup({
        health: [null, null],
        subscribe: [phase('already_running', { refNo: REF_NO })],
      });

      await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
      expect(deps.healthClient.getHealth).toHaveBeenCalledTimes(2);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(
        `file:///pages/lp-02.html?ref=${REF_NO}`,
      );
    });

    it.each([['starting'], ['stopping']] as const)(
      'hands over to LP-02 when the second step 1 reports %s, without steps 2 and 3',
      async (state) => {
        const deps = setup({
          health: [null, state],
          subscribe: [phase('already_running', { refNo: REF_NO })],
        });

        await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
        expect(deps.subscribe).toHaveBeenCalledOnce();
        expect(deps.becomeSupervisor).not.toHaveBeenCalled();
        expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(
          `file:///pages/lp-02.html?ref=${REF_NO}`,
        );
      },
    );

    it('opens Chrome when the other server reports ready on the second step 1', async () => {
      const deps = setup({
        health: [null, 'ready'],
        subscribe: [phase('already_running', { refNo: REF_NO })],
      });

      await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(APP_URL);
    });

    it('handles already_running of the own supervisor the same way', async () => {
      const deps = setup({
        health: [null, null],
        supervisor: [{ phases: [phase('already_running', { refNo: REF_NO })] }],
      });

      await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
      expect(deps.healthClient.getHealth).toHaveBeenCalledTimes(2);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(
        `file:///pages/lp-02.html?ref=${REF_NO}`,
      );
    });
  });

  describe('DER-102-09 stopped or pipe closed without a result', () => {
    it.each([[phase('stopped')], [{ phase: 'closed' } as const]])(
      'goes on with step 3 after %o',
      async (result) => {
        const deps = setup({ subscribe: [result], supervisor: [{ phases: [phase('ready')] }] });

        await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
        expect(deps.becomeSupervisor).toHaveBeenCalledOnce();
        expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(APP_URL);
      },
    );

    it('goes back to step 2 when the pipe is already taken in step 3', async () => {
      const deps = setup({
        subscribe: [phase('stopped'), phase('ready', { startId: 's-2' })],
        supervisor: ['taken'],
      });

      await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
      expect(deps.subscribe).toHaveBeenCalledTimes(2);
      expect(deps.becomeSupervisor).toHaveBeenCalledOnce();
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(APP_URL);
    });

    it('runs step 3 after stopped at most once', async () => {
      const deps = setup({
        subscribe: [phase('stopped'), { phase: 'closed' }],
        supervisor: ['taken'],
      });

      await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Failed);
      expect(deps.subscribe).toHaveBeenCalledTimes(2);
      expect(deps.becomeSupervisor).toHaveBeenCalledOnce();
      expect(deps.chromeOpener.open).not.toHaveBeenCalled();
    });
  });

  describe('LP-01 when waiting takes longer than 3 s (2.18 step 4)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('DER-102-03 opens LP-01 with the request of this call after 3 s, not before', async () => {
      const deps = setup({ subscribe: [phase('ready')], waitMs: 10_000 });

      const run = runOpenCommand(deps);
      await vi.advanceTimersByTimeAsync(WAITING_PAGE_DELAY_MS - 1);
      expect(deps.chromeOpener.open).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(LP_01_URL);

      await vi.advanceTimersByTimeAsync(10_000);
      await expect(run).resolves.toBe(LauncherExitCode.Success);
    });

    it('DER-102-04 writes ready with the local address for the open LP-01 instead of opening Chrome again', async () => {
      const deps = setup({ subscribe: [phase('ready', { startId: 's-1' })], waitMs: 3500 });

      const run = runOpenCommand(deps);
      await vi.advanceTimersByTimeAsync(3500);

      await expect(run).resolves.toBe(LauncherExitCode.Success);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(LP_01_URL);
      expect(deps.launcherState.ready).toHaveBeenCalledExactlyOnceWith(REQUEST, APP_URL);
      expect(deps.launcherState.aborted).not.toHaveBeenCalled();
    });

    it('opens no LP-01 when the result comes within 3 s', async () => {
      const deps = setup({ subscribe: [phase('ready')], waitMs: WAITING_PAGE_DELAY_MS - 1 });

      const run = runOpenCommand(deps);
      await vi.advanceTimersByTimeAsync(60_000);

      await expect(run).resolves.toBe(LauncherExitCode.Success);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(APP_URL);
      expect(deps.launcherState.ready).not.toHaveBeenCalled();
    });

    it('opens no LP-01 when the server is ready at once', async () => {
      const deps = setup({ health: ['ready'] });

      await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(APP_URL);
    });

    it.each([['aborted'], ['gave_up']] as const)(
      'writes aborted with the reference number for the open LP-01 on %s (Nachtrag MAR-382)',
      async (name) => {
        const deps = setup({ subscribe: [phase(name, { refNo: REF_NO })], waitMs: 3500 });

        const run = runOpenCommand(deps);
        await vi.advanceTimersByTimeAsync(3500);

        await expect(run).resolves.toBe(LauncherExitCode.Success);
        expect(deps.launcherState.aborted).toHaveBeenCalledExactlyOnceWith(REQUEST, REF_NO);
        expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(LP_01_URL);
      },
    );

    it('writes aborted with the reference number of already_running when no server answers (Nachtrag MAR-382)', async () => {
      const deps = setup({
        health: [null, 'starting'],
        subscribe: [phase('already_running', { refNo: REF_NO })],
        waitMs: 3500,
      });

      const run = runOpenCommand(deps);
      await vi.advanceTimersByTimeAsync(3500);

      await expect(run).resolves.toBe(LauncherExitCode.Success);
      expect(deps.launcherState.aborted).toHaveBeenCalledExactlyOnceWith(REQUEST, REF_NO);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(LP_01_URL);
    });

    it('writes ready after already_running when the other server reports ready', async () => {
      const deps = setup({
        health: [null, 'ready'],
        subscribe: [phase('already_running', { refNo: REF_NO })],
        waitMs: 3500,
      });

      const run = runOpenCommand(deps);
      await vi.advanceTimersByTimeAsync(3500);

      await expect(run).resolves.toBe(LauncherExitCode.Success);
      expect(deps.launcherState.ready).toHaveBeenCalledExactlyOnceWith(REQUEST, APP_URL);
    });

    it('writes the result of the own supervisor for the open LP-01', async () => {
      const deps = setup({
        supervisor: [{ phases: [phase('starting'), phase('aborted', { refNo: REF_NO })] }],
        waitMs: 4000,
      });

      const run = runOpenCommand(deps);
      await vi.advanceTimersByTimeAsync(4000);

      await expect(run).resolves.toBe(LauncherExitCode.Success);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(LP_01_URL);
      expect(deps.launcherState.aborted).toHaveBeenCalledExactlyOnceWith(REQUEST, REF_NO);
    });

    it('keeps one LP-01 and one request across step 3 after stopped', async () => {
      const deps = setup({
        subscribe: [phase('stopped')],
        supervisor: [{ phases: [phase('ready', { startId: 's-2' })] }],
        waitMs: 2000,
      });

      const run = runOpenCommand(deps);
      await vi.advanceTimersByTimeAsync(4000);

      await expect(run).resolves.toBe(LauncherExitCode.Success);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(LP_01_URL);
      expect(deps.launcherState.ready).toHaveBeenCalledExactlyOnceWith(REQUEST, APP_URL);
    });

    it('opens the result in Chrome when LP-01 could not be opened', async () => {
      const deps = setup({ subscribe: [phase('ready')], waitMs: 3500 });
      deps.chromeOpener.open.mockRejectedValueOnce(new Error('spawn explorer.exe ENOENT'));

      const run = runOpenCommand(deps);
      await vi.advanceTimersByTimeAsync(3500);

      await expect(run).resolves.toBe(LauncherExitCode.Success);
      expect(deps.chromeOpener.open.mock.calls).toEqual([[LP_01_URL], [APP_URL]]);
      expect(deps.launcherState.ready).not.toHaveBeenCalled();
    });

    it('keeps supervising when the launcher state cannot be written and ends with Failed', async () => {
      const deps = setup({
        supervisor: [{ phases: [phase('ready', { startId: 's-1' })] }],
        waitMs: 3500,
      });
      deps.launcherState.ready.mockImplementation(() => {
        throw new Error('EACCES');
      });

      const run = runOpenCommand(deps);
      await vi.advanceTimersByTimeAsync(3500);

      await expect(run).resolves.toBe(LauncherExitCode.Failed);
      expect(deps.becomeSupervisor).toHaveBeenCalledOnce();
    });

    it('opens no LP-01 later while the own supervisor runs on after the result', async () => {
      let endSupervisor = () => {};
      const deps = setup();
      deps.becomeSupervisor.mockImplementation(async (onPhase) => {
        onPhase(phase('ready', { startId: 's-1' }));
        await new Promise<void>((resolve) => (endSupervisor = resolve));
        return 'ended';
      });

      const run = runOpenCommand(deps);
      await vi.advanceTimersByTimeAsync(60_000);
      endSupervisor();

      await expect(run).resolves.toBe(LauncherExitCode.Success);
      expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(APP_URL);
    });
  });
});
