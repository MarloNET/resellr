/** Operating state of the server (CU-038, Technical Specification 2.17). */
export type LifecycleStateName = 'starting' | 'ready' | 'stopping';

export interface LifecycleState {
  get(): LifecycleStateName;
  set(state: LifecycleStateName): void;
  isStopping(): boolean;
}

export function createLifecycleState(initial: LifecycleStateName = 'starting'): LifecycleState {
  let state = initial;
  return {
    get: () => state,
    set: (next) => {
      state = next;
    },
    isStopping: () => state === 'stopping',
  };
}
