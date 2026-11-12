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
      if (!response.ok) {
        let code = 'unknown';
        try {
          code = (JSON.parse(text) as { error?: { code?: string } }).error?.code ?? code;
        } catch {
          // No JSON error body (Technical Specification 2.0.5), e.g. from a proxy or cut off.
        }
        throw new Error(`${method} ${path} failed with ${response.status} ${code}`);
      }
      return (text === '' ? undefined : JSON.parse(text)) as T;
    },
  };
}

/**
 * Device types (S2, UI-027): one more active device type and a deactivated one beside the
 * initial settings, which come with the seed migration CU-071 and not from here (FIND-223).
 */
export const DEMO_DEVICE_TYPES = [
  { name: 'Beamer', active: true },
  { name: 'Drucker', active: false },
] as const;

export const seedDeviceTypes: SeedArea = async (api) => {
  for (const deviceType of DEMO_DEVICE_TYPES) {
    await api.request('POST', '/api/device-types', deviceType);
  }
};

/**
 * Suppliers (S2, UI-032): the delivered list is empty (REQ-006); the demo has two active
 * suppliers and a deactivated one.
 */
export const DEMO_SUPPLIERS = [
  { name: 'Lieferant A', active: true },
  { name: 'Lieferant B', active: true },
  { name: 'Lieferant C', active: false },
] as const;

export const seedSuppliers: SeedArea = async (api) => {
  for (const supplier of DEMO_SUPPLIERS) {
    await api.request('POST', '/api/suppliers', supplier);
  }
};

/**
 * Merchant profile (S2, UI-026): the delivery has no brand (REQ-074); the demo uses a synthetic
 * one. The profile is a single row, saved on top of the version read.
 */
export const DEMO_MERCHANT_PROFILE = {
  brandName: 'Demo-Händler',
  contactText: 'Demo-Händler GmbH\nMusterstraße 1\n12345 Musterstadt\nTel. 0000 000000',
} as const;

export const seedMerchantProfile: SeedArea = async (api) => {
  const { version } = await api.request<{ version: number }>('GET', '/api/merchant-profile');
  await api.request('PUT', '/api/merchant-profile', { version, ...DEMO_MERCHANT_PROFILE });
};

/**
 * The `seed<Bereich>(api)` functions in the order of the build steps. Each build step adds the
 * synthetic, deterministic demo data of its area as its own function at the end of this list
 * (random values only with a fixed seed). S1 has no demo data (FIND-223).
 */
export const SEED_AREAS: readonly SeedArea[] = [
  seedDeviceTypes,
  seedSuppliers,
  seedMerchantProfile,
];

/** Demo data (CU-061) for `npm run demo`: synthetic, no customer data (Baseline 11.3). */
export async function seedDemoData(
  api: DemoApi,
  areas: readonly SeedArea[] = SEED_AREAS,
): Promise<void> {
  for (const seedArea of areas) {
    await seedArea(api);
  }
}
