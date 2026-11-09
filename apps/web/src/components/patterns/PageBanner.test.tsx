import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/api-client.ts';
import { PageBanner } from './PageBanner.tsx';

function internalError(referenceNumber: string | null): ApiError {
  return new ApiError('error', 500, {
    code: 'internal_error',
    message: '',
    fields: [],
    details: {},
    referenceNumber,
  });
}

describe('PageBanner (CU-051, REQ-073)', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('E5 .error shows function, next step and the reference number of the error response', () => {
    render(
      <PageBanner variant="error" error={internalError('R-7K2M-9QX4')}>
        {(referenceNumber) =>
          `Händlermarke konnte nicht gespeichert werden. Bitte versuchen Sie es erneut. Referenz: ${referenceNumber}`
        }
      </PageBanner>,
    );

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toContain('Händlermarke konnte nicht gespeichert werden.');
    expect(banner.textContent).toContain('Bitte versuchen Sie es erneut.');
    expect(banner.textContent).toContain('Referenz: R-7K2M-9QX4');
    expect(banner.className).toContain('bg-error-bg');
  });

  it('E5 .error passes null when the answer has no reference number (400 handled like 500)', () => {
    const text = vi.fn((referenceNumber: string | null) => `Nummer: ${String(referenceNumber)}`);
    render(
      <PageBanner variant="error" error={new ApiError('error', 400, null)}>
        {text}
      </PageBanner>,
    );

    expect(text).toHaveBeenCalledWith(null);
  });

  it('E5 .error closes with "×" and does not close by itself', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <PageBanner variant="error" error={internalError('R-7K2M-9QX4')} onClose={onClose}>
        {() => 'Fehler'}
      </PageBanner>,
    );

    act(() => vi.advanceTimersByTime(60_000));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Meldung schließen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('E6 .success shows the text of the screen and closes after 5 s (5000 ms)', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <PageBanner variant="success" onClose={onClose}>
        Zugangspasswort geändert
      </PageBanner>,
    );

    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Zugangspasswort geändert');
    expect(banner.className).toContain('bg-status-published-bg');

    act(() => vi.advanceTimersByTime(4999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('E3 .success starts the 5 s again when the screen changes the text', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const banner = (text: ReactNode) => (
      <PageBanner variant="success" onClose={onClose}>
        {text}
      </PageBanner>
    );
    const { rerender } = render(banner('Kanal gespeichert'));

    act(() => vi.advanceTimersByTime(3000));
    rerender(banner('Zugangspasswort geändert'));
    act(() => vi.advanceTimersByTime(4900));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Zugangspasswort geändert');

    act(() => vi.advanceTimersByTime(100));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('E3 .success keeps its 5 s when the screen renders the same text again', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const banner = () => (
      <PageBanner variant="success" onClose={onClose}>
        <span>Gespeichert</span>
      </PageBanner>
    );
    const { rerender } = render(banner());

    act(() => vi.advanceTimersByTime(3000));
    rerender(banner());
    act(() => vi.advanceTimersByTime(2000));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('E2 "×" has the accessible name "Meldung schließen", shows "×" and is at least 32 × 32 px', () => {
    render(
      <PageBanner variant="success" onClose={vi.fn()}>
        Gespeichert
      </PageBanner>,
    );

    const close = screen.getByRole('button', { name: 'Meldung schließen' });
    expect(close.textContent).toBe('×');
    expect(close.className).toContain('min-h-[32px]');
    expect(close.className).toContain('min-w-[32px]');
  });

  it('.success closes with "×" before the 5 s are over', () => {
    const onClose = vi.fn();
    render(
      <PageBanner variant="success" onClose={onClose}>
        Gespeichert
      </PageBanner>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Meldung schließen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
