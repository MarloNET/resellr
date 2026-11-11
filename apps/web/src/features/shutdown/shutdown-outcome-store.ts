import { useSyncExternalStore } from 'react';

import type { ApiError } from '../../api/api-client.ts';

/**
 * Outcome of the last `POST /api/ops/shutdown` from UI-045 that the frame shows as a banner:
 * `error` = `500` (`UI-045.error`), `shutting-down` = `503 shutting_down` (P-07).
 */
export type ShutdownOutcome = { kind: 'error'; error: ApiError } | { kind: 'shutting-down' };

/**
 * Outcome of shutting down in this window until the page is reloaded (CU-311, Nachtrag MAR-421).
 * Same pattern as CU-049; nothing is kept in `localStorage`. UI-045 (CU-255) sets it when the
 * request ends with an error answer and clears it before it sends a new request; "×" of the
 * error banner clears it as well.
 */
export interface ShutdownOutcomeStore {
  get(): ShutdownOutcome | null;
  set(outcome: ShutdownOutcome): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export function createShutdownOutcomeStore(): ShutdownOutcomeStore {
  let outcome: ShutdownOutcome | null = null;
  const listeners = new Set<() => void>();
  const update = (next: ShutdownOutcome | null) => {
    if (next === outcome) return;
    outcome = next;
    for (const listener of listeners) listener();
  };

  return {
    get: () => outcome,
    set: update,
    clear: () => update(null),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const shutdownOutcomeStore = createShutdownOutcomeStore();

export function useShutdownOutcome(
  store: ShutdownOutcomeStore = shutdownOutcomeStore,
): ShutdownOutcome | null {
  return useSyncExternalStore(store.subscribe, store.get);
}
