import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Component tests of UI-015 (CU-214, CU-215) with a mocked `fetch` for the reads and a fake
// `XMLHttpRequest` for the uploads (Technical Specification 2.11, 6.1, 6.2).

const OPS_STATUS = {
  dataDirPath: 'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten',
  appVersion: '0.1.0',
};

const photo = (id: number, position: number, originalName: string, byteSize: number) => ({
  id,
  hash: String(id).padStart(64, '0'),
  position,
  originalName,
  byteSize,
  url: `/media/photos/${String(id).padStart(64, '0')}`,
  thumbUrl: `/media/thumbs/${String(id).padStart(64, '0')}`,
});

const TWO_PHOTOS = [
  photo(1, 1, 'Vorderseite.jpg', 2_516_582),
  photo(2, 2, 'Tastatur.png', 870_400),
];

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: '', fields: [], details: {}, referenceNumber: null, ...extra },
});

type PhotosHandler = (init: RequestInit | undefined) => Promise<Response> | Response;

/** `fetch` of the page: the frame's status, the health check of P-06 and the photos. */
function mockApi(photos: PhotosHandler) {
  const reads: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const { pathname } = new URL(String(input), 'http://127.0.0.1');
      if (pathname === '/api/ops/status') return Response.json(OPS_STATUS);
      if (pathname === '/api/ops/health') return Response.json({ state: 'ready' });
      if (pathname === '/api/listings/9/photos') {
        reads.push(pathname);
        return photos(init);
      }
      throw new Error(`unexpected request ${init?.method ?? 'GET'} ${pathname}`);
    }),
  );
  return { reads };
}

const listOf = (items: unknown[]) => () => Response.json({ items, total: items.length });

/** The photos the server has stored; an accepted upload adds its photo (for the reload). */
function storedPhotos(initial: ReturnType<typeof photo>[] = []) {
  const items = [...initial];
  return {
    read: () => Response.json({ items, total: items.length }),
    /** Answers `201` for the upload and stores the photo. */
    accept(upload: FakeUpload, id: number) {
      const stored = photo(id, items.length + 1, upload.file!.name, 1000);
      items.push(stored);
      upload.respond(201, { photo: stored, listingVersion: 1 + items.length, count: items.length });
    },
  };
}

