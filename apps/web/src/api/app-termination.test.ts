import { QueryObserver } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fresh modules per test: the flag `terminated` lives until the page is reloaded.
async function loadModules() {
  vi.resetModules();
  const termination = await import('./app-termination.ts');
  const { createQueryClient } = await import('../app/query-client.ts');
  return { ...termination, queryClient: createQueryClient() };
}

describe('app termination (CU-257, Technical Specification 2.17)', () => {
  let signals: AbortSignal[];
  let calls: number;
  const queryFn = ({ signal }: { signal: AbortSignal }) => {
    calls += 1;
    signals.push(signal);
    return new Promise<string>(() => {});
  };

  beforeEach(() => {
    signals = [];
    calls = 0;
  });

  it('DER-96-07 stops running queries, clears the cache, sets the flag and navigates to /beendet', async () => {
    const { terminateApp, isAppTerminated, getTerminationOutcome, queryClient } =
      await loadModules();
    void queryClient.prefetchQuery({ queryKey: ['ops', 'status'], queryFn });
    queryClient.setQueryData(['listings'], ['MI-A']);
    const navigate = vi.fn();

    expect(isAppTerminated()).toBe(false);
    await terminateApp(queryClient, navigate, { kind: 'success', dataDirPath: 'C:\\Daten' });

    expect(signals[0]?.aborted).toBe(true);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(isAppTerminated()).toBe(true);
    expect(getTerminationOutcome()).toEqual({ kind: 'success', dataDirPath: 'C:\\Daten' });
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/beendet', { replace: true });
  });

  it('DER-96-07 no query starts after the shutdown, neither on subscribe nor on refetch triggers', async () => {
    const { terminateApp, queryClient } = await loadModules();
    await terminateApp(queryClient, vi.fn(), { kind: 'unknown' });

    const observer = new QueryObserver(queryClient, { queryKey: ['ops', 'status'], queryFn });
    const unsubscribe = observer.subscribe(() => {});
    queryClient.resumePausedMutations();
    await queryClient.refetchQueries({ type: 'active' });
    unsubscribe();

    expect(calls).toBe(0);
  });

  it('only the first outcome counts', async () => {
    const { terminateApp, getTerminationOutcome, queryClient } = await loadModules();
    const navigate = vi.fn();

    await terminateApp(queryClient, navigate, { kind: 'unknown' });
    await terminateApp(queryClient, navigate, { kind: 'success', dataDirPath: 'C:\\Daten' });

    expect(getTerminationOutcome()).toEqual({ kind: 'unknown' });
    expect(navigate).toHaveBeenCalledOnce();
  });
});
