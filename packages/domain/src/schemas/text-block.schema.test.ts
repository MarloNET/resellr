import { describe, expect, it } from 'vitest';

import {
  TEXT_BLOCK_KIND_LABELS,
  TEXT_BLOCK_KINDS,
  textBlockBodySchema,
  textBlockCreateSchema,
  textBlockNameSchema,
  textBlockSaveResultSchema,
  textBlockUpdateSchema,
} from './text-block.schema.ts';

const NAME_TEXT = 'Name: 1 bis 100 Zeichen';
const BODY_TEXT = 'Text: 1 bis 5.000 Zeichen';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('text block schemas (CU-066)', () => {
  it('has the five kinds of REQ-026 with their names', () => {
    expect(TEXT_BLOCK_KINDS.map((kind) => TEXT_BLOCK_KIND_LABELS[kind])).toEqual([
      'Akku-Hinweis',
      'Lieferumfang',
      'Abholung/Kontakt',
      'Rechtliches',
      'Sonstiges',
    ]);
  });

  it('trims the name and accepts 100 characters', () => {
    expect(textBlockNameSchema.parse('  Abholung  ')).toBe('Abholung');
    expect(textBlockNameSchema.parse(` ${'a'.repeat(100)} `)).toBe('a'.repeat(100));
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['101 characters', 'a'.repeat(101)],
  ])('DER-39-05 rejects a name that is %s with M-30', (_case, name) => {
    expect(messagesOf(textBlockNameSchema.safeParse(name))).toEqual([NAME_TEXT]);
  });

  it('DER-39-05 accepts a text of 5,000 characters and keeps it as entered', () => {
    const body = ` ${'a'.repeat(4998)} `;
    expect(textBlockBodySchema.parse(body)).toBe(body);
  });

  it.each([
    ['empty', ''],
    ['5,001 characters', 'a'.repeat(5001)],
  ])('DER-39-05 rejects a text that is %s with the field rule of UI-030', (_case, body) => {
    expect(messagesOf(textBlockBodySchema.safeParse(body))).toEqual([BODY_TEXT]);
  });

  it('needs name, kind and text to create a text block and no other field', () => {
    const input = { name: ' Abholung', kind: 'pickup_contact', body: 'Abholung in Hannover' };
    expect(textBlockCreateSchema.parse(input)).toEqual({ ...input, name: 'Abholung' });
    expect(textBlockCreateSchema.safeParse({ ...input, kind: undefined }).success).toBe(false);
    expect(textBlockCreateSchema.safeParse({ ...input, id: 1 }).success).toBe(false);
  });

  it('needs the version to change a text block; the other fields are optional', () => {
    expect(textBlockUpdateSchema.parse({ version: 2, active: false })).toEqual({
      version: 2,
      active: false,
    });
    expect(textBlockUpdateSchema.safeParse({ active: false }).success).toBe(false);
    expect(messagesOf(textBlockUpdateSchema.safeParse({ version: 2, name: '' }))).toEqual([
      NAME_TEXT,
    ]);
  });

  it('describes the answer { textBlock, impact } of 2.2', () => {
    const answer = {
      textBlock: { id: 1, name: 'A', kind: 'other', body: 'x', active: true, version: 1 },
      impact: { updated: 0, rerelease: 0, manualReview: 0 },
    };
    expect(textBlockSaveResultSchema.parse(answer)).toEqual(answer);
  });
});
