import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/api-client.ts';
import { createShutdownOutcomeStore } from './shutdown-outcome-store.ts';

describe('shutdown outcome store (CU-311, Nachtrag MAR-421)', () => {
  it('starts without an outcome', () => {
    expect(createShutdownOutcomeStore().get()).toBeNull();
  });

  it('keeps the outcome set last until it is cleared', () => {
    const store = createShutdownOutcomeStore();
    const error = new ApiError('error', 500, null);

    store.set({ kind: 'error', error });
    expect(store.get()).toEqual({ kind: 'error', error });
    store.set({ kind: 'shutting-down' });
    expect(store.get()).toEqual({ kind: 'shutting-down' });
    store.clear();
    expect(store.get()).toBeNull();
  });

  it('notifies its listeners on every change until they unsubscribe', () => {
    const store = createShutdownOutcomeStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set({ kind: 'shutting-down' });
    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.set({ kind: 'shutting-down' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify when clearing an empty store', () => {
    const store = createShutdownOutcomeStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.clear();

    expect(listener).not.toHaveBeenCalled();
  });
});
