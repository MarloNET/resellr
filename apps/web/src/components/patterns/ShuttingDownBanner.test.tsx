import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShuttingDownBanner } from './ShuttingDownBanner.tsx';

describe('ShuttingDownBanner (CU-054, P-07)', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('E3 shows the text of design chapter 5 without reference number and without "×"', () => {
    render(<ShuttingDownBanner />);

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toBe(FIXED_TEXTS.shuttingDownBanner);
    expect(banner.textContent).not.toMatch(/Referenz|R-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    expect(screen.queryByRole('button')).toBeNull();
    expect(banner.className).toContain('bg-flag-warn-bg');
  });

  it('E3 leaves the inputs visible and does not disappear by itself', () => {
    vi.useFakeTimers();
    render(
      <form>
        <ShuttingDownBanner />
        <input aria-label="WI-Nr" defaultValue="626198" />
      </form>,
    );

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('alert')).toBeTruthy();
    const input = screen.getByLabelText('WI-Nr') as HTMLInputElement;
    expect(input.value).toBe('626198');
    expect(input.disabled).toBe(false);
  });

  it('E3 takes the text of a screen instead of the default text', () => {
    render(<ShuttingDownBanner>resellr wird beendet.</ShuttingDownBanner>);

    expect(screen.getByRole('alert').textContent).toBe('resellr wird beendet.');
  });
});
