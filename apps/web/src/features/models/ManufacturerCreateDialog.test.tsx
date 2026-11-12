import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../app/query-client.ts';
import { routes } from '../../app/router.tsx';

// Component tests of dialog UI-008 opened from UI-031 (Q-7, DER-37-13) with a mocked `fetch`
// (Technical Specification 6.1, 6.2).

const HP = { id: 2, name: 'HP', active: true, gpsrComplete: true, version: 1 };

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = () => Promise<Response> | Response;

/**
 * `fetch` of UI-031 with the manufacturer HP, `GET /api/ops/status` from `status` and
 * `POST /api/manufacturers` from `create`. Records the writes with their JSON body.
 */
function mockApi({ create, status }: { create?: Route; status?: Route } = {}) {
  const sent: { path: string; body: unknown }[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/ops/status') return status ? status() : Response.json(OPS_STATUS);
    if (method === 'GET' && path.startsWith('/api/manufacturers')) {
      return Response.json({ items: [HP], total: 1 });
    }
    if (method !== 'POST' || path !== '/api/manufacturers' || !create) {
      throw new Error(`unexpected request ${method} ${path}`);
    }
    sent.push({ path, body: JSON.parse(String(init?.body)) });
    return create();
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent };
}

const dialog = () => screen.getByRole('dialog', { name: 'Hersteller anlegen' });
const nameInput = () =>
  within(dialog()).getByRole<HTMLInputElement>('textbox', { name: /^Name des Herstellers/ });
const createButton = () =>
  within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Hersteller anlegen' });
const cancelButton = () =>
  within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Abbrechen' });

