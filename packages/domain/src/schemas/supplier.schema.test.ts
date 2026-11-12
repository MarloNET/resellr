import { describe, expect, it } from 'vitest';

import {
  supplierCreateSchema,
  supplierNameSchema,
  supplierSchema,
  supplierUpdateSchema,
} from './supplier.schema.ts';

const NAME_TEXT = 'Name: 1 bis 100 Zeichen';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('supplier schemas (CU-065)', () => {
  it('trims the name (Technical Specification 2.2)', () => {
    expect(supplierNameSchema.parse('  L1  ')).toBe('L1');
  });

  it('accepts a name of 100 characters after trimming', () => {
    expect(supplierNameSchema.parse(` ${'a'.repeat(100)} `)).toBe('a'.repeat(100));
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['101 characters', 'a'.repeat(101)],
  ])('DER-36-05 rejects a name that is %s with the text of UI-032', (_case, name) => {
    expect(messagesOf(supplierNameSchema.safeParse(name))).toEqual([NAME_TEXT]);
  });

  it('needs name and active to create a supplier', () => {
    expect(supplierCreateSchema.parse({ name: ' L1', active: true })).toEqual({
      name: 'L1',
      active: true,
    });
    expect(supplierCreateSchema.safeParse({ name: 'L1' }).success).toBe(false);
  });

  it('rejects unknown fields, so there is no field for an id or a version on create', () => {
    expect(supplierCreateSchema.safeParse({ name: 'L1', active: true, id: 1 }).success).toBe(false);
  });

  it('needs the version to change a supplier; name and active are optional', () => {
    expect(supplierUpdateSchema.parse({ version: 3 })).toEqual({ version: 3 });
    expect(supplierUpdateSchema.parse({ version: 3, active: false })).toEqual({
      version: 3,
      active: false,
    });
    expect(supplierUpdateSchema.safeParse({ name: 'L1' }).success).toBe(false);
    expect(messagesOf(supplierUpdateSchema.safeParse({ version: 3, name: '' }))).toEqual([
      NAME_TEXT,
    ]);
  });

  it('describes the answer with the fields of 3.1', () => {
    const answer = { id: 5, name: 'L1', active: true, version: 1 };
    expect(supplierSchema.parse(answer)).toEqual(answer);
  });
});
