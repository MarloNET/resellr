import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';
import { describe, expect, it, vi } from 'vitest';

import type { ShutdownResponse } from './health-client.ts';
import { FREE_PIPE_TIMEOUT_MS, runStopCommand, type StopCommandDeps } from './stop-command.ts';
import type { PhaseEvent, SubscribeResult } from './supervisor/supervisor-pipe.ts';

const REQUEST = 'request-1';
const REF_NO = 'R-7K3M-Q9TX';
const DATA_DIR = 'C:\\Users\\Jörg\\AppData\\Local\\resellr\\Daten';
const LP_03_URL = `file:///pages/lp-03.html?request=${REQUEST}`;

const phase = (name: PhaseEvent['phase'], fields: Partial<PhaseEvent> = {}): PhaseEvent => ({
  event: 'phase',
  phase: name,
  ...fields,
});

interface Setup {
  forUpdate?: boolean;
  /** Result of `stop` over the pipe; null = no supervisor listens. */
  pipe?: SubscribeResult | null;
  /** Answer of the direct `POST /api/ops/shutdown`; null = no server answers. */
  shutdown?: ShutdownResponse | null;
  /** Whether the pipe is free within 30 s. */
  pipeFree?: boolean;
  /** Test hook `RESELLR_TEST_STOP_FAILS`. */
  failForTest?: boolean;
}

function setup({
  forUpdate = false,
  pipe = null,
  shutdown = null,
  pipeFree = true,
  failForTest = false,
}: Setup = {}) {
  /** Every step in the order it happens. */
  const order: string[] = [];
  const deps = {
    forUpdate,
    failForTest,
    dataDir: DATA_DIR,
    stopSupervisor: vi.fn(async () => {
      order.push('pipe stop');
      return pipe;
    }),
    healthClient: {
      shutdown: vi.fn(async () => {
        order.push('POST shutdown');
        return shutdown;
      }),
    },
    waitForFreePipe: vi.fn(async (timeoutMs: number) => {
      order.push(`wait for free pipe ${timeoutMs}`);
      return pipeFree;
    }),
    chromeOpener: {
      open: vi.fn(async (target: string) => {
        order.push(`open ${target}`);
      }),
    },
    newRequestId: () => REQUEST,
    resultPageUrl: (request: string) => `file:///pages/lp-03.html?request=${request}`,
    launcherState: {
      prepare: vi.fn(() => void order.push('prepare')),
      stopped: vi.fn((request: string, dataDir: string) =>
        order.push(`stopped ${request} ${dataDir}`),
      ),
      error: vi.fn((request: string, refNo: string | null) =>
        order.push(`error ${request} ${refNo}`),
      ),
      notRunning: vi.fn((request: string) => void order.push(`not_running ${request}`)),
    },
  } satisfies StopCommandDeps;
  return { deps, order };
}

