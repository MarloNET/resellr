import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Insertable, Selectable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type Database } from './database.ts';
import { runMigrations } from './migrator.ts';
import { migrations } from './migrations/index.ts';
import type { DB } from './schema.ts';

type SqlType<T> = [NonNullable<T>] extends [number] ? 'INTEGER' : 'TEXT';
interface ColumnSpec<T> {
  type: SqlType<T>;
  nullable: null extends T ? true : false;
}
/**
 * One entry per table and column of the Kysely types; `npm run typecheck` fails if a table or
 * column is missing or added here, or if type or nullability differ from `schema.ts` (E3).
 */
type SchemaSpec = {
  [T in keyof DB]: { [C in keyof Selectable<DB[T]>]-?: ColumnSpec<Selectable<DB[T]>[C]> };
};

const int = { type: 'INTEGER', nullable: false } as const;
const intNull = { type: 'INTEGER', nullable: true } as const;
const text = { type: 'TEXT', nullable: false } as const;
const textNull = { type: 'TEXT', nullable: true } as const;
const stamps = { version: int, created_at: text, updated_at: text } as const;

const SCHEMA: SchemaSpec = {
  merchant_profile: {
    id: int,
    brand_name: text,
    contact_text: text,
    logo_hash: textNull,
    version: int,
    updated_at: text,
  },
  device_type: { id: int, name: text, name_key: text, active: int, sort_order: int, ...stamps },
  attribute: {
    id: int,
    device_type_id: int,
    label: text,
    label_key: text,
    data_type: text,
    system_role: textNull,
    unit: textNull,
    unit_spacing: int,
    min_value: textNull,
    max_value: textNull,
    pick_list_id: intNull,
    level: text,
    variant_forming: int,
    required: int,
    datasheet_block: text,
    sort_order: int,
    active: int,
    ...stamps,
  },
  pick_list: { id: int, key: text, name: text, is_battery_list: int, version: int },
  pick_list_value: {
    id: int,
    pick_list_id: int,
    label: text,
    label_key: text,
    battery_present: intNull,
    sort_order: int,
    active: int,
    version: int,
  },
  manufacturer: {
    id: int,
    name: text,
    name_key: text,
    active: int,
    gpsr_legal_name: textNull,
    gpsr_street: textNull,
    gpsr_postal_code: textNull,
    gpsr_city: textNull,
    gpsr_country: textNull,
    gpsr_contact: textNull,
    eu_rp_name: textNull,
    eu_rp_address: textNull,
    eu_rp_contact: textNull,
    gpsr_complete: int,
    ...stamps,
  },
  supplier: { id: int, name: text, name_key: text, active: int, ...stamps },
  condition_code: {
    id: int,
    code: text,
    code_key: text,
    supplier_id: intNull,
    plain_text: text,
    suggested_condition_value_id: intNull,
    suggested_visual_grade: intNull,
    ...stamps,
  },
  text_block: {
    id: int,
    name: text,
    name_key: text,
    kind: text,
    body: text,
    active: int,
    all_device_types: int,
    all_channels: int,
    legal_status: textNull,
    legal_checked_on: textNull,
    legal_checked_by: textNull,
    ...stamps,
  },
  text_block_device_type: { text_block_id: int, device_type_id: int },
  text_block_channel: { text_block_id: int, channel_id: int },
  datasheet_layout: {
    id: int,
    header_labels: text,
    block_order: text,
    attribute_order: text,
    version: int,
    updated_at: text,
  },
  media_file: {
    hash: text,
    kind: text,
    ext: text,
    mime: text,
    byte_size: int,
    width: int,
    height: int,
    created_at: text,
    unreferenced_since: textNull,
  },
  channel: {
    id: int,
    code: text,
    name: text,
    active: int,
    title_max_length: int,
    vb_allowed: int,
    sort_order: int,
    condition_mappings_version: int,
    ...stamps,
  },
  price_rule: { channel_id: int, reference_channel_id: int, delta_cents: int, updated_at: text },
  title_pattern: {
    id: int,
    device_type_id: int,
    channel_id: intNull,
    parts: text,
    version: int,
    updated_at: text,
  },
  description_template: { channel_id: int, sections: text, version: int, updated_at: text },
  condition_mapping: {
    id: int,
    channel_id: int,
    condition_value_id: int,
    visual_grade: intNull,
    label: text,
    extra: text,
  },
  category_mapping: {
    id: int,
    device_type_id: int,
    channel_id: int,
    category_path: text,
    category_ref: text,
    version: int,
    updated_at: text,
  },
  attribute_mapping: {
    id: int,
    channel_id: int,
    device_type_id: int,
    fields: text,
    version: int,
    updated_at: text,
  },
  model_template: {
    id: int,
    device_type_id: int,
    manufacturer_id: int,
    model_name: text,
    model_name_key: text,
    type_designation: textNull,
    mpn: textNull,
    mpn_unknown: int,
    original_ean: textNull,
    model_values: text,
    default_device_values: text,
    search_key: text,
    import_review_pending: int,
    import_review_keys: text,
    ...stamps,
  },
  device: {
    id: int,
    wi_nr: text,
    wi_nr_key: text,
    model_template_id: int,
    listing_id: intNull,
    cancelled_from_listing_id: intNull,
    supplier_id: intNull,
    condition_code: textNull,
    condition_value_id: int,
    visual_grade: int,
    condition_description: text,
    device_values: text,
    review_keys: text,
    capture_status: text,
    stock_status: text,
    sold_channel_id: intNull,
    sold_on: textNull,
    cancel_reason: textNull,
    cancelled_at: textNull,
    assigned_at: textNull,
    captured_at: text,
    captured_on: text,
    version: int,
    updated_at: text,
  },
  listing: {
    id: int,
    model_template_id: int,
    condition_value_id: int,
    visual_grade: int,
    condition_description: text,
    condition_description_key: text,
    variant_values: text,
    other_device_values: text,
    article_number: text,
    article_number_key: text,
    ean_mode: text,
    own_ean: textNull,
    display_title: text,
    quantity: int,
    stock_json: text,
    stock_hash: text,
    ...stamps,
  },
  listing_delivery_scope: { listing_id: int, text_block_id: int, position: int },
  listing_price: { listing_id: int, channel_id: int, amount_cents: int, vb: int, source: text },
  listing_photo: {
    id: int,
    listing_id: int,
    file_hash: text,
    original_name: text,
    position: int,
    created_at: text,
  },
  channel_content: {
    id: int,
    listing_id: int,
    channel_id: int,
    status: text,
    current_state: text,
    current_hash: text,
    released_state: textNull,
    released_hash: textNull,
    released_at: textNull,
    used_text_block_ids: text,
    manual_title: textNull,
    manual_title_base_hash: textNull,
    manual_description: textNull,
    manual_description_base_hash: textNull,
    manual_category: textNull,
    flag_changed_since_release: int,
    flag_transfer_change: int,
    flag_adjust_stock: int,
    flag_manual_text_review: int,
    published_on: textNull,
    external_ref: textNull,
    stock_snapshot: textNull,
    stock_snapshot_hash: textNull,
    last_reconciled_at: textNull,
    ...stamps,
  },
  audit_entry: {
    id: int,
    occurred_at: text,
    object_type: text,
    object_category: text,
    object_id: intNull,
    object_label: text,
    action: text,
    old_value: textNull,
    new_value: textNull,
  },
  app_meta: { key: text, value: text },
  app_migration: { name: text, applied_at: text },
};

