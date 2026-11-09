import { describe, expect, it } from 'vitest';

import { createLifecycleState } from './lifecycle-state.ts';

describe('lifecycle state (CU-038)', () => {
  it('starts in starting', () => {
    expect(createLifecycleState().get()).toBe('starting');
  });

  it('changes between starting, ready and stopping', () => {
    const lifecycle = createLifecycleState();

    lifecycle.set('ready');
    expect(lifecycle.get()).toBe('ready');
    expect(lifecycle.isStopping()).toBe(false);

    lifecycle.set('stopping');
    expect(lifecycle.isStopping()).toBe(true);

    // A failed shutdown returns to ready (2.17, step 8).
    lifecycle.set('ready');
    expect(lifecycle.isStopping()).toBe(false);
  });
});
