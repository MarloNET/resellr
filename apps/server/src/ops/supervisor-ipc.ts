/** The part of `process` the IPC channel to the supervisor uses. */
export interface IpcProcess {
  send?: (message: unknown, callback: (error: Error | null) => void) => boolean;
  readonly connected?: boolean;
  once(event: 'disconnect', listener: () => void): unknown;
}

export interface SupervisorIpc {
  /**
   * Reports `{ type: 'ready', startId }` to the supervisor; does nothing without a channel. A
   * report that cannot be sent counts as a lost supervisor.
   */
  reportReady(): void;
  /**
   * Calls `handle` once when the channel to the supervisor closes or a report to it fails, at
   * once if that already happened; never without a channel (started directly, e.g. demo and tests).
   */
  onSupervisorLost(handle: () => void): void;
}

/**
 * IPC channel to the supervisor (CU-249, Technical Specification 2.18 "Überwachung"): the
 * supervisor starts the server with an IPC channel and `RESELLR_START_ID`; the server reports
 * readiness with this `startId` and ends when the channel closes (H-13).
 */
export function createSupervisorIpc(ipcProcess: IpcProcess, startId: string | null): SupervisorIpc {
  const hasChannel = typeof ipcProcess.send === 'function';
  let lost = hasChannel && !ipcProcess.connected;
  const lostHandlers: (() => void)[] = [];
  const markLost = () => {
    if (lost) return;
    lost = true;
    for (const handle of lostHandlers.splice(0)) handle();
  };

  return {
    reportReady: () => {
      if (!hasChannel || lost || !ipcProcess.connected) return;
      // A channel the supervisor closed during the start stays `connected` until `disconnect`;
      // without a callback the failed write (`EPIPE`) would end the server as an unhandled error.
      try {
        ipcProcess.send?.({ type: 'ready', startId }, (error) => {
          if (error) markLost();
        });
      } catch {
        markLost();
      }
    },
    onSupervisorLost: (handle) => {
      if (!hasChannel) return;
      if (lost || !ipcProcess.connected) {
        handle();
        return;
      }
      // Only now: a `disconnect` listener keeps the channel and so the event loop open, which an
      // aborted start relies on running empty (exit code 10). A channel closed during the start is
      // noticed by `connected` or the failed ready report.
      if (lostHandlers.length === 0) ipcProcess.once('disconnect', markLost);
      lostHandlers.push(handle);
    },
  };
}
