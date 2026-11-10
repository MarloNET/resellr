import { describe, expect, it } from 'vitest';

import { ExitCode, LauncherExitCode } from './exit-codes.ts';

describe('exit codes (E7)', () => {
  it('names the exit codes 0, 10, 11 and 12 from Technical Specification 2.18', () => {
    expect(ExitCode).toEqual({
      StoppedByUser: 0,
      StartAborted: 10,
      AlreadyRunning: 11,
      SupervisorLost: 12,
    });
  });
});

describe('launcher exit codes (CU-006, CU-258)', () => {
  it('names 0 for success and 1 for failure, as for `stop --for-update` in 2.18', () => {
    expect(LauncherExitCode).toEqual({ Success: 0, Failed: 1 });
  });
});
