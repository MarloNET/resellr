import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { createSupervisorIpc, type IpcProcess } from './supervisor-ipc.ts';

/** A process with an IPC channel the test can close. */
function processWithChannel() {
  const emitter = new EventEmitter();
  const ipcProcess = {
    send: vi.fn<(message: unknown, callback?: (error: Error | null) => void) => boolean>(
      () => true,
    ),
    connected: true,
    once: (event: 'disconnect', listener: () => void) => emitter.once(event, listener),
    disconnect: () => {
      ipcProcess.connected = false;
      emitter.emit('disconnect');
    },
  };
  return ipcProcess;
}

const withoutChannel: IpcProcess = { once: () => undefined };

describe('IPC to the supervisor (CU-249)', () => {
  it('reports ready with the startId of this start', () => {
    const ipcProcess = processWithChannel();

    createSupervisorIpc(ipcProcess, 'start-1').reportReady();

    expect(ipcProcess.send).toHaveBeenCalledExactlyOnceWith(
      { type: 'ready', startId: 'start-1' },
      expect.any(Function),
    );
  });

  it('sends nothing once the channel is closed', () => {
    const ipcProcess = processWithChannel();
    ipcProcess.connected = false;

    createSupervisorIpc(ipcProcess, 'start-1').reportReady();

    expect(ipcProcess.send).not.toHaveBeenCalled();
  });

  it('calls the handler once when the channel closes', () => {
    const ipcProcess = processWithChannel();
    const lost = vi.fn();

    createSupervisorIpc(ipcProcess, 'start-1').onSupervisorLost(lost);
    expect(lost).not.toHaveBeenCalled();
    ipcProcess.disconnect();

    expect(lost).toHaveBeenCalledOnce();
  });

  it('calls the handler at once when the channel closed during the start', () => {
    const ipcProcess = processWithChannel();
    const ipc = createSupervisorIpc(ipcProcess, 'start-1');
    ipcProcess.disconnect();
    const lost = vi.fn();

    ipc.onSupervisorLost(lost);

    expect(lost).toHaveBeenCalledOnce();
  });

  it('treats a failed ready report as a lost supervisor, also for a handler added later', () => {
    const ipcProcess = processWithChannel();
    ipcProcess.send.mockImplementation((_message, callback) => {
      callback?.(new Error('write EPIPE'));
      return false;
    });
    const ipc = createSupervisorIpc(ipcProcess, 'start-1');
    const lostEarly = vi.fn();
    ipc.onSupervisorLost(lostEarly);

    ipc.reportReady();
    const lostLater = vi.fn();
    ipc.onSupervisorLost(lostLater);

    expect(lostEarly).toHaveBeenCalledOnce();
    expect(lostLater).toHaveBeenCalledOnce();
    // The channel closes afterwards: no second call.
    ipcProcess.disconnect();
    expect(lostEarly).toHaveBeenCalledOnce();
    expect(lostLater).toHaveBeenCalledOnce();
  });

  it('treats a ready report that throws as a lost supervisor', () => {
    const ipcProcess = processWithChannel();
    ipcProcess.send.mockImplementation(() => {
      throw new Error('Channel closed');
    });
    const ipc = createSupervisorIpc(ipcProcess, 'start-1');
    const lost = vi.fn();
    ipc.onSupervisorLost(lost);

    expect(() => ipc.reportReady()).not.toThrow();
    expect(lost).toHaveBeenCalledOnce();
  });

  it('does nothing without a channel, as when started directly', () => {
    const lost = vi.fn();
    const ipc = createSupervisorIpc(withoutChannel, null);

    expect(() => ipc.reportReady()).not.toThrow();
    ipc.onSupervisorLost(lost);
    expect(lost).not.toHaveBeenCalled();
  });
});
