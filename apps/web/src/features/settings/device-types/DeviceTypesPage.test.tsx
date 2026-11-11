import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-027 with a mocked `fetch` (Technical Specification 6.1, 6.2).

const NOTEBOOK = { id: 1, name: 'Notebook', active: true, version: 3, attributeCount: 10 };
const TABLET = { id: 2, name: 'Tablet', active: false, version: 1, attributeCount: 7 };

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

type DeviceTypeItem = typeof NOTEBOOK;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame (UI-044), the device types and one
 * handler per write `METHOD path`. Like the server, a saved device type is part of the next list.
 * Records the writes with their JSON body.
 */
function mockApi({ list, writes = {} }: { list?: Route; writes?: Record<string, Route> } = {}) {
  const items: DeviceTypeItem[] = [NOTEBOOK, TABLET];
  const sent: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/ops/status') return Response.json(OPS_STATUS);
    if (method === 'GET' && path.startsWith('/api/device-types')) {
      return list ? list(init) : Response.json({ items, total: items.length });
    }
    const key = `${method} ${path}`;
    sent.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = writes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    const response = await handler(init);
    if (response.ok) {
      const saved = (await response.clone().json()) as DeviceTypeItem;
      const index = items.findIndex((item) => item.id === saved.id);
      if (index === -1) items.push(saved);
      else items[index] = saved;
    }
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, sent };
}

function renderDeviceTypes() {
  const router = createMemoryRouter(routes, { initialEntries: ['/einstellungen/geraetearten'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const nameInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Name/ });
const statusSwitch = () => screen.getByRole('switch', { name: 'Status' });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Geräteart speichern|Speichern …)$/ });
const listRegion = () => screen.getByRole('region', { name: 'Gerätearten' });

const SAVED_NOTEBOOK = { ...NOTEBOOK, name: 'Laptop', version: 4 };
const PATCH_NOTEBOOK = 'PATCH /api/device-types/1';

/** A response that never arrives, e.g. a write without time limit (P-08). */
const pending = () => new Promise<Response>(() => {});

async function openPage() {
  renderDeviceTypes();
  await screen.findByRole('button', { name: /Notebook/ });
  await vi.waitFor(() => expect(nameInput().value).toBe('Notebook'));
}

function rename(name: string) {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.click(saveButton());
}

/** Types into "Name" like the user: the field has the focus. */
function typeName(value: string) {
  act(() => nameInput().focus());
  fireEvent.change(nameInput(), { target: { value } });
}

/** Leaves "Name" with the keyboard (Tab): the focus moves to the next control. */
function leaveNameByKeyboard() {
  act(() => statusSwitch().focus());
}

/**
 * First half of a mouse click: the button goes down on the element and, like in the browser, the
 * focus moves to it, so "Name" loses it.
 */
