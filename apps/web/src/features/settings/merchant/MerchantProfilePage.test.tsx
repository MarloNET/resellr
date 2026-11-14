import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '../../../app/query-client.ts';
import { routes } from '../../../app/router.tsx';

// Component tests of UI-026 with a mocked `fetch` (Technical Specification 6.1, 6.2).

const PROFILE = { brandName: 'Muster-Händler', contactText: 'Tel. 1', logo: null, version: 3 };
const SAVED = { ...PROFILE, brandName: 'Demo-Händler', version: 4 };
const PUT = 'PUT /api/merchant-profile';
const PUT_LOGO = 'PUT /api/merchant-profile/logo';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const logoOf = (hash: string) => ({ hash, url: `/media/logo/${hash}` });
const WITH_LOGO = { ...PROFILE, logo: logoOf(HASH_A), version: 4 };

const NO_LOGO = 'Kein Logo. Ohne Logo kann kein Datenblatt erzeugt werden.';
const LOGO_RULE = 'Logo: nur PNG oder JPEG bis 5 MB';

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const LOGO_NOTICE =
  'Das Logo erscheint auf dem Datenblatt. Die Druckqualität stellt der Händler sicher.';

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

/**
 * `fetch` of the page: `GET /api/ops/status` for the frame (UI-044), the profile and one handler
 * per write `METHOD path`. Records the writes with their JSON body.
 */
function mockApi({ read, writes = {} }: { read?: Route; writes?: Record<string, Route> } = {}) {
  const sent: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    if (path === '/api/ops/status') return Response.json(OPS_STATUS);
    if (method === 'GET' && path === '/api/merchant-profile') {
      return read ? read(init) : Response.json(PROFILE);
    }
    const key = `${method} ${path}`;
    const body = init?.body;
    // An upload is recorded as its form, every other write as its JSON body.
    sent.push({
      method,
      path,
      body: body instanceof FormData ? body : body ? JSON.parse(String(body)) : undefined,
    });
    const handler = writes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    return handler(init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, sent };
}

function renderPage() {
  const router = createMemoryRouter(routes, { initialEntries: ['/einstellungen/haendlermarke'] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const nameInput = () =>
  screen.getByRole<HTMLInputElement>('textbox', { name: /^Name der Händlermarke/ });
const contactInput = () =>
  screen.getByRole<HTMLTextAreaElement>('textbox', { name: /^Kontaktangaben/ });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^(Speichern|Speichern …)$/ });

const logoRegion = () => screen.getByRole('region', { name: 'Logo' });
const logoButton = (name: 'Logo ersetzen' | 'Logo entfernen') =>
  within(logoRegion()).getByRole<HTMLButtonElement>('button', { name });
const logoPreview = () =>
  within(logoRegion()).queryByRole<HTMLImageElement>('img', { name: 'Logo' });

/** Chooses a file in the dialog that "Logo ersetzen" opens. */
function chooseLogo(name = 'logo.png', type = 'image/png') {
  const input = logoRegion().querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File(['image'], name, { type })] } });
}

/** A response that never arrives, e.g. a write without time limit (P-08). */
const pending = () => new Promise<Response>(() => {});

