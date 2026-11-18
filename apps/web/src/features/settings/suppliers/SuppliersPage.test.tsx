import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-032 with a mocked `fetch` (Technical Specification 6.1, 6.2).

const L1 = { id: 1, name: 'L1', active: true, version: 3 };
const L2 = { id: 2, name: 'L2', active: false, version: 1 };

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

type SupplierItem = typeof L1;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame (UI-044), the suppliers and one
 * handler per write `METHOD path`. Like the server, a saved supplier is part of the next list.
 * Records the list requests and the writes with their JSON body.
 */
function mockApi({
  initial = [L1, L2],
  list,
  writes = {},
}: { initial?: SupplierItem[]; list?: Route; writes?: Record<string, Route> } = {}) {
  const items = [...initial];
  const sent: { method: string; path: string; body: unknown }[] = [];
  const reads: string[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/ops/status') return Response.json(OPS_STATUS);
    if (method === 'GET' && path.startsWith('/api/suppliers')) {
      reads.push(path);
      return list ? list(init) : Response.json({ items, total: items.length });
    }
    const key = `${method} ${path}`;
    sent.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = writes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    const response = await handler(init);
    if (response.ok) {
      const saved = (await response.clone().json()) as SupplierItem;
      const index = items.findIndex((item) => item.id === saved.id);
      if (index === -1) items.push(saved);
      else items[index] = saved;
    }
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, sent, reads };
}

function renderSuppliers() {
  const router = createMemoryRouter(routes, { initialEntries: ['/einstellungen/lieferanten'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const nameInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Name/ });
const statusSwitch = () => screen.getByRole<HTMLButtonElement>('switch', { name: 'Status' });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Speichern|Speichern …)$/ });
const cancelButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Abbrechen' });
const createButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Lieferant anlegen' });
const listRegion = () => screen.getByRole('region', { name: 'Lieferanten' });

const SAVED_L1 = { ...L1, name: 'Lieferant Eins', version: 4 };
const PATCH_L1 = 'PATCH /api/suppliers/1';

/** A response that never arrives, e.g. a write without time limit (P-08). */
const pending = () => new Promise<Response>(() => {});

async function openPage() {
  renderSuppliers();
  await screen.findByRole('button', { name: /^L1/ });
  await vi.waitFor(() => expect(nameInput().value).toBe('L1'));
}

function rename(name: string) {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.click(saveButton());
}

/** First half of a mouse click: the button goes down on the element (focus moves after it). */
function pressPointer(element: HTMLElement) {
  fireEvent.pointerDown(element);
  fireEvent.mouseDown(element);
}

