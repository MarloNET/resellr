import { describe, expect, it } from 'vitest';

import {
  conditionCodeCreateSchema,
  conditionCodePlainTextSchema,
  conditionCodeSchema,
  conditionCodeUpdateSchema,
  suggestedVisualGradeSchema,
} from './condition-code.schema.ts';

const CODE_TEXT = 'Zustandscode: 1 bis 20 Zeichen';
const PLAIN_TEXT_TEXT = 'Klartext: 1 bis 500 Zeichen';
const GRADE_TEXT = 'Optik-Note: ganze Zahl von 1 bis 5';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('condition code schemas (CU-065)', () => {
  it('trims code and plain text (Technical Specification 2.2)', () => {
    expect(conditionCodeSchema.parse(' DGS ')).toBe('DGS');
    expect(conditionCodePlainTextSchema.parse('  Kratzer ')).toBe('Kratzer');
  });

  it('accepts a code of 20 and a plain text of 500 characters', () => {
    expect(conditionCodeSchema.parse('a'.repeat(20))).toBe('a'.repeat(20));
    expect(conditionCodePlainTextSchema.parse('a'.repeat(500))).toBe('a'.repeat(500));
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['21 characters', 'a'.repeat(21)],
  ])('DER-38-05 rejects a code that is %s with the text of UI-033', (_case, code) => {
    expect(messagesOf(conditionCodeSchema.safeParse(code))).toEqual([CODE_TEXT]);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['501 characters', 'a'.repeat(501)],
  ])(
    'DER-38-05 rejects a plain text that is %s with "Klartext: 1 bis 500 Zeichen" (O-2)',
    (_case, plainText) => {
      expect(messagesOf(conditionCodePlainTextSchema.safeParse(plainText))).toEqual([
        PLAIN_TEXT_TEXT,
      ]);
    },
  );

  it.each([0, 6, 2.5, -1])(
    'DER-38-05 rejects the visual grade %s with the text of UI-033',
    (grade) => {
      expect(messagesOf(suggestedVisualGradeSchema.safeParse(grade))).toContain(GRADE_TEXT);
    },
  );

  it('accepts the visual grades 1 to 5 and none', () => {
    for (const grade of [1, 2, 3, 4, 5, null]) {
      expect(suggestedVisualGradeSchema.parse(grade)).toBe(grade);
    }
  });

  it('creates an entry without supplier and suggestions when they are left out', () => {
    expect(conditionCodeCreateSchema.parse({ code: 'DGS', plainText: 'Kratzer' })).toEqual({
      code: 'DGS',
      supplierId: null,
      plainText: 'Kratzer',
      suggestedConditionValueId: null,
      suggestedVisualGrade: null,
    });
  });

  it('rejects unknown fields, so there is no field for an id or a version on create', () => {
    expect(
      conditionCodeCreateSchema.safeParse({ id: 1, code: 'DGS', plainText: 'Kratzer' }).success,
    ).toBe(false);
  });

  it('needs the version to change an entry and keeps omitted fields undefined', () => {
    expect(conditionCodeUpdateSchema.parse({ version: 2, supplierId: null })).toEqual({
      version: 2,
      supplierId: null,
    });
    expect(conditionCodeUpdateSchema.safeParse({ plainText: 'x' }).success).toBe(false);
  });
});
