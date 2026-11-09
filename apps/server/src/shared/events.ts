// Event types of the server (Technical Specification 2.0.4, 2.8.3; hotspot CU-034, 4.5).
// Only the five change events and four check events of 2.8.3; a new event is a change of
// the specification. Handlers are registered by the components (CU-169, CU-290).

type Id = number;

/** Scope of a settings change (2.1 to 2.3, table "Ereignisse und Geltungsbereich"). */
export type SettingsScope =
  | { kind: 'device_types'; deviceTypeIds: Id[] }
  | { kind: 'channel'; channelId: Id; deviceTypeId?: Id }
  | { kind: 'manufacturer'; manufacturerId: Id }
  | { kind: 'text_block'; deviceTypeIds: Id[]; channelIds: Id[] }
  | { kind: 'all' };

// Change events (`emit`): collected and handled before the commit; handlers return a report.

export interface ListingCreated {
  type: 'ListingCreated';
  listingId: Id;
}

/** Inputs of channel contents changed: values, prices, photos, model data, manual adjustment. */
export interface ContentInputsChanged {
  type: 'ContentInputsChanged';
  listingIds?: Id[];
  modelTemplateId?: Id;
  /** Restricts the event to these channels, e.g. for a price change. */
  channelIds?: Id[];
  channelContentId?: Id;
}

export interface SettingsChanged {
  type: 'SettingsChanged';
  scope: SettingsScope;
}

export interface ChannelActivated {
  type: 'ChannelActivated';
  channelId: Id;
}

export interface StockChanged {
  type: 'StockChanged';
  listingId: Id;
}

// Check events (`check`): handled at once; a handler rejects with a domain rule.

export interface VariantSetChanging {
  type: 'VariantSetChanging';
  deviceTypeId: Id;
  variantAttributeIds: Id[];
}

export interface ModelTemplateDeviceTypeChanging {
  type: 'ModelTemplateDeviceTypeChanging';
  modelTemplateId: Id;
}

export interface ModelTemplateDeleting {
  type: 'ModelTemplateDeleting';
  modelTemplateId: Id;
}

export interface ListingDeleting {
  type: 'ListingDeleting';
  listingId: Id;
}

export type ChangeEvent =
  ListingCreated | ContentInputsChanged | SettingsChanged | ChannelActivated | StockChanged;

export type CheckEvent =
  VariantSetChanging | ModelTemplateDeviceTypeChanging | ModelTemplateDeleting | ListingDeleting;

export const CHANGE_EVENT_TYPES = [
  'ListingCreated',
  'ContentInputsChanged',
  'SettingsChanged',
  'ChannelActivated',
  'StockChanged',
] as const satisfies readonly ChangeEvent['type'][];

export const CHECK_EVENT_TYPES = [
  'VariantSetChanging',
  'ModelTemplateDeviceTypeChanging',
  'ModelTemplateDeleting',
  'ListingDeleting',
] as const satisfies readonly CheckEvent['type'][];
