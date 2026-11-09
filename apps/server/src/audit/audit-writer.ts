import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import type { Clock } from '../shared/clock.ts';

// Object types and actions of Technical Specification 3.6.

type SettingsAction =
  'created' | 'updated' | 'activated' | 'deactivated' | 'reordered' | 'legal_status_changed';
/** Settings with a DELETE endpoint (REQ-072, FIND-220). */
type DeletableSettingsAction = SettingsAction | 'deleted';

/** Actions per object type. */
interface AuditActions {
  device_type: SettingsAction;
  attribute: SettingsAction;
  pick_list_value: SettingsAction;
  manufacturer: SettingsAction;
  supplier: SettingsAction;
  condition_code: DeletableSettingsAction;
  text_block: SettingsAction;
  merchant_profile: SettingsAction;
  datasheet_layout: SettingsAction;
  channel: SettingsAction;
  price_rule: DeletableSettingsAction;
  title_pattern: DeletableSettingsAction;
  description_template: SettingsAction;
  condition_mappings: SettingsAction;
  category_mapping: DeletableSettingsAction;
  attribute_mapping: SettingsAction;
  model_template: 'created' | 'updated' | 'deleted';
  listing:
    | 'created'
    | 'values_updated'
    | 'deviation_confirmed'
    | 'price_updated'
    | 'photo_added'
    | 'photo_removed'
    | 'photos_reordered'
    | 'deleted';
  channel_content:
    | 'manual_title_saved'
    | 'manual_title_discarded'
    | 'manual_description_saved'
    | 'manual_description_discarded'
    | 'manual_category_saved'
    | 'manual_category_discarded'
    | 'released'
    | 'change_draft_released'
    | 'status_changed'
    | 'reconciled'
    | 'unchecked_legal_confirmed';
  device:
    | 'created'
    | 'values_updated'
    | 'assigned'
    | 'assigned_despite_deviation'
    | 'rebooked'
    | 'sold'
    | 'sale_reversed'
    | 'cancelled'
    | 'wi_nr_corrected';
}

export type AuditObjectType = keyof AuditActions;
export type AuditAction<T extends AuditObjectType = AuditObjectType> = AuditActions[T];
export type AuditCategory =
  'settings' | 'model_template' | 'listing' | 'channel_content' | 'device' | 'other';

/** A readable value of `oldValue` and `newValue` (labels instead of ids, 3.4). */
export type AuditValue =
  string | number | boolean | null | readonly AuditValue[] | { readonly [key: string]: AuditValue };

/** Changed fields by their readable name, e.g. `{ "Optik-Note": 4 }` (2.0.9, 3.4). */
export type AuditValues = Readonly<Record<string, AuditValue>>;

/**
 * One entry of 2.0.9 without `occurredAt`, which the writer takes from the clock; no user and no
 * passwords (E-4, E-5). The action must fit the object type (3.6).
 */
export type AuditEntryInput = {
  [T in AuditObjectType]: {
    objectType: T;
    /** `null` if the object has no id of its own (e.g. condition mappings of a channel). */
    objectId: number | null;
    /** E.g. "Gerät 626198", "Textbaustein Abholung". */
    objectLabel: string;
    action: AuditAction<T>;
    oldValue: AuditValues | null;
    newValue: AuditValues | null;
  };
}[AuditObjectType];

export interface AuditWriter {
  write(entry: AuditEntryInput): Promise<void>;
}

/** Category of each object type; all other object types are settings (3.6). */
const CATEGORY_BY_TYPE: Partial<Record<AuditObjectType, AuditCategory>> = {
  model_template: 'model_template',
  listing: 'listing',
  channel_content: 'channel_content',
  device: 'device',
};

/** Deletions and the confirmation of unchecked legal texts fall under `other` (3.6, UI-024). */
function categoryOf({ objectType, action }: AuditEntryInput): AuditCategory {
  if (action === 'deleted' || action === 'unchecked_legal_confirmed') return 'other';
  return CATEGORY_BY_TYPE[objectType] ?? 'settings';
}

const toJson = (values: AuditValues | null) => (values === null ? null : JSON.stringify(values));

export interface AuditWriterDeps {
  /** `tx.db` of the action, never the outer `db` (2.0.4, MAR-263). */
  db: Kysely<DB>;
  clock: Clock;
}

/**
 * Audit writer (CU-035, REQ-072): the only place that inserts into `audit_entry`. Create it in
 * the action with `tx.db` of the unit of work (Nachtrag MAR-285), so the entry is stored
 * together with the change or not at all. A failing insert propagates and rolls the action back:
 * without an entry nothing is stored (2.0.4).
 */
export function createAuditWriter({ db, clock }: AuditWriterDeps): AuditWriter {
  return {
    write: async (entry) => {
      await db
        .insertInto('audit_entry')
        .values({
          occurred_at: clock.now().toISOString(),
          object_type: entry.objectType,
          object_category: categoryOf(entry),
          object_id: entry.objectId,
          object_label: entry.objectLabel,
          action: entry.action,
          old_value: toJson(entry.oldValue),
          new_value: toJson(entry.newValue),
        })
        .execute();
    },
  };
}
