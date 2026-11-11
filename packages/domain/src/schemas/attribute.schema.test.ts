import { describe, expect, it } from 'vitest';

import { attributeLabelSchema, attributeWithUsageSchema } from './attribute.schema.ts';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('attribute schemas (CU-063)', () => {
  it('trims the label and accepts 100 characters', () => {
    expect(attributeLabelSchema.parse('  RAM ')).toBe('RAM');
    expect(attributeLabelSchema.parse('a'.repeat(100))).toBe('a'.repeat(100));
  });

  it.each([
    ['empty', ''],
    ['101 characters', 'a'.repeat(101)],
  ])('rejects a label that is %s with M-02', (_case, label) => {
    expect(messagesOf(attributeLabelSchema.safeParse(label))).toEqual([
      'Bezeichnung: 1 bis 100 Zeichen',
    ]);
  });

  it('rejects { and } with M-03', () => {
    expect(messagesOf(attributeLabelSchema.safeParse('RAM {GB}'))).toEqual([
      'Bezeichnung darf { und } nicht enthalten',
    ]);
  });

  it('gives one message per field: length before characters (2.0.5)', () => {
    expect(messagesOf(attributeLabelSchema.safeParse(`{${'a'.repeat(100)}}`))).toEqual([
      'Bezeichnung: 1 bis 100 Zeichen',
    ]);
  });

  it('describes an attribute with the fields of 3.1 and hasValues', () => {
    const attribute = {
      id: 12,
      deviceTypeId: 1,
      label: 'RAM',
      dataType: 'integer',
      systemRole: null,
      unit: 'GB',
      unitSpacing: true,
      minValue: '1',
      maxValue: '256',
      pickListId: null,
      level: 'device',
      variantForming: true,
      required: true,
      datasheetBlock: 'technical',
      sortOrder: 2,
      active: true,
      version: 1,
      hasValues: false,
    };
    expect(attributeWithUsageSchema.parse(attribute)).toEqual(attribute);
    expect(attributeWithUsageSchema.safeParse({ ...attribute, level: 'listing' }).success).toBe(
      false,
    );
  });
});
