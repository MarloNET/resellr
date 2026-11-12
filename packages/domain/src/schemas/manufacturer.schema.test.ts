import { describe, expect, it } from 'vitest';

import {
  manufacturerCreateResultSchema,
  manufacturerCreateSchema,
  manufacturerNameSchema,
  manufacturerSchema,
  manufacturerUpdateResultSchema,
  manufacturerUpdateSchema,
} from './manufacturer.schema.ts';

const NAME_TEXT = 'Name: 1 bis 50 Zeichen';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

const LENOVO = { id: 1, name: 'Lenovo', active: true, gpsrComplete: false, version: 1 };

describe('manufacturer schemas (CU-065)', () => {
  it('AC-REQ-100-01 trims the name " Fujitsu " to "Fujitsu"', () => {
    expect(manufacturerCreateSchema.parse({ name: ' Fujitsu ' })).toEqual({ name: 'Fujitsu' });
  });

  it('accepts a name of 50 characters after trimming', () => {
    expect(manufacturerNameSchema.parse(` ${'a'.repeat(50)} `)).toBe('a'.repeat(50));
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['51 characters', 'a'.repeat(51)],
  ])('AC-REQ-100-03 rejects a name that is %s and names the rule', (_case, name) => {
    expect(messagesOf(manufacturerNameSchema.safeParse(name))).toEqual([NAME_TEXT]);
  });

  it('rejects unknown fields on create, so there is no id, status or version', () => {
    expect(manufacturerCreateSchema.safeParse({ name: 'HP', active: false }).success).toBe(false);
  });

  it('needs the version on update; name and status are optional (2.0.3)', () => {
    expect(manufacturerUpdateSchema.parse({ version: 2, name: ' HP ' })).toEqual({
      version: 2,
      name: 'HP',
    });
    expect(manufacturerUpdateSchema.parse({ version: 2, active: false })).toEqual({
      version: 2,
      active: false,
    });
    expect(manufacturerUpdateSchema.safeParse({ name: 'HP' }).success).toBe(false);
    expect(messagesOf(manufacturerUpdateSchema.safeParse({ version: 1, name: '' }))).toEqual([
      NAME_TEXT,
    ]);
  });

  it('describes the manufacturer of the answers with its GPSR chip (2.2)', () => {
    expect(manufacturerSchema.parse(LENOVO)).toEqual(LENOVO);
  });

  it('marks the answer of POST with existing (AC-REQ-100-02)', () => {
    expect(manufacturerCreateResultSchema.parse({ ...LENOVO, existing: true })).toEqual({
      ...LENOVO,
      existing: true,
    });
    expect(manufacturerCreateResultSchema.safeParse(LENOVO).success).toBe(false);
  });

  it('answers PATCH with manufacturer and impact (2.2)', () => {
    const answer = { manufacturer: LENOVO, impact: { updated: 0, rerelease: 0, manualReview: 0 } };
    expect(manufacturerUpdateResultSchema.parse(answer)).toEqual(answer);
  });
});
