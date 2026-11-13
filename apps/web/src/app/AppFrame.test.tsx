import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { shutdownOutcomeStore } from '../features/shutdown/shutdown-outcome-store.ts';
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
const shuttingDown = () =>
  Response.json(
    {
      error: {
        code: 'shutting_down',
        message: '',
        fields: [],
        details: {},
        referenceNumber: null,
      },
    },
    { status: 503 },
  );

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

describe('AppFrame banner after "resellr beenden" (CU-044, Nachtrag MAR-421)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    shutdownOutcomeStore.clear();
    vi.unstubAllGlobals();
  });

  async function confirmShutdown() {
    await within(notice()).findByText(DATA_DIR_PATH);
    fireEvent.click(within(notice()).getByRole('button', { name: 'resellr beenden' }));
    const dialog = screen.getByRole('dialog', { name: 'resellr beenden' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'resellr beenden' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }

  it('UI-045.error: DER-96-03 on 500 the dialog closes, the notice stays and the banner names function, next step and reference number', async () => {
    serve({ '/api/ops/status': status, '/api/ops/shutdown': statusError });
    renderFrame();

    await confirmShutdown();

    const banner = await within(content()).findByRole('alert');
    expect(banner.textContent).toBe(`${FIXED_TEXTS.shutdownError(REFERENCE_NUMBER)}×`);
    expect(banner.textContent).toContain('resellr konnte nicht beendet werden.');
    expect(banner.textContent).toContain('Bitte versuchen Sie es erneut.');
    expect(content().firstElementChild?.contains(banner)).toBe(true);
    expect(within(content()).getByRole('heading', { name: 'Inserat-Übersicht' })).toBeTruthy();
    expect(within(notice()).getByTestId('backup-notice-path').textContent).toBe(DATA_DIR_PATH);
    expect(
      within(notice()).getByRole<HTMLButtonElement>('button', { name: 'resellr beenden' }).disabled,
    ).toBe(false);

    fireEvent.click(within(banner).getByRole('button', { name: FIXED_TEXTS.closeBanner }));
    expect(within(content()).queryByRole('alert')).toBeNull();
  });

  it('UI-045.wird-beendet: DER-96-05 on 503 shutting_down the content area shows P-07 without reference number', async () => {
    serve({ '/api/ops/status': status, '/api/ops/shutdown': shuttingDown });
    renderFrame();

    await confirmShutdown();

    const banner = await within(content()).findByRole('alert');
    expect(banner.textContent).toBe(FIXED_TEXTS.shuttingDownBanner);
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(content().firstElementChild?.contains(banner)).toBe(true);
    expect(within(notice()).getByTestId('backup-notice-path').textContent).toBe(DATA_DIR_PATH);
  });

  it('shows P-06 before the banner of the shutdown and both before the page', async () => {
    serve({});
    shutdownOutcomeStore.set({ kind: 'shutting-down' });
    renderFrame();

    await waitFor(() => expect(within(content()).getAllByRole('alert')).toHaveLength(2));
    const [first, second] = within(content()).getAllByRole('alert');
    expect(first!.textContent).toBe(`${FIXED_TEXTS.unreachableBanner}Erneut versuchen`);
    expect(second!.textContent).toBe(FIXED_TEXTS.shuttingDownBanner);
    const page = within(content()).getByRole('heading', { name: 'Inserat-Übersicht' });
    expect(second!.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('AppFrame after "resellr beenden" in this window (CU-044, Nachtrag MAR-510)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // Fresh modules per test: the flag `terminated` lives until the page is reloaded.
  async function renderApp() {
    vi.resetModules();
    const { QueryClientProvider } = await import('@tanstack/react-query');
    const { createMemoryRouter, RouterProvider } = await import('react-router');
    const { createQueryClient } = await import('./query-client.ts');
    const { routes } = await import('./router.tsx');
    const router = createMemoryRouter(routes, { initialEntries: ['/inserate'] });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    return router;
  }

  /** Second page, "resellr beenden" in the notice and in UI-045, then the end state UI-046. */
  async function shutDownFromSecondPage(router: Awaited<ReturnType<typeof renderApp>>) {
    await screen.findByText(DATA_DIR_PATH);
    await router.navigate('/einstellungen/hersteller');
    fireEvent.click(within(notice()).getByRole('button', { name: 'resellr beenden' }));
    const dialog = screen.getByRole('dialog', { name: 'resellr beenden' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'resellr beenden' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/beendet'));
  }

  async function expectEndStateOnly(router: Awaited<ReturnType<typeof renderApp>>) {
    await waitFor(() => expect(router.state.location.pathname).toBe('/beendet'));
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByTestId('navigation-column')).toBeNull();
    expect(screen.queryByRole('region', { name: FIXED_TEXTS.backupNoticeTitle })).toBeNull();
  }

  it('UI-046.success: DER-96-09 "Zurück" and "Vor" after the shutdown lead to /beendet with the same path, without frame and without request', async () => {
    const answerPath = 'D:\\Kopie\\resellr-Daten';
    serve({
      '/api/ops/status': status,
      '/api/ops/shutdown': () => Response.json({ dataDirPath: answerPath }),
    });
    const router = await renderApp();
    await shutDownFromSecondPage(router);
    const requests = fetchMock.mock.calls.length;

    await router.navigate(-1);

    await expectEndStateOnly(router);
    expect(screen.getByRole('heading', { level: 1, name: FIXED_TEXTS.shutdownDone })).toBeTruthy();
    expect(screen.getByTestId('terminated-path').textContent).toBe(answerPath);

    await router.navigate('/einstellungen/lieferanten');
    await router.navigate('/gibt-es-nicht');
    await expectEndStateOnly(router);
    expect(screen.getByRole('heading', { level: 1, name: FIXED_TEXTS.shutdownDone })).toBeTruthy();
    expect(screen.getByTestId('terminated-path').textContent).toBe(answerPath);
    expect(fetchMock.mock.calls.length).toBe(requests);
  });

  it('UI-046.unknown: DER-96-09 "Zurück" after the shutdown leads to /beendet without path, without frame and without request', async () => {
    serve({ '/api/ops/status': status });
    const router = await renderApp();
    await shutDownFromSecondPage(router);
    const requests = fetchMock.mock.calls.length;

    await router.navigate(-1);

    await expectEndStateOnly(router);
    expect(
      screen.getByRole('heading', { level: 1, name: FIXED_TEXTS.shutdownUnknownTitle }),
    ).toBeTruthy();
    expect(screen.queryByTestId('terminated-path')).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(requests);
  });
});
