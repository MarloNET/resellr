import { describe, expect, it } from 'vitest';

import { createQueryClient } from './query-client.ts';

describe('query client (Technical Specification 2.0.8)', () => {
  const client = createQueryClient();
  const queryDefaults = client.getDefaultOptions().queries!;
  const refetchOnWindowFocus = queryDefaults.refetchOnWindowFocus as (query: {
    queryKey: readonly unknown[];
  }) => boolean;

  it('never retries reads or writes', () => {
    expect(queryDefaults.retry).toBe(false);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });

  it('refetches on window focus except the copy assistant view', () => {
    expect(refetchOnWindowFocus({ queryKey: ['ops', 'status'] })).toBe(true);
    expect(refetchOnWindowFocus({ queryKey: ['listing-content', 'copy-view', 9] })).toBe(false);
  });

  it('runs requests regardless of the browser online flag (127.0.0.1 only)', () => {
    expect(queryDefaults.networkMode).toBe('always');
    expect(client.getDefaultOptions().mutations?.networkMode).toBe('always');
  });
});
