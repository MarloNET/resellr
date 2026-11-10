import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { AppFrame } from './AppFrame.tsx';
import { createQueryClient } from './query-client.ts';

const DATA_DIR_PATH = 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten';
const REFERENCE_NUMBER = 'R-7K2M-9QX4';

const fetchMock = vi.fn<typeof fetch>();

const status = () => Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' });
const statusError = () =>
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
  );
const health = () => Response.json({ state: 'ready', startId: 's-1' });

/** Answers per path; a path without answer fails like a lost connection. */
function serve(answers: Record<string, () => Response>) {
  fetchMock.mockImplementation((input) => {
    const answer = answers[String(input)];
    return answer ? Promise.resolve(answer()) : Promise.reject(new TypeError('Failed to fetch'));
  });
}

function calls(path: string): number {
  return fetchMock.mock.calls.filter(([input]) => String(input) === path).length;
}

function renderFrame() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppFrame />,
        children: [{ path: 'inserate', element: <h1>Inserat-Übersicht</h1> }],
      },
    ],
    { initialEntries: ['/inserate'] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const content = () => screen.getByTestId('content-area');
const notice = () => screen.getByRole('region', { name: FIXED_TEXTS.backupNoticeTitle });

describe('AppFrame P-06 for GET /api/ops/status (CU-044, Nachtrag MAR-395)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('UI-044.unreachable: DER-95-04 shows P-06 as the first element of the content area above the page while the status is unreachable', async () => {
    serve({});
    renderFrame();

    const banner = await within(content()).findByRole('alert');
    expect(banner.textContent).toBe(`${FIXED_TEXTS.unreachableBanner}Erneut versuchen`);
    expect(content().firstElementChild?.contains(banner)).toBe(true);
    expect(within(content()).getByRole('heading', { name: 'Inserat-Übersicht' })).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(within(notice()).getByTestId('backup-notice-path').textContent).toBe(
      FIXED_TEXTS.backupNoticeLoading,
    );
  });

  it('UI-044.loading: DER-95-04 shows no P-06 while the status still loads', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    renderFrame();

    await vi.advanceTimersByTimeAsync(4_000);
    expect(calls('/api/ops/status')).toBeGreaterThanOrEqual(1);
    expect(within(content()).queryByRole('alert')).toBeNull();
    expect(within(notice()).getByTestId('backup-notice-path').textContent).toBe(
      FIXED_TEXTS.backupNoticeLoading,
    );
  });

  it('UI-044.error: DER-95-03 shows no P-06 on 500, the notice shows UI-044.error instead', async () => {
    serve({ '/api/ops/status': statusError });
    renderFrame();

    expect(
      await within(notice()).findByText(FIXED_TEXTS.backupNoticeError(REFERENCE_NUMBER)),
    ).toBeTruthy();
    expect(within(content()).queryByRole('alert')).toBeNull();
  });

  it('UI-044.unreachable: DER-95-04 "Erneut versuchen" checks the health, reloads the data folder path and the banner disappears', async () => {
    serve({});
    renderFrame();
    await within(content()).findByRole('alert');

    serve({ '/api/ops/health': health, '/api/ops/status': status });
    fireEvent.click(within(content()).getByRole('button', { name: 'Erneut versuchen' }));

    await waitFor(() =>
      expect(within(notice()).getByTestId('backup-notice-path').textContent).toBe(DATA_DIR_PATH),
    );
    expect(within(content()).queryByRole('alert')).toBeNull();
    expect(calls('/api/ops/health')).toBe(1);
  });
});
