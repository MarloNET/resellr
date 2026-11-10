import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';
import { describe, expect, it, vi } from 'vitest';

import type { HealthState } from './health-client.ts';
import { type OpenCommandDeps, runOpenCommand } from './open-command.ts';
import type { PhaseEvent, SubscribeResult } from './supervisor/supervisor-pipe.ts';

const APP_URL = 'http://127.0.0.1:4311/';
const REF_NO = 'R-7K3M-Q9TX';

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
}

function setup({ health = [null], subscribe = [null], supervisor = [] }: Setup = {}) {
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
      return subscribeResults.shift()!;
    }),
    becomeSupervisor: vi.fn(async (onPhase: (event: PhaseEvent) => void) => {
      const run = supervisorRuns.shift();
      if (run === undefined) throw new Error('unexpected step 3');
      if (run === 'taken') return 'taken' as const;
      for (const event of run.phases) onPhase(event);
      return 'ended' as const;
    }),
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
});
