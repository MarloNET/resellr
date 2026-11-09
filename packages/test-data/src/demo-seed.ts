/**
 * Access to the HTTP API of the running server the demo data is written through, so services,
 * events and audit entries run as in operation; `packages/test-data` may not import
 * `apps/server` (Technical Specification 4.1, Nachtrag MAR-305).
 */
export interface DemoApi {
  /** `http://127.0.0.1:<port>` */
  baseUrl: string;
  /** Sends a JSON request and returns the JSON answer; throws for every answer except 2xx. */
  request<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;
}

/** Writes the demo data of one area through the API (hotspot CU-061, 4.5). */
export type SeedArea = (api: DemoApi) => Promise<void>;

const READ_METHODS = new Set(['GET', 'HEAD']);

/**
 * API access for the demo data. The address uses `127.0.0.1`, never `localhost`, so `Host`
 * passes G-1 of `local-guard`; changing requests carry the own origin and JSON like the user
 * interface (G-2, G-4).
 */
export function createDemoApi(baseUrl: string): DemoApi {
  const { origin, hostname } = new URL(baseUrl);
  if (hostname !== '127.0.0.1') throw new Error(`The demo API needs 127.0.0.1, got ${baseUrl}`);

  return {
    baseUrl: origin,
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      const writes = !READ_METHODS.has(method);
      const response = await fetch(`${origin}${path}`, {
        method,
        headers: writes ? { origin, 'content-type': 'application/json' } : {},
        body: writes ? JSON.stringify(body ?? {}) : undefined,
      });
      const text = await response.text();
      const json: unknown = text === '' ? undefined : JSON.parse(text);
      if (!response.ok) {
        const code = (json as { error?: { code?: string } } | undefined)?.error?.code ?? 'unknown';
        throw new Error(`${method} ${path} failed with ${response.status} ${code}`);
      }
      return json as T;
    },
  };
}

/**
 * The `seed<Bereich>(api)` functions in the order of the build steps. Each build step adds the
 * synthetic, deterministic demo data of its area as its own function at the end of this list
 * (random values only with a fixed seed). S1 has no demo data, and the initial settings follow
 * with S2 through CU-071 (FIND-223).
 */
export const SEED_AREAS: readonly SeedArea[] = [];

/** Demo data (CU-061) for `npm run demo`: synthetic, no customer data (Baseline 11.3). */
export async function seedDemoData(
  api: DemoApi,
  areas: readonly SeedArea[] = SEED_AREAS,
): Promise<void> {
  for (const seedArea of areas) {
    await seedArea(api);
  }
}
