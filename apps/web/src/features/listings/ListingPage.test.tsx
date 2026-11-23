import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../app/query-client.ts';
import { queryKeys } from '../../api/query-keys.ts';
import { routes } from '../../app/router.tsx';

// Component tests of UI-014 (CU-138) with a mocked `fetch` (Technical Specification 6.1, 6.2):
// head, listing values, devices and the states of opening a model listing (#198); the stock data
// in head and devices on opening and after the answer of an own action (#209).

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const attribute = (fields: Record<string, unknown>) => ({
  deviceTypeId: 1,
  systemRole: null,
  unit: null,
  unitSpacing: true,
  minValue: null,
  maxValue: null,
  pickListId: null,
  level: 'device',
  variantForming: false,
  required: false,
  datasheetBlock: 'none',
  active: true,
  version: 1,
  hasValues: true,
  ...fields,
});

const ATTRIBUTES = [
  attribute({ id: 11, label: 'Prozessor', dataType: 'text', level: 'model', sortOrder: 1 }),
  attribute({
    id: 12,
    label: 'RAM',
    dataType: 'integer',
    unit: 'GB',
    variantForming: true,
    sortOrder: 2,
  }),
  attribute({
    id: 13,
    label: 'Betriebssystem',
    dataType: 'pick',
    pickListId: 3,
    variantForming: true,
    sortOrder: 3,
  }),
  attribute({ id: 14, label: 'Betriebssystem-Version', dataType: 'text', sortOrder: 4 }),
  attribute({
    id: 15,
    label: 'Akkukapazität',
    dataType: 'battery_capacity',
    systemRole: 'battery_capacity',
    sortOrder: 5,
  }),
];

const DEVICE = {
  id: 41,
  wiNr: '626198',
  stockStatus: 'available',
  soldChannelId: null,
  soldOn: null,
  batteryCapacity: { percent: 85 },
  capturedOn: '2026-11-16',
};

const LISTING = {
  id: 9,
  modelTemplateId: 7,
  conditionValueId: 1,
  visualGrade: 2,
  conditionDescription: 'Display: feine Kratzer',
  variantValues: { '12': 16, '13': 31 },
  otherValues: { '14': 'macOS 14' },
  deliveryScopeTextBlockIds: [],
  articleNumber: '626198',
  eanMode: 'original',
  ownEan: null,
  displayTitle: 'MacBook Pro 13',
  quantity: 1,
  version: 1,
  stock: { quantity: 1, wiNrs: ['626198'], batteryText: '85 %', stockHash: 'ab12' },
  prices: [],
  devices: [
    DEVICE,
    {
      ...DEVICE,
      id: 42,
      wiNr: '626199',
      stockStatus: 'sold',
      soldChannelId: 1,
      soldOn: '2026-11-17',
      batteryCapacity: { notDeterminable: true },
    },
  ],
  deliveryScope: [],
};

const CANCELLED = {
  ...DEVICE,
  id: 43,
  wiNr: '626200',
  stockStatus: 'cancelled',
  batteryCapacity: null,
  capturedOn: '2026-11-18',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type ListingHandler = (url: URL, init: RequestInit | undefined) => Promise<Response> | Response;

/**
 * `fetch` of the page: the frame's status, the health check of P-06, the model listing and the
 * reads for its labels (model template, device types, attributes, pick lists, channels).
 */
function mockApi(listing: ListingHandler) {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://127.0.0.1');
      const { pathname } = url;
      if (pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (pathname.startsWith('/api/listings/')) {
        requests.push(`${pathname}${url.search}`);
        return listing(url, init);
      }
      if (pathname === '/api/model-templates/7') {
        return Response.json({
          id: 7,
          deviceTypeId: 1,
          originalEan: '0194252146835',
          modelValues: { '11': 'Intel Core i5' },
          defaultDeviceValues: {},
        });
      }
      if (pathname === '/api/device-types') {
        return Response.json({
          items: [{ id: 1, name: 'Notebook', active: true, version: 1, attributeCount: 5 }],
          total: 1,
        });
      }
      if (pathname === '/api/device-types/1/attributes') {
        return Response.json({ items: ATTRIBUTES, total: ATTRIBUTES.length });
      }
      if (pathname === '/api/pick-lists') {
        return Response.json({
          items: [
            { id: 1, key: 'condition', name: 'Zustand', isBatteryList: false, version: 1 },
            { id: 3, key: 'operating_system', name: 'OS', isBatteryList: false, version: 1 },
          ],
          total: 2,
        });
      }
      const values = /^\/api\/pick-lists\/(\d+)\/values$/.exec(pathname);
      if (values) {
        const value = (id: number, label: string) => ({
          id,
          label,
          active: true,
          batteryPresent: null,
          sortOrder: 1,
          version: 1,
        });
        const items = values[1] === '1' ? [value(1, 'gebraucht')] : [value(31, 'macOS')];
        return Response.json({ items, total: items.length });
      }
      if (pathname === '/api/channels') {
        return Response.json({
          items: [{ id: 1, code: 'shop', name: 'Shop', active: true, sortOrder: 1 }],
          total: 1,
        });
      }
      throw new Error(`unexpected request ${init?.method ?? 'GET'} ${pathname}`);
    }),
  );
  return { requests };
}

