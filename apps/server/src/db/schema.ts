import type { Generated } from 'kysely';

// Kysely types of the 29 domain tables of Technical Specification 3.1 to 3.3 and of the
// management table `app_migration` (CU-028, hotspot 4.5: no change after S1 without 4.7).
// Column names stay `snake_case` as in the database. Value types follow the conventions of 3:
// booleans are INTEGER 0/1, instants ISO 8601 text in UTC, calendar days `YYYY-MM-DD`, money in
// cents, decimals canonical strings, JSON columns raw text (structure in 3.4, parsed by the
// repositories with the Zod schemas of `packages/domain`).

/** INTEGER PRIMARY KEY; SQLite assigns it when the insert leaves it out. */
type Id = Generated<number>;
/** INTEGER 0 or 1. */
type Flag = number;
/** TEXT holding JSON (3.4). */
type Json = string;

// 3.1 Settings

export interface MerchantProfileTable {
  /** Always 1. */
  id: number;
  brand_name: string;
  contact_text: string;
  logo_hash: string | null;
  version: number;
  updated_at: string;
}

export interface DeviceTypeTable {
  id: Id;
  name: string;
  name_key: string;
  active: Flag;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AttributeTable {
  id: Id;
  device_type_id: number;
  label: string;
  label_key: string;
  /** text, integer, decimal, boolean, pick, ports */
  data_type: string;
  /** keyboard_layout, power_supply, battery, battery_capacity */
  system_role: string | null;
  unit: string | null;
  unit_spacing: Flag;
  min_value: string | null;
  max_value: string | null;
  pick_list_id: number | null;
  /** model or device */
  level: string;
  variant_forming: Flag;
  required: Flag;
  /** identification, condition, delivery_scope, technical, ports, software */
  datasheet_block: string;
  sort_order: number;
  active: Flag;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PickListTable {
  id: Id;
  key: string;
  name: string;
  is_battery_list: Flag;
  version: number;
}

export interface PickListValueTable {
  id: Id;
  pick_list_id: number;
  label: string;
  label_key: string;
  battery_present: Flag | null;
  sort_order: number;
  active: Flag;
  version: number;
}

export interface ManufacturerTable {
  id: Id;
  name: string;
  name_key: string;
  active: Flag;
  gpsr_legal_name: string | null;
  gpsr_street: string | null;
  gpsr_postal_code: string | null;
  gpsr_city: string | null;
  gpsr_country: string | null;
  gpsr_contact: string | null;
  eu_rp_name: string | null;
  eu_rp_address: string | null;
  eu_rp_contact: string | null;
  gpsr_complete: Flag;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierTable {
  id: Id;
  name: string;
  name_key: string;
  active: Flag;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ConditionCodeTable {
  id: Id;
  code: string;
  code_key: string;
  supplier_id: number | null;
  plain_text: string;
  suggested_condition_value_id: number | null;
  suggested_visual_grade: number | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TextBlockTable {
  id: Id;
  name: string;
  name_key: string;
  /** battery_notice, delivery_scope, pickup_contact, legal, other */
  kind: string;
  body: string;
  active: Flag;
  all_device_types: Flag;
  all_channels: Flag;
  /** unchecked or checked */
  legal_status: string | null;
  legal_checked_on: string | null;
  legal_checked_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TextBlockDeviceTypeTable {
  text_block_id: number;
  device_type_id: number;
}

export interface TextBlockChannelTable {
  text_block_id: number;
  channel_id: number;
}

export interface DatasheetLayoutTable {
  /** Always 1. */
  id: number;
  header_labels: Json;
  block_order: Json;
  attribute_order: Json;
  version: number;
  updated_at: string;
}

export interface MediaFileTable {
  /** SHA-256, 64 hex characters. */
  hash: string;
  /** photo or logo */
  kind: string;
  /** jpg or png */
  ext: string;
  /** image/jpeg or image/png */
  mime: string;
  byte_size: number;
  width: number;
  height: number;
  created_at: string;
  /** Set by the cleanup (CU-307), reset by the upload (CU-090); start of the 24 h grace. */
  unreferenced_since: string | null;
}

// 3.2 Channel settings

export interface ChannelTable {
  id: Id;
  code: string;
  name: string;
  active: Flag;
  title_max_length: number;
  vb_allowed: Flag;
  sort_order: number;
  condition_mappings_version: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PriceRuleTable {
  channel_id: number;
  reference_channel_id: number;
  delta_cents: number;
  updated_at: string;
}

export interface TitlePatternTable {
  id: Id;
  device_type_id: number;
  channel_id: number | null;
  parts: Json;
  version: number;
  updated_at: string;
}

export interface DescriptionTemplateTable {
  channel_id: number;
  sections: Json;
  version: number;
  updated_at: string;
}

export interface ConditionMappingTable {
  id: Id;
  channel_id: number;
  condition_value_id: number;
  visual_grade: number | null;
  label: string;
  extra: string;
}

export interface CategoryMappingTable {
  id: Id;
  device_type_id: number;
  channel_id: number;
  category_path: string;
  category_ref: string;
  version: number;
  updated_at: string;
}

export interface AttributeMappingTable {
  id: Id;
  channel_id: number;
  device_type_id: number;
  fields: Json;
  version: number;
  updated_at: string;
}

// 3.3 Catalog, stock, channel contents and audit log

export interface ModelTemplateTable {
  id: Id;
  device_type_id: number;
  manufacturer_id: number;
  model_name: string;
  model_name_key: string;
  type_designation: string | null;
  mpn: string | null;
  mpn_unknown: Flag;
  original_ean: string | null;
  model_values: Json;
  default_device_values: Json;
  search_key: string;
  import_review_pending: Flag;
  import_review_keys: Json;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceTable {
  id: Id;
  wi_nr: string;
  wi_nr_key: string;
  model_template_id: number;
  listing_id: number | null;
  cancelled_from_listing_id: number | null;
  supplier_id: number | null;
  condition_code: string | null;
  condition_value_id: number;
  visual_grade: number;
  condition_description: string;
  device_values: Json;
  review_keys: Json;
  /** checked or review_pending */
  capture_status: string;
  /** available, sold, cancelled */
  stock_status: string;
  sold_channel_id: number | null;
  sold_on: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  assigned_at: string | null;
  captured_at: string;
  captured_on: string;
  version: number;
  updated_at: string;
}

export interface ListingTable {
  id: Id;
  model_template_id: number;
  condition_value_id: number;
  visual_grade: number;
  condition_description: string;
  condition_description_key: string;
  variant_values: Json;
  other_device_values: Json;
  article_number: string;
  article_number_key: string;
  /** original or own */
  ean_mode: string;
  own_ean: string | null;
  display_title: string;
  /** Derived; written only by CU-128 (FIND-221). */
  quantity: number;
  /** Derived; written only by CU-128 (FIND-221). */
  stock_json: Json;
  /** Derived; written only by CU-128 (FIND-221). */
  stock_hash: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ListingDeliveryScopeTable {
  listing_id: number;
  text_block_id: number;
  position: number;
}

export interface ListingPriceTable {
  listing_id: number;
  channel_id: number;
  amount_cents: number;
  vb: Flag;
  /** manual or rule */
  source: string;
}

export interface ListingPhotoTable {
  id: Id;
  listing_id: number;
  file_hash: string;
  original_name: string;
  position: number;
  created_at: string;
}

export interface ChannelContentTable {
  id: Id;
  listing_id: number;
  channel_id: number;
  /** draft, released, published, ended */
  status: string;
  current_state: Json;
  current_hash: string;
  released_state: Json | null;
  released_hash: string | null;
  released_at: string | null;
  used_text_block_ids: Json;
  manual_title: string | null;
  manual_title_base_hash: string | null;
  manual_description: string | null;
  manual_description_base_hash: string | null;
  manual_category: string | null;
  flag_changed_since_release: Flag;
  flag_transfer_change: Flag;
  flag_adjust_stock: Flag;
  flag_manual_text_review: Flag;
  published_on: string | null;
  external_ref: string | null;
  stock_snapshot: Json | null;
  stock_snapshot_hash: string | null;
  last_reconciled_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

/** Inserted only by the audit writer (CU-035), deleted only by the retention job (CU-234). */
export interface AuditEntryTable {
  id: Id;
  occurred_at: string;
  object_type: string;
  /** settings, model_template, listing, channel_content, device, other */
  object_category: string;
  object_id: number | null;
  object_label: string;
  action: string;
  old_value: Json | null;
  new_value: Json | null;
}

/** Key-value pairs of operation: data_folder_stamp, engine_version, app_version, created_at. */
export interface AppMetaTable {
  key: string;
  value: string;
}

/** Management table of the migration run (CU-029), not a domain table. */
export interface AppMigrationTable {
  name: string;
  applied_at: string;
}

export interface DB {
  merchant_profile: MerchantProfileTable;
  device_type: DeviceTypeTable;
  attribute: AttributeTable;
  pick_list: PickListTable;
  pick_list_value: PickListValueTable;
  manufacturer: ManufacturerTable;
  supplier: SupplierTable;
  condition_code: ConditionCodeTable;
  text_block: TextBlockTable;
  text_block_device_type: TextBlockDeviceTypeTable;
  text_block_channel: TextBlockChannelTable;
  datasheet_layout: DatasheetLayoutTable;
  media_file: MediaFileTable;
  channel: ChannelTable;
  price_rule: PriceRuleTable;
  title_pattern: TitlePatternTable;
  description_template: DescriptionTemplateTable;
  condition_mapping: ConditionMappingTable;
  category_mapping: CategoryMappingTable;
  attribute_mapping: AttributeMappingTable;
  model_template: ModelTemplateTable;
  device: DeviceTable;
  listing: ListingTable;
  listing_delivery_scope: ListingDeliveryScopeTable;
  listing_price: ListingPriceTable;
  listing_photo: ListingPhotoTable;
  channel_content: ChannelContentTable;
  audit_entry: AuditEntryTable;
  app_meta: AppMetaTable;
  app_migration: AppMigrationTable;
}