interface TableInfoRow {
  name: string;
  type: string;
  notnull: 0 | 1;
}

const NOW = '2026-11-10T08:00:00.000Z';
const HASH = 'a'.repeat(64);

/** One valid row per table, inserted in foreign key order through Kysely (E4). */
const ROWS: { [T in keyof DB]: Insertable<DB[T]> } = {
  media_file: {
    hash: HASH,
    kind: 'photo',
    ext: 'jpg',
    mime: 'image/jpeg',
    byte_size: 1024,
    width: 800,
    height: 600,
    created_at: NOW,
    unreferenced_since: null,
  },
  merchant_profile: {
    id: 1,
    brand_name: 'Testhandel',
    contact_text: '',
    logo_hash: HASH,
    version: 1,
    updated_at: NOW,
  },
  device_type: {
    id: 1,
    name: 'Notebook',
    name_key: 'notebook',
    active: 1,
    sort_order: 1,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  pick_list: { id: 1, key: 'condition', name: 'Zustand', is_battery_list: 0, version: 1 },
  pick_list_value: {
    id: 1,
    pick_list_id: 1,
    label: 'Gebraucht',
    label_key: 'gebraucht',
    battery_present: null,
    sort_order: 1,
    active: 1,
    version: 1,
  },
  attribute: {
    id: 1,
    device_type_id: 1,
    label: 'Zustand Tastatur',
    label_key: 'zustand tastatur',
    data_type: 'pick',
    system_role: null,
    unit: null,
    unit_spacing: 1,
    min_value: null,
    max_value: null,
    pick_list_id: 1,
    level: 'device',
    variant_forming: 0,
    required: 1,
    datasheet_block: 'condition',
    sort_order: 1,
    active: 1,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  manufacturer: {
    id: 1,
    name: 'Lenovo',
    name_key: 'lenovo',
    active: 1,
    gpsr_complete: 0,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  supplier: {
    id: 1,
    name: 'Lieferant A',
    name_key: 'lieferant a',
    active: 1,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  condition_code: {
    id: 1,
    code: 'A1',
    code_key: 'a1',
    supplier_id: 1,
    plain_text: 'Sehr gut',
    suggested_condition_value_id: 1,
    suggested_visual_grade: 2,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  channel: {
    id: 1,
    code: 'shop',
    name: 'Shop',
    active: 1,
    title_max_length: 128,
    vb_allowed: 0,
    sort_order: 1,
    condition_mappings_version: 1,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  text_block: {
    id: 1,
    name: 'Netzteil',
    name_key: 'netzteil',
    kind: 'delivery_scope',
    body: 'Original-Netzteil',
    active: 1,
    all_device_types: 0,
    all_channels: 0,
    legal_status: null,
    legal_checked_on: null,
    legal_checked_by: null,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  text_block_device_type: { text_block_id: 1, device_type_id: 1 },
  text_block_channel: { text_block_id: 1, channel_id: 1 },
  datasheet_layout: {
    id: 1,
    header_labels: '[]',
    block_order: '["identification","condition","delivery_scope","technical","ports","software"]',
    attribute_order: '{}',
    version: 1,
    updated_at: NOW,
  },
  price_rule: { channel_id: 1, reference_channel_id: 1, delta_cents: 0, updated_at: NOW },
  title_pattern: {
    id: 1,
    device_type_id: 1,
    channel_id: null,
    parts: '[]',
    version: 1,
    updated_at: NOW,
  },
  description_template: { channel_id: 1, sections: '[]', version: 1, updated_at: NOW },
  condition_mapping: {
    id: 1,
    channel_id: 1,
    condition_value_id: 1,
    visual_grade: null,
    label: 'Gebraucht',
    extra: '',
  },
  category_mapping: {
    id: 1,
    device_type_id: 1,
    channel_id: 1,
    category_path: 'Computer > Notebooks',
    category_ref: '',
    version: 1,
    updated_at: NOW,
  },
  attribute_mapping: {
    id: 1,
    channel_id: 1,
    device_type_id: 1,
    fields: '[]',
    version: 1,
    updated_at: NOW,
  },
  model_template: {
    id: 1,
    device_type_id: 1,
    manufacturer_id: 1,
    model_name: 'ThinkPad T14',
    model_name_key: 'thinkpadt14',
    mpn: null,
    mpn_unknown: 1,
    model_values: '{}',
    default_device_values: '{}',
    search_key: 'thinkpad t14',
    import_review_pending: 0,
    import_review_keys: '[]',
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  listing: {
    id: 1,
    model_template_id: 1,
    condition_value_id: 1,
    visual_grade: 2,
    condition_description: '',
    condition_description_key: '',
    variant_values: '{}',
    other_device_values: '{}',
    article_number: 'NB-1',
    article_number_key: 'nb-1',
    ean_mode: 'original',
    display_title: 'Lenovo ThinkPad T14',
    quantity: 1,
    stock_json: '{"quantity":1,"wiNrs":["626198"],"batteryText":""}',
    stock_hash: HASH,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  device: {
    id: 1,
    wi_nr: '626198',
    wi_nr_key: '626198',
    model_template_id: 1,
    listing_id: 1,
    supplier_id: 1,
    condition_code: 'A1',
    condition_value_id: 1,
    visual_grade: 2,
    condition_description: '',
    device_values: '{}',
    review_keys: '[]',
    capture_status: 'checked',
    stock_status: 'available',
    assigned_at: NOW,
    captured_at: NOW,
    captured_on: '2026-11-10',
    version: 1,
    updated_at: NOW,
  },
  listing_delivery_scope: { listing_id: 1, text_block_id: 1, position: 1 },
  listing_price: { listing_id: 1, channel_id: 1, amount_cents: 49900, vb: 0, source: 'manual' },
  listing_photo: {
    id: 1,
    listing_id: 1,
    file_hash: HASH,
    original_name: 'front.jpg',
    position: 1,
    created_at: NOW,
  },
  channel_content: {
    id: 1,
    listing_id: 1,
    channel_id: 1,
    status: 'draft',
    current_state: '{}',
    current_hash: HASH,
    used_text_block_ids: '[]',
    flag_changed_since_release: 0,
    flag_transfer_change: 0,
    flag_adjust_stock: 0,
    flag_manual_text_review: 0,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  audit_entry: {
    occurred_at: NOW,
    object_type: 'device',
    object_category: 'device',
    object_id: 1,
    object_label: 'Gerät 626198',
    action: 'created',
    old_value: null,
    new_value: '{"WI-Nr":"626198"}',
  },
  app_meta: { key: 'app_version', value: '0.1.0' },
  app_migration: { name: '20991231_9999_test_row', applied_at: NOW },
};

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-schema-types-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, migrations, () => new Date(NOW));
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('schema types (CU-028)', () => {
  it('E3 cover every table of the migrated database', () => {
    const tables = database.sqlite
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .pluck()
      .all() as string[];
    expect(tables.toSorted()).toEqual(Object.keys(SCHEMA).toSorted());
  });

  it.each(Object.entries(SCHEMA))(
    'E3 match every column of %s in name, type and nullability',
    (table, columns) => {
      const actual = (database.sqlite.pragma(`table_info(${table})`) as TableInfoRow[]).map(
        (column) => [column.name, { type: column.type, nullable: column.notnull === 0 }] as const,
      );
      expect(Object.fromEntries(actual)).toEqual(columns);
    },
  );

  it('E4 insert and select every table through Kysely against the migrated database', async () => {
    const { db } = database;
    for (const [table, row] of Object.entries(ROWS) as [keyof DB, Insertable<DB[keyof DB]>][]) {
      await db.insertInto(table).values(row).execute();
    }
    for (const table of Object.keys(ROWS) as (keyof DB)[]) {
      const rows = await db.selectFrom(table).selectAll().execute();
      expect(rows.length, table).toBeGreaterThanOrEqual(1);
    }
    expect(database.sqlite.pragma('foreign_key_check')).toEqual([]);
  });

  it('E4 typed queries compile with the column types of schema.ts', async () => {
    const { db } = database;
    await db.insertInto('media_file').values(ROWS.media_file).execute();
    const file = await db
      .selectFrom('media_file')
      .select(['hash', 'byte_size', 'unreferenced_since'])
      .executeTakeFirstOrThrow();
    const size: number = file.byte_size;
    const since: string | null = file.unreferenced_since;
    expect({ size, since }).toEqual({ size: 1024, since: null });
    const generated = await db
      .insertInto('audit_entry')
      .values(ROWS.audit_entry)
      .returning('id')
      .executeTakeFirstOrThrow();
    expect(generated.id).toBe(1);
  });
});

describe('constraints of the initial migration (CU-030)', () => {
  const insertAll = async () => {
    for (const [table, row] of Object.entries(ROWS) as [keyof DB, Insertable<DB[keyof DB]>][]) {
      if (table === 'audit_entry' || table === 'app_meta' || table === 'app_migration') continue;
      await database.db.insertInto(table).values(row).execute();
    }
  };

  it('rejects a value outside a value list', async () => {
    await insertAll();
    const run = database.db
      .updateTable('device')
      .set({ stock_status: 'lost' })
      .where('id', '=', 1)
      .execute();
    await expect(run).rejects.toThrow(/CHECK constraint failed/);
  });

  it('rejects JSON that is not valid', async () => {
    await insertAll();
    const run = database.db.updateTable('listing').set({ stock_json: '{' }).execute();
    await expect(run).rejects.toThrow(/CHECK constraint failed/);
  });

  it('allows the WI-Nr of a cancelled device again, but not of an active one', async () => {
    await insertAll();
    const second = { ...ROWS.device, id: 2, listing_id: null };
    await expect(database.db.insertInto('device').values(second).execute()).rejects.toThrow(
      /UNIQUE constraint failed/,
    );
    await database.db
      .updateTable('device')
      .set({ stock_status: 'cancelled', cancel_reason: 'Defekt', cancelled_at: NOW })
      .where('id', '=', 1)
      .execute();
    await database.db.insertInto('device').values(second).execute();
  });

  it('treats NULL like 0 in the unique condition code of supplier and no supplier', async () => {
    await insertAll();
    const withoutSupplier = { ...ROWS.condition_code, id: 2, supplier_id: null };
    await database.db.insertInto('condition_code').values(withoutSupplier).execute();
    const run = database.db
      .insertInto('condition_code')
      .values({ ...withoutSupplier, id: 3 })
      .execute();
    await expect(run).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it('cascades a deleted listing to its prices, photos, scope and channel contents', async () => {
    await insertAll();
    await database.db.updateTable('device').set({ listing_id: null }).execute();
    await database.db.deleteFrom('listing').execute();
    for (const table of [
      'listing_price',
      'listing_photo',
      'listing_delivery_scope',
      'channel_content',
    ] as const) {
      expect(await database.db.selectFrom(table).selectAll().execute(), table).toEqual([]);
    }
  });

  it('restricts deleting a channel that a listing price refers to', async () => {
    await insertAll();
    await expect(database.db.deleteFrom('channel').execute()).rejects.toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });
});

// Words of a table or column name (split at `_`) that point to data REQ-068 and REQ-069 forbid.
const FORBIDDEN_WORDS: Readonly<Record<string, readonly string[]>> = {
  'platform credentials (REQ-068)': [
    'password',
    'passwort',
    'passwd',
    'pwd',
    'passphrase',
    'secret',
    'token',
    'credential',
    'credentials',
    'apikey',
    'oauth',
    'login',
    'logon',
    'username',
    'session',
    'cookie',
    'auth',
  ],
  'buyers (REQ-069)': [
    'buyer',
    'kaeufer',
    'customer',
    'kunde',
    'purchaser',
    'orders',
    'bestellung',
    'recipient',
    'billing',
    'shipping',
    'invoice',
    'payment',
    'iban',
    'email',
    'mail',
    'phone',
    'telefon',
    'mobile',
    'birthday',
    'birthdate',
  ],
  'the user or another person (REQ-069)': [
    'user',
    'users',
    'nutzer',
    'benutzer',
    'account',
    'konto',
    'person',
    'owner',
    'operator',
    'employee',
    'author',
    'editor',
    'member',
    'firstname',
    'lastname',
    'surname',
    'vorname',
    'nachname',
    'salutation',
    // `<action>_by`, e.g. `released_by`, names who did something.
    'by',
  ],
  'contact or address data (REQ-069)': [
    'contact',
    'address',
    'street',
    'postal',
    'zip',
    'city',
    'country',
  ],
};
// Joined words: `api_key`, `order_id`; `sort_order` and `block_order` are orders of display.
const FORBIDDEN_PATTERNS = [/(^|_)api_?key(_|$)/, /(^|_)order_(id|no|number|ref)(_|$)/];

/**
 * The exception of REQ-069: business contact data the user maintains as content. Each entry
 * must exist and must be caught by the check, so the list cannot hide anything else.
 */
const BUSINESS_CONTACT_COLUMNS: Readonly<Record<string, string>> = {
  'merchant_profile.contact_text': 'contact data of the merchant brand (REQ-028)',
  'manufacturer.gpsr_street': 'GPSR manufacturer data (REQ-027)',
  'manufacturer.gpsr_postal_code': 'GPSR manufacturer data (REQ-027)',
  'manufacturer.gpsr_city': 'GPSR manufacturer data (REQ-027)',
  'manufacturer.gpsr_country': 'GPSR manufacturer data (REQ-027)',
  'manufacturer.gpsr_contact': 'GPSR manufacturer data (REQ-027)',
  'manufacturer.eu_rp_address': 'GPSR responsible person in the EU (REQ-027)',
  'manufacturer.eu_rp_contact': 'GPSR responsible person in the EU (REQ-027)',
  'text_block.legal_checked_by': 'checking body of a legal text block, not the user (REQ-054)',
};

/** Why a table or column name points to forbidden data, or null. */
function forbiddenReason(name: string): string | null {
  const words = name.toLowerCase().split('_');
  for (const [reason, forbidden] of Object.entries(FORBIDDEN_WORDS)) {
    const word = words.find((w) => forbidden.includes(w));
    if (word) return `${reason}: "${word}"`;
  }
  const pattern = FORBIDDEN_PATTERNS.find((p) => p.test(name.toLowerCase()));
  return pattern ? `platform credentials or buyers (REQ-068, REQ-069): ${pattern}` : null;
}

describe('no credentials and no personal data in the data model (REQ-068, REQ-069)', () => {
  const tables = () =>
    database.sqlite
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .pluck()
      .all() as string[];
  /** Every column of every table of the migrated database as `table.column`. */
  const columns = () =>
    tables().flatMap((table) =>
      (database.sqlite.pragma(`table_info(${table})`) as TableInfoRow[]).map(
        (column) => `${table}.${column.name}`,
      ),
    );

  it.each([
    'password_hash',
    'ebay_api_key',
    'kleinanzeigen_token',
    'shop_login',
    'buyer_name',
    'customer_email',
    'order_id',
    'shipping_street',
    'user_id',
    'created_by',
    'released_by',
    'reconciled_by',
  ])('REQ-069 the check catches the column name %s', (name) => {
    expect(forbiddenReason(name)).not.toBeNull();
  });

  it.each([
    'name_key',
    'sort_order',
    'block_order',
    'released_at',
    'last_reconciled_at',
    'external_ref',
  ])('REQ-069 the check accepts the column name %s', (name) => {
    expect(forbiddenReason(name)).toBeNull();
  });

  it('REQ-068 REQ-069 no table holds user accounts, buyers, orders or platform credentials', () => {
    const found = tables().flatMap((table) => {
      const reason = forbiddenReason(table);
      return reason ? [`${table}: ${reason}`] : [];
    });
    expect(found).toEqual([]);
  });

  it('REQ-068 REQ-069 no column of any table holds credentials, buyers or the user', () => {
    const found = columns().flatMap((column) => {
      if (column in BUSINESS_CONTACT_COLUMNS) return [];
      const reason = forbiddenReason(column.split('.')[1] ?? column);
      return reason ? [`${column}: ${reason}`] : [];
    });
    expect(found).toEqual([]);
  });

  it.each(Object.entries(BUSINESS_CONTACT_COLUMNS))(
    'REQ-069 the exception %s exists and is business contact data: %s',
    (column) => {
      expect(columns()).toContain(column);
      expect(forbiddenReason(column.split('.')[1] ?? column)).not.toBeNull();
    },
  );

  it.each(['audit_entry', 'channel_content', 'device'])(
    'REQ-069 %s (audit entries, releases, reconciliations, devices) names no person',
    (table) => {
      const found = columns()
        .filter((column) => column.startsWith(`${table}.`))
        .filter((column) => forbiddenReason(column.split('.')[1] ?? column) !== null);
      expect(found).toEqual([]);
    },
  );
});
