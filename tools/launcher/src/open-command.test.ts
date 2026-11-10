import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';
import { describe, expect, it, vi } from 'vitest';

import type { HealthState } from './health-client.ts';
import { runOpenCommand } from './open-command.ts';

const APP_URL = 'http://127.0.0.1:4311/';

function setup(state: HealthState | null) {
  const healthClient = { appUrl: APP_URL, getHealth: vi.fn(async () => state) };
  const chromeOpener = { open: vi.fn(async () => {}) };
  return { healthClient, chromeOpener };
}

describe('open command (CU-259)', () => {
  it('DER-102-01 opens Chrome with the local address when the server reports ready', async () => {
    const deps = setup('ready');

    await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Success);
    expect(deps.healthClient.getHealth).toHaveBeenCalledOnce();
    expect(deps.chromeOpener.open).toHaveBeenCalledExactlyOnceWith(APP_URL);
  });

  // Steps 2 and 3 of the flow (pipe of the supervisor, own start) follow with #119.
  it.each([['starting'], ['stopping'], [null]] as const)(
    'opens nothing and fails when the health state is %s',
    async (state) => {
      const deps = setup(state);

      await expect(runOpenCommand(deps)).resolves.toBe(LauncherExitCode.Failed);
      expect(deps.chromeOpener.open).not.toHaveBeenCalled();
    },
  );

  it('passes on an error of the chrome opener', async () => {
    const deps = setup('ready');
    deps.chromeOpener.open.mockRejectedValue(new Error('spawn explorer.exe ENOENT'));

    await expect(runOpenCommand(deps)).rejects.toThrow('ENOENT');
  });
});
