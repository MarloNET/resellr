import type BetterSqlite3 from 'better-sqlite3';

import { pickListId } from './pick-lists.ts';

/** Attribute values by column (Technical Specification 3.4); a missing column holds `{}`. */
export interface StoredValues {
  modelValues?: Record<string, unknown>;
  defaultDeviceValues?: Record<string, unknown>;
  deviceValues?: Record<string, unknown>;
  variantValues?: Record<string, unknown>;
  otherDeviceValues?: Record<string, unknown>;
}

const STAMP = '2026-11-12T09:00:00.000Z';

/**
 * One model template of `deviceTypeId` with one model listing and one device, holding the given
 * attribute values in their JSON columns (3.4). Model templates, devices and model listings get
 * their services in later build steps (Technical Specification 4.4, S3 and S4); until then tests
 * insert them directly. Needs the pick lists of `insertPickLists`.
 */
export function insertAttributeValueRecords(
  sqlite: BetterSqlite3.Database,
  values: StoredValues,
  deviceTypeId = 1,
) {
  const run = (statement: string, ...params: unknown[]) => sqlite.prepare(statement).run(...params);
  const json = (column: keyof StoredValues) => JSON.stringify(values[column] ?? {});
  run(
    'INSERT INTO manufacturer (id, name, name_key, active, gpsr_complete, version, created_at, updated_at) VALUES (1, ?, ?, 1, 0, 1, ?, ?)',
    'Lenovo',
    'lenovo',
    STAMP,
    STAMP,
  );
  run(
    "INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version) VALUES (1, ?, 'gebraucht', 'gebraucht', 1, 1, 1)",
    pickListId('condition'),
  );
  run(
    `INSERT INTO model_template (id, device_type_id, manufacturer_id, model_name, model_name_key,
       mpn_unknown, model_values, default_device_values, search_key, import_review_pending,
       import_review_keys, version, created_at, updated_at)
     VALUES (1, ?, 1, 'ThinkPad T14', 'thinkpadt14', 1, ?, ?, 'thinkpad t14', 0, '[]', 1, ?, ?)`,
    deviceTypeId,
    json('modelValues'),
    json('defaultDeviceValues'),
    STAMP,
    STAMP,
  );
  run(
    `INSERT INTO listing (id, model_template_id, condition_value_id, visual_grade,
       condition_description, condition_description_key, variant_values, other_device_values,
       article_number, article_number_key, ean_mode, display_title, quantity, stock_json,
       stock_hash, version, created_at, updated_at)
     VALUES (1, 1, 1, 2, '', '', ?, ?, 'A-1', 'a-1', 'original', 'ThinkPad T14', 1, '{}', '', 1, ?, ?)`,
    json('variantValues'),
    json('otherDeviceValues'),
    STAMP,
    STAMP,
  );
  run(
    `INSERT INTO device (id, wi_nr, wi_nr_key, model_template_id, listing_id, condition_value_id,
       visual_grade, condition_description, device_values, review_keys, capture_status,
       stock_status, captured_at, captured_on, version, updated_at)
     VALUES (1, '626198', '626198', 1, 1, 1, 2, '', ?, '[]', 'checked', 'available', ?, '2026-11-12', 1, ?)`,
    json('deviceValues'),
    STAMP,
    STAMP,
  );
}
