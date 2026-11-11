import { describe, expect, it } from 'vitest';

import {
  deviceTypeCreateSchema,
  deviceTypeNameSchema,
  deviceTypeSchema,
  deviceTypeUpdateSchema,
} from './device-type.schema.ts';

const NAME_TEXT = 'Name: 1 bis 50 Zeichen';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('device type schemas (CU-063)', () => {
  it('trims the name (Technical Specification 2.1)', () => {
    expect(deviceTypeNameSchema.parse('  Monitor  ')).toBe('Monitor');
  });

  it('accepts a name of 50 characters after trimming', () => {
    expect(deviceTypeNameSchema.parse(` ${'a'.repeat(50)} `)).toBe('a'.repeat(50));
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['51 characters', 'a'.repeat(51)],
  ])('rejects a name that is %s with the text of UI-027', (_case, name) => {
    expect(messagesOf(deviceTypeNameSchema.safeParse(name))).toEqual([NAME_TEXT]);
  });

  it('needs name and active to create a device type', () => {
    expect(deviceTypeCreateSchema.parse({ name: ' Monitor', active: true })).toEqual({
      name: 'Monitor',
      active: true,
    });
    expect(deviceTypeCreateSchema.safeParse({ name: 'Monitor' }).success).toBe(false);
  });

  it('rejects unknown fields, so there is no field for an id or a version on create', () => {
    expect(deviceTypeCreateSchema.safeParse({ name: 'A', active: true, id: 1 }).success).toBe(
      false,
    );
  });

  it('needs the version to change a device type; name and active are optional', () => {
    expect(deviceTypeUpdateSchema.parse({ version: 3 })).toEqual({ version: 3 });
    expect(deviceTypeUpdateSchema.parse({ version: 3, active: false })).toEqual({
      version: 3,
      active: false,
    });
    expect(deviceTypeUpdateSchema.safeParse({ name: 'Monitor' }).success).toBe(false);
    expect(messagesOf(deviceTypeUpdateSchema.safeParse({ version: 3, name: '' }))).toEqual([
      NAME_TEXT,
    ]);
  });

  it('describes the answer with the fields of 2.1', () => {
    const answer = { id: 5, name: 'Monitor', active: true, version: 1, attributeCount: 0 };
    expect(deviceTypeSchema.parse(answer)).toEqual(answer);
  });
});