/** Fake `XMLHttpRequest`: records each upload; the test reports progress and the answer. */
class FakeUpload {
  static sent: FakeUpload[] = [];
  method = '';
  url = '';
  file: File | null = null;
  status = 0;
  responseText = '';
  upload: { onprogress: ((event: Partial<ProgressEvent>) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: FormData) {
    this.file = body.get('file') as File;
    FakeUpload.sent.push(this);
  }

  progress(percent: number) {
    act(() => this.upload.onprogress?.({ lengthComputable: true, loaded: percent, total: 100 }));
  }

  respond(status: number, body: unknown) {
    act(() => {
      this.status = status;
      this.responseText = JSON.stringify(body);
      this.onload?.();
    });
  }

  dropConnection() {
    act(() => this.onerror?.());
  }
}

/**
 * Renders the app at `path` with fresh modules: the lock "gesperrt bis Neuladen" (CU-049) of
 * one test lasts until the page is loaded again and must not reach the next one.
 */
async function renderPage(path = '/inserate/9/fotos') {
  FakeUpload.sent = [];
  vi.stubGlobal('XMLHttpRequest', FakeUpload);
  vi.resetModules();
  const { QueryClientProvider } = await import('@tanstack/react-query');
  const { createMemoryRouter, RouterProvider } = await import('react-router');
  const { createQueryClient } = await import('../../app/query-client.ts');
  const { routes } = await import('../../app/router.tsx');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

const file = (name: string, type = 'image/jpeg') => new File(['image'], name, { type });

/** Drops files onto the area of the photos ("hierher ziehen"). */
function dropFiles(files: File[]) {
  fireEvent.drop(screen.getByRole('region', { name: 'Fotos verwalten' }), {
    dataTransfer: { files },
  });
}

/** The photos of the grid as number, file name and size. */
function gridEntries() {
  return within(screen.getByRole('listbox', { name: 'Fotos' }))
    .getAllByRole('option')
    .map((option) => option.textContent);
}

const addButton = () =>
  screen.getByRole('button', { name: 'Fotos hinzufügen' }) as HTMLButtonElement;

/** Accessibility assertion of a state: heading, named controls and named images. */
function expectAccessiblePage() {
  expect(screen.getByRole('heading', { level: 1, name: 'Fotos verwalten' })).toBeTruthy();
  for (const control of [...screen.queryAllByRole('button'), ...screen.getAllByRole('link')]) {
    expect(control.textContent?.trim() || control.getAttribute('aria-label')).toBeTruthy();
  }
  for (const image of screen.queryAllByRole('img')) {
    expect(image.getAttribute('alt')).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UI-015 Fotos verwalten (CU-214, CU-215)', () => {
  it('UI-015.default DER-80-01 shows the numbered thumbnails in their order with file name and size and the counter "n von 20 Fotos"', async () => {
    mockApi(listOf(TWO_PHOTOS));

    await renderPage();

    expect(await screen.findByText('2 von 20 Fotos')).toBeTruthy();
    expect(gridEntries()).toEqual(['01Vorderseite.jpg2,4 MB', '02Tastatur.png850 KB']);
    const images = within(screen.getByRole('listbox', { name: 'Fotos' })).getAllByRole('img');
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      TWO_PHOTOS[0]!.thumbUrl,
      TWO_PHOTOS[1]!.thumbUrl,
    ]);
    expect(addButton().disabled).toBe(false);
    expectAccessiblePage();
  });

  it('UI-015.empty DER-80-01 shows "Noch keine Fotos. Fotos hinzufügen oder hierher ziehen." and "0 von 20 Fotos"', async () => {
    mockApi(listOf([]));

    await renderPage();

    expect(
      await screen.findByText('Noch keine Fotos. Fotos hinzufügen oder hierher ziehen.'),
    ).toBeTruthy();
    expect(screen.getByText('0 von 20 Fotos')).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
    expectAccessiblePage();
  });

  it('UI-015.loading DER-80-02 uploads five files one after the other with "Lade <Datei> hoch (n %)", rejects the second at its file and uploads the others', async () => {
    const server = storedPhotos();
    mockApi(server.read);
    await renderPage();
    await screen.findByText('0 von 20 Fotos');
    const names = ['1.jpg', '2.gif', '3.jpg', '4.jpg', '5.jpg'];

    dropFiles(names.map((name) => file(name)));

    // One request at a time: the second file waits until the first has its answer.
    expect(FakeUpload.sent.map((upload) => upload.file?.name)).toEqual(['1.jpg']);
    expect(FakeUpload.sent[0]).toMatchObject({ method: 'POST', url: '/api/listings/9/photos' });
    FakeUpload.sent[0]!.progress(40);
    expect(screen.getByText('Lade 1.jpg hoch (40 %)')).toBeTruthy();
    expect(screen.getByText('Lade 2.gif hoch (0 %)')).toBeTruthy();
    server.accept(FakeUpload.sent[0]!, 11);

    expect(await screen.findByText('1 von 20 Fotos')).toBeTruthy();
    expect(FakeUpload.sent.map((upload) => upload.file?.name)).toEqual(['1.jpg', '2.gif']);
    FakeUpload.sent[1]!.respond(
      415,
      errorBody('unsupported_media_type', { message: '2.gif: nur JPEG oder PNG bis 20 MB' }),
    );

    for (const [index, name] of [
      [2, '3.jpg'],
      [3, '4.jpg'],
      [4, '5.jpg'],
    ] as const) {
      await vi.waitFor(() => expect(FakeUpload.sent).toHaveLength(index + 1));
      expect(FakeUpload.sent[index]!.file?.name).toBe(name);
      server.accept(FakeUpload.sent[index]!, 10 + index);
    }

    expect(await screen.findByText('4 von 20 Fotos')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('2.gif: nur JPEG oder PNG bis 20 MB');
    expect(gridEntries().map((entry) => entry?.slice(0, 7))).toEqual([
      '011.jpg',
      '023.jpg',
      '034.jpg',
      '045.jpg',
    ]);
    expect(screen.queryByText(/^Lade /)).toBeNull();
    expectAccessiblePage();
  });

  it('UI-015.loading DER-80-02 queues files dropped while an upload runs behind it', async () => {
    const server = storedPhotos();
    mockApi(server.read);
    await renderPage();
    await screen.findByText('0 von 20 Fotos');

    dropFiles([file('a.jpg')]);
    dropFiles([file('b.jpg')]);

    expect(FakeUpload.sent.map((upload) => upload.file?.name)).toEqual(['a.jpg']);
    expect(screen.getByText('Lade b.jpg hoch (0 %)')).toBeTruthy();
    server.accept(FakeUpload.sent[0]!, 1);
    await vi.waitFor(() => expect(FakeUpload.sent).toHaveLength(2));
    expect(FakeUpload.sent[1]!.file?.name).toBe('b.jpg');
    server.accept(FakeUpload.sent[1]!, 2);
    expect(await screen.findByText('2 von 20 Fotos')).toBeTruthy();
  });

  it.each([
    [
      'AC-REQ-042-02 a GIF file',
      'Foto.gif',
      415,
      'unsupported_media_type',
      'Foto.gif: nur JPEG oder PNG bis 20 MB',
    ],
    [
      'AC-REQ-042-02 a file over 20 MB',
      'Gross.jpg',
      413,
      'file_too_large',
      'Gross.jpg: nur JPEG oder PNG bis 20 MB',
    ],
    [
      'AC-REQ-042-03 a 21st photo',
      'Mehr.jpg',
      422,
      'photo_limit_reached',
      'Höchstens 20 Fotos je Modell-Inserat',
    ],
  ])(
    'UI-015.validation %s shows the reason at the file and adds nothing',
    async (_, name, status, code, message) => {
      mockApi(listOf(TWO_PHOTOS));
      await renderPage();
      await screen.findByText('2 von 20 Fotos');

      dropFiles([file(name)]);
      FakeUpload.sent[0]!.respond(status, errorBody(code, { message }));

      expect((await screen.findByRole('alert')).textContent).toBe(message);
      expect(screen.getByText('2 von 20 Fotos')).toBeTruthy();
      expect(gridEntries()).toHaveLength(2);
      expectAccessiblePage();
    },
  );

  it('UI-015.validation chooses the files with "Fotos hinzufügen", JPEG and PNG only, several at once', async () => {
    mockApi(listOf([]));
    await renderPage();
    await screen.findByText('0 von 20 Fotos');
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toBe('image/jpeg,image/png');
    expect(input.multiple).toBe(true);
    const click = vi.spyOn(input, 'click');

    fireEvent.click(addButton());
    Object.defineProperty(input, 'files', { value: [file('a.jpg'), file('b.png', 'image/png')] });
    fireEvent.change(input);

    expect(click).toHaveBeenCalled();
    expect(FakeUpload.sent.map((upload) => upload.file?.name)).toEqual(['a.jpg']);
  });

  it('UI-015.disabled DER-80-03 deactivates "Fotos hinzufügen" with 20 photos, with the reason as tooltip', async () => {
    mockApi(
      listOf(
        Array.from({ length: 20 }, (_, index) => photo(index + 1, index + 1, `${index}.jpg`, 1)),
      ),
    );

    await renderPage();

    expect(await screen.findByText('20 von 20 Fotos')).toBeTruthy();
    expect(addButton().disabled).toBe(true);
    expect(addButton().title).toBe('Höchstens 20 Fotos je Modell-Inserat');
    dropFiles([file('mehr.jpg')]);
    expect(FakeUpload.sent).toEqual([]);
    expectAccessiblePage();
  });

  it('UI-015.error DER-80-04 shows "<Datei> konnte nicht hochgeladen werden. Referenz: <Nr>" at the file on 500, and the next file is still uploaded', async () => {
    mockApi(listOf([]));
    await renderPage();
    await screen.findByText('0 von 20 Fotos');

    dropFiles([file('Rueckseite.jpg'), file('Seite.jpg')]);
    FakeUpload.sent[0]!.respond(
      500,
      errorBody('internal_error', { referenceNumber: 'R-7K2M-9QX4' }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Rueckseite.jpg konnte nicht hochgeladen werden. Referenz: R-7K2M-9QX4',
    );
    await vi.waitFor(() => expect(FakeUpload.sent).toHaveLength(2));
    expectAccessiblePage();
  });

  it('UI-015.success DER-80-04 shows no banner after an upload, the grid is the feedback; "Fertig" saves nothing and leads to UI-014', async () => {
    const server = storedPhotos();
    const { reads } = mockApi(server.read);
    const { router } = await renderPage();
    await screen.findByText('0 von 20 Fotos');

    dropFiles([file('Neu.jpg')]);
    server.accept(FakeUpload.sent[0]!, 5);

    expect(await screen.findByText('1 von 20 Fotos')).toBeTruthy();
    expect(gridEntries()).toEqual(['01Neu.jpg1 KB']);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/gespeichert/)).toBeNull();
    const uploads = FakeUpload.sent.length;
    const readsBefore = reads.length;

    fireEvent.click(screen.getByRole('link', { name: 'Fertig' }));

    expect(router.state.location.pathname).toBe('/inserate/9');
    expect(FakeUpload.sent).toHaveLength(uploads);
    // Only reads may follow (UI-014 loads its data); "Fertig" writes nothing.
    expect(reads.length).toBeGreaterThanOrEqual(readsBefore);
  });

  it('UI-015.ausgang-unbekannt DER-80-05 locks the photo management until reload after an upload without HTTP answer, without "Erneut versuchen"', async () => {
    mockApi(listOf(TWO_PHOTOS));
    await renderPage();
    await screen.findByText('2 von 20 Fotos');

    dropFiles([file('a.jpg'), file('b.jpg')]);
    FakeUpload.sent[0]!.dropConnection();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Ausgang unbekannt, bitte neu laden.');
    expect(within(banner).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
    expect(addButton().disabled).toBe(true);
    expect(FakeUpload.sent).toHaveLength(1);
    expect(screen.queryByText(/^Lade /)).toBeNull();
    dropFiles([file('c.jpg')]);
    expect(FakeUpload.sent).toHaveLength(1);
    // The grid stays as loaded; only a reload shows the actual state.
    expect(gridEntries()).toHaveLength(2);
    expectAccessiblePage();
  });

  it('UI-015.unreachable DER-80-12 shows P-06 with "Erneut versuchen" and without reference number when GET …/photos gets no answer; after the retry the grid loads', async () => {
    let reachable = false;
    mockApi(() => {
      if (!reachable) throw new TypeError('Failed to fetch');
      return listOf(TWO_PHOTOS)();
    });
    await renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(banner.textContent).not.toContain('Referenz');
    expect(screen.getByRole('heading', { level: 1, name: 'Fotos verwalten' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeTruthy();
    expectAccessiblePage();

    reachable = true;
    fireEvent.click(within(banner).getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByText('2 von 20 Fotos')).toBeTruthy();
    expect(gridEntries()).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-015.unreachable DER-80-12 shows P-06 when GET …/photos takes longer than 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi(
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    await renderPage();

    await vi.advanceTimersByTimeAsync(5000);

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Fotos verwalten' })).toBeTruthy();
  });

  it('UI-015.unreachable DER-80-12 shows P-06 when GET …/photos is refused with 503 shutting_down', async () => {
    mockApi(() => Response.json(errorBody('shutting_down'), { status: 503 }));

    await renderPage();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('resellr ist nicht erreichbar.');
    expect(banner.textContent).not.toContain('Referenz');
    expect(within(banner).getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
  });

  it('UI-015.loading shows placeholders while the photos load', async () => {
    mockApi(() => new Promise<Response>(() => {}));

    await renderPage();

    const region = await screen.findByRole('region', { name: 'Fotos verwalten' });
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(addButton().disabled).toBe(true);
    expectAccessiblePage();
  });

  it('DER-80-10 selects a photo with the arrow keys; Alt+arrow does not move it here', async () => {
    mockApi(listOf([...TWO_PHOTOS, photo(3, 3, 'Unterseite.jpg', 1)]));
    await renderPage();
    await screen.findByText('3 von 20 Fotos');
    const options = within(screen.getByRole('listbox', { name: 'Fotos' })).getAllByRole('option');
    const selected = () =>
      options.findIndex((option) => option.getAttribute('aria-selected') === 'true');
    expect(selected()).toBe(0);
    expect(options.map((option) => option.tabIndex)).toEqual([0, -1, -1]);

    fireEvent.keyDown(options[0]!, { key: 'ArrowRight' });
    expect(selected()).toBe(1);
    expect(document.activeElement).toBe(options[1]);
    fireEvent.keyDown(options[1]!, { key: 'ArrowDown' });
    expect(selected()).toBe(2);
    fireEvent.keyDown(options[2]!, { key: 'ArrowRight' });
    expect(selected()).toBe(2);
    fireEvent.keyDown(options[2]!, { key: 'ArrowLeft' });
    fireEvent.keyDown(options[1]!, { key: 'ArrowUp' });
    expect(selected()).toBe(0);
    fireEvent.keyDown(options[0]!, { key: 'ArrowRight', altKey: true });
    expect(selected()).toBe(0);
    expect(gridEntries()[0]).toContain('Vorderseite.jpg');
  });

  it('M-15 shows "Dieser Eintrag ist nicht mehr vorhanden." when the model listing does not exist', async () => {
    mockApi(() => Response.json(errorBody('not_found'), { status: 404 }));

    await renderPage();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Dieser Eintrag ist nicht mehr vorhanden.',
    );
    expect(screen.queryByRole('region', { name: 'Fotos verwalten' })).toBeNull();
  });
});
