import { errorResponseSchema, type ErrorResponse } from '@resellr/domain/errors/error-response';

import {
  writeOutcomeStore as defaultWriteOutcomeStore,
  type WriteOutcomeStore,
} from './write-outcome-store.ts';

/**
 * Designed state a failed request leads to (Technical Specification 2.0.5, 2.0.7):
 * - `error`: `.error` – `500 internal_error`, also `400` and any other unexpected answer
 * - `validation`: `.validation` – `422 validation_failed`, `413`, `415`
 * - `rejected`: domain rejection – `422` with a domain code (2.0.6), shown per feature
 * - `confirmation-required`: `422 confirmation_required`, confirmation dialog per feature
 * - `conflict`: `.conflict` (P-05) – `409`
 * - `not-found`: banner M-15 – `404 not_found`
 * - `shutting-down`: `.wird-beendet` (P-07) – `503 shutting_down` on a write
 * - `unreachable`: `.unreachable` (P-06) – read without answer, read time limit exceeded,
 *   `503 shutting_down` on a read
 * - `outcome-unknown`: `.ausgang-unbekannt` (P-08) – write without answer; locks all writes
 */
export type ApiErrorKind =
  | 'error'
  | 'validation'
  | 'rejected'
  | 'confirmation-required'
  | 'conflict'
  | 'not-found'
  | 'shutting-down'
  | 'unreachable'
  | 'outcome-unknown';

export type RequestKind = 'read' | 'write';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status, `null` when no answer arrived. */
  readonly status: number | null;
  /** Error body in the format of 2.0.5, `null` without a valid body. */
  readonly error: ErrorResponse['error'] | null;

  constructor(kind: ApiErrorKind, status: number | null, error: ErrorResponse['error'] | null) {
    super(`API request failed: ${kind}${status === null ? '' : ` (${status})`}`);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.error = error;
  }
}

/** Read time limit (Technical Specification 2.0.8, REQ-060). */
export const READ_TIMEOUT_MS = 5000;

export interface RequestOptions {
  /** Read or write; defaults to `read` for `GET`, `write` otherwise (preview and counts are reads). */
  kind?: RequestKind;
  /** Time limit in ms; default 5 s for reads and none for writes; `null` = none (2.0.8). */
  timeoutMs?: number | null;
  /** Abort signal of the caller, e.g. from TanStack Query; an abort is passed on unchanged. */
  signal?: AbortSignal;
}

export interface ApiClientDeps {
  fetch?: typeof fetch;
  writeOutcomeStore?: WriteOutcomeStore;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** `fetch` wrapper of web-ui (CU-047): time limits and classification of every answer. */
export function createApiClient(deps: ApiClientDeps = {}) {
  const store = deps.writeOutcomeStore ?? defaultWriteOutcomeStore;
  const doFetch = deps.fetch ?? ((input, init) => globalThis.fetch(input, init));

  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const kind = options.kind ?? (method === 'GET' ? 'read' : 'write');
    if (kind === 'write' && store.isLocked()) {
      // "gesperrt bis Neuladen": no further write leaves the page (P-08, K-6).
      throw new ApiError('outcome-unknown', null, null);
    }

    const timeoutMs = options.timeoutMs === undefined ? defaultTimeout(kind) : options.timeoutMs;
    const timeout = new AbortController();
    const timer = timeoutMs === null ? undefined : setTimeout(() => timeout.abort(), timeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout.signal])
      : timeout.signal;

    let response: Response;
    try {
      response = await doFetch(path, {
        method,
        signal,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      if (options.signal?.aborted && !timeout.signal.aborted) throw cause;
      // No HTTP answer: connection lost or time limit exceeded.
      if (kind === 'read') throw new ApiError('unreachable', null, null);
      store.lock();
      throw new ApiError('outcome-unknown', null, null);
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) {
      const text = await response.text();
      return (text === '' ? undefined : JSON.parse(text)) as T;
    }
    throw await toApiError(response, kind);
  }

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
    post: <T>(path: string, body: unknown, options?: RequestOptions) =>
      request<T>('POST', path, body, options),
    put: <T>(path: string, body: unknown, options?: RequestOptions) =>
      request<T>('PUT', path, body, options),
    patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
      request<T>('PATCH', path, body, options),
    delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('DELETE', path, body, options),
  };
}

function defaultTimeout(kind: RequestKind): number | null {
  return kind === 'read' ? READ_TIMEOUT_MS : null;
}

async function toApiError(response: Response, kind: RequestKind): Promise<ApiError> {
  const error = await readErrorBody(response);
  const { status } = response;
  const code = error?.code;

  if (status === 503 && code === 'shutting_down') {
    return new ApiError(kind === 'read' ? 'unreachable' : 'shutting-down', status, error);
  }
  if (error === null) return new ApiError('error', status, null);
  if (status === 409) return new ApiError('conflict', status, error);
  if (status === 413 || status === 415) return new ApiError('validation', status, error);
  if (status === 404) return new ApiError('not-found', status, error);
  if (status === 422) {
    if (code === 'validation_failed') return new ApiError('validation', status, error);
    if (code === 'confirmation_required') {
      return new ApiError('confirmation-required', status, error);
    }
    return new ApiError('rejected', status, error);
  }
  // 500, and 400 as a programming error of the UI, which is handled like 500 (2.0.5).
  return new ApiError('error', status, error);
}

async function readErrorBody(response: Response): Promise<ErrorResponse['error'] | null> {
  try {
    const parsed = errorResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error : null;
  } catch {
    return null;
  }
}

export const apiClient = createApiClient();