function renderPage(path = '/inserate/9', client = createQueryClient()) {
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </QueryClientProvider>,
  );
}

const pending = () => new Promise<Response>(() => {});

/** The listing values as pairs of term and value. */
function valueEntries() {
  const area = screen.getByRole('region', { name: 'Inseratswerte' });
  return within(area)
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
}

/** The rows of the area "Geräte" as cell texts. */
function deviceRows() {
  const table = screen.getByRole('table', { name: 'Geräte' });
  return within(table)
    .getAllByRole('row')
    .map((row) =>
      within(row)
        .queryAllByRole('cell')
        .map((cell) => cell.textContent),
    )
    .filter((cells) => cells.length > 0);
}

/** Accessibility assertion of a state: heading and named controls. */
function expectAccessiblePage(title = 'Modell-Inserat') {
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
  for (const control of [
    ...screen.queryAllByRole('button'),
    ...screen.getAllByRole('link'),
    ...screen.queryAllByRole('checkbox'),
  ]) {
    const name =
      control.textContent?.trim() ||
      control.getAttribute('aria-label') ||
      control.closest('label')?.textContent?.trim();
    expect(name).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UI-014 Modell-Inserat (CU-138)', () => {
  it('UI-014.default DER-60-01 shows head, listing values and devices with WI-Nr, inventory status, battery capacity and capture date', async () => {
    const { requests } = mockApi(() => Response.json(LISTING));

    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'MacBook Pro 13' })).toBeTruthy();
    expect(requests).toEqual(['/api/listings/9']);
    expect(screen.getByText('Notebook · Stückzahl 1 · Artikelnummer 626198')).toBeTruthy();
    expect(await screen.findByText('gebraucht')).toBeTruthy();
    expect(await screen.findByText('macOS')).toBeTruthy();
    expect(valueEntries()).toEqual([
      ['Zustand', 'gebraucht'],
      ['Optik-Note', '2'],
      ['RAM', '16 GB'],
      ['Betriebssystem', 'macOS'],
      ['Betriebssystem-Version', 'macOS 14'],
      ['Lieferumfang', '–'],
      ['Artikelnummer', '626198'],
      ['EAN', 'Original (0194252146835)'],
      ['Zustandsbeschreibung', 'Display: feine Kratzer'],
    ]);
    expect(await screen.findByText('verkauft (Shop, 17.11.2026)')).toBeTruthy();
    expect(deviceRows()).toEqual([
      ['626198', 'verfügbar', '85 %', '16.11.2026'],
      ['626199', 'verkauft (Shop, 17.11.2026)', 'nicht ermittelbar', '16.11.2026'],
    ]);
    expect(screen.getByRole('link', { name: '626198' }).getAttribute('href')).toBe('/geraete/41');
    expectAccessiblePage('MacBook Pro 13');
  });

  it('UI-014.loading UI-014.default DER-65-02 shows "Stückzahl n" of the stock data and the devices from GET /api/listings/{id} on opening', async () => {
    let answer: (response: Response) => void = () => {};
    mockApi(() => new Promise<Response>((resolve) => (answer = resolve)));

    renderPage();

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Lade Modell-Inserat …',
    );
    answer(
      Response.json({
        ...LISTING,
        quantity: 2,
        stock: {
          quantity: 2,
          wiNrs: ['626198', '626201'],
          batteryText: '85–90 %',
          stockHash: 'cd34',
        },
        devices: [
          ...LISTING.devices,
          { ...DEVICE, id: 44, wiNr: '626201', batteryCapacity: { percent: 90 } },
        ],
      }),
    );

    expect(await screen.findByText('Notebook · Stückzahl 2 · Artikelnummer 626198')).toBeTruthy();
    expect(await screen.findByText('verkauft (Shop, 17.11.2026)')).toBeTruthy();
    expect(deviceRows()).toEqual([
      ['626198', 'verfügbar', '85 %', '16.11.2026'],
      ['626199', 'verkauft (Shop, 17.11.2026)', 'nicht ermittelbar', '16.11.2026'],
      ['626201', 'verfügbar', '90 %', '16.11.2026'],
    ]);
    expectAccessiblePage('MacBook Pro 13');
  });

  it('UI-014.default DER-65-02 shows the new stock data in head and devices after the answer of an own action', async () => {
    const sold = {
      ...LISTING,
      quantity: 0,
      stock: { quantity: 0, wiNrs: [], batteryText: '', stockHash: 'ef56' },
      devices: [
        { ...DEVICE, stockStatus: 'sold', soldChannelId: 1, soldOn: '2026-11-19' },
        LISTING.devices[1],
      ],
    };
    let current: unknown = LISTING;
    const { requests } = mockApi(() => Response.json(current));
    const client = createQueryClient();

    renderPage('/inserate/9', client);

    expect(await screen.findByText('Notebook · Stückzahl 1 · Artikelnummer 626198')).toBeTruthy();
    // A write action reads the model listing again with its answer (2.0.8, `inventory`).
    current = sold;
    await act(() => client.invalidateQueries({ queryKey: queryKeys.inventory.all }));

    expect(await screen.findByText('Notebook · Stückzahl 0 · Artikelnummer 626198')).toBeTruthy();
    expect(deviceRows()).toEqual([
      ['626198', 'verkauft (Shop, 19.11.2026)', '85 %', '16.11.2026'],
      ['626199', 'verkauft (Shop, 17.11.2026)', 'nicht ermittelbar', '16.11.2026'],
    ]);
    expect(requests).toEqual(['/api/listings/9', '/api/listings/9']);
  });

  it('UI-014.default shows an own EAN as "eigene (Nr)" and the delivery scope by its names', async () => {
    mockApi(() =>
      Response.json({
        ...LISTING,
        eanMode: 'own',
        ownEan: '4006381333931',
        deliveryScopeTextBlockIds: [4, 5],
        deliveryScope: [
          { id: 4, name: 'Netzteil' },
          { id: 5, name: 'Handbuch' },
        ],
      }),
    );

    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'MacBook Pro 13' });
    expect(valueEntries()).toEqual(
      expect.arrayContaining([
        ['Lieferumfang', 'Netzteil, Handbuch'],
        ['EAN', 'eigene (4006381333931)'],
      ]),
    );
  });

  it('DER-60-05 shows no model data, but the hint that they are kept in the model template', async () => {
    mockApi(() => Response.json(LISTING));

    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'MacBook Pro 13' });
    const area = screen.getByRole('region', { name: 'Inseratswerte' });
    expect(
      within(area).getByText('Modelldaten werden in der Modellvorlage gepflegt.'),
    ).toBeTruthy();
    // The attribute "Prozessor" of the level model and its value are not shown.
    expect(screen.queryByText('Prozessor')).toBeNull();
    expect(screen.queryByText('Intel Core i5')).toBeNull();
  });

  it('UI-014.empty DER-60-03 shows a cancelled device only with the filter "auch stornierte"', async () => {
    const { requests } = mockApi((url) =>
      Response.json(
        url.searchParams.get('includeCancelled') === 'true'
          ? { ...LISTING, devices: [...LISTING.devices, CANCELLED] }
          : LISTING,
      ),
    );

    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'MacBook Pro 13' });
    expect(valueEntries()).toContainEqual(['Lieferumfang', '–']);
    expect(screen.queryByText('626200')).toBeNull();
    const filter = screen.getByRole('checkbox', { name: 'auch stornierte' }) as HTMLInputElement;
    expect(filter.checked).toBe(false);

    fireEvent.click(filter);

    expect(await screen.findByText('626200')).toBeTruthy();
    expect(deviceRows()[2]).toEqual(['626200', 'storniert', '–', '18.11.2026']);
    expect(requests).toEqual(['/api/listings/9', '/api/listings/9?includeCancelled=true']);

    fireEvent.click(filter);

    expect(screen.queryByText('626200')).toBeNull();
    expectAccessiblePage('MacBook Pro 13');
  });

  it('UI-014.loading DER-60-02 shows placeholder blocks with "Lade Modell-Inserat …" while the model listing loads', async () => {
    mockApi(pending);

    renderPage();

    expect((await screen.findByRole('status')).textContent).toBe('Lade Modell-Inserat …');
    expectAccessiblePage();
  });

  it('UI-014.error DER-60-02 shows the banner "Das Modell-Inserat konnte nicht geladen werden. Referenz: <Nr>" on 500 internal_error', async () => {
    mockApi(() =>
      Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
        status: 500,
      }),
    );

    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'Das Modell-Inserat konnte nicht geladen werden. Referenz: R-7K2M-9QX4',
    );
    expect(screen.queryByRole('status')).toBeNull();
    expectAccessiblePage();
  });

  it('shows "Dieser Eintrag ist nicht mehr vorhanden." for 404 not_found and for an address without id (M-15)', async () => {
    mockApi(() =>
      Response.json(
        errorBody('not_found', { message: 'Dieser Eintrag ist nicht mehr vorhanden.' }),
        { status: 404 },
      ),
    );

    renderPage('/inserate/999');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
    cleanup();

    const { requests } = mockApi(pending);
    renderPage('/inserate/abc');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
    expect(requests).toEqual([]);
  });

  it('UI-014.unreachable DER-60-06 shows P-06 with "Erneut versuchen" above the page when GET /api/listings/{id} gets no answer; it disappears after an answer', async () => {
    let reachable = false;
    mockApi(() => {
      if (!reachable) throw new TypeError('Failed to fetch');
      return Response.json(LISTING);
    });
    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    const content = screen.getByRole('main');
    expect(within(content).getByRole('heading', { level: 1, name: 'Modell-Inserat' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeTruthy();
    expectAccessiblePage();

    reachable = true;
    fireEvent.click(within(banner).getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'MacBook Pro 13' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-014.unreachable DER-60-06 keeps the loaded page under P-06 when the filter "auch stornierte" gets no answer; it disappears after an answer', async () => {
    let reachable = false;
    mockApi((url) => {
      if (url.searchParams.get('includeCancelled') !== 'true') return Response.json(LISTING);
      if (!reachable) throw new TypeError('Failed to fetch');
      return Response.json({ ...LISTING, devices: [...LISTING.devices, CANCELLED] });
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'MacBook Pro 13' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'auch stornierte' }));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(screen.getByRole('heading', { level: 1, name: 'MacBook Pro 13' })).toBeTruthy();
    expect(screen.getByText('Notebook · Stückzahl 1 · Artikelnummer 626198')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Inseratswerte' })).toBeTruthy();
    expect(deviceRows().map(([wiNr]) => wiNr)).toEqual(['626198', '626199']);
    expect(screen.getByRole('checkbox', { name: 'auch stornierte' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expectAccessiblePage('MacBook Pro 13');

    reachable = true;
    fireEvent.click(within(banner).getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByText('626200')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-014.unreachable DER-60-06 shows P-06 when GET /api/listings/{id} takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    renderPage();
    await screen.findByText('Lade Modell-Inserat …');

    await vi.advanceTimersByTimeAsync(5000);

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Modell-Inserat' })).toBeTruthy();
  });
});