function pressPointer(element: HTMLElement) {
  fireEvent.pointerDown(element);
  fireEvent.mouseDown(element);
  act(() => element.focus());
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

/**
 * Another window renamed "Notebook" to "Notebook Pro" (version 4) after the first list request.
 * Like the server, `PATCH` answers `409 version_conflict` unless it sends version 4.
 */
function mockConcurrentChange() {
  let listCalls = 0;
  return mockApi({
    list: () => {
      listCalls += 1;
      const notebook =
        listCalls === 1 ? NOTEBOOK : { ...NOTEBOOK, name: 'Notebook Pro', version: 4 };
      return Response.json({ items: [notebook, TABLET], total: 2 });
    },
    writes: {
      [PATCH_NOTEBOOK]: (init) => {
        const body = JSON.parse(String(init?.body)) as { version: number; name: string };
        return body.version === 4
          ? Response.json({ ...NOTEBOOK, name: body.name, version: 5 })
          : Response.json(errorBody('version_conflict'), { status: 409 });
      },
    },
  });
}

/** The browser window gets the focus again; TanStack Query loads the list in the background. */
async function refetchOnFocus() {
  fireEvent(window, new Event('visibilitychange'));
  await screen.findByRole('button', { name: /Notebook Pro/ });
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
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('UI-027 device types (CU-095)', () => {
  it('UI-027.default shows the device types with status, opens the first one and offers no deletion (AC-REQ-004-04)', async () => {
    mockApi();
    await openPage();

    const rows = within(listRegion()).getAllByRole('button', { name: /Merkmal/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      'Notebookaktiv10 Merkmale',
      'Tabletdeaktiviert7 Merkmale',
    ]);
    expect(rows[0]?.getAttribute('aria-current')).toBe('true');
    expect(within(listRegion()).getByText('2')).toBeTruthy();
    expect(statusSwitch().getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: 'Geräteart anlegen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Geräteart speichern' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /löschen/i })).toBeNull();
    expect(screen.queryByText(/löschen/i)).toBeNull();
    expectAccessibleForm();
  });

  it('UI-027.default selecting another device type shows its name and status', async () => {
    mockApi();
    await openPage();

    fireEvent.click(screen.getByRole('button', { name: /Tablet/ }));

    expect(nameInput().value).toBe('Tablet');
    expect(statusSwitch().getAttribute('aria-checked')).toBe('false');
  });

  it('UI-027.loading DER-33-04 shows "Lade Gerätearten …" while GET /api/device-types runs', async () => {
    mockApi({ list: pending });
    renderDeviceTypes();

    expect((await screen.findByRole('status')).textContent).toBe('Lade Gerätearten …');
    expect(nameInput().disabled).toBe(true);
    expectAccessibleForm();
  });

  it('UI-027.success DER-33-05 shows "Geräteart gespeichert" after a rename and closes it after 5 s', async () => {
    const { sent } = mockApi({ writes: { [PATCH_NOTEBOOK]: () => Response.json(SAVED_NOTEBOOK) } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('Laptop');

    const banner = await screen.findByText('Geräteart gespeichert');
    expect(banner.closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/device-types/1',
        body: { version: 3, name: 'Laptop', active: true },
      },
    ]);
    expect(nameInput().value).toBe('Laptop');
    expect(screen.getByRole('button', { name: /Laptop/ })).toBeTruthy();
    expectAccessibleForm();

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Geräteart gespeichert')).toBeNull();
  });

  it('UI-027.success DER-33-12 a rename opens no impact dialog UI-043', async () => {
    mockApi({ writes: { [PATCH_NOTEBOOK]: () => Response.json(SAVED_NOTEBOOK) } });
    await openPage();

    rename('Laptop');

    await screen.findByText('Geräteart gespeichert');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('UI-027.success AC-REQ-004-01 "Geräteart anlegen" creates "Monitor" and marks it in the list', async () => {
    const monitor = { id: 3, name: 'Monitor', active: true, version: 1, attributeCount: 0 };
    const { sent } = mockApi({
      writes: { 'POST /api/device-types': () => Response.json(monitor, { status: 201 }) },
    });
    await openPage();

    fireEvent.click(screen.getByRole('button', { name: 'Geräteart anlegen' }));
    expect(nameInput().value).toBe('');
    expect(statusSwitch().getAttribute('aria-checked')).toBe('true');
    rename('Monitor');

    await screen.findByText('Geräteart gespeichert');
    expect(sent).toEqual([
      { method: 'POST', path: '/api/device-types', body: { name: 'Monitor', active: true } },
    ]);
    expect(screen.getByRole('button', { name: /Monitor/ }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('UI-027.success AC-REQ-004-03 the switch deactivates a device type', async () => {
    const { sent } = mockApi({
      writes: { [PATCH_NOTEBOOK]: () => Response.json({ ...NOTEBOOK, active: false, version: 4 }) },
    });
    await openPage();

    fireEvent.click(statusSwitch());
    expect(statusSwitch().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(saveButton());

    await screen.findByText('Geräteart gespeichert');
    expect(sent[0]?.body).toEqual({ version: 3, name: 'Notebook', active: false });
    expect(screen.getByRole('button', { name: /Notebook/ }).textContent).toContain('deaktiviert');
  });

  it.each([
    ['empty', ''],
    ['51 characters', 'x'.repeat(51)],
  ])(
    'UI-027.validation DER-33-06 a name that is %s shows "Name: 1 bis 50 Zeichen" in the browser with the focus on it',
    async (_case, name) => {
      const { sent } = mockApi();
      await openPage();

      rename(name);

      expect(await screen.findByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
      expect(document.activeElement).toBe(nameInput());
      expect(nameInput().getAttribute('aria-invalid')).toBe('true');
      expect(sent).toEqual([]);
      expectAccessibleForm();
    },
  );

  it('UI-027.validation DER-33-06 shows the field error of a 422 validation_failed at "Name" with the focus on it', async () => {
    mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [{ path: 'name', code: 'too_big', message: 'Name: 1 bis 50 Zeichen' }],
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();

    rename('Laptop');

    expect(await screen.findByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
    expect(nameInput().value).toBe('Laptop');
  });

  it('UI-027.validation AC-REQ-004-02 shows "Name ist bereits vergeben" at the field', async () => {
    mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () =>
          Response.json(errorBody('name_taken', { message: 'Name ist bereits vergeben' }), {
            status: 422,
          }),
      },
    });
    await openPage();

    rename('tablet');

    expect(await screen.findByText('Name ist bereits vergeben')).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
    expect(screen.queryByText('Geräteart gespeichert')).toBeNull();
  });

  it('UI-027.validation DER-33-06 leaving "Name" with the keyboard checks the field at once', async () => {
    mockApi();
    await openPage();

    typeName('x'.repeat(51));
    leaveNameByKeyboard();

    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    expectAccessibleForm();
  });

  // QA-D1: the check on leaving the field must not change the error line while the mouse button
  // is pressed on "Geräteart speichern"; otherwise the button moves and the click is lost.
  it('UI-027.validation DER-33-06 a mouse click on save after an invalid name shows the error after the click, without request', async () => {
    const { sent } = mockApi();
    await openPage();
    fireEvent.click(screen.getByRole('button', { name: 'Geräteart anlegen' }));
    typeName('x'.repeat(51));

    pressPointer(saveButton());
    expect(screen.queryByText('Name: 1 bis 50 Zeichen')).toBeNull();
    await releasePointerAndClick(saveButton());

    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
    expect(sent).toEqual([]);
  });

  it('UI-027.validation DER-33-06 a mouse click on save after a corrected name saves when renaming', async () => {
    const { sent } = mockApi({ writes: { [PATCH_NOTEBOOK]: () => Response.json(SAVED_NOTEBOOK) } });
    await openPage();
    typeName('x'.repeat(51));
    leaveNameByKeyboard();
    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    typeName('Laptop');

    pressPointer(saveButton());
    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    await releasePointerAndClick(saveButton());

    expect(await screen.findByText('Geräteart gespeichert')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/device-types/1',
        body: { version: 3, name: 'Laptop', active: true },
      },
    ]);
    expect(screen.queryByText('Name: 1 bis 50 Zeichen')).toBeNull();
  });

  it('UI-027.validation AC-REQ-004-02 a mouse click on save after a corrected name sends the new device type and shows "Name ist bereits vergeben"', async () => {
    const { sent } = mockApi({
      writes: {
        'POST /api/device-types': () =>
          Response.json(errorBody('name_taken', { message: 'Name ist bereits vergeben' }), {
            status: 422,
          }),
      },
    });
    await openPage();
    fireEvent.click(screen.getByRole('button', { name: 'Geräteart anlegen' }));
    typeName('x'.repeat(51));
    leaveNameByKeyboard();
    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    typeName('Tablet');

    pressPointer(saveButton());
    await releasePointerAndClick(saveButton());

    expect(await screen.findByText('Name ist bereits vergeben')).toBeTruthy();
    expect(screen.queryByText('Name: 1 bis 50 Zeichen')).toBeNull();
    expect(document.activeElement).toBe(nameInput());
    expect(sent).toEqual([
      { method: 'POST', path: '/api/device-types', body: { name: 'Tablet', active: true } },
    ]);
  });

  it('UI-027.validation DER-33-06 a mouse click on the status switch after an invalid name toggles it', async () => {
    mockApi();
    await openPage();
    typeName('x'.repeat(51));

    pressPointer(statusSwitch());
    expect(screen.queryByText('Name: 1 bis 50 Zeichen')).toBeNull();
    await releasePointerAndClick(statusSwitch());

    expect(statusSwitch().getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
  });

  it('UI-027.error DER-33-10 shows the error banner with the reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
      },
    });
    await openPage();

    rename('Laptop');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Einstellungen konnten nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(nameInput().value).toBe('Laptop');
    expect(saveButton().disabled).toBe(false);
    expectAccessibleForm();
  });

  it('UI-027.speichert DER-33-07 shows "Speichern …" and locks all inputs without time limit', async () => {
    mockApi({ writes: { [PATCH_NOTEBOOK]: pending } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('Laptop');

    expect(
      (await screen.findByRole('button', { name: 'Speichern …' })).hasAttribute('disabled'),
    ).toBe(true);
    expect(nameInput().disabled).toBe(true);
    expect((statusSwitch() as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Geräteart anlegen' }).disabled,
    ).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Tablet/ }).disabled).toBe(true);
    // No time limit for writes (Ä-29): still saving after a minute.
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(screen.getByRole('button', { name: 'Speichern …' })).toBeTruthy();
    expectAccessibleForm();
  });

  it('UI-027.conflict DER-33-08 (a) shows P-05 with "Neu laden" and keeps the inputs; "Neu laden" takes the reloaded data', async () => {
    let listCalls = 0;
    mockApi({
      list: () => {
        listCalls += 1;
        const notebook =
          listCalls === 1 ? NOTEBOOK : { ...NOTEBOOK, name: 'Notebook Pro', version: 4 };
        return Response.json({ items: [notebook, TABLET], total: 2 });
      },
      writes: {
        [PATCH_NOTEBOOK]: () => Response.json(errorBody('version_conflict'), { status: 409 }),
      },
    });
    await openPage();

    rename('Laptop');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.',
    );
    expect(nameInput().value).toBe('Laptop');
    expect(screen.queryByText('Geräteart gespeichert')).toBeNull();
    expectAccessibleForm();

    fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(nameInput().value).toBe('Notebook Pro'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-027.conflict DER-33-08 (a) a refetch between opening and saving sends the version the form is based on and shows P-05', async () => {
    const { sent } = mockConcurrentChange();
    await openPage();

    fireEvent.change(nameInput(), { target: { value: 'Laptop' } });
    await refetchOnFocus();
    fireEvent.click(saveButton());

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert.',
    );
    expect(sent.map((write) => write.body)).toEqual([{ version: 3, name: 'Laptop', active: true }]);
    expect(nameInput().value).toBe('Laptop');
    expect(screen.queryByText('Geräteart gespeichert')).toBeNull();
    expectAccessibleForm();
  });

  it('UI-027.conflict DER-33-08 (a) after P-05 a focus change before "Neu laden" does not overwrite the other change', async () => {
    const { sent } = mockConcurrentChange();
    await openPage();

    rename('Laptop');
    await screen.findByRole('alert');
    await refetchOnFocus();
    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(sent.map((write) => write.body)).toEqual([
      { version: 3, name: 'Laptop', active: true },
      { version: 3, name: 'Laptop', active: true },
    ]);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Geräteart gespeichert')).toBeNull();

    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(nameInput().value).toBe('Notebook Pro'));
    expect(screen.queryByRole('alert')).toBeNull();
    rename('Laptop');
    await screen.findByText('Geräteart gespeichert');
    expect(sent[2]?.body).toEqual({ version: 4, name: 'Laptop', active: true });
  });

  it('UI-027.unreachable DER-33-08 (b) shows P-06 with "Erneut versuchen" when the list gets no answer, without replacing the page', async () => {
    mockApi({
      list: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderDeviceTypes();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Gerätearten und Merkmale' })).toBeTruthy();
    expect(listRegion()).toBeTruthy();
    expectAccessibleForm();
  });

  it('UI-027.wird-beendet DER-33-08 (c) shows P-07 without reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () => Response.json(errorBody('shutting_down'), { status: 503 }),
      },
    });
    await openPage();

    rename('Laptop');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-/);
    expect(nameInput().value).toBe('Laptop');
    expectAccessibleForm();
  });

  it('shows "Dieser Eintrag ist nicht mehr vorhanden." when the device type is gone', async () => {
    mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () =>
          Response.json(
            errorBody('not_found', { message: 'Dieser Eintrag ist nicht mehr vorhanden.' }),
            {
              status: 404,
            },
          ),
      },
    });
    await openPage();

    rename('Laptop');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-027.ausgang-unbekannt DER-33-07 a save without HTTP answer shows "Ausgang unbekannt, bitte neu laden." without button and locks every further write', async () => {
    const { sent } = mockApi({
      writes: {
        [PATCH_NOTEBOOK]: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    await openPage();

    rename('Laptop');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(nameInput().value).toBe('Laptop');
    expect(saveButton().disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Geräteart anlegen' }).disabled,
    ).toBe(true);
    fireEvent.click(saveButton());
    expect(sent).toHaveLength(1);
    expectAccessibleForm();
  });
});
