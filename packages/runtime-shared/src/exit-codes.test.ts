import { describe, expect, it } from 'vitest';

import { ExitCode } from './exit-codes.ts';

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
