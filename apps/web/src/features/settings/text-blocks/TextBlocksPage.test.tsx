import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-030 with a mocked `fetch` (Technical Specification 6.1, 6.2).

const ABHOLUNG = {
  id: 1,
  name: 'Abholung Hannover',
  kind: 'pickup_contact',
  body: 'Abholung nach Absprache.',
  active: true,
  version: 3,
};
const AKKU = {
  id: 2,
  name: 'Akku-Hinweis Notebook',
  kind: 'battery_notice',
  body: 'Die Akkukapazität beträgt {Akkukapazität}.',
  active: true,
  version: 1,
};
const ALT = {
  id: 3,
  name: 'Widerruf alt',
  kind: 'legal',
  body: 'Alter Rechtsblock.',
  active: false,
  version: 2,
};

const NO_IMPACT = { updated: 0, rerelease: 0, manualReview: 0 };

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

type TextBlockItem = typeof ABHOLUNG;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame (UI-044), the text blocks and one
 * handler per write `METHOD path`. Like the server, a saved text block is part of the next
 * list. Records the list requests and the writes with their JSON body.
 */
function mockApi({
  initial = [ABHOLUNG, AKKU, ALT],
  list,
  writes = {},
}: { initial?: TextBlockItem[]; list?: Route; writes?: Record<string, Route> } = {}) {
  const items = [...initial];
  const sent: { method: string; path: string; body: unknown }[] = [];
  const reads: string[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/ops/status') return Response.json(OPS_STATUS);
    if (method === 'GET' && path.startsWith('/api/text-blocks')) {
      reads.push(path);
      return list ? list(init) : Response.json({ items, total: items.length });
    }
    const key = `${method} ${path}`;
    sent.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = writes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    const response = await handler(init);
    if (response.ok) {
      const { textBlock } = (await response.clone().json()) as { textBlock: TextBlockItem };
      const index = items.findIndex((item) => item.id === textBlock.id);
      if (index === -1) items.push(textBlock);
      else items[index] = textBlock;
    }
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, sent, reads };
}