/** Opens UI-031 and from there UI-008 with "Hersteller anlegen". */
async function openDialog() {
  const router = createMemoryRouter(routes, { initialEntries: ['/einstellungen/hersteller'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('button', { name: /^HP/ });
  const region = screen.getByRole('region', { name: 'Hersteller' });
  fireEvent.click(within(region).getByRole('button', { name: 'Hersteller anlegen' }));
  expect(document.activeElement).toBe(nameInput());
}

function create(name: string) {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.click(createButton());
}

/** Accessibility assertion of a state: named dialog and controls, linked field error. */
function expectAccessibleDialog() {
  expect(nameInput().getAttribute('aria-required')).toBe('true');
  if (nameInput().getAttribute('aria-invalid') === 'true') {
    const describedBy = nameInput().getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
  }
  for (const button of within(dialog()).getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('UI-008 manufacturer dialog opened from UI-031 (CU-115)', () => {
  it.each([
    ['empty', ''],
    ['51 characters long', 'x'.repeat(51)],
  ])(
    'UI-008.validation DER-37-13 (a) a %s name shows "Name: 1 bis 50 Zeichen" and creates nothing',
    async (_case, name) => {
      const { sent } = mockApi();
      await openDialog();

      create(name);

      expect(nameInput().getAttribute('aria-invalid')).toBe('true');
      expect(dialog().textContent).toContain('Name: 1 bis 50 Zeichen');
      expect(document.activeElement).toBe(nameInput());
      expect(nameInput().value).toBe(name);
      expect(sent).toEqual([]);
      expectAccessibleDialog();
    },
  );

  it('UI-008.validation DER-37-13 (a) leaving an empty name shows the text at once', async () => {
    mockApi();
    await openDialog();

    fireEvent.blur(nameInput());

    expect(dialog().textContent).toContain('Name: 1 bis 50 Zeichen');
  });

  it('UI-008.validation DER-37-13 (a) DER-37-09 shows "Hersteller Toshiba ist deaktiviert" at the field', async () => {
    const { sent } = mockApi({
      create: () =>
        Response.json(
          errorBody('manufacturer_deactivated', { message: 'Hersteller Toshiba ist deaktiviert' }),
          { status: 422 },
        ),
    });
    await openDialog();

    create('toshiba');

    await vi.waitFor(() => expect(nameInput().getAttribute('aria-invalid')).toBe('true'));
    expect(dialog().textContent).toContain('Hersteller Toshiba ist deaktiviert');
    expect(within(dialog()).queryByRole('alert')).toBeNull();
    expect(nameInput().value).toBe('toshiba');
    expect(sent).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Toshiba/ })).toBeNull();
    expectAccessibleDialog();
  });

  it('UI-008.error DER-37-13 (b) shows "Hersteller konnte nicht angelegt werden. Referenz: <Nr>" on 500 and keeps the input', async () => {
    mockApi({
      create: () =>
        Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
          status: 500,
        }),
    });
    await openDialog();

    create('Fujitsu');

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain(
      'Hersteller konnte nicht angelegt werden. Referenz: R-7K2M-9QX4',
    );
    expect(nameInput().value).toBe('Fujitsu');
    expect(createButton().disabled).toBe(false);
    expectAccessibleDialog();
  });

  it('UI-008.conflict DER-37-13 (d) shows P-05 with "Neu laden" on 409 version_conflict and keeps the input', async () => {
    mockApi({
      create: () => Response.json(errorBody('version_conflict'), { status: 409 }),
    });
    await openDialog();

    create('Fujitsu');

    const banner = await within(dialog()).findByRole('alert');
    expect(within(banner).getByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(nameInput().value).toBe('Fujitsu');
    expectAccessibleDialog();
  });

  it('UI-008.wird-beendet DER-37-13 (d) shows P-07 without reference number on 503 shutting_down and keeps the input', async () => {
    mockApi({
      create: () =>
        Response.json(errorBody('shutting_down', { referenceNumber: 'R-7K2M-9QX5' }), {
          status: 503,
        }),
    });
    await openDialog();

    create('Fujitsu');

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(banner.textContent).not.toContain('Referenz');
    expect(nameInput().value).toBe('Fujitsu');
    expectAccessibleDialog();
  });

  it('UI-008.unreachable shows P-06 in the dialog while GET /api/ops/status gets no answer', async () => {
    mockApi({
      status: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await openDialog();

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
  });

  it('"Abbrechen" and Esc close the dialog without a write and lead back to UI-031', async () => {
    const { sent } = mockApi();
    await openDialog();

    fireEvent.change(nameInput(), { target: { value: 'Fujitsu' } });
    fireEvent.click(cancelButton());
    expect(screen.queryByRole('dialog')).toBeNull();

    const region = screen.getByRole('region', { name: 'Hersteller' });
    fireEvent.click(within(region).getByRole('button', { name: 'Hersteller anlegen' }));
    // Each opening starts empty.
    expect(nameInput().value).toBe('');
    fireEvent.keyDown(nameInput(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent).toEqual([]);
  });

  it('UI-008.speichert locks the input and both buttons while the write runs, and Esc does not close it', async () => {
    mockApi({ create: () => new Promise<Response>(() => {}) });
    await openDialog();

    create('Fujitsu');

    await vi.waitFor(() => expect(createButton().disabled).toBe(true));
    expect(cancelButton().disabled).toBe(true);
    expect(nameInput().disabled).toBe(true);
    fireEvent.keyDown(nameInput(), { key: 'Escape' });
    expect(dialog()).toBeTruthy();
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-008.ausgang-unbekannt DER-37-13 (c) shows "Ausgang unbekannt, bitte neu laden." without button and locks the dialog and the page', async () => {
    const { sent } = mockApi({
      create: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await openDialog();

    create('Fujitsu');

    const banner = await within(dialog()).findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(nameInput().value).toBe('Fujitsu');
    expect(createButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    fireEvent.keyDown(nameInput(), { key: 'Escape' });
    expect(dialog()).toBeTruthy();
    fireEvent.click(createButton());
    expect(sent).toHaveLength(1);
    expectAccessibleDialog();
  });
});
