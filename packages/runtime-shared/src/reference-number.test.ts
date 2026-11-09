import { describe, expect, it } from 'vitest';

import {
  REFERENCE_NUMBER_PATTERN,
  createReferenceNumber,
  isReferenceNumber,
} from './reference-number.ts';

describe('reference number (E4)', () => {
  it('matches the check pattern from Technical Specification 2.0.5', () => {
    expect(REFERENCE_NUMBER_PATTERN.source).toBe('^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$');
    for (let i = 0; i < 1000; i++) {
      expect(createReferenceNumber()).toMatch(REFERENCE_NUMBER_PATTERN);
    }
  });

  it('maps random bytes to the Crockford Base32 alphabet in order', () => {
    const counting = (start: number) => (length: number) =>
      Uint8Array.from({ length }, (_, i) => start + i);

    expect(createReferenceNumber(counting(0))).toBe('R-0123-4567');
    expect(createReferenceNumber(counting(8))).toBe('R-89AB-CDEF');
    expect(createReferenceNumber(counting(16))).toBe('R-GHJK-MNPQ');
    expect(createReferenceNumber(counting(24))).toBe('R-RSTV-WXYZ');
    // Only the low five bits count.
    expect(createReferenceNumber(counting(32 + 24))).toBe('R-RSTV-WXYZ');
  });

  it('creates different numbers on consecutive calls', () => {
    const numbers = new Set(Array.from({ length: 1000 }, () => createReferenceNumber()));
    expect(numbers.size).toBe(1000);
  });

  it('accepts a valid number', () => {
    expect(isReferenceNumber('R-7K2M-9QX4')).toBe(true);
  });

  it.each(['I', 'L', 'O', 'U'])('rejects numbers containing %s', (char) => {
    expect(isReferenceNumber(`R-7K2M-9QX${char}`)).toBe(false);
    expect(isReferenceNumber(`R-${char}K2M-9QX4`)).toBe(false);
  });

  it.each([
    ['lower case', 'r-7k2m-9qx4'],
    ['missing prefix', '7K2M-9QX4'],
    ['wrong grouping', 'R-7K2M9-QX4'],
    ['too short', 'R-7K2M-9QX'],
    ['too long', 'R-7K2M-9QX45'],
    ['surrounding text', ' R-7K2M-9QX4'],
    ['trailing newline', 'R-7K2M-9QX4\n'],
  ])('rejects %s', (_, value) => {
    expect(isReferenceNumber(value)).toBe(false);
  });

  it('rejects values that are not strings', () => {
    expect(isReferenceNumber(undefined)).toBe(false);
    expect(isReferenceNumber(null)).toBe(false);
    expect(isReferenceNumber(42)).toBe(false);
  });
});
