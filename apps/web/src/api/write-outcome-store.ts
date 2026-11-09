import { useSyncExternalStore } from 'react';

/**
 * State "gesperrt bis Neuladen" of the page (CU-049, P-08, K-6). A write request that ends
 * without an HTTP response locks every further write of the page; only a reload of the
 * page (a new module instance) unlocks it. There is no unlock and no retry.
 */
export interface WriteOutcomeStore {
  isLocked(): boolean;
  lock(): void;
  subscribe(listener: () => void): () => void;
}

export function createWriteOutcomeStore(): WriteOutcomeStore {
  let locked = false;
  const listeners = new Set<() => void>();

  return {
    isLocked: () => locked,
    lock() {
      if (locked) return;
      locked = true;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const writeOutcomeStore = createWriteOutcomeStore();

/** `true` once the outcome of a write is unknown; write triggers use it to disable themselves. */
export function useWritesLocked(store: WriteOutcomeStore = writeOutcomeStore): boolean {
  return useSyncExternalStore(store.subscribe, store.isLocked);
}
