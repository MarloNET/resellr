import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-031 and of dialog UI-008 opened from it, with a mocked `fetch`
// (Technical Specification 6.1, 6.2).

const EMPTY_GPSR = {
  legalName: '',
  street: '',
  postalCode: '',
  city: '',
  country: '',
  contact: '',
  euRpName: '',
  euRpAddress: '',
  euRpContact: '',
};
const ALL_MISSING = ['legalName', 'street', 'postalCode', 'city', 'country', 'contact'];
const NO_GPSR = { gpsrComplete: false, gpsrMissing: ALL_MISSING, gpsr: EMPTY_GPSR };
const HP_GPSR = {
  ...EMPTY_GPSR,
  legalName: 'HP Deutschland GmbH',
  street: 'Schickardstraße 32',
  postalCode: '71034',
  city: 'Böblingen',
  country: 'Deutschland',
  contact: 'https://www.hp.com/de-de/kontakt',
};

const LENOVO = { id: 1, name: 'Lenovo', active: true, ...NO_GPSR, version: 3 };
const HP = {
  id: 2,
  name: 'HP',
  active: true,
  gpsrComplete: true,
  gpsrMissing: [] as string[],
  gpsr: HP_GPSR,
  version: 1,
};
const TOSHIBA = { id: 3, name: 'Toshiba', active: false, ...NO_GPSR, version: 2 };

const NO_IMPACT = { updated: 0, rerelease: 0, manualReview: 0 };

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

type ManufacturerItem = typeof HP;

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
      // `existing` of POST is no field of the list; JSON leaves `undefined` out.
      const saved = {
        ...('manufacturer' in answer ? answer.manufacturer : answer),
        existing: undefined,
      };
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
  within(detailForm()).getByRole<HTMLInputElement>('textbox', { name: 'Name' });
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

/** Inputs of the GPSR details in UI-031 by their label. */
const gpsrInput = (label: string) =>
  within(detailForm()).getByRole<HTMLInputElement | HTMLTextAreaElement>('textbox', {
    name: label,
  });
const impactDialog = () => screen.getByRole('dialog', { name: 'Auswirkung der Änderung' });

const PATCH_HP = 'PATCH /api/manufacturers/2';
const PATCH_LENOVO = 'PATCH /api/manufacturers/1';
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

