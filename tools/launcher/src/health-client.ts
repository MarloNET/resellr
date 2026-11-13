import { isReferenceNumber } from '@resellr/runtime-shared/reference-number';

/** Time limit of `GET /api/ops/health` in the flow `open` (Technical Specification 2.18, step 1). */
export const HEALTH_TIMEOUT_MS = 1000;

/** States `GET /api/ops/health` reports (CU-041). */
export type HealthState = 'starting' | 'ready' | 'stopping';

const HEALTH_STATES: readonly unknown[] = ['starting', 'ready', 'stopping'];

/** Answer of `POST /api/ops/shutdown`: status code and JSON body, null if the body is no JSON. */
export interface ShutdownResponse {
  status: number;
  body: unknown;
  /** Reference number of a failed shutdown (`error.referenceNumber`, 2.0.5), else null. */
  refNo: string | null;
}

export interface HealthClient {
  /** Local address of resellr, `http://127.0.0.1:<port>/` (2.0.1). */
  appUrl: string;
  /**
   * State of the running server, or null without a valid answer within the time limit: 1 s in
   * the flow `open`, 5 s for the availability check (CU-265).
   */
  getHealth(timeoutMs?: number): Promise<HealthState | null>;
  /** Asks the running server to stop; null if no server answers (2.17). */
  shutdown(): Promise<ShutdownResponse | null>;
}

export interface HealthClientOptions {
  /** Port of `config.json`, determined by the caller through CU-309 (Nachtrag MAR-296). */
  port: number;
}

/**
 * Client of the ops routes over loopback (CU-266, Technical Specification 2.18). The requests
 * carry neither `Origin` nor `Sec-Fetch-Site`, so `local-guard` treats them as not coming from a
 * browser (2.0.2, G-3).
 */
export function createHealthClient({ port }: HealthClientOptions): HealthClient {
  const appUrl = `http://127.0.0.1:${port}/`;

  const getHealth = async (timeoutMs = HEALTH_TIMEOUT_MS): Promise<HealthState | null> => {
    try {
      const response = await fetch(new URL('/api/ops/health', appUrl), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status !== 200) return null;
      const body: unknown = await response.json();
      const state = (body as { state?: unknown } | null)?.state;
      return HEALTH_STATES.includes(state) ? (state as HealthState) : null;
    } catch {
      // No connection, time limit reached or no JSON: no server is ready.
      return null;
    }
  };

  const shutdown = async (): Promise<ShutdownResponse | null> => {
    let response: Response;
    try {
      response = await fetch(new URL('/api/ops/shutdown', appUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
    } catch {
      return null;
    }
    const text = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      // The status code alone tells the result.
    }
    return { status: response.status, body, refNo: referenceNumberOf(body) };
  };

  return { appUrl, getHealth, shutdown };
}

/** `error.referenceNumber` of an error body (2.0.5), only if it matches the pattern (H-11). */
function referenceNumberOf(body: unknown): string | null {
  const refNo = (body as { error?: { referenceNumber?: unknown } } | null)?.error?.referenceNumber;
  return isReferenceNumber(refNo) ? refNo : null;
}
