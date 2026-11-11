import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeOutcomeStore } from '../../api/write-outcome-store.ts';
import { createQueryClient } from '../../app/query-client.ts';
import { OutcomeUnknownBanner } from '../../components/patterns/OutcomeUnknownBanner.tsx';
import { ShuttingDownBanner } from '../../components/patterns/ShuttingDownBanner.tsx';
import { UnreachableBanner } from '../../components/patterns/UnreachableBanner.tsx';
import { BackupNotice } from './BackupNotice.tsx';

const DATA_DIR_PATH = 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten';
const REFERENCE_NUMBER = 'R-7K2M-9QX4';

const fetchMock = vi.fn<typeof fetch>();

function pending(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')),
    );
  });
}

function renderNotice() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <BackupNotice variant="sidebar" />
    </QueryClientProvider>,
  );
  return screen.getByRole('region', { name: FIXED_TEXTS.backupNoticeTitle });
}

/**
 * Renders the notice with fresh modules: the write lock of a test above lasts until the page is
 * reloaded (CU-049) and would disable "resellr beenden" in UI-045.
 */
async function renderFreshNotice() {
  vi.resetModules();
  const { BackupNotice: FreshBackupNotice } = await import('./BackupNotice.tsx');
  const { createQueryClient: createFreshQueryClient } = await import('../../app/query-client.ts');
  render(
    <QueryClientProvider client={createFreshQueryClient()}>
      <FreshBackupNotice variant="sidebar" />
    </QueryClientProvider>,
  );
  return screen.getByRole('region', { name: FIXED_TEXTS.backupNoticeTitle });
}

