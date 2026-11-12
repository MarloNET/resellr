import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-031 and of dialog UI-008 opened from it, with a mocked `fetch`
// (Technical Specification 6.1, 6.2).

const LENOVO = { id: 1, name: 'Lenovo', active: true, gpsrComplete: false, version: 3 };
const HP = { id: 2, name: 'HP', active: true, gpsrComplete: true, version: 1 };
const TOSHIBA = { id: 3, name: 'Toshiba', active: false, gpsrComplete: false, version: 2 };

const NO_IMPACT = { updated: 0, rerelease: 0, manualReview: 0 };

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

type ManufacturerItem = typeof LENOVO;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame (UI-044), the manufacturers and one
 * handler per write `METHOD path`. Like the server, a saved manufacturer is part of the next
 * list. Records the list requests and the writes with their JSON body.
 */
function mockApi({
  initial = [HP, LENOVO, TOSHIBA],
  list,
  writes = {},
}: { initial?: ManufacturerItem[]; list?: Route; writes?: Record<string, Route> } = {}) {
  const items = [...initial];
  const sent: { method: string; path: string; body: unknown }[] = [];
  const reads: string[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/ops/status') return Response.json(OPS_STATUS);
    if (method === 'GET' && path.startsWith('/api/manufacturers')) {
      reads.push(path);
      return list ? list(init) : Response.json({ items, total: items.length });
    }
    const key = `${method} ${path}`;
    sent.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = writes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    const response = await handler(init);
    if (response.ok) {
      const answer = (await response.clone().json()) as
        { manufacturer: ManufacturerItem } | (ManufacturerItem & { existing: boolean });
      const { id, name, active, gpsrComplete, version } =
        'manufacturer' in answer ? answer.manufacturer : answer;
      const saved = { id, name, active, gpsrComplete, version };
      const index = items.findIndex((item) => item.id === saved.id);
      if (index === -1) items.push(saved);
      else items[index] = saved;
    }
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, sent, reads };
}

