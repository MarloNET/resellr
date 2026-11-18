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
 * Manufacturers (S2, UI-031): the delivered list is empty (REQ-006); the demo has three active
 * manufacturers and a deactivated one. A new manufacturer is always active (REQ-100), so the
 * deactivated one is switched off after creating it.
 */
export const DEMO_MANUFACTURERS = [
  { name: 'Lenovo', active: true },
  { name: 'HP', active: true },
  { name: 'Fujitsu', active: true },
  { name: 'Toshiba', active: false },
] as const;

export const seedManufacturers: SeedArea = async (api) => {
  for (const { name, active } of DEMO_MANUFACTURERS) {
    const created = await api.request<{ id: number; version: number }>(
      'POST',
      '/api/manufacturers',
      { name },
    );
    if (!active) {
      await api.request('PATCH', `/api/manufacturers/${created.id}`, {
        version: created.version,
        active: false,
      });
    }
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
 * Text blocks (S2, UI-030): the texts are not part of the delivery (REQ-006); the demo has
 * synthetic texts of three kinds with placeholders of Requirements chapter 9.7 and a
 * deactivated one. A new text block is always active, so the deactivated one is switched off
 * after creating it.
 */
export const DEMO_TEXT_BLOCKS = [
  {
    name: 'Akku-Hinweis',
    kind: 'battery_notice',
    body: 'Die Akkukapazität beträgt {Akkukapazität}. Bei gebrauchten Akkus ist eine verringerte Laufzeit normal.',
    active: true,
  },
  {
    name: 'Lieferumfang Standard',
    kind: 'delivery_scope',
    body: 'Gerät mit passendem Netzteil',
    active: true,
  },
  {
    name: 'Abholung',
    kind: 'pickup_contact',
    body: 'Abholung nach Absprache bei {Händlermarke}:\n{Händler-Kontakt}',
    active: true,
  },
  {
    name: 'Hinweis Zubehör',
    kind: 'other',
    body: 'Zubehör auf Anfrage.',
    active: false,
  },
] as const;

/** Scope of the demo text blocks: "alle" device types and channels (#163). */
const ALL_SCOPE = { allDeviceTypes: true, deviceTypeIds: [], allChannels: true, channelIds: [] };

export const seedTextBlocks: SeedArea = async (api) => {
  for (const { active, ...textBlock } of DEMO_TEXT_BLOCKS) {
    const created = await api.request<{ textBlock: { id: number; version: number } }>(
      'POST',
      '/api/text-blocks',
      { ...textBlock, ...ALL_SCOPE },
    );
    if (!active) {
      await api.request('PATCH', `/api/text-blocks/${created.textBlock.id}`, {
        version: created.textBlock.version,
        active: false,
      });
    }
  }
};

/**
 * Datasheet layout (S2, UI-039): the demo moves the block "Anschlüsse" before "Technik"
 * (example of AC-REQ-051-01) and keeps the header labels and attribute orders of the initial
 * settings. The layout is a single row, saved on top of the state read.
 */
export const DEMO_DATASHEET_BLOCK_ORDER = [
  'identification',
  'condition',
  'delivery_scope',
  'ports',
  'technical',
  'software',
] as const;

export const seedDatasheetLayout: SeedArea = async (api) => {
  const { version, headerLabels, attributeOrder } = await api.request<{
    version: number;
    headerLabels: string[];
    attributeOrder: Record<string, number[]>;
  }>('GET', '/api/datasheet-layout');
  await api.request('PUT', '/api/datasheet-layout', {
    version,
    headerLabels,
    blockOrder: DEMO_DATASHEET_BLOCK_ORDER,
    attributeOrder,
  });
};

/**
 * Model templates (S3, UI-006, UI-007): a few notebooks and a mini PC of the demo manufacturers
 * on the initial device types, one with MPN "unbekannt" and one with an original EAN from the
 * GS1 range for internal use (prefix 200), so it belongs to no real product. Device types and
 * manufacturers are looked up by name, as the user chooses them in UI-007. `modelValues` holds
 * the values of the attributes of the level model by label, at least those of the required ones
 * (Prozessor, Displaygröße; 2.4, AC-REQ-008-05); a decimal with a point, as stored, so the run of
 * REQ-106 finds every seeded text again (e2e `write-paths`); the device defaults stay empty.
 */
export const DEMO_MODEL_TEMPLATES = [
  {
    deviceType: 'Notebook',
    manufacturer: 'Lenovo',
    modelName: 'ThinkPad E15 Gen 2',
    typeDesignation: '20TD',
    mpn: '20TD002MGE',
    originalEan: '',
    modelValues: { Prozessor: 'Intel Core i5-1135G7', Displaygröße: '15.6' },
  },
  {
    deviceType: 'Notebook',
    manufacturer: 'Lenovo',
    modelName: 'ThinkPad T14 Gen 2',
    typeDesignation: '20W0',
    mpn: '20W000T9GE',
    originalEan: '2000000177007',
    modelValues: { Prozessor: 'Intel Core i5-1145G7', Displaygröße: '14' },
  },
  {
    deviceType: 'Notebook',
    manufacturer: 'HP',
    modelName: 'EliteBook 840 G8',
    typeDesignation: '',
    mpn: '6FY52AV',
    originalEan: '',
    modelValues: { Prozessor: 'Intel Core i5-1135G7', Displaygröße: '14' },
  },
  {
    deviceType: 'PC/Mini-PC',
    manufacturer: 'Fujitsu',
    modelName: 'Esprimo Q957',
    typeDesignation: '',
    mpn: null,
    originalEan: '',
    modelValues: { Prozessor: 'Intel Core i5-7500T' },
  },
] as const;

/** Ids by name from a list answer `{ items: [{ id, name }] }`. */
async function idsByName(api: DemoApi, path: string): Promise<Map<string, number>> {
  const { items } = await api.request<{ items: { id: number; name: string }[] }>('GET', path);
  return new Map(items.map(({ id, name }) => [name, id]));
}

function idOf(ids: Map<string, number>, name: string): number {
  const id = ids.get(name);
  if (id === undefined) throw new Error(`Demo data: ${name} is missing`);
  return id;
}

/** Attribute ids by label of a device type (`GET /api/device-types/{id}/attributes`). */
async function attributeIdsByLabel(api: DemoApi, deviceTypeId: number) {
  const { items } = await api.request<{ items: { id: number; label: string }[] }>(
    'GET',
    `/api/device-types/${deviceTypeId}/attributes`,
  );
  return new Map(items.map(({ id, label }) => [label, id]));
}

export const seedModelTemplates: SeedArea = async (api) => {
  const deviceTypes = await idsByName(api, '/api/device-types?limit=200');
  const manufacturers = await idsByName(api, '/api/manufacturers?limit=200');
  for (const { deviceType, manufacturer, mpn, modelValues, ...template } of DEMO_MODEL_TEMPLATES) {
    const deviceTypeId = idOf(deviceTypes, deviceType);
    const attributes = await attributeIdsByLabel(api, deviceTypeId);
    await api.request('POST', '/api/model-templates', {
      deviceTypeId,
      manufacturerId: idOf(manufacturers, manufacturer),
      ...template,
      mpn,
      mpnUnknown: mpn === null,
      modelValues: Object.fromEntries(
        Object.entries(modelValues).map(([label, value]) => [idOf(attributes, label), value]),
      ),
      defaultDeviceValues: {},
    });
  }
};

/**
 * Devices (S4, UI-003): three notebooks of the demo model templates, captured unassigned, with
 * the required device values of a Notebook (RAM, Speicherkapazität, Tastaturlayout,
 * Betriebssystem, Netzteil, Akku; Requirements 9.3); one with a battery
 * capacity, one without battery and one with a battery capacity "nicht ermittelbar". The WI-Nrs
 * are invented. Model templates, suppliers and pick list values are looked up by name, as the
 * user chooses them in UI-003; `values` holds the values of the level device by attribute label,
 * a pick list value by its label.
 */
export const DEMO_DEVICES = [
  {
    wiNr: '626198',
    modelName: 'ThinkPad T14 Gen 2',
    supplier: 'Lieferant A',
    condition: 'gebraucht',
    visualGrade: 2,
    conditionDescription: 'Leichte Gebrauchsspuren am Deckel',
    values: {
      RAM: 16,
      Speicherkapazität: 512,
      Tastaturlayout: 'Deutsch (QWERTZ)',
      Betriebssystem: 'Windows 11 Pro',
      Netzteil: 'mit Netzteil (original)',
      Akku: 'mit Akku',
      Akkukapazität: { percent: 87 },
    },
  },
  {
    wiNr: 'A637607',
    modelName: 'ThinkPad E15 Gen 2',
    supplier: null,
    condition: 'gebraucht',
    visualGrade: 3,
    conditionDescription: '',
    values: {
      RAM: 8,
      Speicherkapazität: 256,
      Tastaturlayout: 'Deutsch (QWERTZ)',
      Betriebssystem: 'Windows 10 Pro',
      Netzteil: 'ohne Netzteil',
      Akku: 'ohne Akku',
    },
  },
  {
    wiNr: '626199',
    modelName: 'EliteBook 840 G8',
    supplier: 'Lieferant B',
    condition: 'defekt',
    visualGrade: 4,
    conditionDescription: 'Display mit Pixelfehlern',
    values: {
      RAM: 16,
      Speicherkapazität: 512,
      Tastaturlayout: 'Englisch (QWERTY, US)',
      Betriebssystem: 'Windows 11 Home',
      Netzteil: 'mit Netzteil (nicht original)',
      Akku: 'mit Akku (defekt)',
      Akkukapazität: { notDeterminable: true },
    },
  },
] as const;

/** The attributes of a device type with the list of a pick list attribute. */
async function attributesByLabel(api: DemoApi, deviceTypeId: number) {
  const { items } = await api.request<{
    items: { id: number; label: string; pickListId: number | null }[];
  }>('GET', `/api/device-types/${deviceTypeId}/attributes`);
  return new Map(items.map((attribute) => [attribute.label, attribute]));
}

/** Value ids by label of a pick list, active and deactivated. */
async function pickListValueIds(api: DemoApi, pickListId: number) {
  const { items } = await api.request<{ items: { id: number; label: string }[] }>(
    'GET',
    `/api/pick-lists/${pickListId}/values?limit=200`,
  );
  return new Map(items.map(({ id, label }) => [label, id]));
}

export const seedDevices: SeedArea = async (api) => {
  const { items: templates } = await api.request<{
    items: { id: number; modelName: string; deviceType: { id: number } }[];
  }>('GET', '/api/model-templates?limit=200');
  const suppliers = await idsByName(api, '/api/suppliers?limit=200');
  const { items: pickLists } = await api.request<{ items: { id: number; key: string }[] }>(
    'GET',
    '/api/pick-lists?limit=200',
  );
  const conditionList = pickLists.find(({ key }) => key === 'condition');
  if (conditionList === undefined) throw new Error('Demo data: Zustand is missing');
  const conditions = await pickListValueIds(api, conditionList.id);
  for (const { modelName, supplier, condition, values, ...device } of DEMO_DEVICES) {
    const template = templates.find((candidate) => candidate.modelName === modelName);
    if (template === undefined) throw new Error(`Demo data: ${modelName} is missing`);
    const attributes = await attributesByLabel(api, template.deviceType.id);
    const entries = [];
    for (const [label, value] of Object.entries(values)) {
      const attribute = attributes.get(label);
      if (attribute === undefined) throw new Error(`Demo data: ${label} is missing`);
      entries.push([
        attribute.id,
        typeof value === 'string' && attribute.pickListId !== null
          ? idOf(await pickListValueIds(api, attribute.pickListId), value)
          : value,
      ]);
    }
    await api.request('POST', '/api/devices', {
      ...device,
      supplierId: supplier === null ? null : idOf(suppliers, supplier),
      modelTemplateId: template.id,
      conditionValueId: idOf(conditions, condition),
      values: Object.fromEntries(entries),
      confirmedKeys: [],
    });
  }
};

/**
 * Model listings (S4, UI-004 "Neues Modell-Inserat anlegen", #197): one from the demo device
 * "626198" with its WI-Nr as article number; the other demo devices stay unassigned for UI-004.
 */
export const DEMO_LISTINGS = [{ fromWiNr: '626198' }] as const;

export const seedListings: SeedArea = async (api) => {
  for (const { fromWiNr } of DEMO_LISTINGS) {
    const { items } = await api.request<{ items: { id: number; wiNr: string }[] }>(
      'GET',
      `/api/devices?${new URLSearchParams({ wiNr: fromWiNr })}`,
    );
    const hit = items.find(({ wiNr }) => wiNr === fromWiNr);
    if (hit === undefined) throw new Error(`Demo data: device ${fromWiNr} is missing`);
    const { version } = await api.request<{ version: number }>('GET', `/api/devices/${hit.id}`);
    await api.request('POST', '/api/listings', { fromDeviceId: hit.id, deviceVersion: version });
  }
};

/**
 * The `seed<Bereich>(api)` functions in the order of the build steps. Each build step adds the
 * synthetic, deterministic demo data of its area as its own function at the end of this list
 * (random values only with a fixed seed). S1 has no demo data (FIND-223).
 */
export const SEED_AREAS: readonly SeedArea[] = [
  seedDeviceTypes,
  seedSuppliers,
  seedManufacturers,
  seedMerchantProfile,
  seedTextBlocks,
  seedDatasheetLayout,
  seedModelTemplates,
  seedDevices,
  seedListings,
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
