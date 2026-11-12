import type { PickList, PickListValue } from '@resellr/domain/schemas/pick-list.schema';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-028 with a mocked `fetch` (Technical Specification 6.1, 6.2).

const LISTS: PickList[] = [
  ['condition', 'Zustand'],
  ['keyboard_layout', 'Tastaturlayout'],
  ['power_supply', 'Netzteil'],
  ['battery', 'Akku'],
  ['storage_type', 'Speichertyp'],
  ['display_surface', 'Display-Oberfläche'],
  ['operating_system', 'Betriebssystem'],
  ['port_type', 'Anschlusstyp'],
  ['port_position', 'Anschlussposition'],
].map(([key, name], index) => ({
  id: index + 1,
  key: key as PickList['key'],
  name: name as string,
  isBatteryList: key === 'battery',
  version: 1,
}));

const CONDITION = 1;
const KEYBOARD = 2;
const BATTERY = 4;

const value = (id: number, label: string, extra: Partial<PickListValue> = {}): PickListValue => ({
  id,
  label,
  active: true,
  batteryPresent: null,
  sortOrder: 1,
  version: 1,
  ...extra,
});

const GEBRAUCHT = value(10, 'gebraucht', { version: 3 });
const REFURBISHED = value(11, 'refurbished', { sortOrder: 2 });
const DEFEKT = value(12, 'defekt', { sortOrder: 3, active: false });
const MIT_AKKU = value(20, 'mit Akku (defekt)', { batteryPresent: true });
const OHNE_AKKU = value(21, 'ohne Akku', { batteryPresent: false, sortOrder: 2 });

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame (UI-044), the lists, the values per
 * list and one handler per write `METHOD path`. Like the server, a saved value is part of the
 * next list of values. Records the writes with their JSON body.
 */
function mockApi({
  lists,
  values,
  writes = {},
}: { lists?: Route; values?: Route; writes?: Record<string, Route> } = {}) {
  const stored = new Map<number, PickListValue[]>([
    [CONDITION, [GEBRAUCHT, REFURBISHED, DEFEKT]],
    [KEYBOARD, []],
    [BATTERY, [MIT_AKKU, OHNE_AKKU]],
  ]);
  const sent: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/ops/status') return Response.json(OPS_STATUS);
    if (method === 'GET' && path.startsWith('/api/pick-lists?')) {
      return lists ? lists(init) : Response.json({ items: LISTS, total: LISTS.length });
    }
    const valuesPath = /^\/api\/pick-lists\/(\d+)\/values\?/.exec(path);
    if (method === 'GET' && valuesPath) {
      if (values) return values(init);
      const items = stored.get(Number(valuesPath[1])) ?? [];
      return Response.json({ items, total: items.length });
    }
    const key = `${method} ${path}`;
    sent.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = writes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    const response = await handler(init);
    if (response.ok && method === 'PUT') {
      const listId = Number(/\/api\/pick-lists\/(\d+)/.exec(path)?.[1]);
      const { valueIds } = JSON.parse(String(init?.body)) as { valueIds: number[] };
      const items = stored.get(listId) ?? [];
      stored.set(
        listId,
        valueIds.map((id, index) => ({
          ...(items.find((item) => item.id === id) as PickListValue),
          sortOrder: index + 1,
        })),
      );
    } else if (response.ok) {
      const saved = (await response.clone().json()) as PickListValue;
      const listId = Number(/\/api\/pick-lists\/(\d+)/.exec(path)?.[1] ?? CONDITION);
      const items = stored.get(listId) ?? [];
      const index = items.findIndex((item) => item.id === saved.id);
      stored.set(
        listId,
        index === -1
          ? [...items, saved]
          : items.map((item) => (item.id === saved.id ? saved : item)),
      );
    }
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, sent, stored };
}

function renderPickLists() {
  const router = createMemoryRouter(routes, { initialEntries: ['/einstellungen/auswahllisten'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const listsRegion = () => screen.getByRole('region', { name: 'Auswahllisten' });
const valuesRegion = (name = 'Zustand') => screen.getByRole('region', { name });
const rowOf = (label: string) => screen.getByRole('row', { name: new RegExp(label) });
const valueInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Wert/ });
const batterySelect = () =>
  screen.getByRole<HTMLSelectElement>('combobox', { name: /^Akku vorhanden/ });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Speichern|Speichern …)$/ });

/** A response that never arrives, e.g. a write without time limit (P-08). */
const pending = () => new Promise<Response>(() => {});

