import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/api-client.ts';
import { PAGE_BANNER_SUCCESS_MS, PageBanner } from './PageBanner.tsx';

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

    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('.success shows the text of the screen and closes after 5 s', () => {
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

    act(() => vi.advanceTimersByTime(PAGE_BANNER_SUCCESS_MS - 1));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('.success closes with "×" before the 5 s are over', () => {
    const onClose = vi.fn();
    render(
      <PageBanner variant="success" onClose={onClose}>
        Gespeichert
      </PageBanner>,
    );

    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