function renderManufacturers() {
  const router = createMemoryRouter(routes, { initialEntries: ['/einstellungen/hersteller'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const listRegion = () => screen.getByRole('region', { name: 'Hersteller' });
const detailForm = () => screen.getByRole('form', { name: 'Hersteller' });
const nameInput = () =>
  within(detailForm()).getByRole<HTMLInputElement>('textbox', { name: /^Name/ });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Speichern|Speichern …)$/ });
const cancelButton = () =>
  within(detailForm()).getByRole<HTMLButtonElement>('button', { name: 'Abbrechen' });
const createButton = () =>
  within(listRegion()).getByRole<HTMLButtonElement>('button', { name: 'Hersteller anlegen' });
const deactivateButton = (name: string) =>
  screen.getByRole<HTMLButtonElement>('button', { name: `Deaktivieren: ${name}` });
const row = (name: string) =>
  within(listRegion()).getByRole<HTMLButtonElement>('button', { name: new RegExp(`^${name}`) });
const dialog = () => screen.getByRole('dialog', { name: 'Hersteller anlegen' });
const dialogInput = () =>
  within(dialog()).getByRole<HTMLInputElement>('textbox', { name: /^Name des Herstellers/ });

const PATCH_HP = 'PATCH /api/manufacturers/2';
const RENAMED_HP = { ...HP, name: 'Hewlett-Packard', version: 2 };

/** A response that never arrives, e.g. a write without time limit (P-08). */
const pending = () => new Promise<Response>(() => {});

async function openPage() {
  renderManufacturers();
  await screen.findByRole('button', { name: /^HP/ });
  await vi.waitFor(() => expect(nameInput().value).toBe('HP'));
}

function rename(name: string) {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.click(saveButton());
}

/** Opens UI-008 with "Hersteller anlegen" and confirms `name`. */
function createThroughDialog(name: string) {
  fireEvent.click(createButton());
  fireEvent.change(dialogInput(), { target: { value: name } });
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Hersteller anlegen' }));
}

/** Accessibility assertion of a state: every control has a name, field errors are linked. */
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Hersteller und GPSR' })).toBeTruthy();
  expect(nameInput().getAttribute('aria-required')).toBe('true');
  if (nameInput().getAttribute('aria-invalid') === 'true') {
    const describedBy = nameInput().getAttribute('aria-describedby');
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

describe('UI-031 manufacturers (CU-098)', () => {
  it('UI-031.default DER-37-08 lists name, status and the chips "GPSR vollständig" and "GPSR unvollständig" from GET /api/manufacturers?includeInactive=true', async () => {
    const { reads } = mockApi();
    await openPage();

    const rows = within(listRegion()).getAllByRole('button', { name: /^(HP|Lenovo|Toshiba)/ });
    expect(rows.map((item) => item.textContent)).toEqual([
      'HPaktivGPSR vollständig',
      'LenovoaktivGPSR unvollständig',
      'ToshibadeaktiviertGPSR unvollständig',
    ]);
    expect(rows[0]?.getAttribute('aria-current')).toBe('true');
    expect(reads[0]).toBe('/api/manufacturers?includeInactive=true&limit=200');
    expectAccessiblePage();
  });

  it('UI-031.default offers "Deaktivieren" as row action of the active manufacturers and no deletion', async () => {
    mockApi();
    await openPage();

    expect(deactivateButton('HP')).toBeTruthy();
    expect(deactivateButton('Lenovo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Deaktivieren: Toshiba' })).toBeNull();
    expect(screen.queryByRole('button', { name: /löschen|entfernen/i })).toBeNull();
  });

  it('UI-031.loading DER-37-01 shows "Lade Einstellungen …" while GET /api/manufacturers runs', async () => {
    mockApi({ list: pending });
    renderManufacturers();

    expect((await screen.findByRole('status')).textContent).toBe('Lade Einstellungen …');
    expect(nameInput().disabled).toBe(true);
    expect(screen.queryByText('Noch keine Hersteller')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-031.empty DER-37-02 shows "Noch keine Hersteller" in the list area with the primary button "Hersteller anlegen" below it, which opens UI-008', async () => {
    mockApi({ initial: [] });
    renderManufacturers();

    const text = await within(listRegion()).findByText('Noch keine Hersteller');
    const buttons = within(listRegion()).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['+Hersteller anlegen']);
    expect(buttons[0]?.className).toContain('bg-primary');
    expect(text.compareDocumentPosition(buttons[0] as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expectAccessiblePage();

    fireEvent.click(createButton());
    expect(dialog()).toBeTruthy();
    expect(document.activeElement).toBe(dialogInput());
  });

  it('UI-031.success DER-37-03 shows "Gespeichert" after a rename and closes it after 5 s', async () => {
    const { sent } = mockApi({
      writes: { [PATCH_HP]: () => Response.json({ manufacturer: RENAMED_HP, impact: NO_IMPACT }) },
    });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('Hewlett-Packard');

    const banner = await screen.findByText('Gespeichert');
    expect(banner.closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/manufacturers/2',
        body: { version: 1, name: 'Hewlett-Packard' },
      },
    ]);
    expect(nameInput().value).toBe('Hewlett-Packard');
    expect(row('Hewlett-Packard')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expectAccessiblePage();

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Gespeichert')).toBeNull();
  });

  it('UI-031.success DER-37-03 AC-REQ-101-02 "Deaktivieren" deactivates a manufacturer and shows "Gespeichert"', async () => {
    const { sent } = mockApi({
      writes: {
        'PATCH /api/manufacturers/1': () =>
          Response.json({
            manufacturer: { ...LENOVO, active: false, version: 4 },
            impact: NO_IMPACT,
          }),
      },
    });
    await openPage();

    fireEvent.click(deactivateButton('Lenovo'));

    expect((await screen.findByText('Gespeichert')).closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      { method: 'PATCH', path: '/api/manufacturers/1', body: { version: 3, active: false } },
    ]);
    await vi.waitFor(() => expect(row('Lenovo').textContent).toContain('deaktiviert'));
    expect(screen.queryByRole('button', { name: 'Deaktivieren: Lenovo' })).toBeNull();
    // The choice of HP stays open.
    expect(row('HP').getAttribute('aria-current')).toBe('true');
  });

  it('UI-031.success DER-37-03 AC-REQ-100-01 " Fujitsu " through "Hersteller anlegen" closes UI-008, chooses "Fujitsu" with "GPSR unvollständig" and shows "Gespeichert"', async () => {
    const fujitsu = { id: 4, name: 'Fujitsu', active: true, gpsrComplete: false, version: 1 };
    const { sent } = mockApi({
      writes: {
        'POST /api/manufacturers': () =>
          Response.json({ ...fujitsu, existing: false }, { status: 201 }),
      },
    });
    await openPage();

    createThroughDialog(' Fujitsu ');

    expect((await screen.findByText('Gespeichert')).closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      { method: 'POST', path: '/api/manufacturers', body: { name: ' Fujitsu ' } },
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(row('Fujitsu').getAttribute('aria-current')).toBe('true');
    expect(row('Fujitsu').textContent).toBe('FujitsuaktivGPSR unvollständig');
    expect(nameInput().value).toBe('Fujitsu');
    expect(screen.getByRole('note').textContent).toBe(
      'Hersteller angelegt. GPSR-Herstellerangaben fehlen noch; ohne sie ist keine Freigabe möglich.',
    );
    expect(
      screen.queryByRole('link', { name: /Hersteller und GPSR/ })?.closest('[role="note"]'),
    ).toBeFalsy();
    expectAccessiblePage();

    fireEvent.click(row('HP'));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('DER-37-12 AC-REQ-100-02 "lenovo" through "Hersteller anlegen" with an existing "Lenovo" shows the hint in UI-008, chooses "Lenovo" and keeps one "Lenovo" in the list', async () => {
    const { sent } = mockApi({
      writes: {
        'POST /api/manufacturers': () => Response.json({ ...LENOVO, existing: true }),
      },
    });
    await openPage();

    createThroughDialog('lenovo');

    expect((await within(dialog()).findByRole('status')).textContent).toBe(
      'Lenovo gibt es bereits und wird verwendet',
    );
    expect(sent).toHaveLength(1);
    expect(within(dialog()).getByRole('button', { name: 'Hersteller anlegen' })).toBeTruthy();

    // "Abbrechen" leads back to UI-031 (Q-7), where "Lenovo" is chosen.
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(row('Lenovo').getAttribute('aria-current')).toBe('true');
    expect(within(listRegion()).getAllByRole('button', { name: /^lenovo/i })).toHaveLength(1);
    expect(screen.queryByText('Gespeichert')).toBeNull();
    expect(nameInput().value).toBe('Lenovo');
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('UI-031.disabled DER-37-07 "Speichern" is disabled without a change and enabled after one', async () => {
    const { sent } = mockApi();
    await openPage();

    expect(saveButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    fireEvent.submit(nameInput().form as HTMLFormElement);
    expect(sent).toEqual([]);

    fireEvent.change(nameInput(), { target: { value: 'HP Inc.' } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.change(nameInput(), { target: { value: 'HP' } });
    expect(saveButton().disabled).toBe(true);
    expectAccessiblePage();
  });

  it('DER-37-11 shows the hint that the rename acts on all model templates before saving', async () => {
    mockApi();
    await openPage();

    expect(
      screen.queryByText('Umbenennung wirkt auf alle Modellvorlagen des Herstellers'),
    ).toBeNull();
    fireEvent.change(nameInput(), { target: { value: 'Hewlett-Packard' } });

    expect(
      screen.getByText('Umbenennung wirkt auf alle Modellvorlagen des Herstellers'),
    ).toBeTruthy();
  });

  it('"Abbrechen" takes back the rename (P-01)', async () => {
    mockApi();
    await openPage();

    fireEvent.change(nameInput(), { target: { value: 'HP Inc.' } });
    fireEvent.click(cancelButton());

    expect(nameInput().value).toBe('HP');
    expect(
      screen.queryByText('Umbenennung wirkt auf alle Modellvorlagen des Herstellers'),
    ).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['51 characters', 'x'.repeat(51)],
  ])(
    'UI-031.validation DER-37-04 a name that is %s shows "Name: 1 bis 50 Zeichen" in the browser with the focus on it',
    async (_case, name) => {
      const { sent } = mockApi();
      await openPage();

      rename(name);

      expect(await screen.findByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
      expect(document.activeElement).toBe(nameInput());
      expect(nameInput().getAttribute('aria-invalid')).toBe('true');
      expect(sent).toEqual([]);
      expectAccessiblePage();
    },
  );

  it('UI-031.validation DER-37-04 leaving an empty "Name" shows the text at once', async () => {
    mockApi();
    await openPage();
    fireEvent.change(nameInput(), { target: { value: '' } });

    fireEvent.blur(nameInput());

    expect(screen.getByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
  });

  it('UI-031.validation DER-37-04 a rename to the name of another manufacturer shows "Name ist bereits vergeben" at the field', async () => {
    mockApi({
      writes: {
        [PATCH_HP]: () =>
          Response.json(errorBody('name_taken', { message: 'Name ist bereits vergeben' }), {
            status: 422,
          }),
      },
    });
    await openPage();

    rename('lenovo');

    expect(await screen.findByText('Name ist bereits vergeben')).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
    expect(nameInput().getAttribute('aria-invalid')).toBe('true');
    expect(nameInput().value).toBe('lenovo');
    expect(screen.queryByText('Gespeichert')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-031.validation DER-37-04 shows the field error of a 422 validation_failed at "Name"', async () => {
    mockApi({
      writes: {
        [PATCH_HP]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [{ path: 'name', code: 'too_big', message: 'Name: 1 bis 50 Zeichen' }],
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();

    rename('HP neu');

    expect(await screen.findByText('Name: 1 bis 50 Zeichen')).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
  });

  it('UI-031.error DER-37-10 shows the error banner with the reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PATCH_HP]: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
      },
    });
    await openPage();

    rename('Hewlett-Packard');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Einstellungen konnten nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(nameInput().value).toBe('Hewlett-Packard');
    expect(saveButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it('UI-031.speichert DER-37-05 shows "Speichern …" and locks the trigger and all inputs while the write runs, without time limit', async () => {
    mockApi({ writes: { [PATCH_HP]: pending } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('Hewlett-Packard');

    expect(
      (await screen.findByRole('button', { name: 'Speichern …' })).hasAttribute('disabled'),
    ).toBe(true);
    expect(nameInput().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(deactivateButton('Lenovo').disabled).toBe(true);
    expect(row('Lenovo').disabled).toBe(true);
    // No time limit for writes (Ä-29): still saving after a minute.
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(screen.getByRole('button', { name: 'Speichern …' })).toBeTruthy();
    expectAccessiblePage();
  });

  it('UI-031.speichert "Deaktivieren" locks all inputs and keeps the label of "Speichern" (P-08)', async () => {
    mockApi({ writes: { 'PATCH /api/manufacturers/1': pending } });
    await openPage();

    fireEvent.click(deactivateButton('Lenovo'));

    await vi.waitFor(() => expect(nameInput().disabled).toBe(true));
    expect(saveButton().textContent).toBe('Speichern');
    expect(deactivateButton('Lenovo').disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
  });

  it('UI-031.conflict DER-37-06 (a) shows P-05 with "Neu laden" and keeps the inputs; "Neu laden" takes the reloaded data', async () => {
    let listCalls = 0;
    mockApi({
      list: () => {
        listCalls += 1;
        const hp = listCalls === 1 ? HP : { ...HP, name: 'HP Inc.', version: 2 };
        return Response.json({ items: [hp, LENOVO], total: 2 });
      },
      writes: { [PATCH_HP]: () => Response.json(errorBody('version_conflict'), { status: 409 }) },
    });
    await openPage();

    rename('Hewlett-Packard');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.',
    );
    expect(nameInput().value).toBe('Hewlett-Packard');
    expectAccessiblePage();

    fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(nameInput().value).toBe('HP Inc.'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  it('UI-031.unreachable DER-37-06 (b) shows P-06 with "Erneut versuchen" when the list gets no answer, without replacing the page', async () => {
    mockApi({
      list: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderManufacturers();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(listRegion()).toBeTruthy();
    expect(screen.queryByText('Noch keine Hersteller')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-031.unreachable DER-37-06 (b) shows P-06 when the list takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      list: (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    renderManufacturers();
    await screen.findByText('Lade Einstellungen …');

    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'resellr ist nicht erreichbar.',
    );
  });

  it('UI-031.wird-beendet DER-37-06 (c) shows P-07 without reference number and keeps the inputs', async () => {
    mockApi({
      writes: { [PATCH_HP]: () => Response.json(errorBody('shutting_down'), { status: 503 }) },
    });
    await openPage();

    rename('Hewlett-Packard');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(nameInput().value).toBe('Hewlett-Packard');
    expectAccessiblePage();
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-031.ausgang-unbekannt DER-37-05 a save without HTTP answer shows "Ausgang unbekannt, bitte neu laden." without button and locks every further write', async () => {
    const { sent } = mockApi({
      writes: {
        [PATCH_HP]: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    await openPage();

    rename('Hewlett-Packard');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(nameInput().value).toBe('Hewlett-Packard');
    expect(saveButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(deactivateButton('Lenovo').disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(sent).toHaveLength(1);
    expectAccessiblePage();
  });
});
