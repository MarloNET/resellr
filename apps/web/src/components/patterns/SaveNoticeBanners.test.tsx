import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ErrorCode } from '@resellr/domain/errors/error-codes';

import { ApiError } from '../../api/api-client.ts';
import { noticeOf, SaveNoticeBanners, type SaveNotice } from './SaveNoticeBanners.tsx';

const errorBody = (code: ErrorCode, message = '', referenceNumber: string | null = null) => ({
  code,
  message,
  fields: [],
  details: {},
  referenceNumber,
});

const errorText = (referenceNumber: string | null) =>
  `Hersteller konnte nicht angelegt werden. Referenz: ${referenceNumber ?? '–'}`;

function renderBanners(notice: SaveNotice | null, extra: { onClose?: () => void } = {}) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const onReloaded = vi.fn();
  render(
    <SaveNoticeBanners
      notice={notice}
      onClose={extra.onClose ?? (() => {})}
      onReloaded={onReloaded}
      successText="Gespeichert"
      errorText={errorText}
    />,
    { wrapper },
  );
  return { onReloaded };
}

describe('noticeOf (CU-314, addendum MAR-555)', () => {
  it.each([
    ['conflict', 409, 'version_conflict', { kind: 'conflict' }],
    ['shutting-down', 503, 'shutting_down', { kind: 'shutting-down' }],
  ] as const)('maps %s to its banner', (kind, status, code, notice) => {
    expect(noticeOf(new ApiError(kind, status, errorBody(code)))).toEqual(notice);
  });

  it('maps not-found to the text of the answer (M-15)', () => {
    const error = new ApiError('not-found', 404, errorBody('not_found', 'Weg.'));
    expect(noticeOf(error)).toEqual({ kind: 'not-found', message: 'Weg.' });
  });

  it('gives no notice for an unknown outcome; P-08 shows itself (CU-055)', () => {
    expect(noticeOf(new ApiError('outcome-unknown', null, null))).toBeNull();
  });

  it('maps every other answer to the error banner', () => {
    const error = new ApiError('error', 500, errorBody('internal_error', '', 'R-7K2M-9QX4'));
    expect(noticeOf(error)).toEqual({ kind: 'error', error });
  });
});

describe('SaveNoticeBanners (CU-314)', () => {
  afterEach(cleanup);

  it('shows nothing without a notice', () => {
    renderBanners(null);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the success text and closes with "×"', () => {
    const onClose = vi.fn();
    renderBanners({ kind: 'success' }, { onClose });

    expect(screen.getByRole('status').textContent).toContain('Gespeichert');
    fireEvent.click(screen.getByRole('button', { name: 'Meldung schließen' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the error text of the screen with the reference number', () => {
    const error = new ApiError('error', 500, errorBody('internal_error', '', 'R-7K2M-9QX4'));
    renderBanners({ kind: 'error', error });

    expect(screen.getByRole('alert').textContent).toContain(
      'Hersteller konnte nicht angelegt werden. Referenz: R-7K2M-9QX4',
    );
  });

  it('shows P-05 with "Neu laden" and reports the reload', async () => {
    const { onReloaded } = renderBanners({ kind: 'conflict' });

    expect(screen.getByRole('alert').textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(onReloaded).toHaveBeenCalled());
  });

  it('shows P-07 without reference number and without button', () => {
    renderBanners({ kind: 'shutting-down' });

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toContain('resellr wird gerade beendet.');
    expect(banner.textContent).not.toMatch(/Referenz/);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the text of not-found', () => {
    renderBanners({ kind: 'not-found', message: 'Dieser Eintrag ist nicht mehr vorhanden.' });
    expect(screen.getByRole('alert').textContent).toBe('Dieser Eintrag ist nicht mehr vorhanden.');
  });
});
