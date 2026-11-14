import { describe, expect, it } from 'vitest';

import {
  hasLegalStatus,
  legalCheckIssues,
  TEXT_BLOCK_KIND_LABELS,
  TEXT_BLOCK_KINDS,
  TEXT_BLOCK_LEGAL_STATUS_LABELS,
  textBlockBodySchema,
  textBlockCreateSchema,
  textBlockLegalCheckedBySchema,
  textBlockNameSchema,
  textBlockSaveResultSchema,
  textBlockUpdateResultSchema,
  textBlockUpdateSchema,
} from './text-block.schema.ts';

const NAME_TEXT = 'Name: 1 bis 100 Zeichen';
const BODY_TEXT = 'Text: 1 bis 5.000 Zeichen';
const LEGAL_REQUIRED_TEXT = 'Prüfdatum und prüfende Stelle erforderlich';
const CHECKED_BY_TEXT = 'Prüfende Stelle: höchstens 100 Zeichen';
const FUTURE_TEXT = 'Prüfdatum darf nicht in der Zukunft liegen';
const TODAY = '2026-11-13';

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

  const textBlock = {
    id: 1,
    name: 'A',
    kind: 'legal',
    body: 'x',
    active: true,
    legalStatus: 'checked',
    legalCheckedOn: '2026-11-05',
    legalCheckedBy: 'Kanzlei Muster',
    version: 1,
  };
  const impact = { updated: 0, rerelease: 0, manualReview: 0 };

  it('describes the answer { textBlock, impact } of 2.2', () => {
    const answer = { textBlock, impact };
    expect(textBlockSaveResultSchema.parse(answer)).toEqual(answer);
    const withoutStatus = {
      ...textBlock,
      kind: 'other',
      legalStatus: null,
      legalCheckedOn: null,
      legalCheckedBy: null,
    };
    expect(textBlockSaveResultSchema.parse({ textBlock: withoutStatus, impact }).textBlock).toEqual(
      withoutStatus,
    );
  });

  it('describes the answer { textBlock, impact, legalStatusReset } of PATCH (2.2)', () => {
    const answer = { textBlock, impact, legalStatusReset: true };
    expect(textBlockUpdateResultSchema.parse(answer)).toEqual(answer);
    expect(textBlockUpdateResultSchema.safeParse({ textBlock, impact }).success).toBe(false);
  });
});

describe('legal check status of a text block (CU-066, REQ-054)', () => {
  it('DER-40-05 has a check status only for the kinds legal and battery_notice', () => {
    expect(TEXT_BLOCK_KINDS.filter(hasLegalStatus)).toEqual(['battery_notice', 'legal']);
    expect(TEXT_BLOCK_LEGAL_STATUS_LABELS).toEqual({
      unchecked: 'rechtlich ungeprüft',
      checked: 'rechtlich geprüft',
    });
  });

  it('takes the check fields only in PATCH, never in POST (AC-REQ-054-04)', () => {
    const change = {
      version: 1,
      legalStatus: 'checked',
      legalCheckedOn: '2026-11-05',
      legalCheckedBy: ' Kanzlei Muster ',
    };
    expect(textBlockUpdateSchema.parse(change)).toEqual({
      ...change,
      legalCheckedBy: 'Kanzlei Muster',
    });
    const input = { name: 'Akku', kind: 'battery_notice', body: 'Akku-Hinweis' };
    expect(textBlockCreateSchema.safeParse({ ...input, legalStatus: 'checked' }).success).toBe(
      false,
    );
  });

  it('accepts an empty check date and refuses any notation but YYYY-MM-DD without a field', () => {
    for (const legalCheckedOn of ['', '2026-11-05']) {
      expect(textBlockUpdateSchema.parse({ version: 1, legalCheckedOn })).toEqual({
        version: 1,
        legalCheckedOn,
      });
    }
    for (const legalCheckedOn of ['05.11.2026', '2026-02-30']) {
      const result = textBlockUpdateSchema.safeParse({ version: 1, legalCheckedOn });
      expect(result.error?.issues.map(({ path, code }) => ({ path, code }))).toEqual([
        { path: [], code: 'custom' },
      ]);
    }
  });

  it('DER-40-06 accepts a checking body of 100 characters after trimming', () => {
    expect(textBlockLegalCheckedBySchema.parse(` ${'a'.repeat(100)} `)).toBe('a'.repeat(100));
  });

  it('DER-40-06 rejects a checking body of 101 characters with M-31', () => {
    expect(messagesOf(textBlockLegalCheckedBySchema.safeParse('a'.repeat(101)))).toEqual([
      CHECKED_BY_TEXT,
    ]);
  });

  it.each([
    ['the date', '', 'Kanzlei Muster', ['legalCheckedOn']],
    ['the checking body', '2026-11-05', '', ['legalCheckedBy']],
    ['both', '', '', ['legalCheckedOn', 'legalCheckedBy']],
  ])(
    'DER-40-01 rejects "rechtlich geprüft" without %s with one entry per missing field and M-24',
    (_case, legalCheckedOn, legalCheckedBy, paths) => {
      const issues = legalCheckIssues(
        { legalStatus: 'checked', legalCheckedOn, legalCheckedBy },
        TODAY,
      );
      expect(issues).toEqual(
        paths.map((path) => ({
          path,
          code: 'legal_check_required',
          message: LEGAL_REQUIRED_TEXT,
        })),
      );
    },
  );

  it('DER-40-02 rejects a check date after today at the field Prüfdatum', () => {
    const check = { legalStatus: 'checked', legalCheckedBy: 'Kanzlei Muster' } as const;
    expect(legalCheckIssues({ ...check, legalCheckedOn: '2026-11-14' }, TODAY)).toEqual([
      { path: 'legalCheckedOn', code: 'legal_checked_on_future', message: FUTURE_TEXT },
    ]);
    expect(legalCheckIssues({ ...check, legalCheckedOn: TODAY }, TODAY)).toEqual([]);
  });

  it('has no rule for "rechtlich ungeprüft"', () => {
    expect(
      legalCheckIssues({ legalStatus: 'unchecked', legalCheckedOn: '', legalCheckedBy: '' }, TODAY),
    ).toEqual([]);
  });
});
