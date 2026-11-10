/** Operating state of the server (CU-038, Technical Specification 2.17). */
export type LifecycleStateName = 'starting' | 'ready' | 'stopping';

export interface LifecycleState {
  get(): LifecycleStateName;
  set(state: LifecycleStateName): void;
  isStopping(): boolean;
  /** Changes `ready` to `stopping` and returns true; in any other state returns false (2.17 step 1). */
  beginStopping(): boolean;
}

export function createLifecycleState(initial: LifecycleStateName = 'starting'): LifecycleState {
  let state = initial;
  return {
    get: () => state,
    set: (next) => {
      state = next;
    },
    isStopping: () => state === 'stopping',
    beginStopping: () => {
      if (state !== 'ready') return false;
      state = 'stopping';
      return true;
    },
  };
}
