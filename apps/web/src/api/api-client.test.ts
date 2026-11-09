import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, createApiClient, type ApiErrorKind } from './api-client.ts';
import { createWriteOutcomeStore, type WriteOutcomeStore } from './write-outcome-store.ts';

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

const REFERENCE_NUMBER = 'R-7K2M-9QX4';

function errorBody(code: string, overrides: Record<string, unknown> = {}) {
  return {
    error: {
      code,
      message: code === 'validation_failed' ? '' : 'Text',
      fields: [],
      details: {},
      referenceNumber: null,
      ...overrides,
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A fetch that never answers but rejects like the browser when its signal aborts. */
function pendingFetch(): typeof fetch {
  return (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted.', 'AbortError')),
      );
    });
}

async function rejectionOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected the request to fail');
}

describe('api-client', () => {
  let fetchMock: FetchMock;
  let store: WriteOutcomeStore;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    store = createWriteOutcomeStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function client() {
    return createApiClient({ fetch: fetchMock, writeOutcomeStore: store });
  }

  it('returns the parsed body of a 2xx response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { dataDirPath: 'C:\\resellr' }));

    await expect(client().get('/api/ops/status')).resolves.toEqual({ dataDirPath: 'C:\\resellr' });
  });

  it('sends writes as JSON from the same origin', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 1 }));

    await client().post('/api/things', { name: 'a' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/things');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"name":"a"}');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
  });

  describe('E3 classifies responses into the states of Technical Specification 2.0.7', () => {
    const cases: Array<[string, number, unknown, 'read' | 'write', ApiErrorKind]> = [
      [
        '500 internal_error → .error',
        500,
        errorBody('internal_error', { referenceNumber: REFERENCE_NUMBER }),
        'write',
        'error',
      ],
      ['500 on a read → .error', 500, errorBody('internal_error'), 'read', 'error'],
      ['400 bad_request → handled as 500', 400, errorBody('bad_request'), 'write', 'error'],
      [
        '422 validation_failed → .validation',
        422,
        errorBody('validation_failed'),
        'write',
        'validation',
      ],
      ['413 file_too_large → .validation', 413, errorBody('file_too_large'), 'write', 'validation'],
      [
        '415 unsupported_media_type → .validation',
        415,
        errorBody('unsupported_media_type'),
        'write',
        'validation',
      ],
      ['409 version_conflict → .conflict', 409, errorBody('version_conflict'), 'write', 'conflict'],
      ['409 stale_content → .conflict', 409, errorBody('stale_content'), 'write', 'conflict'],
      ['409 stale_stock → .conflict', 409, errorBody('stale_stock'), 'write', 'conflict'],
      [
        '503 shutting_down on a write → .wird-beendet',
        503,
        errorBody('shutting_down'),
        'write',
        'shutting-down',
      ],
      [
        '503 shutting_down on a read → .unreachable',
        503,
        errorBody('shutting_down'),
        'read',
        'unreachable',
      ],
      ['404 not_found → not found banner', 404, errorBody('not_found'), 'read', 'not-found'],
      [
        '422 confirmation_required → confirmation',
        422,
        errorBody('confirmation_required'),
        'write',
        'confirmation-required',
      ],
      ['500 without an error body → .error', 500, 'not json', 'read', 'error'],
    ];

    it.each(cases)('%s', async (_title, status, body, kind, expected) => {
      fetchMock.mockResolvedValue(jsonResponse(status, body));
      const api = client();

      const error = await rejectionOf(kind === 'read' ? api.get('/api/x') : api.post('/api/x', {}));

      expect(error.kind).toBe(expected);
      expect(error.status).toBe(status);
    });

    it('keeps the error body with field errors and reference number', async () => {
      const fields = [{ path: 'wiNr', code: 'wi_nr_format', message: 'WI-Nr …' }];
      fetchMock.mockResolvedValueOnce(
        jsonResponse(422, errorBody('validation_failed', { fields })),
      );
      fetchMock.mockResolvedValueOnce(
        jsonResponse(500, errorBody('internal_error', { referenceNumber: REFERENCE_NUMBER })),
      );
      const api = client();

      expect((await rejectionOf(api.post('/api/x', {}))).error?.fields).toEqual(fields);
      expect((await rejectionOf(api.post('/api/x', {}))).error?.referenceNumber).toBe(
        REFERENCE_NUMBER,
      );
    });

    it('a response that does not match the error format is handled as .error', async () => {
      fetchMock.mockResolvedValue(jsonResponse(422, errorBody('code_not_in_catalog')));

      const error = await rejectionOf(client().post('/api/x', {}));

      expect(error.kind).toBe('error');
      expect(error.error).toBeNull();
    });

    it('connection loss on a write → .ausgang-unbekannt', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      const error = await rejectionOf(client().post('/api/x', {}));

      expect(error.kind).toBe('outcome-unknown');
      expect(error.status).toBeNull();
    });

    it('connection loss on a read → .unreachable', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      expect((await rejectionOf(client().get('/api/x'))).kind).toBe('unreachable');
    });

    it('a 2xx answer with a body that is not JSON → .error', async () => {
      fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));

      const error = await rejectionOf(client().get('/api/x'));

      expect(error.kind).toBe('error');
      expect(error.status).toBe(200);
    });

    it('connection loss while reading the body of a write → .ausgang-unbekannt', async () => {
      fetchMock.mockResolvedValue(
        new Response(
          new ReadableStream({
            pull: (controller) => controller.error(new TypeError('network error')),
          }),
          { status: 201 },
        ),
      );

      const error = await rejectionOf(client().post('/api/x', {}));

      expect(error.kind).toBe('outcome-unknown');
      expect(store.isLocked()).toBe(true);
    });

    it('a POST marked as read (preview, count) is classified like a read', async () => {
      fetchMock.mockResolvedValue(jsonResponse(503, errorBody('shutting_down')));

      const error = await rejectionOf(client().post('/api/x/preview', {}, { kind: 'read' }));

      expect(error.kind).toBe('unreachable');
    });
  });

  describe('E4 time limits (Technical Specification 2.0.8)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      fetchMock.mockImplementation(pendingFetch());
    });

    it('a read ends with .unreachable after 5 s', async () => {
      const result = rejectionOf(client().get('/api/x'));

      await vi.advanceTimersByTimeAsync(4999);
      expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect((await result).kind).toBe('unreachable');
    });

    it('the time limit also covers reading the body of a read', async () => {
      fetchMock.mockImplementation((_input, init) =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start: (controller) =>
                init?.signal?.addEventListener('abort', () =>
                  controller.error(new DOMException('The operation was aborted.', 'AbortError')),
                ),
            }),
            { status: 200 },
          ),
        ),
      );
      const result = rejectionOf(client().get('/api/x'));

      await vi.advanceTimersByTimeAsync(5000);

      expect((await result).kind).toBe('unreachable');
    });

    it('a write has no time limit', async () => {
      let settled = false;
      void client()
        .post('/api/x', {})
        .catch(() => undefined)
        .finally(() => (settled = true));

      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

      expect(settled).toBe(false);
      expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(false);
    });

    it('a read without time limit (datasheet) waits for the answer', async () => {
      let settled = false;
      void client()
        .get('/api/x', { timeoutMs: null })
        .catch(() => undefined)
        .finally(() => (settled = true));

      await vi.advanceTimersByTimeAsync(60 * 1000);

      expect(settled).toBe(false);
    });

    it('POST /api/ops/shutdown ends after 30 s with an unknown outcome', async () => {
      const result = rejectionOf(client().post('/api/ops/shutdown', {}, { timeoutMs: 30_000 }));

      await vi.advanceTimersByTimeAsync(29_999);
      expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect((await result).kind).toBe('outcome-unknown');
    });

    it('an abort by the caller is passed on and not classified', async () => {
      const controller = new AbortController();
      const result = client().get('/api/x', { signal: controller.signal });

      controller.abort();

      await expect(result).rejects.toMatchObject({ name: 'AbortError' });
      expect(store.isLocked()).toBe(false);
    });
  });

  describe('E5 lock after an unknown write outcome', () => {
    it('a write without response locks all further writes of the page', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const api = client();

      await rejectionOf(api.post('/api/a', {}));

      expect(store.isLocked()).toBe(true);
      const blocked = await rejectionOf(api.patch('/api/b', {}));
      expect(blocked.kind).toBe('outcome-unknown');
      // No automatic retry and no further write request leaves the page.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reads keep working while writes are locked', async () => {
      store.lock();
      fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

      await expect(client().get('/api/x')).resolves.toEqual({ ok: true });
    });

    it('a rejected write with an HTTP response does not lock', async () => {
      fetchMock.mockResolvedValue(jsonResponse(503, errorBody('shutting_down')));

      await rejectionOf(client().post('/api/x', {}));

      expect(store.isLocked()).toBe(false);
    });

    it('a failed read does not lock writes', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await rejectionOf(client().get('/api/x'));

      expect(store.isLocked()).toBe(false);
    });
  });
});
