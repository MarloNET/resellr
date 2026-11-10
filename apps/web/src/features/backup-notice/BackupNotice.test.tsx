import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { BackupNotice } from './BackupNotice.tsx';

const DATA_DIR_PATH = 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten';

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

  it('DER-95-06 "resellr beenden" is a focusable button that does nothing until #142', async () => {
    fetchMock.mockResolvedValue(Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' }));
    const notice = renderNotice();
    await within(notice).findByText(DATA_DIR_PATH);

    const button = within(notice).getByRole('button', { name: 'resellr beenden' });
    button.focus();
    fireEvent.click(button);

    expect(document.activeElement).toBe(button);
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
