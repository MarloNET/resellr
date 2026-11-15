import type { TextBlock } from '@resellr/domain/schemas/text-block.schema';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-030 with a mocked `fetch` (Technical Specification 6.1, 6.2).

const NO_LEGAL_STATUS = { legalStatus: null, legalCheckedOn: null, legalCheckedBy: null };
const ALL_SCOPE = { allDeviceTypes: true, deviceTypeIds: [], allChannels: true, channelIds: [] };

const NOTEBOOK = 11;
const SMARTPHONE = 12;
const SHOP = 21;
const KLEINANZEIGEN = 22;
const EBAY = 23;

/** `GET /api/device-types`: a deactivated device type is offered only when already chosen. */
const DEVICE_TYPES = [
  { id: NOTEBOOK, name: 'Notebook', active: true, version: 1, attributeCount: 0 },
  { id: SMARTPHONE, name: 'Smartphone', active: true, version: 1, attributeCount: 0 },
  { id: 13, name: 'Tablet alt', active: false, version: 2, attributeCount: 0 },
];

/** `GET /api/channels`: the three channels of the initial settings. */
const CHANNELS = [
  { id: SHOP, code: 'shop', name: 'Shop', active: true, sortOrder: 1 },
  { id: KLEINANZEIGEN, code: 'kleinanzeigen', name: 'Kleinanzeigen', active: true, sortOrder: 2 },
  { id: EBAY, code: 'ebay', name: 'eBay', active: true, sortOrder: 3 },
];