// Before the tests of CU-098: its last test locks every write of the module until a reload (P-08).
describe('UI-031 GPSR details and UI-043 (#165)', () => {
  const LABELS = {
    legalName: 'Herstellername (rechtlich)',
    street: 'Straße und Hausnummer',
    postalCode: 'Postleitzahl',
    city: 'Ort',
    country: 'Land',
    contact: 'Elektronische Kontaktadresse',
    euRpName: 'Name der verantwortlichen Person',
    euRpAddress: 'Postanschrift der verantwortlichen Person',
    euRpContact: 'Kontaktadresse der verantwortlichen Person',
  } as const;

  const MISSING_TEXTS = [
    'Herstellername fehlt',
    'Straße und Hausnummer fehlt',
    'Postleitzahl fehlt',
    'Ort fehlt',
    'Land fehlt',
    'Elektronische Kontaktadresse fehlt',
  ];

  const LENOVO_GPSR = {
    ...EMPTY_GPSR,
    legalName: 'Lenovo PC HK Limited',
    street: 'Meitnerstraße 9',
    postalCode: '70563',
    city: 'Stuttgart',
    country: 'Deutschland',
    contact: 'info@lenovo.com',
  };

  async function openLenovo() {
    await openPage();
    fireEvent.click(row('Lenovo'));
    await vi.waitFor(() => expect(nameInput().value).toBe('Lenovo'));
  }

  function enter(values: Partial<Record<keyof typeof LABELS, string>>) {
    for (const [field, value] of Object.entries(values)) {
      fireEvent.change(gpsrInput(LABELS[field as keyof typeof LABELS]), { target: { value } });
    }
  }

  /** Field error of the input `label`, linked through `aria-describedby`. */
  const errorOf = (label: string) => {
    const input = gpsrInput(label);
    const describedBy = input.getAttribute('aria-describedby');
    return describedBy ? document.getElementById(describedBy)?.textContent : undefined;
  };

  it('UI-031.default shows the stored GPSR details of the open manufacturer with the responsible person in the EU', async () => {
    mockApi();
    await openPage();

    expect(Object.values(LABELS).map((label) => gpsrInput(label).value)).toEqual([
      'HP Deutschland GmbH',
      'Schickardstraße 32',
      '71034',
      'Böblingen',
      'Deutschland',
      'https://www.hp.com/de-de/kontakt',
      '',
      '',
      '',
    ]);
    expect(gpsrInput(LABELS.euRpAddress).tagName).toBe('TEXTAREA');
    expect(screen.getByRole('group', { name: 'Postanschrift' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Verantwortliche Person in der EU' })).toBeTruthy();
    expect(screen.queryByText(/ fehlt$/)).toBeNull();
    expectAccessiblePage();
  });

  it('UI-031.validation DER-41-03 names each missing part of a manufacturer with incomplete details as "<Teil> fehlt" at its field', async () => {
    mockApi();
    await openLenovo();

    expect(
      [
        LABELS.legalName,
        LABELS.street,
        LABELS.postalCode,
        LABELS.city,
        LABELS.country,
        LABELS.contact,
      ].map(errorOf),
    ).toEqual(MISSING_TEXTS);
    expect(errorOf(LABELS.euRpName)).toBeUndefined();
    expectAccessiblePage();
  });

  it.each([
    ['legalName', 201, 'Herstellername: höchstens 200 Zeichen'],
    ['street', 201, 'Straße und Hausnummer: höchstens 200 Zeichen'],
    ['postalCode', 21, 'Postleitzahl: höchstens 20 Zeichen'],
    ['city', 101, 'Ort: höchstens 100 Zeichen'],
    ['country', 101, 'Land: höchstens 100 Zeichen'],
    ['contact', 255, 'Elektronische Kontaktadresse: höchstens 254 Zeichen'],
    ['euRpName', 201, 'Name der verantwortlichen Person: höchstens 200 Zeichen'],
    ['euRpAddress', 501, 'Postanschrift der verantwortlichen Person: höchstens 500 Zeichen'],
    ['euRpContact', 255, 'Kontaktadresse der verantwortlichen Person: höchstens 254 Zeichen'],
  ] as const)(
    'UI-031.validation DER-41-01 %s with %i characters shows "%s" at the field and saves nothing',
    async (field, length, text) => {
      const { sent } = mockApi();
      await openPage();

      enter({ [field]: 'x'.repeat(length) });
      fireEvent.click(saveButton());

      await vi.waitFor(() => expect(errorOf(LABELS[field])).toBe(text));
      expect(document.activeElement).toBe(gpsrInput(LABELS[field]));
      expect(sent).toEqual([]);
      expectAccessiblePage();
    },
  );

  it('UI-031.validation DER-41-01 with incomplete details the focus goes to the input error, the "<Teil> fehlt" texts wait until it is corrected', async () => {
    const { sent } = mockApi();
    await openLenovo();

    enter({ postalCode: '1'.repeat(21) });
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(document.activeElement).toBe(gpsrInput(LABELS.postalCode)));
    expect(errorOf(LABELS.postalCode)).toBe('Postleitzahl: höchstens 20 Zeichen');
    expect(errorOf(LABELS.legalName)).toBeUndefined();
    expect(sent).toEqual([]);

    enter({ postalCode: '' });
    fireEvent.blur(gpsrInput(LABELS.postalCode));
    await vi.waitFor(() => expect(errorOf(LABELS.legalName)).toBe('Herstellername fehlt'));
  });

  it('UI-031.validation DER-41-02 leaving a contact that is neither e-mail nor http(s) address shows "E-Mail-Adresse oder Internetadresse ungültig"; saving sends nothing', async () => {
    const { sent } = mockApi();
    await openPage();

    enter({ contact: 'www.hp.com' });
    fireEvent.blur(gpsrInput(LABELS.contact));

    await vi.waitFor(() =>
      expect(errorOf(LABELS.contact)).toBe('E-Mail-Adresse oder Internetadresse ungültig'),
    );
    fireEvent.click(saveButton());
    expect(sent).toEqual([]);
  });

  it('UI-031.validation DER-41-01 DER-41-02 shows a field error of a 422 validation_failed at its GPSR field', async () => {
    mockApi({
      writes: {
        [PATCH_HP]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [
                {
                  path: 'gpsr.contact',
                  code: 'custom',
                  message: 'E-Mail-Adresse oder Internetadresse ungültig',
                },
              ],
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();

    enter({ contact: 'info@hp.com' });
    fireEvent.click(saveButton());

    await vi.waitFor(() =>
      expect(errorOf(LABELS.contact)).toBe('E-Mail-Adresse oder Internetadresse ungültig'),
    );
    expect(document.activeElement).toBe(gpsrInput(LABELS.contact));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('UI-031.success DER-41-04 DER-41-03 saving incomplete details shows "Gespeichert", then UI-043, and names the missing postal code with the chip "GPSR unvollständig"', async () => {
    const saved = {
      ...LENOVO,
      gpsr: { ...LENOVO_GPSR, postalCode: '' },
      gpsrMissing: ['postalCode'],
      version: 4,
    };
    const { sent } = mockApi({
      writes: { [PATCH_LENOVO]: () => Response.json({ manufacturer: saved, impact: NO_IMPACT }) },
    });
    await openLenovo();

    enter({ ...LENOVO_GPSR, postalCode: '' });
    fireEvent.click(saveButton());

    await screen.findByRole('dialog', { name: 'Auswirkung der Änderung' });
    expect(within(impactDialog()).getByText('Keine Kanal-Inhalte betroffen')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/manufacturers/1',
        body: { version: 3, gpsr: { ...LENOVO_GPSR, postalCode: '' } },
      },
    ]);
    fireEvent.click(within(impactDialog()).getByRole('button', { name: 'Schließen' }));

    expect(screen.getByText('Gespeichert').closest('[role="status"]')).toBeTruthy();
    expect(errorOf(LABELS.postalCode)).toBe('Postleitzahl fehlt');
    expect(errorOf(LABELS.legalName)).toBeUndefined();
    expect(row('Lenovo').textContent).toBe('LenovoaktivGPSR unvollständig');
    expect(saveButton().disabled).toBe(true);
    expectAccessiblePage();
  });

  it('UI-043.empty DER-41-05 after saving complete details UI-043 shows "Keine Kanal-Inhalte betroffen"; the chip shows "GPSR vollständig"', async () => {
    const saved = {
      ...LENOVO,
      gpsrComplete: true,
      gpsrMissing: [],
      gpsr: LENOVO_GPSR,
      version: 4,
    };
    mockApi({
      writes: { [PATCH_LENOVO]: () => Response.json({ manufacturer: saved, impact: NO_IMPACT }) },
    });
    await openLenovo();

    enter(LENOVO_GPSR);
    fireEvent.click(saveButton());

    const dialog = await screen.findByRole('dialog', { name: 'Auswirkung der Änderung' });
    expect(within(dialog).getByText('Keine Kanal-Inhalte betroffen')).toBeTruthy();
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Schließen']);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(row('Lenovo').textContent).toBe('LenovoaktivGPSR vollständig');
    expect(screen.queryByText(/ fehlt$/)).toBeNull();
  });

  it('UI-031.disabled "Speichern" is enabled by a GPSR change and disabled again when it is taken back', async () => {
    mockApi();
    await openPage();

    enter({ city: 'Stuttgart' });
    expect(saveButton().disabled).toBe(false);
    enter({ city: 'Böblingen' });
    expect(saveButton().disabled).toBe(true);
  });

  it('UI-043 does not open after "Deaktivieren"', async () => {
    mockApi({
      writes: {
        [PATCH_LENOVO]: () =>
          Response.json({
            manufacturer: { ...LENOVO, active: false, version: 4 },
            impact: NO_IMPACT,
          }),
      },
    });
    await openPage();

    fireEvent.click(deactivateButton('Lenovo'));

    expect(await screen.findByText('Gespeichert')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
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

    // "Speichern" leads to UI-043 (UI-031 "Aktionen"); "Schließen" leads back.
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Auswirkung der Änderung' })).getByRole(
        'button',
        { name: 'Schließen' },
      ),
    );
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
    const fujitsu = { id: 4, name: 'Fujitsu', active: true, ...NO_GPSR, version: 1 };
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
