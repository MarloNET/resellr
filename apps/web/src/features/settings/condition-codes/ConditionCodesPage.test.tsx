import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-033 with a mocked `fetch` (Technical Specification 6.1, 6.2).

const L1 = { id: 1, name: 'L1', active: true, version: 1 };
const L2 = { id: 2, name: 'L2', active: false, version: 2 };
const CONDITION_LIST = {
  id: 1,
  key: 'condition',
  name: 'Zustand',
  isBatteryList: false,
  version: 1,
};
const USED = {
  id: 11,
  label: 'Gebraucht',
  active: true,
  batteryPresent: null,
  sortOrder: 1,
  version: 1,
};
const DEFECT = {
  id: 12,
  label: 'Defekt',
  active: false,
  batteryPresent: null,
  sortOrder: 2,
  version: 1,
};

const DGS = {
  id: 1,
  code: 'DGS',
  supplierId: null,
  plainText: 'Gebrauchsspuren am Gehäuse',
  suggestedConditionValueId: null,
  suggestedVisualGrade: null,
  version: 3,
};
const DGS_L1 = {
  id: 2,
  code: 'DGS',
  supplierId: 1,
  plainText: 'Text von L1',
  suggestedConditionValueId: 11,
  suggestedVisualGrade: 2,
  version: 1,
};

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

/** An entry whose supplier L2 and suggestion "Defekt" were deactivated after saving it. */
const A1_L2 = {
  id: 3,
  code: 'A1',
  supplierId: 2,
  plainText: 'neuwertig',
  suggestedConditionValueId: 12,
  suggestedVisualGrade: null,
  version: 4,
};

type Entry = typeof DGS | typeof DGS_L1 | typeof A1_L2;
type SupplierOfTest = typeof L1;
type ConditionOfTest = typeof USED;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame (UI-044), the entries, the suppliers,
 * the pick lists with the values of the list `condition`, and one handler per write
 * `METHOD path`. Like the server, a saved entry is part of the next list and a deleted one is
 * not. Records the list requests and the writes with their JSON body.
 */
function mockApi({
  initial = [DGS, DGS_L1],
  list,
  writes = {},
  suppliers = () => [L1, L2],
  conditions = () => [USED, DEFECT],
}: {
  initial?: Entry[];
  list?: Route;
  writes?: Record<string, Route>;
  suppliers?: () => SupplierOfTest[];
  conditions?: () => ConditionOfTest[];
} = {}) {
  let items: Entry[] = [...initial];
  const sent: { method: string; path: string; body: unknown }[] = [];
  const reads: string[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/ops/status') return Response.json(OPS_STATUS);
    if (method === 'GET') {
      reads.push(path);
      if (path.startsWith('/api/condition-codes')) {
        return list ? list(init) : Response.json({ items, total: items.length });
      }
      if (path.startsWith('/api/suppliers')) {
        return Response.json({ items: suppliers(), total: suppliers().length });
      }
      if (path.startsWith('/api/pick-lists/1/values')) {
        return Response.json({ items: conditions(), total: conditions().length });
      }
      if (path.startsWith('/api/pick-lists')) {
        return Response.json({ items: [CONDITION_LIST], total: 1 });
      }
    }
    const key = `${method} ${path}`;
    sent.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = writes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    const response = await handler(init);
    if (response.ok && method === 'DELETE') {
      items = items.filter((item) => !path.startsWith(`/api/condition-codes/${item.id}?`));
    } else if (response.ok) {
      const saved = (await response.clone().json()) as Entry;
      const index = items.findIndex((item) => item.id === saved.id);
      if (index === -1) items.push(saved);
      else items[index] = saved;
    }
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, sent, reads };
}

function renderPage() {
  const router = createMemoryRouter(routes, {
    initialEntries: ['/einstellungen/code-uebersetzung'],
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const codeInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Zustandscode/ });
const plainTextInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Klartext/ });
const supplierSelect = () => screen.getByRole<HTMLSelectElement>('combobox', { name: 'Lieferant' });
const conditionSelect = () =>
  screen.getByRole<HTMLSelectElement>('combobox', { name: 'Vorschlag Zustand' });
const gradeSelect = () =>
  screen.getByRole<HTMLSelectElement>('combobox', { name: /^Vorschlag Optik-Note/ });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Speichern|Speichern …)$/ });
const cancelButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Abbrechen' });
const deleteButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Löschen' });
const createButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Übersetzung anlegen' });
const listRegion = () => screen.getByRole('region', { name: 'Code-Übersetzungen' });
const rows = () => within(listRegion()).getAllByRole('button', { name: /^DGS|^A1/ });

const PATCH_DGS = 'PATCH /api/condition-codes/1';
const DELETE_DGS = 'DELETE /api/condition-codes/1?version=3';

/** A response that never arrives, e.g. a write without time limit (P-08). */
const pending = () => new Promise<Response>(() => {});

