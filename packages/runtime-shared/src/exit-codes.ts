/**
 * Exit codes of `resellr-server` and how the supervisor reacts to them
 * (Technical Specification 2.18). Every other exit code counts as a crash.
 */
export const ExitCode = {
  /** Stopped by the user: no restart, event `stopped`, the supervisor ends. */
  StoppedByUser: 0,
  /** Start aborted: no restart, read the start result, event `aborted`, the supervisor ends. */
  StartAborted: 10,
  /** Already running: no restart, not counted as a crash, warning `already_running`, the supervisor ends. */
  AlreadyRunning: 11,
  /** Supervisor lost (IPC channel closed); only happens without a supervisor. */
  SupervisorLost: 12,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Exit codes of `resellr-launcher` (CU-258). Technical Specification 2.18 names 0 and 1 for
 * `stop --for-update`; every other command uses the same two codes.
 */
export const LauncherExitCode = {
  /** The command did its work. */
  Success: 0,
  /** The command failed or is unknown. */
  Failed: 1,
} as const;

export type LauncherExitCode = (typeof LauncherExitCode)[keyof typeof LauncherExitCode];