function renderTextBlocks() {
  const router = createMemoryRouter(routes, { initialEntries: ['/einstellungen/textbausteine'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const listRegion = () => screen.getByRole('region', { name: 'Textbausteine' });
const detailForm = () => screen.getByRole('form', { name: 'Textbausteine' });
const nameInput = () =>
  within(detailForm()).getByRole<HTMLInputElement>('textbox', { name: /^Name/ });
const bodyInput = () =>
  within(detailForm()).getByRole<HTMLTextAreaElement>('textbox', { name: /^Text/ });
const kindSelect = () =>
  within(detailForm()).getByRole<HTMLSelectElement>('combobox', { name: /^Art/ });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Speichern|Speichern …)$/ });
const cancelButton = () =>
  within(detailForm()).getByRole<HTMLButtonElement>('button', { name: 'Abbrechen' });
const createButton = () =>
  within(listRegion()).getByRole<HTMLButtonElement>('button', { name: 'Textbaustein anlegen' });
const deactivateButton = (name: string) =>
  screen.getByRole<HTMLButtonElement>('button', { name: `Deaktivieren: ${name}` });
const row = (name: string) =>
  within(listRegion()).getByRole<HTMLButtonElement>('button', { name: new RegExp(`^${name}`) });

const PATCH_ABHOLUNG = 'PATCH /api/text-blocks/1';
const SAVED_ABHOLUNG = { ...ABHOLUNG, body: 'Abholung Mo–Fr 9–17 Uhr.', version: 4 };

/** A response that never arrives, e.g. a write without time limit (P-08). */
const pending = () => new Promise<Response>(() => {});

async function openPage() {
  renderTextBlocks();
  await screen.findByRole('button', { name: /^Abholung Hannover/ });
  await vi.waitFor(() => expect(nameInput().value).toBe('Abholung Hannover'));
}

function changeBody(body: string) {
  fireEvent.change(bodyInput(), { target: { value: body } });
  fireEvent.click(saveButton());
}

/** Accessibility assertion of a state: every control has a name, field errors are linked. */
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Textbausteine' })).toBeTruthy();
  for (const input of [nameInput(), kindSelect(), bodyInput()]) {
    expect(input.getAttribute('aria-required')).toBe('true');
    if (input.getAttribute('aria-invalid') === 'true') {
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
    }
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

describe('UI-030 text blocks (CU-101)', () => {
  it('UI-030.default lists name, kind and status from GET /api/text-blocks and opens the first one', async () => {
    const { reads } = mockApi();
    await openPage();

    const rows = within(listRegion()).getAllByRole('button', {
      name: /^(Abholung|Akku|Widerruf)/,
    });
    expect(rows.map((item) => item.textContent)).toEqual([
      'Abholung HannoverAbholung/Kontaktaktiv',
      'Akku-Hinweis NotebookAkku-Hinweisaktiv',
      'Widerruf altRechtlichesdeaktiviert',
    ]);
    expect(rows[0]?.getAttribute('aria-current')).toBe('true');
    expect(reads[0]).toBe('/api/text-blocks?limit=200');
    expect(kindSelect().value).toBe('pickup_contact');
    expect(bodyInput().value).toBe('Abholung nach Absprache.');
    expect(screen.getByText('24 / 5.000 Zeichen')).toBeTruthy();
    expectAccessiblePage();
  });

  it('UI-030.default shows the placeholders of chapter 9.7 without {Baustein:Name}', async () => {
    mockApi();
    await openPage();

    const list = within(screen.getByRole('region', { name: 'Platzhalter' })).getAllByRole(
      'listitem',
    );
    expect(list.map((item) => item.textContent)).toContain('{Akkukapazität}');
    expect(list.map((item) => item.textContent)).toContain('{Merkmalsliste}');
    expect(list).toHaveLength(19);
    expect(screen.queryByText(/\{Baustein:/)).toBeNull();
  });

  it('UI-030.default DER-39-13 offers only "Deaktivieren" as row action of the active text blocks and no deletion', async () => {
    mockApi();
    await openPage();

    expect(deactivateButton('Abholung Hannover')).toBeTruthy();
    expect(deactivateButton('Akku-Hinweis Notebook')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Deaktivieren: Widerruf alt' })).toBeNull();
    expect(screen.queryByRole('button', { name: /löschen|entfernen/i })).toBeNull();
  });

  it('UI-030.loading DER-39-01 shows "Lade Einstellungen …" while GET /api/text-blocks runs', async () => {
    mockApi({ list: pending });
    renderTextBlocks();

    expect((await screen.findByRole('status')).textContent).toBe('Lade Einstellungen …');
    expect(nameInput().disabled).toBe(true);
    expect(screen.queryByText('Noch keine Textbausteine')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-030.empty DER-39-02 shows "Noch keine Textbausteine" with the primary button "Textbaustein anlegen" below it', async () => {
    mockApi({ initial: [] });
    renderTextBlocks();

    const text = await within(listRegion()).findByText('Noch keine Textbausteine');
    const buttons = within(listRegion()).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['+Textbaustein anlegen']);
    expect(buttons[0]?.className).toContain('bg-primary');
    expect(text.compareDocumentPosition(buttons[0] as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expectAccessiblePage();

    fireEvent.click(createButton());
    expect(nameInput().disabled).toBe(false);
    expect(nameInput().value).toBe('');
  });

  it('UI-030.success DER-39-03 "Textbaustein anlegen" creates a text block, chooses it and shows "Gespeichert"', async () => {
    const created = {
      id: 4,
      name: 'Lieferumfang Standard',
      kind: 'delivery_scope',
      body: 'Gerät mit Netzteil',
      active: true,
      version: 1,
    };
    const { sent } = mockApi({
      writes: {
        'POST /api/text-blocks': () =>
          Response.json({ textBlock: created, impact: NO_IMPACT }, { status: 201 }),
      },
    });
    await openPage();

    fireEvent.click(createButton());
    fireEvent.change(nameInput(), { target: { value: 'Lieferumfang Standard' } });
    fireEvent.change(kindSelect(), { target: { value: 'delivery_scope' } });
    changeBody('Gerät mit Netzteil');

    expect((await screen.findByText('Gespeichert')).closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/text-blocks',
        body: { name: 'Lieferumfang Standard', kind: 'delivery_scope', body: 'Gerät mit Netzteil' },
      },
    ]);
    expect(row('Lieferumfang Standard').getAttribute('aria-current')).toBe('true');
    expect(saveButton().disabled).toBe(true);
    expectAccessiblePage();
  });

  it('UI-030.success DER-39-03 a change sends only the changed fields and shows "Gespeichert", closed after 5 s', async () => {
    const { sent } = mockApi({
      writes: {
        [PATCH_ABHOLUNG]: () => Response.json({ textBlock: SAVED_ABHOLUNG, impact: NO_IMPACT }),
      },
    });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    changeBody('Abholung Mo–Fr 9–17 Uhr.');

    expect((await screen.findByText('Gespeichert')).closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/text-blocks/1',
        body: { version: 3, body: 'Abholung Mo–Fr 9–17 Uhr.' },
      },
    ]);
    expect(bodyInput().value).toBe('Abholung Mo–Fr 9–17 Uhr.');
    expect(saveButton().disabled).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Gespeichert')).toBeNull();
  });

  it('UI-030.success DER-39-13 "Deaktivieren" deactivates a text block and shows "Gespeichert"', async () => {
    const { sent } = mockApi({
      writes: {
        'PATCH /api/text-blocks/2': () =>
          Response.json({ textBlock: { ...AKKU, active: false, version: 2 }, impact: NO_IMPACT }),
      },
    });
    await openPage();

    fireEvent.click(deactivateButton('Akku-Hinweis Notebook'));

    expect((await screen.findByText('Gespeichert')).closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      { method: 'PATCH', path: '/api/text-blocks/2', body: { version: 1, active: false } },
    ]);
    await vi.waitFor(() =>
      expect(row('Akku-Hinweis Notebook').textContent).toContain('deaktiviert'),
    );
    expect(
      screen.queryByRole('button', { name: 'Deaktivieren: Akku-Hinweis Notebook' }),
    ).toBeNull();
    expect(row('Abholung Hannover').getAttribute('aria-current')).toBe('true');
  });

  it('UI-030.disabled DER-39-08 "Speichern" is disabled without a change and enabled after one', async () => {
    const { sent } = mockApi();
    await openPage();

    expect(saveButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    fireEvent.submit(nameInput().form as HTMLFormElement);
    expect(sent).toEqual([]);

    fireEvent.change(kindSelect(), { target: { value: 'other' } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.change(kindSelect(), { target: { value: 'pickup_contact' } });
    expect(saveButton().disabled).toBe(true);
    expectAccessiblePage();
  });

  it('"Abbrechen" takes back the change (P-01)', async () => {
    mockApi();
    await openPage();

    fireEvent.change(bodyInput(), { target: { value: 'Neu' } });
    fireEvent.click(cancelButton());

    expect(bodyInput().value).toBe('Abholung nach Absprache.');
    expect(saveButton().disabled).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['101 characters long', 'x'.repeat(101)],
  ])(
    'UI-030.validation DER-39-05 a name that is %s shows exactly "Name: 1 bis 100 Zeichen" at "Name", marks it and saves nothing',
    async (_case, name) => {
      const { sent } = mockApi();
      await openPage();

      fireEvent.change(nameInput(), { target: { value: name } });
      fireEvent.click(saveButton());

      const describedBy = await vi.waitFor(() => {
        const id = nameInput().getAttribute('aria-describedby');
        expect(id).toBeTruthy();
        return id as string;
      });
      expect(document.getElementById(describedBy)?.textContent).toBe('Name: 1 bis 100 Zeichen');
      expect(nameInput().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(nameInput());
      expect(sent).toEqual([]);
      expectAccessiblePage();
    },
  );

  it('UI-030.validation DER-39-05 a name of 100 characters is saved', async () => {
    const name = 'n'.repeat(100);
    const { sent } = mockApi({
      writes: {
        [PATCH_ABHOLUNG]: () =>
          Response.json({ textBlock: { ...ABHOLUNG, name, version: 4 }, impact: NO_IMPACT }),
      },
    });
    await openPage();

    fireEvent.change(nameInput(), { target: { value: name } });
    fireEvent.click(saveButton());

    expect(await screen.findByText('Gespeichert')).toBeTruthy();
    expect(sent).toEqual([
      { method: 'PATCH', path: '/api/text-blocks/1', body: { version: 3, name } },
    ]);
    expect(screen.queryByText('Name: 1 bis 100 Zeichen')).toBeNull();
  });

  it('UI-030.validation DER-39-05 a text over 5,000 characters shows the field rule at "Text" in the browser', async () => {
    const { sent } = mockApi();
    await openPage();

    changeBody('x'.repeat(5001));

    expect(await screen.findByText('Text: 1 bis 5.000 Zeichen')).toBeTruthy();
    expect(bodyInput().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(bodyInput());
    expect(sent).toEqual([]);
  });

  it('UI-030.validation DER-39-05 a name already given shows "Name ist bereits vergeben" at "Name"', async () => {
    mockApi({
      writes: {
        [PATCH_ABHOLUNG]: () =>
          Response.json(errorBody('name_taken', { message: 'Name ist bereits vergeben' }), {
            status: 422,
          }),
      },
    });
    await openPage();

    fireEvent.change(nameInput(), { target: { value: 'akku-hinweis notebook' } });
    fireEvent.click(saveButton());

    expect(await screen.findByText('Name ist bereits vergeben')).toBeTruthy();
    expect(nameInput().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(nameInput());
    expect(screen.queryByText('Gespeichert')).toBeNull();
    expectAccessiblePage();
  });

  it.each([
    ['AC-REQ-026-02 the unknown placeholder', 'Unbekannter Platzhalter {Garantiezeit}'],
    ['DER-39-05 {Baustein:Name}', '{Baustein:Name} ist im Textbaustein nicht zulässig'],
  ])('UI-030.validation shows the rejection of %s at "Text"', async (_case, message) => {
    mockApi({
      writes: {
        [PATCH_ABHOLUNG]: () =>
          Response.json(errorBody('placeholder_not_allowed', { message }), { status: 422 }),
      },
    });
    await openPage();

    changeBody('Garantie {Garantiezeit}');

    expect(await screen.findByText(message)).toBeTruthy();
    expect(bodyInput().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(bodyInput());
    expect(bodyInput().value).toBe('Garantie {Garantiezeit}');
    expectAccessiblePage();
  });

  it('UI-030.validation shows the field error of a 422 validation_failed at "Text"', async () => {
    mockApi({
      writes: {
        [PATCH_ABHOLUNG]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [{ path: 'body', code: 'too_big', message: 'Text: 1 bis 5.000 Zeichen' }],
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();

    changeBody('Neu');

    expect(await screen.findByText('Text: 1 bis 5.000 Zeichen')).toBeTruthy();
    expect(document.activeElement).toBe(bodyInput());
  });

  it('UI-030.error DER-39-04 shows the error banner with the reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PATCH_ABHOLUNG]: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
      },
    });
    await openPage();

    changeBody('Neu');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Einstellungen konnten nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(bodyInput().value).toBe('Neu');
    expect(saveButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it('UI-030.speichert DER-39-06 shows "Speichern …" and locks all inputs while the write runs, without time limit', async () => {
    mockApi({ writes: { [PATCH_ABHOLUNG]: pending } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    changeBody('Neu');

    expect(
      (await screen.findByRole('button', { name: 'Speichern …' })).hasAttribute('disabled'),
    ).toBe(true);
    expect(nameInput().disabled).toBe(true);
    expect(kindSelect().disabled).toBe(true);
    expect(bodyInput().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(deactivateButton('Akku-Hinweis Notebook').disabled).toBe(true);
    expect(row('Akku-Hinweis Notebook').disabled).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(screen.getByRole('button', { name: 'Speichern …' })).toBeTruthy();
    expectAccessiblePage();
  });

  it('UI-030.conflict DER-39-07 (a) shows P-05 with "Neu laden" and keeps the inputs; "Neu laden" takes the reloaded data', async () => {
    let listCalls = 0;
    mockApi({
      list: () => {
        listCalls += 1;
        const abholung = listCalls === 1 ? ABHOLUNG : { ...ABHOLUNG, body: 'Anders', version: 4 };
        return Response.json({ items: [abholung, AKKU], total: 2 });
      },
      writes: {
        [PATCH_ABHOLUNG]: () => Response.json(errorBody('version_conflict'), { status: 409 }),
      },
    });
    await openPage();

    changeBody('Neu');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.',
    );
    expect(bodyInput().value).toBe('Neu');
    expectAccessiblePage();

    fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(bodyInput().value).toBe('Anders'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  it('UI-030.unreachable DER-39-07 (b) shows P-06 with "Erneut versuchen" when the list gets no answer', async () => {
    mockApi({
      list: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderTextBlocks();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(listRegion()).toBeTruthy();
    expect(screen.queryByText('Noch keine Textbausteine')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-030.unreachable DER-39-07 (b) shows P-06 when the list takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      list: (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    renderTextBlocks();
    await screen.findByText('Lade Einstellungen …');

    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'resellr ist nicht erreichbar.',
    );
  });

  it('UI-030.wird-beendet DER-39-07 (c) shows P-07 without reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PATCH_ABHOLUNG]: () => Response.json(errorBody('shutting_down'), { status: 503 }),
      },
    });
    await openPage();

    changeBody('Neu');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(bodyInput().value).toBe('Neu');
    expectAccessiblePage();
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-030.ausgang-unbekannt DER-39-06 a save without HTTP answer shows "Ausgang unbekannt, bitte neu laden." without button and locks every further write', async () => {
    const { sent } = mockApi({
      writes: {
        [PATCH_ABHOLUNG]: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    await openPage();

    changeBody('Neu');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(bodyInput().value).toBe('Neu');
    expect(saveButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(deactivateButton('Akku-Hinweis Notebook').disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(sent).toHaveLength(1);
    expectAccessiblePage();
  });
});
