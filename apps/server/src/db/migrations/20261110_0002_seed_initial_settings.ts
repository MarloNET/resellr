import { toKey } from '@resellr/domain/text/normalize-key';
import {
  INITIAL_ATTRIBUTE_MAPPINGS,
  INITIAL_ATTRIBUTES,
  INITIAL_CHANNELS,
  INITIAL_DATASHEET_LAYOUT,
  INITIAL_DESCRIPTION_TEMPLATES,
  INITIAL_DEVICE_TYPES,
  INITIAL_PICK_LISTS,
  INITIAL_TITLE_PATTERNS,
  type InitialFieldSource,
  type InitialTitlePart,
} from '@resellr/seed-data/initial-settings';

import type { Migration } from '../migrator.ts';

// Seed migration (CU-071): writes the initial settings of CU-070 once, when the database is
// created (Technical Specification 2.1.1, 3.8). Data only, no schema change. It runs once per
// database because the migration run records it in `app_migration` (DER-33-11), so a later
// update never changes the initial settings of an existing installation. Not part of the
// initial settings and therefore left empty (AC-REQ-006-03): category and condition mappings,
// text blocks, manufacturers, condition codes and suppliers; `merchant_profile` is its one
// empty row.

const flag = (value: boolean) => (value ? 1 : 0);

export const seedInitialSettings: Migration = {
  name: '20261110_0002_seed_initial_settings',
  async up(db) {
    const at = new Date().toISOString();
    const stamps = { version: 1, created_at: at, updated_at: at };

    await db
      .insertInto('merchant_profile')
      .values({
        id: 1,
        brand_name: '',
        contact_text: '',
        logo_hash: null,
        version: 1,
        updated_at: at,
      })
      .execute();

    const pickListIds = new Map<string, number>();
    for (const list of INITIAL_PICK_LISTS) {
      const { id } = await db
        .insertInto('pick_list')
        .values({
          key: list.key,
          name: list.name,
          is_battery_list: flag(list.key === 'battery'),
          version: 1,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      pickListIds.set(list.key, id);
      for (const [position, value] of list.values.entries()) {
        await db
          .insertInto('pick_list_value')
          .values({
            pick_list_id: id,
            label: value.label,
            label_key: toKey(value.label),
            battery_present: list.key === 'battery' ? flag(value.batteryPresent === true) : null,
            sort_order: position + 1,
            active: 1,
            version: 1,
          })
          .execute();
      }
    }

    const channelIds = new Map<string, number>();
    for (const [index, channel] of INITIAL_CHANNELS.entries()) {
      const { id } = await db
        .insertInto('channel')
        .values({
          code: channel.code,
          name: channel.name,
          active: 1,
          title_max_length: channel.titleMaxLength,
          vb_allowed: flag(channel.vbAllowed),
          sort_order: index + 1,
          condition_mappings_version: 1,
          ...stamps,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      channelIds.set(channel.code, id);
    }

    const attributeOrder: Record<string, number[]> = {};
    for (const [index, deviceTypeName] of INITIAL_DEVICE_TYPES.entries()) {
      const { id: deviceTypeId } = await db
        .insertInto('device_type')
        .values({
          name: deviceTypeName,
          name_key: toKey(deviceTypeName),
          active: 1,
          sort_order: index + 1,
          ...stamps,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const attributeIds = new Map<string, number>();
      for (const attribute of INITIAL_ATTRIBUTES) {
        const use = attribute.uses[deviceTypeName];
        if (use === undefined) continue;
        const { id } = await db
          .insertInto('attribute')
          .values({
            device_type_id: deviceTypeId,
            label: attribute.label,
            label_key: toKey(attribute.label),
            data_type: attribute.dataType,
            system_role: attribute.systemRole,
            unit: attribute.unit,
            unit_spacing: flag(attribute.unitSpacing),
            min_value: attribute.minValue,
            max_value: attribute.maxValue,
            pick_list_id: attribute.pickList === null ? null : pickListIds.get(attribute.pickList),
            level: use.level,
            variant_forming: flag(use.variantForming),
            required: flag(use.required),
            datasheet_block: attribute.datasheetBlock,
            sort_order: attributeIds.size + 1,
            active: 1,
            ...stamps,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        attributeIds.set(attribute.label, id);
      }
      attributeOrder[String(deviceTypeId)] = [...attributeIds.values()];

      const attributeId = (label: string) => {
        const id = attributeIds.get(label);
        if (id === undefined) throw new Error(`${deviceTypeName} has no attribute ${label}`);
        return id;
      };

      await db
        .insertInto('title_pattern')
        .values({
          device_type_id: deviceTypeId,
          channel_id: null,
          parts: JSON.stringify(INITIAL_TITLE_PATTERNS[deviceTypeName].map(titlePart(attributeId))),
          version: 1,
          updated_at: at,
        })
        .execute();

      for (const [code, fields] of Object.entries(INITIAL_ATTRIBUTE_MAPPINGS)) {
        const mapped = fields
          .filter(({ source }) => source.kind !== 'attribute' || attributeIds.has(source.attribute))
          .map(({ label, source }) => ({
            label,
            source: fieldSource(source, attributeId),
            required: false,
            valueMap: [],
          }));
        await db
          .insertInto('attribute_mapping')
          .values({
            channel_id: channelIds.get(code),
            device_type_id: deviceTypeId,
            fields: JSON.stringify(mapped),
            version: 1,
            updated_at: at,
          })
          .execute();
      }
    }

    for (const [code, sections] of Object.entries(INITIAL_DESCRIPTION_TEMPLATES)) {
      await db
        .insertInto('description_template')
        .values({
          channel_id: channelIds.get(code),
          sections: JSON.stringify(
            sections.map(({ heading, lines }) => ({ heading, deviceTypeIds: [], lines })),
          ),
          version: 1,
          updated_at: at,
        })
        .execute();
    }

    await db
      .insertInto('datasheet_layout')
      .values({
        id: 1,
        header_labels: JSON.stringify(INITIAL_DATASHEET_LAYOUT.headerLabels),
        block_order: JSON.stringify(INITIAL_DATASHEET_LAYOUT.blockOrder),
        attribute_order: JSON.stringify(attributeOrder),
        version: 1,
        updated_at: at,
      })
      .execute();
  },
};

/** A part of a title pattern in the stored form of 3.4. */
function titlePart(attributeId: (label: string) => number) {
  return ({ prefix, suffix, priority, ...part }: InitialTitlePart) =>
    part.kind === 'attribute'
      ? { kind: 'attribute', attributeId: attributeId(part.attribute), prefix, suffix, priority }
      : { kind: 'field', field: part.field, prefix, suffix, priority };
}

/** The source of a channel field in the stored form of 3.4. */
function fieldSource(source: InitialFieldSource, attributeId: (label: string) => number) {
  return source.kind === 'attribute'
    ? { kind: 'attribute', attributeId: attributeId(source.attribute) }
    : source;
}
