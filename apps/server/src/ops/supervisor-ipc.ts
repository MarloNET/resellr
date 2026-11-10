/** The part of `process` the IPC channel to the supervisor uses. */
export interface IpcProcess {
  send?: (message: unknown) => boolean;
  readonly connected?: boolean;
  once(event: 'disconnect', listener: () => void): unknown;
}

export interface SupervisorIpc {
  /** Reports `{ type: 'ready', startId }` to the supervisor; does nothing without a channel. */
  reportReady(): void;
  /**
   * Calls `handle` once when the channel to the supervisor closes, at once if it is already
   * closed; never without a channel (started directly, e.g. demo and tests).
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
  return {
    reportReady: () => {
      if (hasChannel && ipcProcess.connected) ipcProcess.send?.({ type: 'ready', startId });
    },
    onSupervisorLost: (handle) => {
      if (!hasChannel) return;
      if (ipcProcess.connected) ipcProcess.once('disconnect', handle);
      else handle();
    },
  };
}