describe('stop command (CU-260)', () => {
  it('DER-104-01 creates launcher-state.js, opens LP-03, sends stop over the pipe and writes stopped with the data folder', async () => {
    const { deps, order } = setup({ pipe: phase('stopped') });

    await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Success);

    expect(order).toEqual([
      'prepare',
      `open ${LP_03_URL}`,
      'pipe stop',
      `stopped ${REQUEST} ${DATA_DIR}`,
    ]);
    expect(deps.healthClient.shutdown).not.toHaveBeenCalled();
    expect(deps.waitForFreePipe).not.toHaveBeenCalled();
  });

  it('DER-104-03 shows not_running without a data folder when neither a supervisor nor a server answers', async () => {
    const { deps, order } = setup();

    await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Success);

    expect(order).toEqual([
      'prepare',
      `open ${LP_03_URL}`,
      'pipe stop',
      'POST shutdown',
      `not_running ${REQUEST}`,
    ]);
  });

  it('sends POST /api/ops/shutdown directly without a supervisor and shows stopped on 200', async () => {
    const { deps, order } = setup({ shutdown: { status: 200, body: {}, refNo: null } });

    await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Success);

    expect(order.slice(2)).toEqual([
      'pipe stop',
      'POST shutdown',
      `stopped ${REQUEST} ${DATA_DIR}`,
    ]);
  });

  it('shows error with the reference number when the direct shutdown fails', async () => {
    const { deps } = setup({ shutdown: { status: 500, body: {}, refNo: REF_NO } });

    await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Failed);

    expect(deps.launcherState.error).toHaveBeenCalledWith(REQUEST, REF_NO);
  });

  it('shows error with the reference number when the supervisor reports error', async () => {
    const { deps } = setup({ pipe: phase('error', { refNo: REF_NO }) });

    await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Failed);

    expect(deps.launcherState.error).toHaveBeenCalledWith(REQUEST, REF_NO);
    expect(deps.healthClient.shutdown).not.toHaveBeenCalled();
  });

  it.each<[string, SubscribeResult]>([
    ['closed without a result', { phase: 'closed' }],
    ['already_running', phase('already_running', { refNo: REF_NO })],
    ['aborted', phase('aborted', { refNo: REF_NO })],
  ])(
    'asks the server directly when the supervisor ends with %s instead of stopped',
    async (_, result) => {
      const { deps } = setup({ pipe: result });

      await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Success);

      expect(deps.healthClient.shutdown).toHaveBeenCalledOnce();
      expect(deps.launcherState.notRunning).toHaveBeenCalledWith(REQUEST);
    },
  );

  it('stops anyway when LP-03 cannot be opened', async () => {
    const { deps } = setup({ pipe: phase('stopped') });
    deps.chromeOpener.open.mockRejectedValueOnce(new Error('no browser'));

    await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Success);

    expect(deps.stopSupervisor).toHaveBeenCalledOnce();
    expect(deps.launcherState.stopped).toHaveBeenCalledWith(REQUEST, DATA_DIR);
  });

  describe('--for-update', () => {
    it('opens no page, waits up to 30 s for the free pipe after stopped and ends with exit code 0', async () => {
      const { deps, order } = setup({ forUpdate: true, pipe: phase('stopped') });

      await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Success);

      expect(FREE_PIPE_TIMEOUT_MS).toBe(30_000);
      expect(order).toEqual(['pipe stop', `wait for free pipe ${FREE_PIPE_TIMEOUT_MS}`]);
      expect(deps.chromeOpener.open).not.toHaveBeenCalled();
    });

    it('ends with exit code 1 when the pipe is not free after 30 s', async () => {
      const { deps } = setup({ forUpdate: true, pipe: phase('stopped'), pipeFree: false });

      await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Failed);
    });

    it('DER-104-03 ends with exit code 0 when resellr does not run', async () => {
      const { deps, order } = setup({ forUpdate: true });

      await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Success);

      expect(order).toEqual(['pipe stop', 'POST shutdown']);
    });

    it('ends with exit code 1 when stopping fails', async () => {
      const { deps } = setup({ forUpdate: true, pipe: phase('error', { refNo: REF_NO }) });

      await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Failed);

      expect(deps.waitForFreePipe).not.toHaveBeenCalled();
    });

    it('ends with exit code 0 after a direct shutdown with 200', async () => {
      const { deps } = setup({
        forUpdate: true,
        shutdown: { status: 200, body: {}, refNo: null },
      });

      await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Success);
    });

    it('DER-105-03 ends with exit code 1 without stopping when the test hook lets stopping fail', async () => {
      const { deps, order } = setup({ forUpdate: true, pipe: phase('stopped'), failForTest: true });

      await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Failed);

      expect(order).toEqual([]);
    });
  });

  it('shows error without a reference number and stops nothing when the test hook lets stopping fail', async () => {
    const { deps, order } = setup({ pipe: phase('stopped'), failForTest: true });

    await expect(runStopCommand(deps)).resolves.toBe(LauncherExitCode.Failed);

    expect(order).toEqual(['prepare', `open ${LP_03_URL}`, `error ${REQUEST} null`]);
  });
});
