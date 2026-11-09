import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Fresh modules per test: the write lock lives until the page is reloaded.
async function loadModules() {
  vi.resetModules();
  const ops = await import('./ops.api.ts');
  const store = await import('./write-outcome-store.ts');
  const { QueryClientProvider } = await import('@tanstack/react-query');
  const { createQueryClient } = await import('../app/query-client.ts');
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...ops, ...store, wrapper };
}

const fetchMock = vi.fn<typeof fetch>();

function never(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')),
    );
  });
}

describe('ops API hooks', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('loads the status for UI-044 and UI-046', async () => {
    const { useOpsStatusQuery, wrapper } = await loadModules();
    fetchMock.mockResolvedValue(Response.json({ dataDirPath: 'C:\\Daten', appVersion: '0.1.0' }));

    const { result } = renderHook(() => useOpsStatusQuery(), { wrapper });

    await waitFor(() => expect(result.current.data?.dataDirPath).toBe('C:\\Daten'));
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/ops/status');
  });

  it('E3 a 500 on the status query ends in .error with reference number and no retry', async () => {
    const { useOpsStatusQuery, wrapper } = await loadModules();
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'internal_error',
            message: 'Text',
            fields: [],
            details: {},
            referenceNumber: 'R-7K2M-9QX4',
          },
        },
        { status: 500 },
      ),
    );

    const { result } = renderHook(() => useOpsStatusQuery(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe('error');
    expect(result.current.error?.error?.referenceNumber).toBe('R-7K2M-9QX4');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('E4 the status query ends with .unreachable after 5 s without answer', async () => {
    const { useOpsStatusQuery, wrapper } = await loadModules();
    vi.useFakeTimers({ shouldAdvanceTime: false });
    fetchMock.mockImplementation(never);

    const { result } = renderHook(() => useOpsStatusQuery(), { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(4999));
    expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(true);
    await act(() => vi.runOnlyPendingTimersAsync());

    expect(result.current.error?.kind).toBe('unreachable');
  });

  it('the health check runs only on request', async () => {
    const { useOpsHealthQuery, wrapper } = await loadModules();
    fetchMock.mockResolvedValue(Response.json({ state: 'ready', startId: 'a' }));

    const { result } = renderHook(() => useOpsHealthQuery(), { wrapper });
    expect(fetchMock).not.toHaveBeenCalled();

    void result.current.refetch();
    await waitFor(() => expect(result.current.data?.state).toBe('ready'));
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/ops/health');
  });

  it('E4 shutting down waits 30 s, then the outcome is unknown', async () => {
    const { useShutdownMutation, wrapper } = await loadModules();
    vi.useFakeTimers({ shouldAdvanceTime: false });
    fetchMock.mockImplementation(never);

    const { result } = renderHook(() => useShutdownMutation(), { wrapper });
    act(() => result.current.mutate());
    await act(() => vi.advanceTimersByTimeAsync(29_999));
    expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(true);
    await act(() => vi.runOnlyPendingTimersAsync());

    expect(result.current.error?.kind).toBe('outcome-unknown');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect([url, init?.method, init?.body]).toEqual(['/api/ops/shutdown', 'POST', '{}']);
  });

  it('E5 after a connection loss of a write, all write triggers stay disabled until reload', async () => {
    const { useShutdownMutation, useWritesLocked, wrapper } = await loadModules();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    function WriteTrigger() {
      const shutdown = useShutdownMutation();
      const locked = useWritesLocked();
      return (
        <button
          type="button"
          disabled={locked || shutdown.isPending}
          onClick={() => shutdown.mutate()}
        >
          resellr beenden
        </button>
      );
    }
    render(<WriteTrigger />, { wrapper });
    const button = screen.getByRole<HTMLButtonElement>('button');

    fireEvent.click(button);

    await waitFor(() => expect(button.disabled).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(button.disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
