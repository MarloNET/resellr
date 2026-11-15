import { modelTemplateSearchKey } from '@resellr/domain/schemas/model-template.schema';
import { toKey, toModelNameKey } from '@resellr/domain/text/normalize-key';
import type BetterSqlite3 from 'better-sqlite3';

/** A model template for a test, stored by `insertModelTemplate`. */
export interface ModelTemplateOfTest {
  deviceTypeId: number;
  manufacturerId: number;
  modelName: string;
  typeDesignation?: string | null;
  /** `null` stores the MPN as "unbekannt" (3.3). */
  mpn: string | null;
  /** Creation time; the list without a search term is sorted by it (2.4). */
  createdAt?: string;
}

const AT = '2026-11-10T08:00:00.000Z';

/**
 * Inserts a device type or a manufacturer with its name key; returns its id. Model templates
 * can only be created through the API with #177, so the tests of the search write the catalog
 * rows themselves.
 */
export function insertDeviceType(sqlite: BetterSqlite3.Database, name: string): number {
  const { lastInsertRowid } = sqlite
    .prepare(
      `INSERT INTO device_type (name, name_key, active, sort_order, version, created_at, updated_at)
       VALUES (?, ?, 1, (SELECT COUNT(*) + 1 FROM device_type), 1, ?, ?)`,
    )
    .run(name, toKey(name), AT, AT);
  return Number(lastInsertRowid);
}

export function insertManufacturer(sqlite: BetterSqlite3.Database, name: string): number {
  const { lastInsertRowid } = sqlite
    .prepare(
      `INSERT INTO manufacturer (name, name_key, active, gpsr_complete, version, created_at, updated_at)
       VALUES (?, ?, 1, 0, 1, ?, ?)`,
    )
    .run(name, toKey(name), AT, AT);
  return Number(lastInsertRowid);
}

/** Inserts a model template with `model_name_key` and `search_key` as in 3.3; returns its id. */
export function insertModelTemplate(
  sqlite: BetterSqlite3.Database,
  template: ModelTemplateOfTest,
): number {
  const typeDesignation = template.typeDesignation ?? null;
  const createdAt = template.createdAt ?? AT;
  const { lastInsertRowid } = sqlite
    .prepare(
      `INSERT INTO model_template (device_type_id, manufacturer_id, model_name, model_name_key,
         type_designation, mpn, mpn_unknown, original_ean, model_values, default_device_values,
         search_key, import_review_pending, import_review_keys, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, '{}', '{}', ?, 0, '[]', 1, ?, ?)`,
    )
    .run(
      template.deviceTypeId,
      template.manufacturerId,
      template.modelName,
      toModelNameKey(template.modelName),
      typeDesignation,
      template.mpn,
      template.mpn === null ? 1 : 0,
      modelTemplateSearchKey({ modelName: template.modelName, typeDesignation, mpn: template.mpn }),
      createdAt,
      createdAt,
    );
  return Number(lastInsertRowid);
}