/** Second half of a mouse click, in the order of the browser: `pointerup`, `mouseup`, `click`. */
async function releasePointerAndClick(element: HTMLElement) {
  await act(async () => {
    fireEvent.pointerUp(element);
    fireEvent.mouseUp(element);
    fireEvent.click(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Accessibility assertion of a state: every control has a name, field errors are linked. */
function expectAccessibleForm() {
  expect(nameInput().getAttribute('aria-required')).toBe('true');
  expect(statusSwitch().getAttribute('aria-checked')).toMatch(/^(true|false)$/);
  const describedBy = nameInput().getAttribute('aria-describedby');
  if (nameInput().getAttribute('aria-invalid') === 'true') {
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
  }
  for (const button of screen.getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
  expect(screen.getByRole('heading', { level: 1, name: 'Lieferanten' })).toBeTruthy();
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('UI-032 suppliers (CU-099)', () => {
  it('UI-032.default shows the suppliers with status from GET /api/suppliers?includeInactive=true and opens the first one', async () => {
    const { reads } = mockApi();
    await openPage();

    const rows = within(listRegion()).getAllByRole('button', { name: /^L\d/ });
    expect(rows.map((row) => row.textContent)).toEqual(['L1aktiv', 'L2deaktiviert']);
    expect(rows[0]?.getAttribute('aria-current')).toBe('true');
    expect(within(listRegion()).getByText('2')).toBeTruthy();
    expect(statusSwitch().getAttribute('aria-checked')).toBe('true');
    expect(reads[0]).toBe('/api/suppliers?includeInactive=true&limit=200');
    expectAccessibleForm();
  });

  it('UI-032.default DER-36-08 offers no deletion, also not for a deactivated supplier', async () => {
    mockApi();
    await openPage();

    fireEvent.click(screen.getByRole('button', { name: /^L2/ }));

    expect(nameInput().value).toBe('L2');
    expect(statusSwitch().getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('button', { name: /löschen|entfernen/i })).toBeNull();
    expect(screen.queryByText(/löschen/i)).toBeNull();
  });

  it('UI-032.loading DER-36-01 shows "Lade Einstellungen …" while GET /api/suppliers runs', async () => {
    mockApi({ list: pending });
    renderSuppliers();

    expect((await screen.findByRole('status')).textContent).toBe('Lade Einstellungen …');
    expect(nameInput().disabled).toBe(true);
    expect(screen.queryByText('Noch keine Lieferanten')).toBeNull();
    expectAccessibleForm();
  });

  it('UI-032.empty DER-36-02 shows "Noch keine Lieferanten" in the list area with the primary button "Lieferant anlegen" below it', async () => {
    const created = { id: 1, name: 'L1', active: true, version: 1 };
    const { sent } = mockApi({
      initial: [],
      writes: { 'POST /api/suppliers': () => Response.json(created, { status: 201 }) },
    });
    renderSuppliers();

    const text = await within(listRegion()).findByText('Noch keine Lieferanten');
    const buttons = within(listRegion()).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['+Lieferant anlegen']);
    expect(buttons[0]?.className).toContain('bg-primary');
    expect(text.compareDocumentPosition(buttons[0] as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expectAccessibleForm();

    fireEvent.click(createButton());
    rename('L1');

    await screen.findByText('Gespeichert');
    expect(sent).toEqual([
      { method: 'POST', path: '/api/suppliers', body: { name: 'L1', active: true } },
    ]);
    expect(within(listRegion()).queryByText('Noch keine Lieferanten')).toBeNull();
  });

  it('UI-032.success DER-36-03 shows "Gespeichert" after a rename and closes it after 5 s', async () => {
    const { sent } = mockApi({ writes: { [PATCH_L1]: () => Response.json(SAVED_L1) } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('Lieferant Eins');

    const banner = await screen.findByText('Gespeichert');
    expect(banner.closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/suppliers/1',
        body: { version: 3, name: 'Lieferant Eins', active: true },
      },
    ]);
    expect(nameInput().value).toBe('Lieferant Eins');
    expect(screen.getByRole('button', { name: /Lieferant Eins/ })).toBeTruthy();
    expectAccessibleForm();

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Gespeichert')).toBeNull();
  });

  it('UI-032.success DER-36-03 AC-REQ-099-01 "Lieferant anlegen" creates "L3" and marks it in the list', async () => {
    const l3 = { id: 3, name: 'L3', active: true, version: 1 };
    const { sent } = mockApi({
      writes: { 'POST /api/suppliers': () => Response.json(l3, { status: 201 }) },
    });
    await openPage();

    fireEvent.click(createButton());
    expect(nameInput().value).toBe('');
    expect(statusSwitch().getAttribute('aria-checked')).toBe('true');
    rename('L3');

    expect((await screen.findByText('Gespeichert')).closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      { method: 'POST', path: '/api/suppliers', body: { name: 'L3', active: true } },
    ]);
    expect(screen.getByRole('button', { name: /^L3/ }).getAttribute('aria-current')).toBe('true');
  });

  it('UI-032.success AC-REQ-099-03 the switch deactivates a supplier', async () => {
    const { sent } = mockApi({
      writes: { [PATCH_L1]: () => Response.json({ ...L1, active: false, version: 4 }) },
    });
    await openPage();

    fireEvent.click(statusSwitch());
    expect(statusSwitch().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(saveButton());

    await screen.findByText('Gespeichert');
    expect(sent[0]?.body).toEqual({ version: 3, name: 'L1', active: false });
    expect(screen.getByRole('button', { name: /^L1/ }).textContent).toContain('deaktiviert');
  });

  it('UI-032.disabled DER-36-07 "Speichern" is disabled without a change and enabled after one', async () => {
    const { sent } = mockApi();
    await openPage();

    expect(saveButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    fireEvent.submit(nameInput().form as HTMLFormElement);
    expect(sent).toEqual([]);

    fireEvent.change(nameInput(), { target: { value: 'L1 neu' } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.change(nameInput(), { target: { value: 'L1' } });
    expect(saveButton().disabled).toBe(true);

    fireEvent.click(statusSwitch());
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(statusSwitch());
    expect(saveButton().disabled).toBe(true);
    expectAccessibleForm();
  });

  it('UI-032.disabled DER-36-07 a new supplier without input cannot be saved', async () => {
    mockApi();
    await openPage();

    fireEvent.click(createButton());

    expect(saveButton().disabled).toBe(true);
    fireEvent.change(nameInput(), { target: { value: 'L3' } });
    expect(saveButton().disabled).toBe(false);
  });

  it('"Abbrechen" takes back the changes of the open supplier and leaves "Lieferant anlegen" (P-01)', async () => {
    mockApi();
    await openPage();

    fireEvent.change(nameInput(), { target: { value: 'L1 neu' } });
    fireEvent.click(statusSwitch());
    fireEvent.click(cancelButton());
    expect(nameInput().value).toBe('L1');
    expect(statusSwitch().getAttribute('aria-checked')).toBe('true');

    fireEvent.click(createButton());
    fireEvent.change(nameInput(), { target: { value: 'L3' } });
    fireEvent.click(cancelButton());
    expect(nameInput().value).toBe('L1');
    expect(screen.getByRole('button', { name: /^L1/ }).getAttribute('aria-current')).toBe('true');
  });

  it.each([
    ['empty', ''],
    ['101 characters', 'x'.repeat(101)],
  ])(
    'UI-032.validation DER-36-05 a name that is %s shows "Name: 1 bis 100 Zeichen" in the browser with the focus on it',
    async (_case, name) => {
      const { sent } = mockApi();
      await openPage();

      rename(name);

      expect(await screen.findByText('Name: 1 bis 100 Zeichen')).toBeTruthy();
      expect(document.activeElement).toBe(nameInput());
      expect(nameInput().getAttribute('aria-invalid')).toBe('true');
      expect(sent).toEqual([]);
      expectAccessibleForm();
    },
  );

  it('UI-032.validation DER-36-05 leaving an empty "Name" of a new supplier shows the text at once', async () => {
    mockApi();
    await openPage();
    fireEvent.click(createButton());

    fireEvent.blur(nameInput());

    expect(screen.getByText('Name: 1 bis 100 Zeichen')).toBeTruthy();
    expectAccessibleForm();
  });

  it('UI-032.validation DER-36-05 shows the field error of a 422 validation_failed at "Name" with the focus on it', async () => {
    mockApi({
      writes: {
        [PATCH_L1]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [{ path: 'name', code: 'too_big', message: 'Name: 1 bis 100 Zeichen' }],
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();

    rename('L1 neu');

    expect(await screen.findByText('Name: 1 bis 100 Zeichen')).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
    expect(nameInput().value).toBe('L1 neu');
  });

  it('UI-032.validation AC-REQ-099-02 shows "Name ist bereits vergeben" at the field', async () => {
    mockApi({
      writes: {
        'POST /api/suppliers': () =>
          Response.json(errorBody('name_taken', { message: 'Name ist bereits vergeben' }), {
            status: 422,
          }),
      },
    });
    await openPage();
    fireEvent.click(createButton());

    rename('l1');

    expect(await screen.findByText('Name ist bereits vergeben')).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
    expect(nameInput().getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText('Gespeichert')).toBeNull();
    expectAccessibleForm();
  });

  // The check on leaving the field must not change the error line while the mouse button is
  // pressed on "Speichern"; otherwise the button moves and the click is lost.
  it('UI-032.validation DER-36-05 a mouse click on save after a corrected name saves', async () => {
    const { sent } = mockApi({ writes: { [PATCH_L1]: () => Response.json(SAVED_L1) } });
    await openPage();
    fireEvent.change(nameInput(), { target: { value: 'x'.repeat(101) } });
    fireEvent.blur(nameInput());
    expect(screen.getByText('Name: 1 bis 100 Zeichen')).toBeTruthy();
    nameInput().focus();
    fireEvent.change(nameInput(), { target: { value: 'Lieferant Eins' } });

    pressPointer(saveButton());
    fireEvent.blur(nameInput());
    expect(screen.getByText('Name: 1 bis 100 Zeichen')).toBeTruthy();
    await releasePointerAndClick(saveButton());

    expect(await screen.findByText('Gespeichert')).toBeTruthy();
    expect(sent.map((write) => write.body)).toEqual([
      { version: 3, name: 'Lieferant Eins', active: true },
    ]);
    expect(screen.queryByText('Name: 1 bis 100 Zeichen')).toBeNull();
  });

  it('UI-032.error DER-36-04 shows the error banner with the reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PATCH_L1]: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
      },
    });
    await openPage();

    rename('Lieferant Eins');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Einstellungen konnten nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(nameInput().value).toBe('Lieferant Eins');
    expect(saveButton().disabled).toBe(false);
    expectAccessibleForm();
  });

  it('UI-032.speichert DER-36-09 locks the trigger and all inputs while the write runs, without time limit', async () => {
    mockApi({ writes: { [PATCH_L1]: pending } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('Lieferant Eins');

    expect(
      (await screen.findByRole('button', { name: 'Speichern …' })).hasAttribute('disabled'),
    ).toBe(true);
    expect(nameInput().disabled).toBe(true);
    expect(statusSwitch().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /^L2/ }).disabled).toBe(true);
    // No time limit for writes (Ä-29): still saving after a minute.
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(screen.getByRole('button', { name: 'Speichern …' })).toBeTruthy();
    expectAccessibleForm();
  });

  it('UI-032.conflict DER-36-06 (a) shows P-05 with "Neu laden" and keeps the inputs; "Neu laden" takes the reloaded data', async () => {
    let listCalls = 0;
    mockApi({
      list: () => {
        listCalls += 1;
        const l1 = listCalls === 1 ? L1 : { ...L1, name: 'L1 Pro', version: 4 };
        return Response.json({ items: [l1, L2], total: 2 });
      },
      writes: { [PATCH_L1]: () => Response.json(errorBody('version_conflict'), { status: 409 }) },
    });
    await openPage();

    rename('Lieferant Eins');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.',
    );
    expect(nameInput().value).toBe('Lieferant Eins');
    expect(screen.queryByText('Gespeichert')).toBeNull();
    expectAccessibleForm();

    fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(nameInput().value).toBe('L1 Pro'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  it('UI-032.unreachable DER-36-06 (b) shows P-06 with "Erneut versuchen" when the list gets no answer, without replacing the page', async () => {
    mockApi({
      list: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderSuppliers();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(listRegion()).toBeTruthy();
    expect(screen.queryByText('Noch keine Lieferanten')).toBeNull();
    expectAccessibleForm();
  });

  it('UI-032.unreachable DER-36-06 (b) shows P-06 when the list takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      list: (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    renderSuppliers();
    await screen.findByText('Lade Einstellungen …');

    await act(() => vi.advanceTimersByTimeAsync(5000));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
  });

  it('UI-032.wird-beendet DER-36-06 (c) shows P-07 without reference number and keeps the inputs', async () => {
    mockApi({
      writes: { [PATCH_L1]: () => Response.json(errorBody('shutting_down'), { status: 503 }) },
    });
    await openPage();

    rename('Lieferant Eins');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-/);
    expect(nameInput().value).toBe('Lieferant Eins');
    expectAccessibleForm();
  });

  it('shows "Dieser Eintrag ist nicht mehr vorhanden." when the supplier is gone', async () => {
    mockApi({
      writes: {
        [PATCH_L1]: () =>
          Response.json(
            errorBody('not_found', { message: 'Dieser Eintrag ist nicht mehr vorhanden.' }),
            { status: 404 },
          ),
      },
    });
    await openPage();

    rename('Lieferant Eins');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-032.ausgang-unbekannt DER-36-09 a save without HTTP answer shows "Ausgang unbekannt, bitte neu laden." without button and locks every further write', async () => {
    const { sent } = mockApi({
      writes: {
        [PATCH_L1]: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    await openPage();

    rename('Lieferant Eins');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(nameInput().value).toBe('Lieferant Eins');
    expect(saveButton().disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(sent).toHaveLength(1);
    expectAccessibleForm();
  });
});
