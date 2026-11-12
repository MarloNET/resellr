import { describe, expect, it } from 'vitest';

import {
  attributeCreateSchema,
  attributeDefinitionIssues,
  attributeLabelSchema,
  attributeLabelSchemaFor,
  attributeOrderSchema,
  attributeUpdateSchema,
  attributeWithUsageSchema,
  FIXED_PLACEHOLDER_NAMES,
  type AttributeCreateInput,
} from './attribute.schema.ts';

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

const issuesOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => result.error?.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

const newAttribute: AttributeCreateInput = {
  label: 'Bildschirmdiagonale',
  dataType: 'decimal',
  unit: 'Zoll',
  unitSpacing: true,
  minValue: '10',
  maxValue: '60',
  pickListId: null,
  level: 'model',
  variantForming: false,
  required: true,
  datasheetBlock: 'technical',
  active: true,
};

describe('attribute label and placeholders (M-04, DER-34-02)', () => {
  it.each(FIXED_PLACEHOLDER_NAMES)('rejects the fixed placeholder name %j', (name) => {
    expect(messagesOf(attributeLabelSchema.safeParse(name))).toEqual([
      `Bezeichnung ist für einen festen Platzhalter vergeben: ${name}`,
    ]);
  });

  it('names the entered label after trimming', () => {
    expect(messagesOf(attributeLabelSchema.safeParse(' Hersteller '))).toEqual([
      'Bezeichnung ist für einen festen Platzhalter vergeben: Hersteller',
    ]);
  });

  it('allows "Akkukapazität" only for the role battery_capacity', () => {
    expect(attributeLabelSchemaFor('battery_capacity').parse('Akkukapazität')).toBe(
      'Akkukapazität',
    );
    expect(attributeLabelSchemaFor('battery').safeParse('Akkukapazität').success).toBe(false);
    expect(messagesOf(attributeLabelSchemaFor('battery_capacity').safeParse('Hersteller'))).toEqual(
      ['Bezeichnung ist für einen festen Platzhalter vergeben: Hersteller'],
    );
  });

  it('checks braces before placeholder names', () => {
    expect(messagesOf(attributeLabelSchema.safeParse('{Hersteller}'))).toEqual([
      'Bezeichnung darf { und } nicht enthalten',
    ]);
  });
});

describe('attribute create request (2.1)', () => {
  it('accepts AC-REQ-005-01 "Bildschirmdiagonale" and canonicalises the bounds', () => {
    expect(
      attributeCreateSchema.parse({ ...newAttribute, minValue: '10,0', maxValue: '60' }),
    ).toEqual({ ...newAttribute, minValue: '10', maxValue: '60' });
  });

  it('stores an empty unit and empty bounds as null', () => {
    expect(
      attributeCreateSchema.parse({ ...newAttribute, unit: '  ', minValue: '', maxValue: null }),
    ).toMatchObject({ unit: null, minValue: null, maxValue: null });
  });

  it('rejects a unit over 20 characters with the text of 8.2', () => {
    expect(
      issuesOf(attributeCreateSchema.safeParse({ ...newAttribute, unit: 'a'.repeat(21) })),
    ).toEqual([{ path: 'unit', message: 'Einheit: höchstens 20 Zeichen' }]);
    expect(attributeCreateSchema.safeParse({ ...newAttribute, unit: 'a'.repeat(20) }).success).toBe(
      true,
    );
  });

  it('DER-34-03 rejects a minimum above the maximum at the field "Mindestwert"', () => {
    expect(
      issuesOf(
        attributeCreateSchema.safeParse({ ...newAttribute, minValue: '60,5', maxValue: '60' }),
      ),
    ).toEqual([{ path: 'minValue', message: 'Mindestwert darf nicht größer als Höchstwert sein' }]);
  });

  it('DER-34-04 rejects data type pick without a pick list', () => {
    expect(
      issuesOf(
        attributeCreateSchema.safeParse({
          ...newAttribute,
          dataType: 'pick',
          minValue: null,
          maxValue: null,
        }),
      ),
    ).toEqual([{ path: 'pickListId', message: 'Auswahlliste fehlt' }]);
  });

  it('AC-REQ-005-06 accepts the flag at level device', () => {
    const panel = {
      ...newAttribute,
      label: 'Panel',
      dataType: 'text' as const,
      minValue: null,
      maxValue: null,
      level: 'device' as const,
      variantForming: true,
    };
    expect(attributeCreateSchema.parse(panel)).toMatchObject({ variantForming: true });
  });

  it.each([
    ['the flag at level model', { variantForming: true }],
    ['bounds outside number types', { dataType: 'text' }],
    ['a pick list outside data type pick', { pickListId: 3 }],
  ])('rejects %s without a field (2.0.5 rule (4))', (_case, change) => {
    const paths = issuesOf(attributeCreateSchema.safeParse({ ...newAttribute, ...change }))?.map(
      (issue) => issue.path,
    );
    expect(paths).toEqual(['']);
  });

  it('has no field system role, device type or order', () => {
    for (const field of ['systemRole', 'deviceTypeId', 'sortOrder']) {
      expect(attributeCreateSchema.safeParse({ ...newAttribute, [field]: null }).success).toBe(
        false,
      );
    }
  });
});

describe('attribute definition rules on a merged state', () => {
  it('AC-REQ-005-07 rejects the flag for battery_capacity', () => {
    expect(
      attributeDefinitionIssues({
        dataType: 'integer',
        systemRole: 'battery_capacity',
        minValue: null,
        maxValue: null,
        pickListId: null,
        level: 'device',
        variantForming: true,
      }),
    ).toEqual([{ code: 'attribute_variant_flag_battery_capacity', message: '' }]);
  });
});

describe('attribute update and order requests', () => {
  it('needs only the version and the changed fields', () => {
    expect(attributeUpdateSchema.parse({ version: 3, active: false })).toEqual({
      version: 3,
      active: false,
    });
  });

  it('takes the version of the device type and the attribute ids', () => {
    expect(attributeOrderSchema.parse({ version: 2, attributeIds: [3, 1, 2] })).toEqual({
      version: 2,
      attributeIds: [3, 1, 2],
    });
  });
});