const ABHOLUNG: TextBlock = {
  id: 1,
  name: 'Abholung Hannover',
  kind: 'pickup_contact',
  body: 'Abholung nach Absprache.',
  active: true,
  ...NO_LEGAL_STATUS,
  allDeviceTypes: true,
  deviceTypeIds: [] as number[],
  allChannels: false,
  channelIds: [KLEINANZEIGEN] as number[],
  version: 3,
};
const AKKU: TextBlock = {
  id: 2,
  name: 'Akku-Hinweis Notebook',
  kind: 'battery_notice',
  body: 'Die Akkukapazität beträgt {Akkukapazität}.',
  active: true,
  legalStatus: 'unchecked',
  legalCheckedOn: null,
  legalCheckedBy: null,
  allDeviceTypes: false,
  deviceTypeIds: [NOTEBOOK],
  allChannels: true,
  channelIds: [],
  version: 1,
};
const ALT: TextBlock = {
  id: 3,
  name: 'Widerruf alt',
  kind: 'legal',
  body: 'Alter Rechtsblock.',
  active: false,
  legalStatus: 'checked',
  legalCheckedOn: '2026-11-05',
  legalCheckedBy: 'Kanzlei Muster',
  ...ALL_SCOPE,
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

type TextBlockItem = TextBlock;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame (UI-044), the text blocks and one
 * handler per write `METHOD path`. Like the server, a saved text block is part of the next
 * list. Records the list requests and the writes with their JSON body.
 */
function mockApi({
  initial = [ABHOLUNG, AKKU, ALT],
  list,
  channels,
  writes = {},
}: {
  initial?: TextBlockItem[];
  list?: Route;
  channels?: Route;
  writes?: Record<string, Route>;
} = {}) {
  const items = [...initial];
  const sent: { method: string; path: string; body: unknown }[] = [];
  const reads: string[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/ops/status') return Response.json(OPS_STATUS);
    if (path.startsWith('/api/device-types')) {
      return Response.json({ items: DEVICE_TYPES, total: DEVICE_TYPES.length });
    }
    if (path === '/api/channels') {
      return channels ? channels(init) : Response.json({ items: CHANNELS, total: CHANNELS.length });
    }
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

/** UI-043 after "Speichern"; "Schließen" leads back to UI-030. */
const impactDialog = () => screen.getByRole('dialog', { name: 'Auswirkung der Änderung' });
function closeImpactDialog() {
  fireEvent.click(within(impactDialog()).getByRole('button', { name: 'Schließen' }));
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

describe('UI-030 legal check status (CU-101, REQ-054)', () => {
  const LEGAL_REQUIRED = 'Prüfdatum und prüfende Stelle erforderlich';
  const CHECKED_BY_TOO_LONG = 'Prüfende Stelle: höchstens 100 Zeichen';
  const PATCH_AKKU = 'PATCH /api/text-blocks/2';

  const legalStatusSelect = () =>
    within(detailForm()).queryByRole<HTMLSelectElement>('combobox', { name: /^Prüfstatus/ });
  const checkedOnInput = () => within(detailForm()).getByLabelText<HTMLInputElement>(/^Prüfdatum/);
  const checkedByInput = () =>
    within(detailForm()).getByRole<HTMLInputElement>('textbox', { name: /^Prüfende Stelle/ });

  /** Every error a marked control names through `aria-describedby` exists and has a text. */
  function expectLinkedErrors(input: HTMLElement) {
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const ids = input.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(document.getElementById(id)?.textContent).toBeTruthy();
  }

  /** Opens "Akku-Hinweis Notebook" and sets "rechtlich geprüft" with the given fields. */
  async function checkAkku(legalCheckedOn: string, legalCheckedBy: string) {
    await openPage();
    fireEvent.click(row('Akku-Hinweis Notebook'));
    fireEvent.change(legalStatusSelect() as HTMLSelectElement, { target: { value: 'checked' } });
    fireEvent.change(checkedOnInput(), { target: { value: legalCheckedOn } });
    fireEvent.change(checkedByInput(), { target: { value: legalCheckedBy } });
    fireEvent.click(saveButton());
  }

  it('UI-030.default DER-40-04 shows the check status chip of the kinds Rechtliches and Akku-Hinweis in the list', async () => {
    mockApi();
    await openPage();

    expect(within(row('Akku-Hinweis Notebook')).getByText('rechtlich ungeprüft')).toBeTruthy();
    expect(
      within(row('Widerruf alt')).getByText('rechtlich geprüft am 05.11.2026 durch Kanzlei Muster'),
    ).toBeTruthy();
    expect(row('Abholung Hannover').textContent).not.toContain('rechtlich');
    expectAccessiblePage();
  });

  it('UI-030.default DER-40-05 offers no check fields for the kinds Lieferumfang, Abholung/Kontakt and Sonstiges', async () => {
    mockApi();
    await openPage();

    for (const kind of ['pickup_contact', 'delivery_scope', 'other']) {
      fireEvent.change(kindSelect(), { target: { value: kind } });
      expect(legalStatusSelect()).toBeNull();
      expect(within(detailForm()).queryByLabelText(/^Prüfdatum/)).toBeNull();
      expect(within(detailForm()).queryByLabelText(/^Prüfende Stelle/)).toBeNull();
    }
    fireEvent.change(kindSelect(), { target: { value: 'legal' } });
    expect(legalStatusSelect()?.value).toBe('unchecked');
  });

  it('UI-030.default shows the check status of a text block of the kind Akku-Hinweis and the check fields only at "rechtlich geprüft"', async () => {
    mockApi();
    await openPage();

    fireEvent.click(row('Akku-Hinweis Notebook'));
    expect(legalStatusSelect()?.value).toBe('unchecked');
    expect(within(detailForm()).queryByLabelText(/^Prüfdatum/)).toBeNull();

    fireEvent.click(row('Widerruf alt'));
    expect(legalStatusSelect()?.value).toBe('checked');
    expect(checkedOnInput().value).toBe('2026-11-05');
    expect(checkedOnInput().type).toBe('date');
    expect(checkedByInput().value).toBe('Kanzlei Muster');
    expectAccessiblePage();
  });

  it('UI-030.default a new text block of the kind Akku-Hinweis is "rechtlich ungeprüft" and its status is not chosen', async () => {
    mockApi();
    await openPage();

    fireEvent.click(createButton());
    fireEvent.change(kindSelect(), { target: { value: 'battery_notice' } });

    expect(legalStatusSelect()?.value).toBe('unchecked');
    expect(legalStatusSelect()?.disabled).toBe(true);
  });

  it('UI-030.success sends the three check fields together and shows "Gespeichert"', async () => {
    const saved = {
      ...AKKU,
      legalStatus: 'checked',
      legalCheckedOn: '2020-01-15',
      legalCheckedBy: 'Kanzlei Muster',
      version: 2,
    } as const;
    const { sent } = mockApi({
      writes: {
        [PATCH_AKKU]: () =>
          Response.json({ textBlock: saved, impact: NO_IMPACT, legalStatusReset: false }),
      },
    });

    await checkAkku('2020-01-15', 'Kanzlei Muster');

    expect((await screen.findByText('Gespeichert')).closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/text-blocks/2',
        body: {
          version: 1,
          legalStatus: 'checked',
          legalCheckedOn: '2020-01-15',
          legalCheckedBy: 'Kanzlei Muster',
        },
      },
    ]);
    closeImpactDialog();
    await vi.waitFor(() =>
      expect(row('Akku-Hinweis Notebook').textContent).toContain(
        'rechtlich geprüft am 15.01.2020 durch Kanzlei Muster',
      ),
    );
  });

  it.each([
    ['the check date', '', 'Kanzlei Muster'],
    ['the checking body', '2020-01-15', ''],
    ['both', '', ''],
  ])(
    'UI-030.validation DER-40-01 without %s shows "Prüfdatum und prüfende Stelle erforderlich" exactly once and marks both fields',
    async (_case, legalCheckedOn, legalCheckedBy) => {
      const { sent } = mockApi();

      await checkAkku(legalCheckedOn, legalCheckedBy);

      expect(await screen.findAllByText(LEGAL_REQUIRED)).toHaveLength(1);
      expectLinkedErrors(checkedOnInput());
      expectLinkedErrors(checkedByInput());
      expect(screen.queryByText('Prüfende Stelle fehlt')).toBeNull();
      expect(document.activeElement).toBe(checkedOnInput());
      expect(sent).toEqual([]);
      expectAccessiblePage();
    },
  );

  it('UI-030.validation DER-40-01 shows the entries of a 422 validation_failed once below both fields', async () => {
    const required = (path: string) => ({
      path,
      code: 'legal_check_required',
      message: LEGAL_REQUIRED,
    });
    mockApi({
      writes: {
        [PATCH_AKKU]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [required('legalCheckedOn'), required('legalCheckedBy')],
            }),
            { status: 422 },
          ),
      },
    });

    await checkAkku('2020-01-15', 'Kanzlei Muster');

    expect(await screen.findAllByText(LEGAL_REQUIRED)).toHaveLength(1);
    expectLinkedErrors(checkedOnInput());
    expectLinkedErrors(checkedByInput());
    expect(screen.queryByText('Gespeichert')).toBeNull();
  });

  it('UI-030.validation DER-40-02 a check date in the future shows "Prüfdatum darf nicht in der Zukunft liegen" at "Prüfdatum"', async () => {
    const { sent } = mockApi();

    await checkAkku('2999-12-31', 'Kanzlei Muster');

    const message = await screen.findByText('Prüfdatum darf nicht in der Zukunft liegen');
    expect(checkedOnInput().getAttribute('aria-describedby')).toBe(message.id);
    expect(checkedByInput().getAttribute('aria-invalid')).toBeNull();
    expect(sent).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-030.validation DER-40-06 a checking body of 101 characters shows exactly "Prüfende Stelle: höchstens 100 Zeichen" at the field, 100 characters are saved', async () => {
    const { sent } = mockApi({
      writes: {
        [PATCH_AKKU]: (init) => {
          const body = JSON.parse(String(init?.body)) as Record<string, string>;
          return Response.json({
            textBlock: { ...AKKU, ...body, version: 2 },
            impact: NO_IMPACT,
            legalStatusReset: false,
          });
        },
      },
    });

    await checkAkku('2020-01-15', 'a'.repeat(101));

    const message = await screen.findByText(CHECKED_BY_TOO_LONG);
    expect(message.textContent).toBe(CHECKED_BY_TOO_LONG);
    expect(checkedByInput().getAttribute('aria-describedby')).toBe(message.id);
    expect(checkedOnInput().getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText('Prüfende Stelle fehlt')).toBeNull();
    expect(screen.queryByText(LEGAL_REQUIRED)).toBeNull();
    expect(sent).toEqual([]);
    expectAccessiblePage();

    fireEvent.change(checkedByInput(), { target: { value: 'a'.repeat(100) } });
    fireEvent.click(saveButton());

    expect(await screen.findByText('Gespeichert')).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toMatchObject({ legalCheckedBy: 'a'.repeat(100) });
  });

  it('UI-030.success DER-40-06 a checking body of 101 characters entered before going back to "rechtlich ungeprüft" does not block "Speichern"', async () => {
    const { sent } = mockApi({
      writes: {
        [PATCH_AKKU]: () =>
          Response.json({ textBlock: AKKU, impact: NO_IMPACT, legalStatusReset: false }),
      },
    });
    await openPage();
    fireEvent.click(row('Akku-Hinweis Notebook'));
    fireEvent.change(legalStatusSelect() as HTMLSelectElement, { target: { value: 'checked' } });
    fireEvent.change(checkedOnInput(), { target: { value: '2020-01-15' } });
    fireEvent.change(checkedByInput(), { target: { value: 'a'.repeat(101) } });
    fireEvent.change(legalStatusSelect() as HTMLSelectElement, { target: { value: 'unchecked' } });

    fireEvent.click(saveButton());

    expect(await screen.findByText('Gespeichert')).toBeTruthy();
    expect(screen.queryByText(CHECKED_BY_TOO_LONG)).toBeNull();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/text-blocks/2',
        body: { version: 1, legalStatus: 'unchecked', legalCheckedOn: '', legalCheckedBy: '' },
      },
    ]);
  });

  it('UI-030.validation DER-40-06 shows M-31 of a 422 validation_failed at "Prüfende Stelle"', async () => {
    mockApi({
      writes: {
        [PATCH_AKKU]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [{ path: 'legalCheckedBy', code: 'too_big', message: CHECKED_BY_TOO_LONG }],
            }),
            { status: 422 },
          ),
      },
    });

    await checkAkku('2020-01-15', 'Kanzlei Muster');

    expect(await screen.findByText(CHECKED_BY_TOO_LONG)).toBeTruthy();
    expectLinkedErrors(checkedByInput());
    expect(checkedOnInput().getAttribute('aria-invalid')).toBeNull();
  });

  it('UI-030.success DER-40-03 after a change of the text of a "rechtlich geprüft" text block shows "Prüfstatus wurde auf ‚rechtlich ungeprüft‘ zurückgesetzt"', async () => {
    const saved = {
      ...ALT,
      body: 'Neuer Rechtsblock.',
      legalStatus: 'unchecked',
      legalCheckedOn: null,
      legalCheckedBy: null,
      version: 3,
    } as const;
    const { sent } = mockApi({
      writes: {
        'PATCH /api/text-blocks/3': () =>
          Response.json({ textBlock: saved, impact: NO_IMPACT, legalStatusReset: true }),
      },
    });
    await openPage();
    fireEvent.click(row('Widerruf alt'));

    changeBody('Neuer Rechtsblock.');

    const hint = await screen.findByText(
      'Prüfstatus wurde auf ‚rechtlich ungeprüft‘ zurückgesetzt',
    );
    expect(hint.closest('[role="status"]')).toBeTruthy();
    expect(screen.getByText('Gespeichert')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/text-blocks/3',
        body: { version: 2, body: 'Neuer Rechtsblock.' },
      },
    ]);
    closeImpactDialog();
    expect(legalStatusSelect()?.value).toBe('unchecked');
    expect(within(detailForm()).queryByLabelText(/^Prüfdatum/)).toBeNull();
    await vi.waitFor(() =>
      expect(within(row('Widerruf alt')).getByText('rechtlich ungeprüft')).toBeTruthy(),
    );

    fireEvent.click(row('Abholung Hannover'));
    expect(screen.queryByText(/Prüfstatus wurde/)).toBeNull();
  });
});

