import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-039 with a mocked `fetch` (Technical Specification 6.1, 6.2).

const BLOCKS = ['identification', 'condition', 'delivery_scope', 'technical', 'ports', 'software'];

const LAYOUT = {
  headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:'],
  blockOrder: BLOCKS,
  attributeOrder: { '1': [11, 12, 13, 14] },
  version: 3,
};
const PUT = 'PUT /api/datasheet-layout';

const NOTEBOOK = { id: 1, name: 'Notebook', active: true, version: 1, attributeCount: 4 };
const MONITOR = { id: 2, name: 'Monitor', active: true, version: 1, attributeCount: 0 };

const attribute = (
  id: number,
  label: string,
  datasheetBlock: string,
  sortOrder: number,
  active = true,
) => ({
  id,
  deviceTypeId: 1,
  label,
  dataType: 'text',
  systemRole: null,
  unit: null,
  unitSpacing: true,
  minValue: null,
  maxValue: null,
  pickListId: null,
  level: 'device',
  variantForming: false,
  required: false,
  datasheetBlock,
  sortOrder,
  active,
  version: 1,
  hasValues: false,
});

const NOTEBOOK_ATTRIBUTES = [
  attribute(11, 'Prozessor', 'technical', 1),
  attribute(12, 'RAM', 'technical', 2),
  attribute(13, 'HDMI', 'ports', 3),
  attribute(14, 'Diskettenlaufwerk', 'technical', 4, false),
];

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame (UI-044), the layout, the device types
 * and their attributes, and one handler per write `METHOD path`. Records every request.
 */
function mockApi({
  read,
  writes = {},
  attributes = NOTEBOOK_ATTRIBUTES,
}: { read?: Route; writes?: Record<string, Route>; attributes?: unknown[] } = {}) {
  const sent: { method: string; path: string; body: unknown }[] = [];
  const requested: string[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    requested.push(`${method} ${path}`);
    if (path === '/api/ops/status') return Response.json(OPS_STATUS);
    if (method === 'GET' && path === '/api/datasheet-layout') {
      return read ? read(init) : Response.json(LAYOUT);
    }
    if (method === 'GET' && path.startsWith('/api/device-types?')) {
      return Response.json({ items: [NOTEBOOK, MONITOR], total: 2 });
    }
    if (method === 'GET' && path === '/api/device-types/1/attributes') {
      return Response.json({ items: attributes, total: attributes.length });
    }
    if (method === 'GET' && path === '/api/device-types/2/attributes') {
      return Response.json({ items: [], total: 0 });
    }
    const key = `${method} ${path}`;
    sent.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = writes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    return handler(init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, sent, requested };
}

function renderPage() {
  const router = createMemoryRouter(routes, {
    initialEntries: ['/einstellungen/datenblatt-layout'],
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const labelInput = (position: number) =>
  screen.getByRole<HTMLInputElement>('textbox', { name: `Kopfzeilentext ${position}` });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Speichern|Speichern …)$/ });
const blockList = () => screen.getByRole('list', { name: 'Blockreihenfolge' });
const blockRow = (name: string) =>
  within(blockList())
    .getAllByRole('listitem')
    .find((row) => row.textContent?.includes(name)) as HTMLElement;
const blockNames = () =>
  within(blockList())
    .getAllByRole('listitem')
    .map((row) => row.querySelector(':scope > span:last-child')?.textContent);
const attributeNames = (block: string) =>
  within(screen.getByRole('list', { name: block }))
    .getAllByRole('listitem')
    .map((row) => row.querySelector(':scope > span:last-child')?.textContent);
const attributeRow = (block: string, name: string) =>
  within(screen.getByRole('list', { name: block }))
    .getAllByRole('listitem')
    .find((row) => row.textContent?.includes(name)) as HTMLElement;
const previewLink = () => screen.getByRole('link', { name: 'Vorschau am Beispielgerät' });

/** A response that never arrives, e.g. a write without time limit (P-08). */
const pending = () => new Promise<Response>(() => {});

async function openPage() {
  const router = renderPage();
  await vi.waitFor(() => expect(labelInput(1).value).toBe('Shop:'));
  await screen.findByRole('list', { name: 'Technik' });
  return router;
}

function changeLabel(position: number, value: string) {
  fireEvent.change(labelInput(position), { target: { value } });
}

/** Accessibility assertion of a state: every control has a name, field errors are linked. */
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Datenblatt-Layout' })).toBeTruthy();
  for (const button of screen.getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
  for (const field of screen.queryAllByRole('textbox')) {
    expect(field.id && document.querySelector(`label[for="${field.id}"]`)).toBeTruthy();
    if (field.getAttribute('aria-invalid') !== 'true') continue;
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
  }
}

/**
 * Stubs `scrollIntoView` (not part of jsdom) and records the elements it scrolled to; on a long
 * page "Speichern" is at the end, the banners at the top (QA-R2-01).
 */
function recordScrolls() {
  const scrolled: Element[] = [];
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrolled.push(this);
  });
  return scrolled;
}

