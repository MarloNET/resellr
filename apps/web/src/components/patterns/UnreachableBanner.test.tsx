import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, type ApiError } from '../../api/api-client.ts';
import { createQueryClient } from '../../app/query-client.ts';
import { UnreachableBanner } from './UnreachableBanner.tsx';

const fetchMock = vi.fn<typeof fetch>();

/** Answers per path; a path without answer fails like a lost connection. */
function serve(answers: Record<string, () => Response>) {
  fetchMock.mockImplementation((input) => {
    const answer = answers[String(input)];
    return answer ? Promise.resolve(answer()) : Promise.reject(new TypeError('Failed to fetch'));
  });
}

const health = () => Response.json({ state: 'ready', startId: 's-1' });
const listings = () => Response.json([{ title: 'ThinkPad T14' }]);

/** A page whose data query shows P-06 above its content, as the screens will do. */
function Page({ text }: { text?: string }) {
  const query = useQuery<Array<{ title: string }>, ApiError>({
    queryKey: ['inventory', 'listings'],
    queryFn: ({ signal }) => apiClient.get('/api/listings', { signal }),
  });
  return (
    <div>
      {query.error?.kind === 'unreachable' && <UnreachableBanner>{text}</UnreachableBanner>}
      <h1>Inserat-Übersicht</h1>
      <input aria-label="Suche" defaultValue="T14" />
      {query.data?.map((row) => (
        <p key={row.title}>{row.title}</p>
      ))}
    </div>
  );
}

function renderPage(text?: string) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Page text={text} />
    </QueryClientProvider>,
  );
}

function calls(path: string): number {
  return fetchMock.mock.calls.filter(([input]) => String(input) === path).length;
}

describe('UnreachableBanner (CU-053, P-06)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('E2 shows the text of design chapter 5 with "Erneut versuchen", without "×" and reference number', async () => {
    serve({});
    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(`${FIXED_TEXTS.unreachableBanner}Erneut versuchen`);
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '×' })).toBeNull();
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    expect(banner.className).toContain('bg-flag-warn-bg');
  });

  it('E2 does not replace the page: content and inputs stay visible below the banner', async () => {
    serve({});
    renderPage();

    await screen.findByRole('alert');
    expect(screen.getByRole('heading', { name: 'Inserat-Übersicht' })).toBeTruthy();
    expect((screen.getByLabelText('Suche') as HTMLInputElement).value).toBe('T14');
  });

  it('E2 stays while the health check fails and does not reload the data then', async () => {
    serve({});
    renderPage();
    await screen.findByRole('alert');
    expect(calls('/api/listings')).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    await waitFor(() => expect(calls('/api/ops/health')).toBe(1));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Erneut versuchen' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(calls('/api/listings')).toBe(1);
  });

  it('E2 stays when the health check succeeds but the data still cannot be loaded', async () => {
    serve({});
    renderPage();
    await screen.findByRole('alert');

    serve({ '/api/ops/health': health });
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    await waitFor(() => expect(calls('/api/listings')).toBe(2));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Erneut versuchen' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('E2 checks GET /api/ops/health first and reloads the data of the page after success; then the banner is gone', async () => {
    serve({});
    renderPage();
    await screen.findByRole('alert');

    serve({ '/api/ops/health': health, '/api/listings': listings });
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByText('ThinkPad T14')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    const paths = fetchMock.mock.calls.map(([input]) => String(input));
    expect(paths).toEqual(['/api/listings', '/api/ops/health', '/api/listings']);
    expect((screen.getByLabelText('Suche') as HTMLInputElement).value).toBe('T14');
  });

  it('E2 takes the text of a screen instead of the default text', async () => {
    serve({});
    renderPage('Bitte später erneut versuchen');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe('Bitte später erneut versuchenErneut versuchen');
  });
});
