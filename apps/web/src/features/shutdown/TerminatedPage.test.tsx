import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DATA_DIR_PATH = 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten';

/** The two additional lines of the design proposal that are not built (Owner `97d46083`). */
const PROPOSAL_LINES = [/So erreichen Sie den Ordner/, /Zum Weiterarbeiten/];

const fetchMock = vi.fn<typeof fetch>();

/** Answers of the server: status for UI-044, and `shutdown` for `POST /api/ops/shutdown`. */
function serve(shutdown: () => Promise<Response>) {
  fetchMock.mockImplementation((input) =>
    String(input) === '/api/ops/shutdown'
      ? shutdown()
      : Promise.resolve(Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' })),
  );
}

function never(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')),
    );
  });
}

// Fresh modules per test: the end state and the write lock live until the page is reloaded.
async function renderApp(path = '/inserate') {
  vi.resetModules();
  const { QueryClientProvider } = await import('@tanstack/react-query');
  const { createMemoryRouter, RouterProvider } = await import('react-router');
  const { createQueryClient } = await import('../../app/query-client.ts');
  const { routes } = await import('../../app/router.tsx');
  const queryClient = createQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient, router };
}

/** "resellr beenden" in the notice, then "resellr beenden" in UI-045. */
async function confirmShutdown() {
  await screen.findByText(DATA_DIR_PATH);
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Sicherung einrichten' })).getByRole('button', {
      name: 'resellr beenden',
    }),
  );
  const dialog = screen.getByRole('dialog', { name: 'resellr beenden' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'resellr beenden' }));
}

describe('TerminatedPage (UI-046, CU-256) and app termination (CU-257)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('UI-046.success: DER-96-07 replaces the frame without navigation and notice and shows the path of the answer as selectable text', async () => {
    const answerPath = 'D:\\Kopie\\resellr-Daten';
    serve(() => Promise.resolve(Response.json({ dataDirPath: answerPath })));
    const { router } = await renderApp();

    await confirmShutdown();

    const title = await screen.findByRole('heading', { level: 1, name: FIXED_TEXTS.shutdownDone });
    expect(router.state.location.pathname).toBe('/beendet');
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByTestId('navigation-column')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Sicherung einrichten' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();

    const card = screen.getByRole('region', { name: FIXED_TEXTS.shutdownDone });
    expect(card.contains(title)).toBe(true);
    expect(within(card).getByText(FIXED_TEXTS.shutdownDoneLocationLead)).toBeTruthy();
    const path = within(card).getByTestId('terminated-path');
    expect(path.textContent).toBe(answerPath);
    expect(path.tagName).not.toBe('BUTTON');
    expect(path.className).toContain('select-text');
    expect(path.className).toContain('break-all');
    // The path comes from the answer, not from the status loaded with the frame.
    expect(screen.queryByText(DATA_DIR_PATH)).toBeNull();
    for (const line of PROPOSAL_LINES) expect(screen.queryByText(line)).toBeNull();
  });

  it('UI-046.success: DER-96-07 after the change no query runs any more, also not on window focus', async () => {
    serve(() => Promise.resolve(Response.json({ dataDirPath: DATA_DIR_PATH })));
    const { queryClient } = await renderApp();

    await confirmShutdown();
    await screen.findByRole('heading', { name: FIXED_TEXTS.shutdownDone });

    const calls = fetchMock.mock.calls.length;
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(queryClient.isFetching()).toBe(0);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('UI-046.unknown: DER-96-06 on a connection loss shows the warning without path and without "Erneut versuchen"', async () => {
    serve(() => Promise.reject(new TypeError('Failed to fetch')));
    const { router, queryClient } = await renderApp();

    await confirmShutdown();

    const card = await screen.findByRole('region', { name: FIXED_TEXTS.shutdownUnknownTitle });
    expect(router.state.location.pathname).toBe('/beendet');
    expect(
      within(card).getByRole('heading', { level: 1, name: FIXED_TEXTS.shutdownUnknownTitle }),
    ).toBeTruthy();
    expect(within(card).getByText(FIXED_TEXTS.shutdownUnknownText)).toBeTruthy();
    expect(card.className).toContain('bg-flag-warn-bg');
    expect(screen.queryByText(DATA_DIR_PATH)).toBeNull();
    expect(screen.queryByText(FIXED_TEXTS.shutdownDoneLocationLead)).toBeNull();
    expect(screen.queryByTestId('terminated-path')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Erneut versuchen/)).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Sicherung einrichten' })).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('UI-046.unknown: DER-96-06 without an answer within 30 s shows the warning, not before', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockImplementation((input, init) =>
      String(input) === '/api/ops/shutdown'
        ? never(input, init)
        : Promise.resolve(Response.json({ dataDirPath: DATA_DIR_PATH, appVersion: '0.1.0' })),
    );
    const { router } = await renderApp();

    await confirmShutdown();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/ops/shutdown', expect.anything()),
    );
    await vi.advanceTimersByTimeAsync(29_000);
    expect(router.state.location.pathname).toBe('/inserate');
    expect(screen.getByRole('dialog', { name: 'resellr beenden' })).toBeTruthy();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(
      await screen.findByRole('heading', { name: FIXED_TEXTS.shutdownUnknownTitle }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe('/beendet');
    expect(screen.queryByText(DATA_DIR_PATH)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('error answers keep the frame: 500 and 503 do not lead to /beendet', async () => {
    serve(() =>
      Promise.resolve(
        Response.json(
          {
            error: {
              code: 'internal_error',
              message: '',
              fields: [],
              details: {},
              referenceNumber: 'R-7K2M-9QX4',
            },
          },
          { status: 500 },
        ),
      ),
    );
    const { router } = await renderApp();

    await confirmShutdown();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.pathname).toBe('/inserate');
    expect(screen.getByRole('region', { name: 'Sicherung einrichten' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: FIXED_TEXTS.shutdownDone })).toBeNull();
  });

  it('/beendet without shutting down in this window leads to the start page', async () => {
    serve(() => never('/api/ops/shutdown'));
    const { router } = await renderApp('/beendet');

    await waitFor(() => expect(router.state.location.pathname).toBe('/inserate'));
    expect(screen.queryByRole('heading', { name: FIXED_TEXTS.shutdownDone })).toBeNull();
    expect(screen.queryByRole('heading', { name: FIXED_TEXTS.shutdownUnknownTitle })).toBeNull();
  });
});
