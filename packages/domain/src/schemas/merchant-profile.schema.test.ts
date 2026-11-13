import { describe, expect, it } from 'vitest';

import {
  brandNameSchema,
  contactTextSchema,
  merchantProfileSchema,
  merchantProfileUpdateSchema,
} from './merchant-profile.schema.ts';

const NAME_TEXT = 'Name: 1 bis 100 Zeichen';
const CONTACT_TEXT = 'Kontaktangaben: höchstens 500 Zeichen';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('merchant profile schemas (CU-066)', () => {
  it('trims the brand name and accepts 100 characters after trimming', () => {
    expect(brandNameSchema.parse('  Muster-Händler ')).toBe('Muster-Händler');
    expect(brandNameSchema.parse(` ${'a'.repeat(100)} `)).toBe('a'.repeat(100));
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['101 characters', 'a'.repeat(101)],
  ])('DER-42-05 rejects a brand name that is %s with the text of UI-026', (_case, name) => {
    expect(messagesOf(brandNameSchema.safeParse(name))).toEqual([NAME_TEXT]);
  });

  it('accepts empty contact details and 500 characters, kept as entered', () => {
    expect(contactTextSchema.parse('')).toBe('');
    expect(contactTextSchema.parse(' Tel. 0761 1234\nmail@example.org ')).toBe(
      ' Tel. 0761 1234\nmail@example.org ',
    );
    expect(contactTextSchema.parse('a'.repeat(500))).toBe('a'.repeat(500));
  });

  it('DER-42-05 rejects contact details over 500 characters with the text of UI-026', () => {
    expect(messagesOf(contactTextSchema.safeParse('a'.repeat(501)))).toEqual([CONTACT_TEXT]);
  });

  it('needs version, brand name and contact details to save, and nothing else', () => {
    expect(
      merchantProfileUpdateSchema.parse({ version: 1, brandName: ' B ', contactText: 'K' }),
    ).toEqual({ version: 1, brandName: 'B', contactText: 'K' });
    expect(merchantProfileUpdateSchema.safeParse({ version: 1, brandName: 'B' }).success).toBe(
      false,
    );
    expect(
      merchantProfileUpdateSchema.safeParse({
        version: 1,
        brandName: 'B',
        contactText: '',
        logoHash: 'a'.repeat(64),
      }).success,
    ).toBe(false);
  });

  it('describes the profile with or without logo', () => {
    const profile = { brandName: '', contactText: '', logo: null, version: 1 };
    expect(merchantProfileSchema.parse(profile)).toEqual(profile);
    const withLogo = { ...profile, logo: { hash: 'ab', url: '/media/logo/ab' } };
    expect(merchantProfileSchema.parse(withLogo)).toEqual(withLogo);
  });
});
