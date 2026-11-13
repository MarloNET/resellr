import {
  attributeDefinitionIssues,
  attributeLabelSchemaFor,
  attributeUnitSchema,
} from '@resellr/domain/schemas/attribute.schema';
import { PICK_LIST_KEYS, pickListValueLabelSchema } from '@resellr/domain/schemas/pick-list.schema';
import { describe, expect, it } from 'vitest';

import {
  INITIAL_ATTRIBUTE_MAPPINGS,
  INITIAL_ATTRIBUTES,
  INITIAL_CHANNELS,
  INITIAL_DEVICE_TYPES,
  INITIAL_PICK_LISTS,
  INITIAL_TITLE_PATTERNS,
} from './initial-settings.ts';

// The initial settings (CU-070) keep the field rules the settings endpoints apply (2.1), so the
// user can change every entry afterwards (AC-REQ-006-02).

describe('initial settings (CU-070)', () => {
  it('holds the nine pick lists, each once, with valid values', () => {
    expect(INITIAL_PICK_LISTS.map(({ key }) => key)).toEqual([...PICK_LIST_KEYS]);
    for (const list of INITIAL_PICK_LISTS) {
      for (const { label } of list.values)
        expect(pickListValueLabelSchema.parse(label)).toBe(label);
      const keys = list.values.map(({ label }) => label.toLowerCase());
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it.each(INITIAL_ATTRIBUTES.map((attribute) => [attribute.label, attribute] as const))(
    'keeps the label and cross-field rules for the attribute %s',
    (label, attribute) => {
      expect(attributeLabelSchemaFor(attribute.systemRole).safeParse(label).success).toBe(true);
      expect(attributeUnitSchema.parse(attribute.unit)).toBe(attribute.unit);
      for (const use of Object.values(attribute.uses)) {
        expect(
          attributeDefinitionIssues({
            dataType: attribute.dataType,
            systemRole: attribute.systemRole,
            minValue: attribute.minValue,
            maxValue: attribute.maxValue,
            pickListId: attribute.pickList === null ? null : 1,
            level: use.level,
            variantForming: use.variantForming,
          }),
        ).toEqual([]);
      }
    },
  );

  it('names each attribute once and only pick lists that exist', () => {
    const labels = INITIAL_ATTRIBUTES.map(({ label }) => label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
    for (const { pickList } of INITIAL_ATTRIBUTES) {
      if (pickList !== null) expect(PICK_LIST_KEYS).toContain(pickList);
    }
  });

  it('refers in title patterns only to attributes of the device type', () => {
    for (const deviceType of INITIAL_DEVICE_TYPES) {
      for (const part of INITIAL_TITLE_PATTERNS[deviceType]) {
        if (part.kind !== 'attribute') continue;
        const attribute = INITIAL_ATTRIBUTES.find(({ label }) => label === part.attribute);
        expect(attribute?.uses[deviceType], `${deviceType}: ${part.attribute}`).toBeDefined();
      }
    }
  });

  it('refers in attribute mappings only to attributes of the initial settings', () => {
    const labels = new Set(INITIAL_ATTRIBUTES.map(({ label }) => label));
    for (const fields of Object.values(INITIAL_ATTRIBUTE_MAPPINGS)) {
      for (const { source } of fields) {
        if (source.kind === 'attribute') expect(labels).toContain(source.attribute);
      }
    }
  });

  it('keeps the title length of every channel within 20 to 500 characters', () => {
    for (const { titleMaxLength } of INITIAL_CHANNELS) {
      expect(titleMaxLength).toBeGreaterThanOrEqual(20);
      expect(titleMaxLength).toBeLessThanOrEqual(500);
    }
  });
});