describe('UI-030 scope and UI-043 (#163)', () => {
  const scopeGroup = (name: 'Gerätearten' | 'Kanäle') =>
    within(detailForm()).getByRole('group', { name });
  const checkbox = (group: 'Gerätearten' | 'Kanäle', name: string) =>
    within(scopeGroup(group)).getByRole<HTMLInputElement>('checkbox', { name });

  it('UI-030.default DER-39-09 shows the scope of the open text block: "alle" or the chosen entries', async () => {
    mockApi();
    await openPage();

    expect(checkbox('Gerätearten', 'alle Gerätearten').checked).toBe(true);
    expect(within(scopeGroup('Gerätearten')).getAllByRole('checkbox')).toHaveLength(1);
    expect(checkbox('Kanäle', 'alle Kanäle').checked).toBe(false);
    expect(
      within(scopeGroup('Kanäle'))
        .getAllByRole<HTMLInputElement>('checkbox')
        .map((box) => [box.parentElement?.textContent, box.checked]),
    ).toEqual([
      ['alle Kanäle', false],
      ['Shop', false],
      ['Kleinanzeigen', true],
      ['eBay', false],
    ]);
    expect(
      screen.getByRole('group', { name: 'Gerätearten' }).closest('fieldset')?.textContent,
    ).toContain('Geltungsbereich');
    expectAccessiblePage();
  });

  it('UI-030.success DER-39-09 a new text block with a choice of device types and channels is saved and listed', async () => {
    const created = {
      id: 4,
      name: 'Widerruf Shop',
      kind: 'legal',
      body: 'Widerrufsbelehrung',
      active: true,
      legalStatus: 'unchecked',
      legalCheckedOn: null,
      legalCheckedBy: null,
      allDeviceTypes: false,
      deviceTypeIds: [NOTEBOOK, SMARTPHONE],
      allChannels: false,
      channelIds: [SHOP],
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
    fireEvent.change(nameInput(), { target: { value: 'Widerruf Shop' } });
    fireEvent.change(kindSelect(), { target: { value: 'legal' } });
    fireEvent.change(bodyInput(), { target: { value: 'Widerrufsbelehrung' } });
    fireEvent.click(checkbox('Gerätearten', 'alle Gerätearten'));
    expect(
      within(scopeGroup('Gerätearten'))
        .getAllByRole('checkbox')
        .map((box) => box.parentElement?.textContent),
    ).toEqual(['alle Gerätearten', 'Notebook', 'Smartphone']);
    fireEvent.click(checkbox('Gerätearten', 'Notebook'));
    fireEvent.click(checkbox('Gerätearten', 'Smartphone'));
    fireEvent.click(checkbox('Kanäle', 'alle Kanäle'));
    fireEvent.click(checkbox('Kanäle', 'Shop'));
    fireEvent.click(saveButton());

    await screen.findByRole('dialog', { name: 'Auswirkung der Änderung' });
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/text-blocks',
        body: {
          name: 'Widerruf Shop',
          kind: 'legal',
          body: 'Widerrufsbelehrung',
          allDeviceTypes: false,
          deviceTypeIds: [NOTEBOOK, SMARTPHONE],
          allChannels: false,
          channelIds: [SHOP],
        },
      },
    ]);
    closeImpactDialog();
    expect(row('Widerruf Shop').textContent).toBe(
      'Widerruf ShopRechtlichesNotebook, Smartphone, Shoprechtlich ungeprüftaktiv',
    );
  });

  it('UI-030.success DER-39-09 a change of the scope sends only the changed part', async () => {
    const saved = { ...ABHOLUNG, allChannels: true, channelIds: [], version: 4 };
    const { sent } = mockApi({
      writes: { [PATCH_ABHOLUNG]: () => Response.json({ textBlock: saved, impact: NO_IMPACT }) },
    });
    await openPage();

    fireEvent.click(checkbox('Kanäle', 'alle Kanäle'));
    fireEvent.click(saveButton());

    await screen.findByRole('dialog', { name: 'Auswirkung der Änderung' });
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/text-blocks/1',
        body: { version: 3, allChannels: true, channelIds: [] },
      },
    ]);
    closeImpactDialog();
    expect(row('Abholung Hannover').textContent).toContain('alle Gerätearten, alle Kanäle');
  });

  it('UI-030.default a chosen device type deactivated since stays offered and chosen', async () => {
    mockApi({ initial: [{ ...AKKU, deviceTypeIds: [13] }] });
    renderTextBlocks();
    await screen.findByRole('button', { name: /^Akku-Hinweis Notebook/ });

    expect(
      within(scopeGroup('Gerätearten'))
        .getAllByRole<HTMLInputElement>('checkbox')
        .map((box) => [box.parentElement?.textContent, box.checked]),
    ).toEqual([
      ['alle Gerätearten', false],
      ['Notebook', false],
      ['Smartphone', false],
      ['Tablet alt', true],
    ]);
    expect(row('Akku-Hinweis Notebook').textContent).toContain('Tablet alt, alle Kanäle');
  });

  it('UI-030.default a deactivated device type that is not chosen is not offered', async () => {
    mockApi();
    await openPage();

    fireEvent.click(checkbox('Gerätearten', 'alle Gerätearten'));

    expect(
      within(scopeGroup('Gerätearten')).queryByRole('checkbox', { name: 'Tablet alt' }),
    ).toBeNull();
  });

  it('UI-030.disabled "Speichern" stays disabled while a choice has no entry', async () => {
    mockApi();
    await openPage();

    fireEvent.click(checkbox('Kanäle', 'Kleinanzeigen'));
    expect(saveButton().disabled).toBe(true);

    fireEvent.click(checkbox('Kanäle', 'eBay'));
    expect(saveButton().disabled).toBe(false);
  });

  it('UI-030.validation shows a scope_required of the server at its list, without UI-043', async () => {
    const message = 'Kanäle: mindestens einen wählen oder ‚alle‘';
    mockApi({
      writes: {
        [PATCH_ABHOLUNG]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [{ path: 'channelIds', code: 'scope_required', message }],
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();

    changeBody('Neu');

    const error = await screen.findByText(message);
    const channels = screen.getByRole('group', { name: 'Kanäle' });
    expect(channels.contains(error)).toBe(true);
    expect(channels.getAttribute('aria-describedby')).toBe(error.id);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('UI-043.empty DER-39-10 after a successful save UI-043 shows "Keine Kanal-Inhalte betroffen" with only "Schließen"', async () => {
    mockApi({
      writes: {
        [PATCH_ABHOLUNG]: () => Response.json({ textBlock: SAVED_ABHOLUNG, impact: NO_IMPACT }),
      },
    });
    await openPage();

    changeBody('Abholung Mo–Fr 9–17 Uhr.');

    const dialog = await screen.findByRole('dialog', { name: 'Auswirkung der Änderung' });
    expect(within(dialog).getByText('Keine Kanal-Inhalte betroffen')).toBeTruthy();
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Schließen']);
    expect(within(dialog).queryByRole('link')).toBeNull();

    closeImpactDialog();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bodyInput().value).toBe('Abholung Mo–Fr 9–17 Uhr.');
  });

  it('UI-043 does not open after "Deaktivieren" or a rejected save', async () => {
    mockApi({
      writes: {
        'PATCH /api/text-blocks/2': () =>
          Response.json({ textBlock: { ...AKKU, active: false, version: 2 }, impact: NO_IMPACT }),
        [PATCH_ABHOLUNG]: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
      },
    });
    await openPage();

    fireEvent.click(deactivateButton('Akku-Hinweis Notebook'));
    await screen.findByText('Gespeichert');
    changeBody('Neu');
    await screen.findByText(/Referenz: R-7K2M-9QX4/);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('UI-030 text blocks (CU-101)', () => {
  it('UI-030.default DER-39-09 lists name, kind, scope and status from GET /api/text-blocks and opens the first one', async () => {
    const { reads } = mockApi();
    await openPage();

    const rows = within(listRegion()).getAllByRole('button', {
      name: /^(Abholung|Akku|Widerruf)/,
    });
    expect(rows.map((item) => item.textContent)).toEqual([
      'Abholung HannoverAbholung/Kontaktalle Gerätearten, Kleinanzeigenaktiv',
      'Akku-Hinweis NotebookAkku-HinweisNotebook, alle Kanälerechtlich ungeprüftaktiv',
      'Widerruf altRechtlichesalle Gerätearten, alle Kanälerechtlich geprüft am 05.11.2026 durch Kanzlei Musterdeaktiviert',
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
      ...NO_LEGAL_STATUS,
      ...ALL_SCOPE,
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
        body: {
          name: 'Lieferumfang Standard',
          kind: 'delivery_scope',
          body: 'Gerät mit Netzteil',
          ...ALL_SCOPE,
        },
      },
    ]);
    closeImpactDialog();
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
    closeImpactDialog();
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

  it('UI-030.unreachable shows P-06 when the channels of the scope get no answer', async () => {
    mockApi({
      channels: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderTextBlocks();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expectAccessiblePage();
  });

  it('UI-030.loading stays in "Lade Einstellungen …" until the channels of the scope have arrived', async () => {
    let answer: (response: Response) => void = () => {};
    const { reads } = mockApi({
      channels: () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    renderTextBlocks();

    // The text blocks themselves have arrived; only the channels are missing.
    await vi.waitFor(() => expect(reads).toHaveLength(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.getByText('Lade Einstellungen …')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Abholung Hannover/ })).toBeNull();
    expectAccessiblePage();

    answer(Response.json({ items: CHANNELS, total: CHANNELS.length }));
    expect(await screen.findByRole('button', { name: /^Abholung Hannover/ })).toBeTruthy();
    expect(screen.queryByText('Lade Einstellungen …')).toBeNull();
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