async function openPage() {
  renderPage();
  await within(await screen.findByRole('region', { name: 'Code-Übersetzungen' })).findAllByRole(
    'button',
    { name: /^DGS/ },
  );
  await vi.waitFor(() => expect(codeInput().value).toBe('DGS'));
}

function changePlainText(plainText: string) {
  fireEvent.change(plainTextInput(), { target: { value: plainText } });
  fireEvent.click(saveButton());
}

/** Accessibility assertion of a state: every control has a name, field errors are linked. */
function expectAccessibleForm() {
  expect(codeInput().getAttribute('aria-required')).toBe('true');
  expect(plainTextInput().getAttribute('aria-required')).toBe('true');
  for (const control of [
    codeInput(),
    supplierSelect(),
    plainTextInput(),
    conditionSelect(),
    gradeSelect(),
  ]) {
    if (control.getAttribute('aria-invalid') === 'true') {
      const describedBy = control.getAttribute('aria-describedby');
      expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
    }
  }
  expect(supplierSelect()).toBeTruthy();
  expect(conditionSelect()).toBeTruthy();
  for (const button of screen.getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
  expect(screen.getByRole('heading', { level: 1, name: 'Code-Übersetzung' })).toBeTruthy();
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('UI-033 condition codes (CU-100)', () => {
  it('UI-033.default shows code, supplier or "alle", plain text and the suggestions and opens the first entry', async () => {
    const { reads } = mockApi();
    await openPage();

    expect(rows().map((row) => row.textContent)).toEqual([
      'DGSalleGebrauchsspuren am Gehäuse',
      'DGSL1Text von L1Vorschlag Zustand: Gebraucht · Vorschlag Optik-Note: 2',
    ]);
    expect(rows()[0]?.getAttribute('aria-current')).toBe('true');
    expect(plainTextInput().value).toBe('Gebrauchsspuren am Gehäuse');
    expect(supplierSelect().value).toBe('');
    expect(reads).toContain('/api/condition-codes?limit=200');
    expectAccessibleForm();
  });

  it('UI-033.default DER-38-09 shows the hint "Änderungen wirken nur auf künftig erfasste Codes."', async () => {
    mockApi();
    await openPage();

    expect(screen.getByRole('note').textContent).toBe(
      'Änderungen wirken nur auf künftig erfasste Codes.',
    );
  });

  it('UI-033.default offers "alle" and the active suppliers, and the active condition values with grades 1 to 5', async () => {
    mockApi();
    await openPage();

    const labels = (select: HTMLSelectElement) =>
      Array.from(select.options).map((option) => option.textContent);
    expect(labels(supplierSelect())).toEqual(['alle', 'L1']);
    expect(labels(conditionSelect())).toEqual(['–', 'Gebraucht']);
    expect(labels(gradeSelect())).toEqual(['–', '1', '2', '3', '4', '5']);

    fireEvent.click(rows()[1] as HTMLElement);
    expect(supplierSelect().value).toBe('1');
    expect(conditionSelect().value).toBe('11');
    expect(gradeSelect().value).toBe('2');
  });

  it('UI-033.loading DER-38-01 shows "Lade Einstellungen …" while GET /api/condition-codes runs', async () => {
    mockApi({ list: pending });
    renderPage();

    expect((await screen.findByRole('status')).textContent).toBe('Lade Einstellungen …');
    expect(codeInput().disabled).toBe(true);
    expect(screen.queryByText('Noch keine Code-Übersetzungen')).toBeNull();
    expectAccessibleForm();
  });

  it('UI-033.empty DER-38-02 shows "Noch keine Code-Übersetzungen" in the list area with the primary button "Übersetzung anlegen" below it', async () => {
    const created = { ...DGS, id: 5, version: 1 };
    const { sent } = mockApi({
      initial: [],
      writes: { 'POST /api/condition-codes': () => Response.json(created, { status: 201 }) },
    });
    renderPage();

    const text = await within(listRegion()).findByText('Noch keine Code-Übersetzungen');
    const buttons = within(listRegion()).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['+Übersetzung anlegen']);
    expect(buttons[0]?.className).toContain('bg-primary');
    expect(text.compareDocumentPosition(buttons[0] as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expectAccessibleForm();

    fireEvent.click(createButton());
    fireEvent.change(codeInput(), { target: { value: 'DGS' } });
    changePlainText('Gebrauchsspuren am Gehäuse');

    await screen.findByText('Gespeichert');
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/condition-codes',
        body: {
          code: 'DGS',
          supplierId: null,
          plainText: 'Gebrauchsspuren am Gehäuse',
          suggestedConditionValueId: null,
          suggestedVisualGrade: null,
        },
      },
    ]);
    expect(within(listRegion()).queryByText('Noch keine Code-Übersetzungen')).toBeNull();
  });

  it('UI-033.success DER-38-03 AC-REQ-022-01 "Übersetzung anlegen" creates an entry with supplier and suggestions and shows "Gespeichert"', async () => {
    const created = {
      id: 7,
      code: 'A1',
      supplierId: 1,
      plainText: 'neuwertig',
      suggestedConditionValueId: 11,
      suggestedVisualGrade: 1,
      version: 1,
    };
    const { sent } = mockApi({
      writes: { 'POST /api/condition-codes': () => Response.json(created, { status: 201 }) },
    });
    await openPage();

    fireEvent.click(createButton());
    expect(codeInput().value).toBe('');
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
    fireEvent.change(codeInput(), { target: { value: 'A1' } });
    fireEvent.change(supplierSelect(), { target: { value: '1' } });
    fireEvent.change(conditionSelect(), { target: { value: '11' } });
    fireEvent.change(gradeSelect(), { target: { value: '1' } });
    changePlainText('neuwertig');

    expect((await screen.findByText('Gespeichert')).closest('[role="status"]')).toBeTruthy();
    expect(sent[0]?.body).toEqual({
      code: 'A1',
      supplierId: 1,
      plainText: 'neuwertig',
      suggestedConditionValueId: 11,
      suggestedVisualGrade: 1,
    });
    expect(
      within(listRegion()).getByRole('button', { name: /^A1/ }).getAttribute('aria-current'),
    ).toBe('true');
  });

  it('UI-033.success DER-38-03 a change sends the version read and shows "Gespeichert", which closes after 5 s', async () => {
    const saved = { ...DGS, plainText: 'Deutliche Gebrauchsspuren', version: 4 };
    const { sent } = mockApi({ writes: { [PATCH_DGS]: () => Response.json(saved) } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    changePlainText('Deutliche Gebrauchsspuren');

    expect((await screen.findByText('Gespeichert')).closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/condition-codes/1',
        body: {
          version: 3,
          code: 'DGS',
          supplierId: null,
          plainText: 'Deutliche Gebrauchsspuren',
          suggestedConditionValueId: null,
          suggestedVisualGrade: null,
        },
      },
    ]);
    expect(rows()[0]?.textContent).toContain('Deutliche Gebrauchsspuren');
    expectAccessibleForm();

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Gespeichert')).toBeNull();
  });

  it('UI-033.success DER-38-08 DER-38-03 "Löschen" opens the confirmation P-04 first; only "Löschen" in the dialog sends the DELETE', async () => {
    const { sent } = mockApi({
      writes: { [DELETE_DGS]: () => new Response(null, { status: 204 }) },
    });
    await openPage();

    fireEvent.click(deleteButton());

    const dialog = await screen.findByRole('dialog', { name: 'Übersetzung löschen' });
    expect(dialog.textContent).toContain(
      '„DGS“ (Lieferant: alle) wird gelöscht. Änderungen wirken nur auf künftig erfasste Codes.',
    );
    const actions = within(dialog).getAllByRole('button');
    expect(actions.map((button) => button.textContent)).toEqual(['Abbrechen', 'Löschen']);
    expect(actions[1]?.className).toContain('text-error');
    expect(sent).toEqual([]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    expect((await screen.findByText('Gespeichert')).closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      { method: 'DELETE', path: '/api/condition-codes/1?version=3', body: {} },
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    await vi.waitFor(() => expect(rows().map((row) => row.textContent)).toHaveLength(1));
    expect(plainTextInput().value).toBe('Text von L1');
  });

  it('UI-033.default DER-38-08 "Abbrechen" and Esc close the confirmation without deleting', async () => {
    const { sent } = mockApi();
    await openPage();

    fireEvent.click(deleteButton());
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }),
    );
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(deleteButton());
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(sent).toEqual([]);
    expect(rows()).toHaveLength(2);
  });

  it('UI-033.disabled DER-38-07 "Speichern" is disabled without a change and enabled after one', async () => {
    const { sent } = mockApi();
    await openPage();

    expect(saveButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    fireEvent.submit(codeInput().form as HTMLFormElement);
    expect(sent).toEqual([]);

    fireEvent.change(plainTextInput(), { target: { value: 'anders' } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.change(plainTextInput(), { target: { value: DGS.plainText } });
    expect(saveButton().disabled).toBe(true);

    fireEvent.change(gradeSelect(), { target: { value: '3' } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.change(gradeSelect(), { target: { value: '' } });
    expect(saveButton().disabled).toBe(true);
    expectAccessibleForm();
  });

  it('"Abbrechen" takes back the changes of the open entry and leaves "Übersetzung anlegen" (P-01)', async () => {
    mockApi();
    await openPage();

    fireEvent.change(codeInput(), { target: { value: 'XYZ' } });
    fireEvent.change(supplierSelect(), { target: { value: '1' } });
    fireEvent.click(cancelButton());
    expect(codeInput().value).toBe('DGS');
    expect(supplierSelect().value).toBe('');

    fireEvent.click(createButton());
    fireEvent.change(codeInput(), { target: { value: 'A1' } });
    fireEvent.click(cancelButton());
    expect(codeInput().value).toBe('DGS');
    expect(rows()[0]?.getAttribute('aria-current')).toBe('true');
  });

  it.each([
    ['a code of 21 characters', 'code', 'x'.repeat(21), 'Zustandscode: 1 bis 20 Zeichen'],
    ['an empty code', 'code', '', 'Zustandscode: 1 bis 20 Zeichen'],
    ['an empty plain text', 'plainText', '', 'Klartext: 1 bis 500 Zeichen'],
    ['a plain text of 501 characters', 'plainText', 'x'.repeat(501), 'Klartext: 1 bis 500 Zeichen'],
  ])(
    'UI-033.validation DER-38-05 AC-REQ-022-04 %s shows the text of UI-033 in the browser with the focus on it',
    async (_case, field, value, message) => {
      const { sent } = mockApi();
      await openPage();
      const input = field === 'code' ? codeInput() : plainTextInput();

      fireEvent.change(input, { target: { value } });
      fireEvent.click(saveButton());

      expect(await screen.findByText(message)).toBeTruthy();
      expect(document.activeElement).toBe(input);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(sent).toEqual([]);
      expectAccessibleForm();
    },
  );

  it('UI-033.validation DER-38-05 leaving an empty field of a new entry shows its text at once', async () => {
    mockApi();
    await openPage();
    fireEvent.click(createButton());

    fireEvent.blur(codeInput());
    fireEvent.blur(plainTextInput());

    expect(screen.getByText('Zustandscode: 1 bis 20 Zeichen')).toBeTruthy();
    expect(screen.getByText('Klartext: 1 bis 500 Zeichen')).toBeTruthy();
    expectAccessibleForm();
  });

  it('UI-033.validation DER-38-05 shows the field errors of a 422 validation_failed at code, plain text and visual grade', async () => {
    mockApi({
      writes: {
        [PATCH_DGS]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [
                { path: 'plainText', code: 'too_big', message: 'Klartext: 1 bis 500 Zeichen' },
                {
                  path: 'suggestedVisualGrade',
                  code: 'custom',
                  message: 'Optik-Note: ganze Zahl von 1 bis 5',
                },
              ],
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();

    changePlainText('Neu');

    expect(await screen.findByText('Optik-Note: ganze Zahl von 1 bis 5')).toBeTruthy();
    expect(screen.getByText('Klartext: 1 bis 500 Zeichen')).toBeTruthy();
    expect(gradeSelect().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(plainTextInput());
    expect(plainTextInput().value).toBe('Neu');
    expectAccessibleForm();
  });

  it('UI-033.validation AC-REQ-022-02 shows "Diesen Code gibt es für diesen Lieferanten bereits" at the code', async () => {
    mockApi({
      writes: {
        'POST /api/condition-codes': () =>
          Response.json(
            errorBody('name_taken', {
              message: 'Diesen Code gibt es für diesen Lieferanten bereits',
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();
    fireEvent.click(createButton());

    fireEvent.change(codeInput(), { target: { value: 'dgs' } });
    changePlainText('anderer Text');

    expect(
      await screen.findByText('Diesen Code gibt es für diesen Lieferanten bereits'),
    ).toBeTruthy();
    expect(document.activeElement).toBe(codeInput());
    expect(codeInput().getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText('Gespeichert')).toBeNull();
    expectAccessibleForm();
  });

  describe('DER-38-11 DER-38-12 only active suppliers and condition suggestions (2.0.11, Nachtrag MAR-904, MAR-929)', () => {
    const labels = (select: HTMLSelectElement) =>
      Array.from(select.options).map((option) => option.textContent);
    const shown = (select: HTMLSelectElement) => select.options[select.selectedIndex]?.textContent;
    const readsOf = (reads: string[], prefix: string) =>
      reads.filter((path) => path.startsWith(prefix)).length;
    const L3 = { id: 3, name: 'L3', active: true, version: 1 };
    const rejection = (code: string, message: string, path: string, id: number) =>
      Response.json(errorBody(code, { message, details: { path, id } }), { status: 422 });
    const created = (body: unknown) =>
      Response.json({ ...(body as object), id: 9, version: 1 }, { status: 201 });

    /** "Übersetzung anlegen" with code "NEU", plain text "neuer Text" and the given choices. */
    function enterNew({ supplier, condition }: { supplier?: string; condition?: string }) {
      fireEvent.click(createButton());
      fireEvent.change(codeInput(), { target: { value: 'NEU' } });
      if (supplier) fireEvent.change(supplierSelect(), { target: { value: supplier } });
      if (condition) fireEvent.change(conditionSelect(), { target: { value: condition } });
      changePlainText('neuer Text');
    }

    it('UI-033.default shows a stored, deactivated supplier and suggestion as chosen with "(deaktiviert)"; they stay offered after another one is chosen', async () => {
      mockApi({ initial: [DGS, A1_L2] });
      await openPage();

      fireEvent.click(within(listRegion()).getByRole('button', { name: /^A1/ }));

      expect(supplierSelect().value).toBe('2');
      expect(shown(supplierSelect())).toBe('L2 (deaktiviert)');
      expect(labels(supplierSelect())).toEqual(['alle', 'L1', 'L2 (deaktiviert)']);
      expect(conditionSelect().value).toBe('12');
      expect(labels(conditionSelect())).toEqual(['–', 'Gebraucht', 'Defekt (deaktiviert)']);

      fireEvent.change(supplierSelect(), { target: { value: '1' } });
      fireEvent.change(conditionSelect(), { target: { value: '11' } });

      expect(labels(supplierSelect())).toEqual(['alle', 'L1', 'L2 (deaktiviert)']);
      expect(labels(conditionSelect())).toEqual(['–', 'Gebraucht', 'Defekt (deaktiviert)']);
      expectAccessibleForm();
    });

    it('UI-033.default a new entry offers only the active suppliers and suggestions', async () => {
      mockApi();
      await openPage();

      fireEvent.click(createButton());

      expect(labels(supplierSelect())).toEqual(['alle', 'L1']);
      expect(labels(conditionSelect())).toEqual(['–', 'Gebraucht']);
    });

    it('UI-033.validation FIND-403-03 a newly chosen supplier and suggestion deactivated in another window stay shown as chosen after the focus refetch and are the values sent', async () => {
      let l1 = L1;
      let used = USED;
      const { reads, sent } = mockApi({
        suppliers: () => [l1, L2],
        conditions: () => [used, DEFECT],
        writes: { 'POST /api/condition-codes': (init) => created(JSON.parse(String(init?.body))) },
      });
      await openPage();
      fireEvent.click(createButton());
      fireEvent.change(codeInput(), { target: { value: 'NEU' } });
      fireEvent.change(supplierSelect(), { target: { value: '1' } });
      fireEvent.change(conditionSelect(), { target: { value: '11' } });

      // Both are deactivated in another window; the window gets the focus again and the
      // choices are loaded in the background.
      l1 = { ...L1, active: false, version: 2 };
      used = { ...USED, active: false, version: 2 };
      const suppliersBefore = readsOf(reads, '/api/suppliers');
      const conditionsBefore = readsOf(reads, '/api/pick-lists/1/values');
      fireEvent(window, new Event('visibilitychange'));
      await vi.waitFor(() => {
        expect(readsOf(reads, '/api/suppliers')).toBeGreaterThan(suppliersBefore);
        expect(readsOf(reads, '/api/pick-lists/1/values')).toBeGreaterThan(conditionsBefore);
      });
      await vi.waitFor(() =>
        expect(labels(supplierSelect())).toEqual(['alle', 'L1 (deaktiviert)']),
      );
      await vi.waitFor(() =>
        expect(labels(conditionSelect())).toEqual(['–', 'Gebraucht (deaktiviert)']),
      );

      expect(supplierSelect().value).toBe('1');
      expect(shown(supplierSelect())).toBe('L1 (deaktiviert)');
      expect(conditionSelect().value).toBe('11');
      expect(shown(conditionSelect())).toBe('Gebraucht (deaktiviert)');

      changePlainText('neuer Text');

      expect(await screen.findByText('Gespeichert')).toBeTruthy();
      expect(sent[0]?.body).toMatchObject({ supplierId: 1, suggestedConditionValueId: 11 });
    });

    it('UI-033.validation a change of the plain text of an entry with a deactivated supplier sends the stored supplier and suggestion', async () => {
      const { sent } = mockApi({
        initial: [DGS, A1_L2],
        writes: {
          'PATCH /api/condition-codes/3': () =>
            Response.json({ ...A1_L2, plainText: 'wie neu', version: 5 }),
        },
      });
      await openPage();
      fireEvent.click(within(listRegion()).getByRole('button', { name: /^A1/ }));

      changePlainText('wie neu');

      expect(await screen.findByText('Gespeichert')).toBeTruthy();
      expect(sent[0]?.body).toMatchObject({ supplierId: 2, suggestedConditionValueId: 12 });
    });

    it('UI-033.validation after supplier_deactivated shows the text at "Lieferant" with the focus there, reloads both choices, shows "Bitte wählen" and keeps the inputs', async () => {
      let l1 = L1;
      const { reads, sent } = mockApi({
        suppliers: () => [l1, L2, L3],
        writes: {
          'POST /api/condition-codes': () => {
            l1 = { ...L1, active: false, version: 2 };
            return rejection(
              'supplier_deactivated',
              'Lieferant L1 ist deaktiviert',
              'supplierId',
              1,
            );
          },
        },
      });
      await openPage();
      const supplierReads = readsOf(reads, '/api/suppliers');
      const conditionReads = readsOf(reads, '/api/pick-lists/1/values');

      enterNew({ supplier: '1', condition: '11' });

      expect(await screen.findByText('Lieferant L1 ist deaktiviert')).toBeTruthy();
      expect(document.activeElement).toBe(supplierSelect());
      expect(supplierSelect().getAttribute('aria-invalid')).toBe('true');
      await vi.waitFor(() => {
        expect(readsOf(reads, '/api/suppliers')).toBeGreaterThan(supplierReads);
        expect(readsOf(reads, '/api/pick-lists/1/values')).toBeGreaterThan(conditionReads);
      });
      await vi.waitFor(() =>
        expect(labels(supplierSelect())).toEqual(['Bitte wählen', 'alle', 'L3']),
      );
      expect(shown(supplierSelect())).toBe('Bitte wählen');
      expect(codeInput().value).toBe('NEU');
      expect(plainTextInput().value).toBe('neuer Text');
      expect(conditionSelect().value).toBe('11');
      expect(sent).toHaveLength(1);
      expect(screen.queryByText('Gespeichert')).toBeNull();
      expectAccessibleForm();
    });

    it('UI-033.validation "Speichern" without a supplier chosen after the rejection shows "Lieferant: Lieferanten oder „alle“ wählen" and sends nothing; "alle" sends supplierId null', async () => {
      let l1 = L1;
      const { sent } = mockApi({
        suppliers: () => [l1, L2],
        writes: {
          'POST /api/condition-codes': (init) => {
            if (sent.length > 1) return created(JSON.parse(String(init?.body)));
            l1 = { ...L1, active: false, version: 2 };
            return rejection(
              'supplier_deactivated',
              'Lieferant L1 ist deaktiviert',
              'supplierId',
              1,
            );
          },
        },
      });
      await openPage();
      enterNew({ supplier: '1' });
      await vi.waitFor(() => expect(shown(supplierSelect())).toBe('Bitte wählen'));

      fireEvent.click(saveButton());

      expect(await screen.findByText('Lieferant: Lieferanten oder „alle“ wählen')).toBeTruthy();
      expect(screen.queryByText('Lieferant L1 ist deaktiviert')).toBeNull();
      expect(document.activeElement).toBe(supplierSelect());
      expect(sent).toHaveLength(1);
      expectAccessibleForm();

      fireEvent.change(supplierSelect(), { target: { value: '' } });
      expect(screen.queryByText('Lieferant: Lieferanten oder „alle“ wählen')).toBeNull();
      expect(labels(supplierSelect())).toEqual(['alle']);
      fireEvent.click(saveButton());

      expect(await screen.findByText('Gespeichert')).toBeTruthy();
      expect(sent).toHaveLength(2);
      expect(sent[1]?.body).toMatchObject({ code: 'NEU', supplierId: null });
    });

    it('UI-033.validation after supplier_deactivated the choice of another supplier sends its id, never the rejected one', async () => {
      let l1 = L1;
      const { sent } = mockApi({
        suppliers: () => [l1, L2, L3],
        writes: {
          'POST /api/condition-codes': (init) => {
            if (sent.length > 1) return created(JSON.parse(String(init?.body)));
            l1 = { ...L1, active: false, version: 2 };
            return rejection(
              'supplier_deactivated',
              'Lieferant L1 ist deaktiviert',
              'supplierId',
              1,
            );
          },
        },
      });
      await openPage();
      enterNew({ supplier: '1' });
      await vi.waitFor(() => expect(shown(supplierSelect())).toBe('Bitte wählen'));

      fireEvent.change(supplierSelect(), { target: { value: '3' } });
      expect(screen.queryByText('Lieferant L1 ist deaktiviert')).toBeNull();
      fireEvent.click(saveButton());

      expect(await screen.findByText('Gespeichert')).toBeTruthy();
      expect(sent[1]?.body).toMatchObject({ supplierId: 3 });
    });

    it('UI-033.validation after pick_list_value_deactivated "Vorschlag Zustand" is empty with "Vorschlag Zustand Gebraucht ist deaktiviert"; "Speichern" sends suggestedConditionValueId null', async () => {
      let used = USED;
      const { reads, sent } = mockApi({
        conditions: () => [used, DEFECT],
        writes: {
          [PATCH_DGS]: (init) => {
            if (sent.length > 1)
              return Response.json({ ...DGS, ...JSON.parse(String(init?.body)), version: 4 });
            used = { ...USED, active: false, version: 2 };
            return rejection(
              'pick_list_value_deactivated',
              'Vorschlag Zustand Gebraucht ist deaktiviert',
              'suggestedConditionValueId',
              11,
            );
          },
        },
      });
      await openPage();
      const conditionReads = readsOf(reads, '/api/pick-lists/1/values');
      fireEvent.change(conditionSelect(), { target: { value: '11' } });
      changePlainText('Neu');

      expect(await screen.findByText('Vorschlag Zustand Gebraucht ist deaktiviert')).toBeTruthy();
      expect(document.activeElement).toBe(conditionSelect());
      expect(conditionSelect().getAttribute('aria-invalid')).toBe('true');
      await vi.waitFor(() =>
        expect(readsOf(reads, '/api/pick-lists/1/values')).toBeGreaterThan(conditionReads),
      );
      await vi.waitFor(() => expect(labels(conditionSelect())).toEqual(['–']));
      expect(conditionSelect().value).toBe('');
      expect(supplierSelect().value).toBe('');
      expect(plainTextInput().value).toBe('Neu');
      expectAccessibleForm();

      fireEvent.click(saveButton());

      expect(await screen.findByText('Gespeichert')).toBeTruthy();
      expect(sent[1]?.body).toMatchObject({ plainText: 'Neu', suggestedConditionValueId: null });
    });

    it('UI-033.validation FIND-403-01 after a rejection the field does not fall back to the stored value; the stored, deactivated one stays offered and saves with 200', async () => {
      let used = USED;
      const { sent } = mockApi({
        initial: [DGS, A1_L2],
        conditions: () => [used, DEFECT],
        writes: {
          'PATCH /api/condition-codes/3': (init) => {
            if (sent.length > 1)
              return Response.json({ ...A1_L2, ...JSON.parse(String(init?.body)), version: 5 });
            used = { ...USED, active: false, version: 2 };
            return rejection(
              'pick_list_value_deactivated',
              'Vorschlag Zustand Gebraucht ist deaktiviert',
              'suggestedConditionValueId',
              11,
            );
          },
        },
      });
      await openPage();
      fireEvent.click(within(listRegion()).getByRole('button', { name: /^A1/ }));
      fireEvent.change(conditionSelect(), { target: { value: '11' } });
      changePlainText('wie neu');

      expect(await screen.findByText('Vorschlag Zustand Gebraucht ist deaktiviert')).toBeTruthy();
      await vi.waitFor(() =>
        expect(labels(conditionSelect())).toEqual(['–', 'Defekt (deaktiviert)']),
      );
      expect(conditionSelect().value).toBe('');
      expect(supplierSelect().value).toBe('2');

      fireEvent.change(conditionSelect(), { target: { value: '12' } });
      fireEvent.click(saveButton());

      expect(await screen.findByText('Gespeichert')).toBeTruthy();
      expect(sent).toHaveLength(2);
      expect(sent[1]?.body).toMatchObject({
        plainText: 'wie neu',
        supplierId: 2,
        suggestedConditionValueId: 12,
      });
    });

    it('UI-033.validation a second field no longer active after the reload carries its text too', async () => {
      let l1 = L1;
      let used = USED;
      mockApi({
        suppliers: () => [l1, L2],
        conditions: () => [used, DEFECT],
        writes: {
          'POST /api/condition-codes': () => {
            l1 = { ...L1, active: false, version: 2 };
            used = { ...USED, active: false, version: 2 };
            return rejection(
              'supplier_deactivated',
              'Lieferant L1 ist deaktiviert',
              'supplierId',
              1,
            );
          },
        },
      });
      await openPage();

      enterNew({ supplier: '1', condition: '11' });

      expect(await screen.findByText('Lieferant L1 ist deaktiviert')).toBeTruthy();
      expect(await screen.findByText('Vorschlag Zustand Gebraucht ist deaktiviert')).toBeTruthy();
      expect(conditionSelect().value).toBe('');
      expect(conditionSelect().getAttribute('aria-invalid')).toBe('true');
      expect(shown(supplierSelect())).toBe('Bitte wählen');
      expect(document.activeElement).toBe(supplierSelect());
      expectAccessibleForm();
    });

    it('UI-033.validation when the reload fails, the rejected id counts as missing and is never sent again', async () => {
      let failSuppliers = false;
      const { sent } = mockApi({
        writes: {
          'POST /api/condition-codes': (init) => {
            if (sent.length > 1) return created(JSON.parse(String(init?.body)));
            failSuppliers = true;
            return rejection(
              'supplier_deactivated',
              'Lieferant L1 ist deaktiviert',
              'supplierId',
              1,
            );
          },
        },
      });
      const fetchOfPage = vi.mocked(fetch).getMockImplementation();
      vi.mocked(fetch).mockImplementation(async (input, init) =>
        failSuppliers && String(input).startsWith('/api/suppliers')
          ? Response.json(errorBody('internal_error'), { status: 500 })
          : (fetchOfPage as typeof fetch)(input, init),
      );
      await openPage();

      enterNew({ supplier: '1' });

      expect(await screen.findByText('Lieferant L1 ist deaktiviert')).toBeTruthy();
      expect(shown(supplierSelect())).toBe('Bitte wählen');
      expect(labels(supplierSelect())).toEqual(['Bitte wählen', 'alle']);

      fireEvent.change(supplierSelect(), { target: { value: '' } });
      fireEvent.click(saveButton());

      expect(await screen.findByText('Gespeichert')).toBeTruthy();
      expect(sent[1]?.body).toMatchObject({ supplierId: null });
    });
  });

  it('UI-033.error DER-38-04 shows the error banner with the reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PATCH_DGS]: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
      },
    });
    await openPage();

    changePlainText('Neu');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Einstellungen konnten nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(plainTextInput().value).toBe('Neu');
    expect(saveButton().disabled).toBe(false);
    expectAccessibleForm();
  });

  it('UI-033.speichert locks the trigger and all inputs while the write runs, without time limit', async () => {
    mockApi({ writes: { [PATCH_DGS]: pending } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    changePlainText('Neu');

    expect(
      (await screen.findByRole('button', { name: 'Speichern …' })).hasAttribute('disabled'),
    ).toBe(true);
    for (const control of [codeInput(), plainTextInput(), supplierSelect(), gradeSelect()]) {
      expect(control.disabled).toBe(true);
    }
    expect(cancelButton().disabled).toBe(true);
    expect(deleteButton().disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(screen.getByRole('button', { name: 'Speichern …' })).toBeTruthy();
  });

  it('UI-033.conflict DER-38-06 (a) shows P-05 with "Neu laden" and keeps the inputs; "Neu laden" takes the reloaded data', async () => {
    let listCalls = 0;
    mockApi({
      list: () => {
        listCalls += 1;
        const dgs =
          listCalls === 1 ? DGS : { ...DGS, plainText: 'Aus anderem Fenster', version: 4 };
        return Response.json({ items: [dgs, DGS_L1], total: 2 });
      },
      writes: { [PATCH_DGS]: () => Response.json(errorBody('version_conflict'), { status: 409 }) },
    });
    await openPage();

    changePlainText('Neu');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.',
    );
    expect(plainTextInput().value).toBe('Neu');
    expectAccessibleForm();

    fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(plainTextInput().value).toBe('Aus anderem Fenster'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  it('UI-033.conflict DER-38-06 (a) a deletion with an outdated version shows P-05 and deletes nothing', async () => {
    mockApi({
      writes: { [DELETE_DGS]: () => Response.json(errorBody('version_conflict'), { status: 409 }) },
    });
    await openPage();

    fireEvent.click(deleteButton());
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }),
    );

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Bitte neu laden und erneut prüfen.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rows()).toHaveLength(2);
  });

  it('UI-033.conflict DER-38-06 (a) DER-38-08 a deletion sends the version of the opened entry, not the one refetched in the background', async () => {
    let listCalls = 0;
    const { sent } = mockApi({
      list: () => {
        listCalls += 1;
        const dgs =
          listCalls === 1 ? DGS : { ...DGS, plainText: 'Aus anderem Fenster', version: 4 };
        return Response.json({ items: [dgs, DGS_L1], total: 2 });
      },
      writes: {
        [DELETE_DGS]: () => Response.json(errorBody('version_conflict'), { status: 409 }),
        'DELETE /api/condition-codes/1?version=4': () => new Response(null, { status: 204 }),
      },
    });
    await openPage();
    // The browser window gets the focus again; TanStack Query loads the list in the background.
    fireEvent(window, new Event('visibilitychange'));
    await within(listRegion()).findByText(/Aus anderem Fenster/);
    expect(plainTextInput().value).toBe(DGS.plainText);

    fireEvent.click(deleteButton());
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }),
    );

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Bitte neu laden und erneut prüfen.');
    expect(sent.map((request) => request.path)).toEqual(['/api/condition-codes/1?version=3']);
  });

  it('UI-033.unreachable DER-38-06 (b) shows P-06 with "Erneut versuchen" when the list gets no answer, without replacing the page', async () => {
    mockApi({
      list: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(listRegion()).toBeTruthy();
    expect(screen.queryByText('Noch keine Code-Übersetzungen')).toBeNull();
    expectAccessibleForm();
  });

  it('UI-033.unreachable DER-38-06 (b) shows P-06 when the list takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      list: (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    renderPage();
    await screen.findByText('Lade Einstellungen …');

    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'resellr ist nicht erreichbar.',
    );
  });

  it('UI-033.wird-beendet DER-38-06 (c) shows P-07 without reference number and keeps the inputs', async () => {
    mockApi({
      writes: { [PATCH_DGS]: () => Response.json(errorBody('shutting_down'), { status: 503 }) },
    });
    await openPage();

    changePlainText('Neu');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-/);
    expect(plainTextInput().value).toBe('Neu');
    expectAccessibleForm();
  });

  it('shows "Dieser Eintrag ist nicht mehr vorhanden." when the entry is gone', async () => {
    mockApi({
      writes: {
        [PATCH_DGS]: () =>
          Response.json(
            errorBody('not_found', { message: 'Dieser Eintrag ist nicht mehr vorhanden.' }),
            { status: 404 },
          ),
      },
    });
    await openPage();

    changePlainText('Neu');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-033.ausgang-unbekannt DER-38-06 (d) a save without HTTP answer shows "Ausgang unbekannt, bitte neu laden." without button and locks every further write', async () => {
    const { sent } = mockApi({
      writes: {
        [PATCH_DGS]: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    await openPage();

    changePlainText('Neu');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(plainTextInput().value).toBe('Neu');
    expect(saveButton().disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    expect(deleteButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(sent).toHaveLength(1);
    expectAccessibleForm();
  });
});