async function openPage() {
  renderPickLists();
  await screen.findByRole('row', { name: /gebraucht/ });
}

async function openList(name: string) {
  fireEvent.click(within(listsRegion()).getByRole('button', { name }));
  await screen.findByRole('region', { name });
}

function edit(label: string) {
  fireEvent.click(within(rowOf(label)).getByRole('button', { name: 'Bearbeiten' }));
}

function rename(from: string, to: string) {
  edit(from);
  fireEvent.change(valueInput(), { target: { value: to } });
  fireEvent.click(saveButton());
}

const PATCH_GEBRAUCHT = 'PATCH /api/pick-list-values/10';
const SAVED_GEBRAUCHT = { ...GEBRAUCHT, label: 'benutzt', version: 4 };

/** Accessibility assertion of a state: every control has a name, field errors are linked. */
function expectAccessible() {
  for (const button of screen.getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
  for (const control of screen
    .queryAllByRole('textbox')
    .concat(screen.queryAllByRole('combobox'))) {
    expect(control.getAttribute('aria-required')).toBe('true');
    if (control.getAttribute('aria-invalid') === 'true') {
      const describedBy = control.getAttribute('aria-describedby');
      expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
    }
  }
  for (const head of screen.queryAllByRole('columnheader')) {
    expect(head.textContent?.trim()).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('UI-028 pick lists (CU-096)', () => {
  it('UI-028.default DER-35-09 shows the nine lists and the values with order, value and status, without creating or deleting a list', async () => {
    mockApi();
    await openPage();

    const lists = within(listsRegion()).getAllByRole('button');
    expect(lists.map((button) => button.textContent)).toEqual(LISTS.map((list) => list.name));
    expect(lists[0]?.getAttribute('aria-current')).toBe('true');
    const table = within(valuesRegion());
    expect(table.getAllByRole('columnheader').map((head) => head.textContent)).toEqual([
      'Reihenfolge',
      'Wert',
      'Status',
    ]);
    expect(rowOf('gebraucht').textContent).toContain('1');
    expect(rowOf('refurbished').textContent).toContain('aktiv');
    expect(within(rowOf('defekt')).getByText('deaktiviert')).toBeTruthy();
    // A deactivated value can only be edited; "Deaktivieren" is for active ones.
    expect(within(rowOf('defekt')).queryByRole('button', { name: 'Deaktivieren' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Wert anlegen' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /löschen|Liste anlegen|Auswahlliste/i }),
    ).toBeNull();
    expect(screen.queryByText(/löschen/i)).toBeNull();
    expectAccessible();
  });

  it('UI-028.default DER-35-10 shows "Akku vorhanden" only in the list Akku', async () => {
    mockApi();
    await openPage();
    expect(
      within(valuesRegion()).queryByRole('columnheader', { name: 'Akku vorhanden' }),
    ).toBeNull();

    await openList('Akku');

    const table = within(await screen.findByRole('region', { name: 'Akku' }));
    await table.findByRole('row', { name: /ohne Akku/ });
    expect(table.getByRole('columnheader', { name: 'Akku vorhanden' })).toBeTruthy();
    expect(within(rowOf('mit Akku')).getByText('Ja')).toBeTruthy();
    expect(within(rowOf('ohne Akku')).getByText('Nein')).toBeTruthy();
    expectAccessible();
  });

  it('UI-028.loading DER-35-01 shows "Lade Einstellungen …" while the lists load', async () => {
    mockApi({ lists: pending });
    renderPickLists();

    const status = await screen.findAllByRole('status');
    expect(status.map((entry) => entry.textContent)).toContain('Lade Einstellungen …');
    expect(screen.queryByRole('button', { name: 'Wert anlegen' })).toBeNull();
    expectAccessible();
  });

  it('UI-028.loading DER-35-01 shows "Lade Einstellungen …" while the values of a list load', async () => {
    mockApi({ values: pending });
    renderPickLists();

    const region = await screen.findByRole('region', { name: 'Zustand' });
    expect(within(region).getByRole('status').textContent).toBe('Lade Einstellungen …');
    expectAccessible();
  });

  it('UI-028.empty DER-35-02 shows "Noch keine Werte in dieser Liste" with the primary button "Wert anlegen"', async () => {
    mockApi();
    await openPage();

    await openList('Tastaturlayout');

    const region = within(valuesRegion('Tastaturlayout'));
    expect(await region.findByText('Noch keine Werte in dieser Liste')).toBeTruthy();
    const create = region.getAllByRole('button', { name: 'Wert anlegen' });
    expect(create).toHaveLength(1);
    expect(create[0]?.className).toContain('bg-primary');
    expect(region.queryByRole('table')).toBeNull();
    expectAccessible();

    fireEvent.click(create[0] as HTMLElement);
    expect(valueInput().value).toBe('');
    expect(region.queryByText('Noch keine Werte in dieser Liste')).toBeNull();
  });

  it('UI-028.success DER-35-03 AC-REQ-007-01 shows "Gespeichert" after "Ungarisch (QWERTZ)" is created and closes it after 5 s', async () => {
    const created = value(30, 'Ungarisch (QWERTZ)');
    const { sent } = mockApi({
      writes: {
        'POST /api/pick-lists/2/values': () => Response.json(created, { status: 201 }),
      },
    });
    await openPage();
    await openList('Tastaturlayout');
    fireEvent.click(await screen.findByRole('button', { name: 'Wert anlegen' }));
    vi.useFakeTimers({ shouldAdvanceTime: true });

    fireEvent.change(valueInput(), { target: { value: 'Ungarisch (QWERTZ)' } });
    fireEvent.click(saveButton());

    const banner = await screen.findByText('Gespeichert');
    expect(banner.closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/pick-lists/2/values',
        body: { label: 'Ungarisch (QWERTZ)', active: true },
      },
    ]);
    expect(rowOf('Ungarisch').textContent).toContain('aktiv');
    expect(screen.queryByRole('textbox')).toBeNull();
    expectAccessible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.queryByText('Gespeichert')).toBeNull();
  });

  it('UI-028.success DER-35-03 DER-35-13 shows "Gespeichert" after a rename and opens no impact dialog UI-043', async () => {
    const { sent } = mockApi({
      writes: { [PATCH_GEBRAUCHT]: () => Response.json(SAVED_GEBRAUCHT) },
    });
    await openPage();

    rename('gebraucht', 'benutzt');

    expect(await screen.findByText('Gespeichert')).toBeTruthy();
    expect(sent[0]?.body).toEqual({ version: 3, label: 'benutzt', active: true });
    expect(rowOf('benutzt')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('DER-35-11 says before saving that a rename applies to all records', async () => {
    mockApi();
    await openPage();
    edit('gebraucht');
    expect(screen.queryByText('Umbenennung wirkt auf alle Datensätze')).toBeNull();

    fireEvent.change(valueInput(), { target: { value: 'benutzt' } });

    expect(screen.getByText('Umbenennung wirkt auf alle Datensätze')).toBeTruthy();
    fireEvent.change(valueInput(), { target: { value: 'gebraucht ' } });
    expect(screen.queryByText('Umbenennung wirkt auf alle Datensätze')).toBeNull();
  });

  it('deactivates a value with the row action and keeps it listed', async () => {
    const { sent } = mockApi({
      writes: {
        'PATCH /api/pick-list-values/11': () =>
          Response.json({ ...REFURBISHED, active: false, version: 2 }),
      },
    });
    await openPage();

    fireEvent.click(within(rowOf('refurbished')).getByRole('button', { name: 'Deaktivieren' }));

    expect(await screen.findByText('Gespeichert')).toBeTruthy();
    expect(sent).toEqual([
      { method: 'PATCH', path: '/api/pick-list-values/11', body: { version: 1, active: false } },
    ]);
    expect(within(rowOf('refurbished')).getByText('deaktiviert')).toBeTruthy();
  });

  it('UI-028.disabled DER-35-07 "Speichern" is disabled as long as nothing is changed', async () => {
    mockApi();
    await openPage();

    edit('gebraucht');
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: 'Status' }));
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: 'Status' }));
    expect(saveButton().disabled).toBe(true);
    expectAccessible();

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wert anlegen' }));
    expect(saveButton().disabled).toBe(true);
  });

  it('UI-028.validation DER-35-10 rejects a value of the list Akku without "Akku vorhanden" at the field, without a request', async () => {
    const { sent } = mockApi();
    await openPage();
    await openList('Akku');
    fireEvent.click(await screen.findByRole('button', { name: 'Wert anlegen' }));

    fireEvent.change(valueInput(), { target: { value: 'Akku schwach' } });
    fireEvent.click(saveButton());

    expect(batterySelect().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Kennzeichen ‚Akku vorhanden‘ fehlt')).toBeTruthy();
    expect(document.activeElement).toBe(batterySelect());
    expect(sent).toEqual([]);
    expectAccessible();
  });

  it('UI-028.validation DER-35-10 sends "Akku vorhanden" only in the list Akku', async () => {
    const { sent } = mockApi({
      writes: {
        'POST /api/pick-lists/4/values': () =>
          Response.json(value(22, 'Akku schwach', { batteryPresent: true }), { status: 201 }),
        'POST /api/pick-lists/2/values': () =>
          Response.json(value(31, 'Englisch (QWERTY)'), { status: 201 }),
      },
    });
    await openPage();
    await openList('Akku');
    fireEvent.click(await screen.findByRole('button', { name: 'Wert anlegen' }));
    fireEvent.change(valueInput(), { target: { value: 'Akku schwach' } });
    fireEvent.change(batterySelect(), { target: { value: 'true' } });
    fireEvent.click(saveButton());
    await screen.findByText('Gespeichert');

    await openList('Tastaturlayout');
    fireEvent.click(await screen.findByRole('button', { name: 'Wert anlegen' }));
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.change(valueInput(), { target: { value: 'Englisch (QWERTY)' } });
    fireEvent.click(saveButton());
    await screen.findByRole('row', { name: /Englisch/ });

    expect(sent.map((entry) => entry.body)).toEqual([
      { label: 'Akku schwach', active: true, batteryPresent: true },
      { label: 'Englisch (QWERTY)', active: true },
    ]);
  });

  it('UI-028.validation AC-REQ-007-02 shows "Wert gibt es in dieser Liste bereits" at the field', async () => {
    mockApi({
      writes: {
        'POST /api/pick-lists/1/values': () =>
          Response.json(
            errorBody('name_taken', { message: 'Wert gibt es in dieser Liste bereits' }),
            { status: 422 },
          ),
      },
    });
    await openPage();
    fireEvent.click(screen.getByRole('button', { name: 'Wert anlegen' }));

    fireEvent.change(valueInput(), { target: { value: 'GEBRAUCHT' } });
    fireEvent.click(saveButton());

    expect(await screen.findByText('Wert gibt es in dieser Liste bereits')).toBeTruthy();
    expect(valueInput().getAttribute('aria-invalid')).toBe('true');
    expect(valueInput().value).toBe('GEBRAUCHT');
    expect(document.activeElement).toBe(valueInput());
    expectAccessible();
  });

  it('UI-028.validation checks an empty value when leaving the field', async () => {
    mockApi();
    await openPage();
    edit('gebraucht');

    fireEvent.change(valueInput(), { target: { value: '  ' } });
    fireEvent.blur(valueInput());

    expect(screen.getByText('Wert: 1 bis 100 Zeichen')).toBeTruthy();
    expectAccessible();
  });

  it('UI-028.error DER-35-04 shows the error banner with the reference number and keeps the input', async () => {
    mockApi({
      writes: {
        [PATCH_GEBRAUCHT]: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
      },
    });
    await openPage();

    rename('gebraucht', 'benutzt');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Einstellungen konnten nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(valueInput().value).toBe('benutzt');
    expectAccessible();
  });

  it('UI-028.speichert DER-35-05 shows "Speichern …" and locks all inputs without time limit', async () => {
    mockApi({ writes: { [PATCH_GEBRAUCHT]: pending } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('gebraucht', 'benutzt');

    expect(saveButton().textContent).toBe('Speichern …');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(saveButton().textContent).toBe('Speichern …');
    expect(saveButton().disabled).toBe(true);
    expect(valueInput().disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('switch', { name: 'Status' }).disabled).toBe(true);
    for (const button of within(listsRegion()).getAllByRole<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
    }
    for (const name of ['Hoch', 'Runter', 'Wert anlegen', 'Abbrechen']) {
      for (const button of screen.queryAllByRole<HTMLButtonElement>('button', { name })) {
        expect(button.disabled).toBe(true);
      }
    }
    expectAccessible();
  });

  it('DER-35-08 "Runter" sends PUT value-order with the value ids and shows the new order', async () => {
    const { sent } = mockApi({
      writes: {
        'PUT /api/pick-lists/1/value-order': () => Response.json({ ...LISTS[0], version: 2 }),
      },
    });
    await openPage();

    fireEvent.click(within(rowOf('gebraucht')).getByRole('button', { name: 'Runter' }));

    expect(await screen.findByText('Gespeichert')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PUT',
        path: '/api/pick-lists/1/value-order',
        body: { version: 1, valueIds: [11, 10, 12] },
      },
    ]);
    const rows = within(valuesRegion()).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
      'refurbished',
      'gebraucht',
      'defekt',
    ]);
  });

  it('DER-35-08 dropping a row onto another sends the new order', async () => {
    const { sent } = mockApi({
      writes: {
        'PUT /api/pick-lists/1/value-order': () => Response.json({ ...LISTS[0], version: 2 }),
      },
    });
    await openPage();
    const transfer = { effectAllowed: '', setData: vi.fn(), getData: vi.fn() };

    fireEvent.dragStart(rowOf('defekt'), { dataTransfer: transfer });
    fireEvent.dragOver(rowOf('gebraucht'), { dataTransfer: transfer });
    fireEvent.drop(rowOf('gebraucht'), { dataTransfer: transfer });

    await screen.findByText('Gespeichert');
    expect(sent[0]?.body).toEqual({ version: 1, valueIds: [12, 10, 11] });
  });

  it('UI-028.conflict DER-35-06 (a) shows P-05, keeps the input and takes the reloaded value after "Neu laden"', async () => {
    let valueCalls = 0;
    const { sent } = mockApi({
      values: () => {
        valueCalls += 1;
        const gebraucht =
          valueCalls === 1 ? GEBRAUCHT : { ...GEBRAUCHT, label: 'Gebraucht', version: 4 };
        return Response.json({ items: [gebraucht, REFURBISHED, DEFEKT], total: 3 });
      },
      writes: {
        [PATCH_GEBRAUCHT]: (init) => {
          const body = JSON.parse(String(init?.body)) as { version: number; label: string };
          return body.version === 4
            ? Response.json({ ...GEBRAUCHT, label: body.label, version: 5 })
            : Response.json(errorBody('version_conflict'), { status: 409 });
        },
      },
    });
    await openPage();

    rename('gebraucht', 'benutzt');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert.',
    );
    expect(valueInput().value).toBe('benutzt');
    expect(screen.queryByText('Gespeichert')).toBeNull();
    expectAccessible();

    fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(valueInput().value).toBe('Gebraucht'));
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(valueInput(), { target: { value: 'benutzt' } });
    fireEvent.click(saveButton());
    await screen.findByText('Gespeichert');
    expect(sent[1]?.body).toEqual({ version: 4, label: 'benutzt', active: true });
  });

  it('UI-028.unreachable DER-35-06 (b) shows P-06 with "Erneut versuchen" when the values get no answer, without replacing the page', async () => {
    mockApi({
      values: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderPickLists();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Auswahllisten' })).toBeTruthy();
    expect(within(listsRegion()).getAllByRole('button')).toHaveLength(9);
    expectAccessible();
  });

  it('UI-028.wird-beendet DER-35-06 (c) shows P-07 without reference number and keeps the input', async () => {
    mockApi({
      writes: {
        [PATCH_GEBRAUCHT]: () => Response.json(errorBody('shutting_down'), { status: 503 }),
      },
    });
    await openPage();

    rename('gebraucht', 'benutzt');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr wird gerade beendet.');
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-/);
    expect(valueInput().value).toBe('benutzt');
    expectAccessible();
  });

  it('shows "Dieser Eintrag ist nicht mehr vorhanden." when the value is gone', async () => {
    mockApi({
      writes: {
        [PATCH_GEBRAUCHT]: () =>
          Response.json(
            errorBody('not_found', { message: 'Dieser Eintrag ist nicht mehr vorhanden.' }),
            { status: 404 },
          ),
      },
    });
    await openPage();

    rename('gebraucht', 'benutzt');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-028.ausgang-unbekannt DER-35-05 a save without HTTP answer shows "Ausgang unbekannt, bitte neu laden." without button and locks every further write', async () => {
    const { sent } = mockApi({
      writes: {
        [PATCH_GEBRAUCHT]: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    await openPage();

    rename('gebraucht', 'benutzt');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(valueInput().value).toBe('benutzt');
    expect(saveButton().disabled).toBe(true);
    for (const name of ['Hoch', 'Runter', 'Deaktivieren', 'Bearbeiten']) {
      for (const button of screen.queryAllByRole<HTMLButtonElement>('button', { name })) {
        expect(button.disabled).toBe(true);
      }
    }
    fireEvent.click(saveButton());
    expect(sent).toHaveLength(1);
    expectAccessible();
  });
});