async function openPage() {
  renderPage();
  await vi.waitFor(() => expect(nameInput().value).toBe('Muster-Händler'));
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
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Händlermarke' })).toBeTruthy();
  for (const button of screen.getAllByRole('button')) {
    expect(button.textContent?.trim() || button.getAttribute('aria-label')).toBeTruthy();
  }
  if (screen.queryByRole('form', { name: 'Händlermarke' }) === null) return;
  expect(nameInput().getAttribute('aria-required')).toBe('true');
  expect(contactInput().getAttribute('aria-required')).toBeNull();
  for (const field of [nameInput(), contactInput()]) {
    if (field.getAttribute('aria-invalid') !== 'true') continue;
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
  }
  expect(screen.getByRole('region', { name: 'Logo' })).toBeTruthy();
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('UI-026 merchant profile (CU-097)', () => {
  it('UI-026.default DER-42-08 shows name, contact details and the logo area with the notice on the datasheet', async () => {
    mockApi();
    await openPage();

    expect(contactInput().value).toBe('Tel. 1');
    const logo = screen.getByRole('region', { name: 'Logo' });
    expect(within(logo).getByText(LOGO_NOTICE)).toBeTruthy();
    // Field order of UI-026: name, logo, contact details.
    expect(nameInput().compareDocumentPosition(logo)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(logo.compareDocumentPosition(contactInput())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(saveButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it('UI-026.loading DER-42-01 shows the placeholder while GET /api/merchant-profile runs', async () => {
    mockApi({ read: pending });
    renderPage();

    expect((await screen.findByRole('status')).textContent).toBe('Lade Einstellungen …');
    expect(screen.queryByRole('textbox')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-026.success DER-42-03 shows "Händlermarke gespeichert" after a save with 200 and closes it after 5 s', async () => {
    const { sent } = mockApi({ writes: { [PUT]: () => Response.json(SAVED) } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('Demo-Händler');

    const banner = await screen.findByText('Händlermarke gespeichert');
    expect(banner.closest('[role="status"]')).toBeTruthy();
    expect(sent).toEqual([
      {
        method: 'PUT',
        path: '/api/merchant-profile',
        body: { version: 3, brandName: 'Demo-Händler', contactText: 'Tel. 1' },
      },
    ]);
    expect(nameInput().value).toBe('Demo-Händler');
    expectAccessiblePage();

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Händlermarke gespeichert')).toBeNull();
  });

  it('UI-026.success DER-42-03 saves changed contact details with the version of the last save', async () => {
    const savedContact = { ...SAVED, contactText: 'Tel. 2', version: 5 };
    const answers = [SAVED, savedContact];
    const { sent } = mockApi({
      writes: { [PUT]: () => Response.json(answers.shift()) },
    });
    await openPage();
    rename('Demo-Händler');
    await screen.findByText('Händlermarke gespeichert');

    fireEvent.change(contactInput(), { target: { value: 'Tel. 2' } });
    fireEvent.click(saveButton());

    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.body).toEqual({ version: 4, brandName: 'Demo-Händler', contactText: 'Tel. 2' });
    await vi.waitFor(() => expect(contactInput().value).toBe('Tel. 2'));
  });

  it('UI-026.success DER-42-11 opens no dialog UI-043 and shows no counts after the save', async () => {
    mockApi({ writes: { [PUT]: () => Response.json(SAVED) } });
    await openPage();

    rename('Demo-Händler');

    await screen.findByText('Händlermarke gespeichert');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/aktualisiert|erneut freizugeben|manuell/i)).toBeNull();
  });

  it('UI-026.error DER-42-04 shows the error banner with the reference number and keeps the inputs', async () => {
    mockApi({
      writes: {
        [PUT]: () =>
          Response.json(errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }), {
            status: 500,
          }),
      },
    });
    await openPage();
    fireEvent.change(contactInput(), { target: { value: 'Tel. 2' } });

    rename('Demo-Händler');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Händlermarke konnte nicht gespeichert werden. Referenz: R-7K2M-9QX4',
    );
    expect(nameInput().value).toBe('Demo-Händler');
    expect(contactInput().value).toBe('Tel. 2');
    expect(saveButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it.each([
    ['empty', ''],
    ['101 characters', 'x'.repeat(101)],
  ])(
    'UI-026.validation DER-42-05 a name that is %s shows "Name: 1 bis 100 Zeichen" at the field without a request',
    async (_case, name) => {
      const { sent } = mockApi();
      await openPage();

      rename(name);

      expect(await screen.findByText('Name: 1 bis 100 Zeichen')).toBeTruthy();
      expect(nameInput().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(nameInput());
      expect(sent).toEqual([]);
      expectAccessiblePage();
    },
  );

  it('UI-026.validation DER-42-05 contact details over 500 characters show "Kontaktangaben: höchstens 500 Zeichen" at the field', async () => {
    const { sent } = mockApi();
    await openPage();

    fireEvent.change(contactInput(), { target: { value: 'x'.repeat(501) } });
    fireEvent.click(saveButton());

    expect(await screen.findByText('Kontaktangaben: höchstens 500 Zeichen')).toBeTruthy();
    expect(contactInput().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(contactInput());
    expect(sent).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-026.validation DER-42-05 leaving a field checks it at once', async () => {
    mockApi();
    await openPage();

    fireEvent.change(nameInput(), { target: { value: '' } });
    fireEvent.blur(nameInput());
    fireEvent.change(contactInput(), { target: { value: 'x'.repeat(501) } });
    fireEvent.blur(contactInput());

    expect(screen.getByText('Name: 1 bis 100 Zeichen')).toBeTruthy();
    expect(screen.getByText('Kontaktangaben: höchstens 500 Zeichen')).toBeTruthy();
  });

  it('UI-026.validation DER-42-05 shows the field errors of a 422 validation_failed at both fields', async () => {
    mockApi({
      writes: {
        [PUT]: () =>
          Response.json(
            errorBody('validation_failed', {
              fields: [
                { path: 'brandName', code: 'too_big', message: 'Name: 1 bis 100 Zeichen' },
                {
                  path: 'contactText',
                  code: 'too_big',
                  message: 'Kontaktangaben: höchstens 500 Zeichen',
                },
              ],
            }),
            { status: 422 },
          ),
      },
    });
    await openPage();

    rename('Demo-Händler');

    expect(await screen.findByText('Name: 1 bis 100 Zeichen')).toBeTruthy();
    expect(screen.getByText('Kontaktangaben: höchstens 500 Zeichen')).toBeTruthy();
    await vi.waitFor(() => expect(document.activeElement).toBe(nameInput()));
    expect(screen.queryByRole('alert')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-026.validation a mouse click on save after a corrected name saves', async () => {
    const { sent } = mockApi({ writes: { [PUT]: () => Response.json(SAVED) } });
    await openPage();
    fireEvent.change(nameInput(), { target: { value: '' } });
    fireEvent.blur(nameInput());
    expect(screen.getByText('Name: 1 bis 100 Zeichen')).toBeTruthy();
    nameInput().focus();
    fireEvent.change(nameInput(), { target: { value: 'Demo-Händler' } });

    pressPointer(saveButton());
    fireEvent.blur(nameInput());
    expect(screen.getByText('Name: 1 bis 100 Zeichen')).toBeTruthy();
    await releasePointerAndClick(saveButton());

    expect(await screen.findByText('Händlermarke gespeichert')).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(screen.queryByText('Name: 1 bis 100 Zeichen')).toBeNull();
  });

  it('UI-026.speichert DER-42-06 shows "Speichern …" and locks all inputs while the write runs, without time limit', async () => {
    mockApi({ writes: { [PUT]: pending } });
    await openPage();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    rename('Demo-Händler');

    expect(
      (await screen.findByRole('button', { name: 'Speichern …' })).hasAttribute('disabled'),
    ).toBe(true);
    expect(nameInput().disabled).toBe(true);
    expect(contactInput().disabled).toBe(true);
    // No time limit for writes (Ä-29): still saving after a minute.
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(screen.getByRole('button', { name: 'Speichern …' })).toBeTruthy();
    expectAccessiblePage();
  });

  it('UI-026.empty DER-42-02 shows "Kein Logo. Ohne Logo kann kein Datenblatt erzeugt werden." without preview and without "Logo entfernen"', async () => {
    mockApi();
    await openPage();

    expect(within(logoRegion()).getByText(NO_LOGO)).toBeTruthy();
    expect(logoPreview()).toBeNull();
    expect(logoButton('Logo ersetzen').disabled).toBe(false);
    expect(within(logoRegion()).queryByRole('button', { name: 'Logo entfernen' })).toBeNull();
    expectAccessiblePage();
  });

  it('UI-026.default shows the stored logo as preview with "Logo ersetzen" and "Logo entfernen"', async () => {
    mockApi({ read: () => Response.json(WITH_LOGO) });
    await openPage();

    expect(logoPreview()?.getAttribute('src')).toBe(`/media/logo/${HASH_A}`);
    expect(within(logoRegion()).queryByText(NO_LOGO)).toBeNull();
    expect(logoButton('Logo entfernen').disabled).toBe(false);
    expectAccessiblePage();
  });

  it('UI-026.success DER-42-09 the preview follows replacing and removing the logo; later writes use the new version', async () => {
    const replaced = { ...WITH_LOGO, logo: logoOf(HASH_B), version: 5 };
    const removed = { ...replaced, logo: null, version: 6 };
    const { sent } = mockApi({
      read: () => Response.json(WITH_LOGO),
      writes: {
        [PUT_LOGO]: () => Response.json(replaced),
        'DELETE /api/merchant-profile/logo?version=5': () => Response.json(removed),
        [PUT]: () => Response.json({ ...removed, brandName: 'Demo-Händler', version: 7 }),
      },
    });
    await openPage();
    fireEvent.change(nameInput(), { target: { value: 'Demo-Händler' } });

    chooseLogo('neu.jpg', 'image/jpeg');

    await vi.waitFor(() =>
      expect(logoPreview()?.getAttribute('src')).toBe(`/media/logo/${HASH_B}`),
    );
    const form = sent[0]?.body as FormData;
    expect(sent[0]?.path).toBe('/api/merchant-profile/logo');
    expect(form.get('version')).toBe('4');
    expect((form.get('file') as File).name).toBe('neu.jpg');
    // A not yet saved name stays in the form.
    expect(nameInput().value).toBe('Demo-Händler');
    expectAccessiblePage();

    fireEvent.click(logoButton('Logo entfernen'));

    expect(await within(logoRegion()).findByText(NO_LOGO)).toBeTruthy();
    expect(logoPreview()).toBeNull();

    fireEvent.click(saveButton());
    await vi.waitFor(() => expect(sent).toHaveLength(3));
    expect(sent[2]?.body).toEqual({ version: 6, brandName: 'Demo-Händler', contactText: 'Tel. 1' });
  });

  it.each([
    ['a GIF file', 415, 'unsupported_media_type'],
    ['a file over 5 MB', 413, 'file_too_large'],
  ])(
    'UI-026.validation %s shows "Logo: nur PNG oder JPEG bis 5 MB" at the logo and keeps the preview',
    async (_case, status, code) => {
      mockApi({
        read: () => Response.json(WITH_LOGO),
        writes: {
          [PUT_LOGO]: () => Response.json(errorBody(code, { message: LOGO_RULE }), { status }),
        },
      });
      await openPage();

      chooseLogo('logo.gif', 'image/gif');

      const message = await within(logoRegion()).findByText(LOGO_RULE);
      expect(logoButton('Logo ersetzen').getAttribute('aria-describedby')).toBe(message.id);
      expect(document.activeElement).toBe(logoButton('Logo ersetzen'));
      expect(logoPreview()?.getAttribute('src')).toBe(`/media/logo/${HASH_A}`);
      expect(screen.queryByRole('alert')).toBeNull();
      expectAccessiblePage();
    },
  );

  it('UI-026.speichert shows "Speichern …" and locks all inputs while the logo is uploaded', async () => {
    mockApi({ read: () => Response.json(WITH_LOGO), writes: { [PUT_LOGO]: pending } });
    await openPage();

    chooseLogo();

    expect(
      (await screen.findByRole('button', { name: 'Speichern …' })).hasAttribute('disabled'),
    ).toBe(true);
    expect(nameInput().disabled).toBe(true);
    expect(contactInput().disabled).toBe(true);
    expect(logoButton('Logo ersetzen').disabled).toBe(true);
    expect(logoButton('Logo entfernen').disabled).toBe(true);
    expectAccessiblePage();
  });

  it('UI-026.conflict DER-42-07 (a) removing the logo with an outdated version shows P-05 and keeps the preview', async () => {
    mockApi({
      read: () => Response.json(WITH_LOGO),
      writes: {
        'DELETE /api/merchant-profile/logo?version=4': () =>
          Response.json(errorBody('version_conflict'), { status: 409 }),
      },
    });
    await openPage();

    fireEvent.click(logoButton('Logo entfernen'));

    expect((await screen.findByRole('alert')).textContent).toContain('Bitte neu laden');
    expect(logoPreview()?.getAttribute('src')).toBe(`/media/logo/${HASH_A}`);
  });

  it('UI-026.conflict DER-42-07 (a) shows P-05 with "Neu laden" and keeps the inputs; "Neu laden" takes the reloaded data', async () => {
    let reads = 0;
    mockApi({
      read: () => {
        reads += 1;
        return Response.json(
          reads === 1 ? PROFILE : { ...PROFILE, brandName: 'Anders', version: 4 },
        );
      },
      writes: { [PUT]: () => Response.json(errorBody('version_conflict'), { status: 409 }) },
    });
    await openPage();

    rename('Demo-Händler');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. Bitte neu laden und erneut prüfen.',
    );
    expect(nameInput().value).toBe('Demo-Händler');
    expect(screen.queryByText('Händlermarke gespeichert')).toBeNull();
    expectAccessiblePage();

    fireEvent.click(within(banner).getByRole('button', { name: 'Neu laden' }));
    await vi.waitFor(() => expect(nameInput().value).toBe('Anders'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-026.unreachable DER-42-07 (b) shows P-06 with "Erneut versuchen" when the profile gets no answer, without replacing the page', async () => {
    mockApi({
      read: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Händlermarke' })).toBeTruthy();
    expectAccessiblePage();
  });

  it('UI-026.unreachable DER-42-07 (b) shows P-06 when the profile takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({
      read: (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    renderPage();
    await screen.findByText('Lade Einstellungen …');

    await act(() => vi.advanceTimersByTimeAsync(5000));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
  });

  it('UI-026.wird-beendet DER-42-07 (c) shows P-07 without reference number and keeps the inputs', async () => {
    mockApi({
      writes: { [PUT]: () => Response.json(errorBody('shutting_down'), { status: 503 }) },
    });
    await openPage();

    rename('Demo-Händler');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-/);
    expect(nameInput().value).toBe('Demo-Händler');
    expectAccessiblePage();
  });

  // Last test of the file: the lock "gesperrt bis Neuladen" (CU-049) lasts until the module is
  // loaded again, and Vitest loads it again per test file only.
  it('UI-026.ausgang-unbekannt DER-42-06 a save without HTTP answer shows "Ausgang unbekannt, bitte neu laden." without button and locks every further write', async () => {
    const { sent } = mockApi({
      writes: {
        [PUT]: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    await openPage();

    rename('Demo-Händler');

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(nameInput().value).toBe('Demo-Händler');
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(sent).toHaveLength(1);
    expectAccessiblePage();
  });
});
