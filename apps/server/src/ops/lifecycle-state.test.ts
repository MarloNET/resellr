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

  it('beginStopping changes only ready to stopping', () => {
    const lifecycle = createLifecycleState('ready');

    expect(lifecycle.beginStopping()).toBe(true);
    expect(lifecycle.get()).toBe('stopping');
    // A second shutdown is refused (2.17, step 1).
    expect(lifecycle.beginStopping()).toBe(false);
    expect(lifecycle.get()).toBe('stopping');

    const starting = createLifecycleState();
    expect(starting.beginStopping()).toBe(false);
    expect(starting.get()).toBe('starting');
  });
});
