import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of UI-010 (CU-137) with a mocked `fetch` (Technical Specification 6.1, 6.2):
// head and the states of opening a device (#187).

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const DEVICE = {
  id: 5,
  wiNr: '626198',
  modelTemplateId: 7,
  modelTemplateLabel: 'ThinkPad T14',
  listingId: 2,
  listing: { id: 2, title: 'Lenovo ThinkPad T14, 16 GB, 512 GB' },
  supplierId: null,
  conditionValueId: 1,
  visualGrade: 3,
  conditionDescription: '',
  values: {},
  reviewKeys: ['condition'],
  captureStatus: 'review_pending',
  stockStatus: 'available',
  capturedAt: '2026-11-16T09:00:00.000Z',
  capturedOn: '2026-11-16',
  version: 1,
  updatedAt: '2026-11-16T09:00:00.000Z',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type DeviceHandler = (init: RequestInit | undefined) => Promise<Response> | Response;

/** `fetch` of the page: the frame's status, the health check of P-06 and the device. */
function mockApi(device: DeviceHandler) {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://127.0.0.1');
      if (url.pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (url.pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (url.pathname.startsWith('/api/devices/')) {
        requests.push(url.pathname);
        return device(init);
      }
      throw new Error(`unexpected request ${init?.method ?? 'GET'} ${url.pathname}`);
    }),
  );
  return { requests };
}

function renderPage(path = '/geraete/5') {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </QueryClientProvider>,
  );
}

const pending = () => new Promise<Response>(() => {});

/** The head as pairs of term and value. */
function headEntries() {
  const list = screen.getByLabelText('Gerätekopf');
  const terms = within(list).getAllByRole('term');
  return terms.map((term) => [term.textContent, term.nextElementSibling?.textContent]);
}

/** Accessibility assertion of a state: heading and named controls. */
function expectAccessiblePage(title = 'Gerät') {
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
  for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
    expect(control.textContent?.trim() || control.getAttribute('aria-label')).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UI-010 Gerät (CU-137)', () => {
  it('UI-010.default DER-54-10 shows WI-Nr, model template, model listing as link and the chips of inventory and capture status', async () => {
    const { requests } = mockApi(() => Response.json(DEVICE));

    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Gerät 626198' })).toBeTruthy();
    expect(requests).toEqual(['/api/devices/5']);
    expect(headEntries()).toEqual([
      ['Modellvorlage', 'ThinkPad T14'],
      ['Modell-Inserat', 'Lenovo ThinkPad T14, 16 GB, 512 GB'],
      ['Bestandsstatus', 'verfügbar'],
      ['Erfassungsstatus', 'unvollständig geprüft'],
    ]);
    expect(
      screen.getByRole('link', { name: 'Lenovo ThinkPad T14, 16 GB, 512 GB' }).getAttribute('href'),
    ).toBe('/inserate/2');
    expectAccessiblePage('Gerät 626198');
  });

  it('UI-010.default DER-54-10 shows "nicht zugeordnet" without model listing and a cancelled device with its status', async () => {
    mockApi(() =>
      Response.json({
        ...DEVICE,
        listingId: null,
        listing: null,
        stockStatus: 'cancelled',
        captureStatus: 'checked',
      }),
    );

    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Gerät 626198' });
    expect(headEntries()).toEqual([
      ['Modellvorlage', 'ThinkPad T14'],
      ['Modell-Inserat', 'nicht zugeordnet'],
      ['Bestandsstatus', 'storniert'],
      ['Erfassungsstatus', 'geprüft'],
    ]);
    expect(screen.queryByRole('link', { name: /ThinkPad/ })).toBeNull();
  });

  it('UI-010.loading DER-54-10 shows "Lade Gerät …" while the device loads', async () => {
    mockApi(pending);

    renderPage();

    expect((await screen.findByRole('status')).textContent).toBe('Lade Gerät …');
    expectAccessiblePage();
  });

  it('UI-010.error DER-54-10 shows the banner "Gerät konnte nicht geladen werden. Referenz: <Nr>" on 500 internal_error', async () => {
    mockApi(() =>
      Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
        status: 500,
      }),
    );

    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe('Gerät konnte nicht geladen werden. Referenz: R-7K2M-9QX4');
    expect(screen.queryByRole('status')).toBeNull();
    expectAccessiblePage();
  });

  it('shows "Dieser Eintrag ist nicht mehr vorhanden." for 404 not_found and for an address without id (M-15)', async () => {
    mockApi(() =>
      Response.json(
        errorBody('not_found', { message: 'Dieser Eintrag ist nicht mehr vorhanden.' }),
        {
          status: 404,
        },
      ),
    );

    renderPage('/geraete/999');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
    cleanup();

    const { requests } = mockApi(pending);
    renderPage('/geraete/abc');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
    expect(requests).toEqual([]);
  });

  it('UI-010.unreachable DER-54-13 shows P-06 with "Erneut versuchen" above the page when GET /api/devices/{id} gets no answer; it disappears after an answer', async () => {
    let reachable = false;
    mockApi(() => {
      if (!reachable) throw new TypeError('Failed to fetch');
      return Response.json(DEVICE);
    });
    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    const content = screen.getByRole('main');
    expect(within(content).getByRole('heading', { level: 1, name: 'Gerät' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeTruthy();
    expectAccessiblePage();

    reachable = true;
    fireEvent.click(within(banner).getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Gerät 626198' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-010.unreachable DER-54-13 shows P-06 when GET /api/devices/{id} takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi(
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    renderPage();
    await screen.findByText('Lade Gerät …');

    await vi.advanceTimersByTimeAsync(5000);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'resellr ist nicht erreichbar.',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Gerät' })).toBeTruthy();
  });
});