describe('BackupNotice (UI-044, CU-254)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('UI-044.default shows the heading, all statements of REQ-104 and the path', async () => {
    fetchMock.mockResolvedValue(Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' }));

    const notice = renderNotice();

    const path = await within(notice).findByText(DATA_DIR_PATH);
    expect(within(notice).getByRole('heading', { name: 'Sicherung einrichten' })).toBeTruthy();
    for (const line of [
      FIXED_TEXTS.backupNoticeIntro,
      FIXED_TEXTS.backupNoticeStepsLead,
      FIXED_TEXTS.backupNoticeStep1,
      FIXED_TEXTS.backupNoticeStep2,
      FIXED_TEXTS.backupNoticeLocationLead,
      FIXED_TEXTS.backupNoticeWarning,
    ]) {
      expect(within(notice).getByText(line)).toBeTruthy();
    }
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/ops/status');
    // Selectable text that breaks anywhere; no copy action, no "×", no collapsing.
    expect(path.className).toContain('break-all');
    expect(path.className).not.toContain('select-none');
    expect(
      within(notice)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['resellr beenden']);
    expect(within(notice).queryByText(FIXED_TEXTS.backupNoticeLoading)).toBeNull();
  });

  it('UI-044.default the text in reading order is the unchanged wording of REQ-104', async () => {
    fetchMock.mockResolvedValue(Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' }));

    const notice = renderNotice();
    await within(notice).findByText(DATA_DIR_PATH);

    const lines = [...notice.querySelectorAll('p')].map((line) => line.textContent);
    expect(lines.join(' ')).toBe(FIXED_TEXTS.backupNoticeText(DATA_DIR_PATH));
  });

  it('DER-95-02 shows "wird geladen …" at the place of the path while the status loads', () => {
    fetchMock.mockImplementation(pending);

    const notice = renderNotice();

    expect(within(notice).getByRole('heading', { name: 'Sicherung einrichten' })).toBeTruthy();
    expect(within(notice).getByText(FIXED_TEXTS.backupNoticeIntro)).toBeTruthy();
    expect(within(notice).getByText(FIXED_TEXTS.backupNoticeStep2)).toBeTruthy();
    expect(within(notice).getByText(FIXED_TEXTS.backupNoticeWarning)).toBeTruthy();
    const loading = within(notice).getByTestId('backup-notice-path');
    expect(loading.textContent).toBe('wird geladen …');
    expect(within(notice).getByRole('button', { name: 'resellr beenden' })).toBeTruthy();
  });

  it('UI-044.error: DER-95-03 shows the text with the reference number at the place of the path on 500', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'internal_error',
            message: '',
            fields: [],
            details: {},
            referenceNumber: REFERENCE_NUMBER,
          },
        },
        { status: 500 },
      ),
    );

    const notice = renderNotice();

    const text = await within(notice).findByText(
      `Speicherort konnte nicht ermittelt werden. Informieren Sie den Betreiber und nennen Sie die Referenznummer ${REFERENCE_NUMBER}.`,
    );
    expect(text.dataset.testid).toBe('backup-notice-path');
    // The rest of the notice stays complete.
    expect(within(notice).getByRole('heading', { name: 'Sicherung einrichten' })).toBeTruthy();
    for (const line of [
      FIXED_TEXTS.backupNoticeIntro,
      FIXED_TEXTS.backupNoticeStepsLead,
      FIXED_TEXTS.backupNoticeStep1,
      FIXED_TEXTS.backupNoticeStep2,
      FIXED_TEXTS.backupNoticeLocationLead,
      FIXED_TEXTS.backupNoticeWarning,
    ]) {
      expect(within(notice).getByText(line)).toBeTruthy();
    }
    expect(within(notice).getByRole('button', { name: 'resellr beenden' })).toBeTruthy();
    expect(within(notice).queryByText(FIXED_TEXTS.backupNoticeLoading)).toBeNull();
    // The notice is no banner: it shows no P-06 and no own alert.
    expect(within(notice).queryByRole('alert')).toBeNull();
  });

  it('UI-044.unreachable: DER-95-04 keeps "wird geladen …" at the place of the path when resellr is not reachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const notice = renderNotice();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Let the rejected request settle into the error state of the query.
    await act(async () => {});
    expect(within(notice).getByTestId('backup-notice-path').textContent).toBe('wird geladen …');
    expect(within(notice).getByText(FIXED_TEXTS.backupNoticeWarning)).toBeTruthy();
    expect(within(notice).getByRole('button', { name: 'resellr beenden' })).toBeTruthy();
    expect(within(notice).queryByRole('alert')).toBeNull();
  });

  it.each([
    ['UI-044.unreachable', 'P-06', () => <UnreachableBanner alwaysShow />],
    ['UI-044.wird-beendet', 'P-07', () => <ShuttingDownBanner />],
    [
      'UI-044.ausgang-unbekannt',
      'P-08',
      () => {
        // The page state "gesperrt bis Neuladen" (CU-049); it lasts for this test file only.
        writeOutcomeStore.lock();
        return <OutcomeUnknownBanner />;
      },
    ],
  ])(
    '%s: DER-95-05 with %s in the content area heading, text and path of the notice stay unchanged',
    async (_state, _pattern, banner) => {
      fetchMock.mockResolvedValue(
        Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' }),
      );
      const queryClient = createQueryClient();
      const frame = (content: ReactNode) => (
        <QueryClientProvider client={queryClient}>
          <BackupNotice variant="sidebar" />
          <main>{content}</main>
        </QueryClientProvider>
      );
      const { rerender } = render(frame(null));
      const notice = screen.getByRole('region', { name: FIXED_TEXTS.backupNoticeTitle });
      await within(notice).findByText(DATA_DIR_PATH);
      const before = notice.innerHTML;

      rerender(frame(banner()));

      const main = screen.getByRole('main');
      expect(within(main).getByRole('alert')).toBeTruthy();
      // The same element with the same content: no other heading, text or path, no own message.
      expect(screen.getByRole('region', { name: FIXED_TEXTS.backupNoticeTitle })).toBe(notice);
      expect(notice.innerHTML).toBe(before);
      expect(within(notice).getByTestId('backup-notice-path').textContent).toBe(DATA_DIR_PATH);
      expect(within(notice).queryByRole('alert')).toBeNull();
      expect(within(notice).queryByRole('status')).toBeNull();
      expect(within(notice).getByRole('button', { name: 'resellr beenden' })).toHaveProperty(
        'disabled',
        false,
      );
    },
  );

  it('AC-REQ-104-03 the notice puts nothing into localStorage or sessionStorage', async () => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock.mockResolvedValue(Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' }));

    const notice = renderNotice();
    const path = await within(notice).findByText(DATA_DIR_PATH);
    fireEvent.click(path, { detail: 3 });
    fireEvent.click(within(notice).getByRole('heading', { name: 'Sicherung einrichten' }));

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('DER-95-06 "resellr beenden" is a focusable button', async () => {
    fetchMock.mockResolvedValue(Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' }));
    const notice = renderNotice();
    await within(notice).findByText(DATA_DIR_PATH);

    const button = within(notice).getByRole('button', { name: 'resellr beenden' });
    button.focus();

    expect(document.activeElement).toBe(button);
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('UI-044.disabled: DER-96-04 "resellr beenden" is disabled while UI-045 is open and while shutting down', async () => {
    fetchMock.mockImplementation((input, init) =>
      input === '/api/ops/status'
        ? Promise.resolve(Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' }))
        : pending(input, init),
    );
    const notice = await renderFreshNotice();
    await within(notice).findByText(DATA_DIR_PATH);
    const button = within(notice).getByRole<HTMLButtonElement>('button', {
      name: 'resellr beenden',
    });

    button.focus();
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'resellr beenden' });
    expect(button.disabled).toBe(true);

    fireEvent.click(within(dialog).getByRole('button', { name: 'resellr beenden' }));
    await within(dialog).findByRole('status');
    expect(button.disabled).toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/ops/status',
      '/api/ops/shutdown',
    ]);
  });

  it('UI-044.disabled: DER-96-04 after "Abbrechen" the button is enabled again and has the focus', async () => {
    fetchMock.mockResolvedValue(Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' }));
    const notice = await renderFreshNotice();
    await within(notice).findByText(DATA_DIR_PATH);
    const button = within(notice).getByRole<HTMLButtonElement>('button', {
      name: 'resellr beenden',
    });

    button.focus();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button.disabled).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
