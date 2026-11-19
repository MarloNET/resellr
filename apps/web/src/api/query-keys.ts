/**
 * All query keys of web-ui (CU-048, hotspot): `['<component>', '<resource>', id?]`
 * (Technical Specification 4.2), grouped by server component.
 */
export const queryKeys = {
  ops: {
    all: ['ops'] as const,
    status: () => ['ops', 'status'] as const,
    health: () => ['ops', 'health'] as const,
  },
  settings: {
    all: ['settings'] as const,
    deviceTypes: () => ['settings', 'device-types'] as const,
    attributes: (deviceTypeId: number) => ['settings', 'attributes', deviceTypeId] as const,
    manufacturers: () => ['settings', 'manufacturers'] as const,
    suppliers: () => ['settings', 'suppliers'] as const,
    textBlocks: () => ['settings', 'text-blocks'] as const,
    merchantProfile: () => ['settings', 'merchant-profile'] as const,
    datasheetLayout: () => ['settings', 'datasheet-layout'] as const,
    conditionCodes: () => ['settings', 'condition-codes'] as const,
    conditionCodeResolution: (code: string, supplierId: number | null) =>
      ['settings', 'condition-code-resolution', { code, supplierId }] as const,
    pickLists: () => ['settings', 'pick-lists'] as const,
    pickListValues: (pickListId: number) => ['settings', 'pick-list-values', pickListId] as const,
  },
  channels: {
    all: ['channels'] as const,
    channels: () => ['channels', 'channels'] as const,
  },
  catalog: {
    all: ['catalog'] as const,
    /** Prefix of all lists of `modelTemplates`, to reload them after a write. */
    modelTemplateLists: () => ['catalog', 'model-templates'] as const,
    modelTemplates: (filter: { q?: string; deviceTypeId?: number }) =>
      ['catalog', 'model-templates', filter] as const,
    modelTemplate: (id: number) => ['catalog', 'model-template', id] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    device: (id: number) => ['inventory', 'device', id] as const,
    devicePrefill: (
      modelTemplateId: number,
      code: { conditionCode: string | null; supplierId: number | null },
    ) => ['inventory', 'device-prefill', modelTemplateId, code] as const,
    deviceSearch: (wiNr: string) => ['inventory', 'devices', { wiNr }] as const,
    listing: (id: number, filter: { includeCancelled: boolean }) =>
      ['inventory', 'listing', id, filter] as const,
    listingChoice: (modelTemplateId: number) =>
      ['inventory', 'listing-choice', modelTemplateId] as const,
  },
} as const;

/**
 * Resource of the copy assistant view (UI-019). Its queries are not refetched on window
 * focus (Technical Specification 2.0.8, CU-046); the key itself is added with UI-019.
 */
export const COPY_VIEW_RESOURCE = 'copy-view';