/** The result banner of "Speichern" was scrolled into view and has the focus (QA-R2-01). */
function expectBannerInView(banner: HTMLElement, scrolled: Element[]) {
  const region = document.activeElement as HTMLElement;
  expect(region.contains(banner)).toBe(true);
  expect(scrolled).toContain(region);
}

beforeEach(() => {
  recordScrolls();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('UI-039 datasheet layout (CU-102)', () => {
  it('UI-039.default shows header labels, the six blocks in order and the active attributes of the first device type per block', async () => {
    mockApi();
    await openPage();

    expect([1, 2, 3].map((position) => labelInput(position).value)).toEqual([
      'Shop:',
      'eBay:',
      'Kleinanzeigen:',
    ]);
    expect(blockNames()).toEqual([
      'Identifikation',
      'Zustand',
      'Lieferumfang',
      'Technik',
      'Anschlüsse',
      'Software',
    ]);
    expect(screen.getByRole('button', { name: 'Notebook' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(attributeNames('Technik')).toEqual(['Prozessor', 'RAM']);
    expect(attributeNames('Anschlüsse')).toEqual(['HDMI']);
    expect(screen.queryByText('Diskettenlaufwerk')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-039.loading DER-85-04 shows "Lade Einstellungen …" while GET /api/datasheet-layout runs', async () => {
    mockApi({ read: pending });
    renderPage();

    const statuses = await screen.findAllByRole('status');
    expect(statuses.map((status) => status.textContent)).toContain('Lade Einstellungen …');
    expect(screen.queryByRole('textbox')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-039.disabled DER-85-05 "Speichern" is disabled as long as nothing is changed', async () => {
    mockApi();
    await openPage();

    expect(saveButton().disabled).toBe(true);
    changeLabel(2, 'Ebay-Nr.:');
    expect(saveButton().disabled).toBe(false);
    changeLabel(2, 'eBay:');
    expect(saveButton().disabled).toBe(true);
    expectAccessiblePage();
  });

  it('UI-039.success DER-85-01 saves header labels, block order and attribute order changed with the keyboard and shows "Datenblatt-Layout gespeichert"', async () => {
    const saved = {
      headerLabels: ['Shop:', 'Ebay-Nr.:', 'Kleinanzeigen:'],
      blockOrder: [
        'identification',
        'condition',
        'delivery_scope',
        'ports',
        'technical',
        'software',
      ],
      attributeOrder: { '1': [12, 11, 13, 14] },
      version: 4,
    };
    const { sent } = mockApi({ writes: { [PUT]: () => Response.json(saved) } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    changeLabel(2, 'Ebay-Nr.:');
    fireEvent.click(within(blockRow('Anschlüsse')).getByRole('button', { name: 'Hoch' }));
    fireEvent.click(within(attributeRow('Technik', 'RAM')).getByRole('button', { name: 'Hoch' }));
    expect(blockNames().slice(3, 5)).toEqual(['Anschlüsse', 'Technik']);
    expect(attributeNames('Technik')).toEqual(['RAM', 'Prozessor']);
    fireEvent.click(saveButton());

    const banner = await screen.findByText('Datenblatt-Layout gespeichert');
    expect(banner.closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PUT',
        path: '/api/datasheet-layout',
        body: {
          version: 3,
          headerLabels: saved.headerLabels,
          blockOrder: saved.blockOrder,
          attributeOrder: saved.attributeOrder,
        },
      },
    ]);
    expect(saveButton().disabled).toBe(true);
    expectAccessiblePage();

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Datenblatt-Layout gespeichert')).toBeNull();
  });

  it('UI-039.success DER-85-01 an attribute created in UI-027 after loading the layout does not block saving a header label (FIND-379)', async () => {
    // The layout stores [11, 12, 13, 14] for Notebook; attribute 15 was created in UI-027 since.
    const created = [...NOTEBOOK_ATTRIBUTES, attribute(15, 'Akku', 'technical', 5)];
    const { sent } = mockApi({
      attributes: created,
      writes: { [PUT]: () => Response.json({ ...LAYOUT, version: 4 }) },
    });
    await openPage();
    expect(attributeNames('Technik')).toEqual(['Prozessor', 'RAM', 'Akku']);

    changeLabel(2, 'Ebay-Nr.:');
    fireEvent.click(saveButton());

    await screen.findByText('Datenblatt-Layout gespeichert');
    expect(sent).toEqual([
      {
        method: 'PUT',
        path: '/api/datasheet-layout',
        body: {
          version: 3,
          headerLabels: ['Shop:', 'Ebay-Nr.:', 'Kleinanzeigen:'],
          blockOrder: BLOCKS,
          attributeOrder: {},
        },
      },
    ]);
    expectAccessiblePage();
  });

  it('UI-039.success DER-85-01 dragging a block onto another and an attribute onto another changes the order to save', async () => {
    const { sent } = mockApi({ writes: { [PUT]: () => Response.json({ ...LAYOUT, version: 4 }) } });
    await openPage();
    const transfer = { effectAllowed: '', setData: vi.fn(), getData: vi.fn() };

    fireEvent.dragStart(blockRow('Software'), { dataTransfer: transfer });
    fireEvent.dragOver(blockRow('Identifikation'), { dataTransfer: transfer });
    fireEvent.drop(blockRow('Identifikation'), { dataTransfer: transfer });
    fireEvent.dragStart(attributeRow('Technik', 'RAM'), { dataTransfer: transfer });
    fireEvent.dragOver(attributeRow('Technik', 'Prozessor'), { dataTransfer: transfer });
    fireEvent.drop(attributeRow('Technik', 'Prozessor'), { dataTransfer: transfer });
    fireEvent.click(saveButton());

    await screen.findByText('Datenblatt-Layout gespeichert');
    expect(sent[0]?.body).toMatchObject({
      blockOrder: [
        'software',
        'identification',
        'condition',
        'delivery_scope',
        'technical',
        'ports',
      ],
      attributeOrder: { '1': [12, 11, 13, 14] },
    });
  });

  it('UI-039.empty DER-85-03 a device type without attributes in a datasheet block shows the notice and "Zu den Merkmalen (UI-027)"', async () => {
    mockApi();
    const router = await openPage();

    fireEvent.click(screen.getByRole('button', { name: 'Monitor' }));

    expect(
      await screen.findByText(
        'Für diese Geräteart sind noch keine Merkmale einem Datenblatt-Block zugeordnet',
      ),
    ).toBeTruthy();
    const toAttributes = screen.getByRole('button', { name: 'Zu den Merkmalen (UI-027)' });
    expect(toAttributes.className).toContain('bg-primary');
    expectAccessiblePage();

    fireEvent.click(toAttributes);
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/einstellungen/geraetearten'),
    );
  });

  it('UI-039.default DER-85-06 the preview link is disabled and GET /api/datasheets/preview-device is not requested', async () => {
    const { requested } = mockApi();
    await openPage();

    expect(previewLink().getAttribute('aria-disabled')).toBe('true');
    expect(previewLink().hasAttribute('href')).toBe(false);
    fireEvent.click(previewLink());
    expect(requested.some((request) => request.includes('/api/datasheets/preview-device'))).toBe(
      false,
    );
  });

  it('UI-039.validation DER-85-02 a header label with 51 characters shows "Kopfzeilentext: höchstens 50 Zeichen" at the field without a request', async () => {
    const { sent } = mockApi();
    await openPage();

    changeLabel(2, 'x'.repeat(51));
    fireEvent.click(saveButton());

    expect(await screen.findByText('Kopfzeilentext: höchstens 50 Zeichen')).toBeTruthy();
    expect(labelInput(2).getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(labelInput(2));
    expect(sent).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-039.validation DER-85-02 leaving a field checks it at once', async () => {
    mockApi();
    await openPage();

    changeLabel(3, 'x'.repeat(51));
    fireEvent.blur(labelInput(3));

    expect(screen.getByText('Kopfzeilentext: höchstens 50 Zeichen')).toBeTruthy();
  });

  it('UI-039.validation DER-85-02 shows the field error of a 422 validation_failed at its header label', async () => {
    mockApi({
      writes: {
        [PUT]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [
                {
                  path: 'headerLabels.0',
                  code: 'too_big',
                  message: 'Kopfzeilentext: höchstens 50 Zeichen',
                },
              ],
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();

    changeLabel(1, 'Webshop:');
    fireEvent.click(saveButton());

    expect(await screen.findByText('Kopfzeilentext: höchstens 50 Zeichen')).toBeTruthy();
    await vi.waitFor(() => expect(document.activeElement).toBe(labelInput(1)));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-039.error DER-85-04 a save with 500 internal_error shows the banner with the reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PUT]: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
      },
    });
    await openPage();

    changeLabel(2, 'Ebay-Nr.:');
    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Einstellungen konnten nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(labelInput(2).value).toBe('Ebay-Nr.:');
    expect(saveButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it.each([
    ['success', () => Response.json({ ...LAYOUT, version: 4 }), 'Datenblatt-Layout gespeichert'],
    [
      'error',
      () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
      'Referenz: R-7K2M-9QX4',
    ],
    [
      'conflict',
      () => Response.json(errorBody('version_conflict'), { status: 409 }),
      'Bitte neu laden und erneut prüfen.',
    ],
    [
      'wird-beendet',
      () => Response.json(errorBody('shutting_down'), { status: 503 }),
      'resellr wird gerade beendet.',
    ],
  ])(
    'UI-039.%s brings the banner after "Speichern" at the end of a long page into view and focuses it (QA-R2-01)',
    async (state, answer, text) => {
      mockApi({ writes: { [PUT]: answer } });
      await openPage();
      const scrolled = recordScrolls();

      changeLabel(2, 'Ebay-Nr.:');
      saveButton().focus();
      fireEvent.click(saveButton());

      const banner = await screen.findByRole(state === 'success' ? 'status' : 'alert');
      expect(banner.textContent).toContain(text);
      expectBannerInView(banner, scrolled);
      expectAccessiblePage();
    },
  );

  it('UI-039.speichert shows "Speichern …" and locks the inputs while the write runs', async () => {
    mockApi({ writes: { [PUT]: pending } });
    await openPage();

    changeLabel(2, 'Ebay-Nr.:');
    fireEvent.click(saveButton());

    expect(
      (await screen.findByRole('button', { name: 'Speichern …' })).hasAttribute('disabled'),
    ).toBe(true);
    expect(labelInput(2).disabled).toBe(true);
    expect(
      within(blockRow('Technik')).getByRole<HTMLButtonElement>('button', { name: 'Hoch' }).disabled,
    ).toBe(true);
  });

  it('UI-039.conflict DER-85-09 (a) shows P-05 with "Neu laden", saves nothing and keeps the inputs; "Neu laden" takes the reloaded data', async () => {
    let reads = 0;
    mockApi({
      read: () => {
        reads += 1;
        return Response.json(
          reads === 1
            ? LAYOUT
            : { ...LAYOUT, headerLabels: ['Webshop:', 'eBay:', 'Kleinanzeigen:'], version: 4 },
        );
      },
      writes: { [PUT]: () => Response.json(errorBody('version_conflict'), { status: 409 }) },
    });
    await openPage();

    changeLabel(2, 'Ebay-Nr.:');
    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.',
    );
    expect(labelInput(2).value).toBe('Ebay-Nr.:');
    expect(screen.queryByText('Datenblatt-Layout gespeichert')).toBeNull();
    expectAccessiblePage();

    fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(labelInput(1).value).toBe('Webshop:'));
    expect(labelInput(2).value).toBe('eBay:');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-039.wird-beendet DER-85-09 (b) shows P-07 without reference number and keeps the inputs', async () => {
    mockApi({
      writes: { [PUT]: () => Response.json(errorBody('shutting_down'), { status: 503 }) },
    });
    await openPage();

    changeLabel(2, 'Ebay-Nr.:');
    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-/);
    expect(labelInput(2).value).toBe('Ebay-Nr.:');
    expectAccessiblePage();
  });

  it('UI-039.unreachable DER-85-09 (d) shows the permanent P-06 with "Erneut versuchen" when the layout gets no answer', async () => {
    mockApi({
      read: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(within(banner).queryByRole('button', { name: 'Meldung schließen' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Datenblatt-Layout' })).toBeTruthy();
    expectAccessiblePage();
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-039.ausgang-unbekannt DER-85-09 (c) a save without answer shows "Ausgang unbekannt, bitte neu laden." and keeps "Speichern" locked without retry', async () => {
    const { sent } = mockApi({
      writes: {
        [PUT]: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    await openPage();
    const scrolled = recordScrolls();

    changeLabel(2, 'Ebay-Nr.:');
    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expectBannerInView(banner, scrolled);
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(labelInput(2).value).toBe('Ebay-Nr.:');
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(sent).toHaveLength(1);
    expectAccessiblePage();
  });
});
