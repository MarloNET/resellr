import { describe, expect, it } from 'vitest';

import { isValidEan } from './ean.ts';

describe('EAN check (E6)', () => {
  it.each([
    ['GTIN-13', '4006381333931'],
    ['GTIN-13', '4012345123456'],
    ['GTIN-13 with check digit 0', '4000000000020'],
    ['GTIN-8', '96385074'],
    ['GTIN-8', '40170725'],
  ])('accepts the valid %s %s', (_, ean) => {
    expect(isValidEan(ean)).toBe(true);
  });

  it.each([
    ['GTIN-13', '4006381333932'],
    ['GTIN-13', '4012345123450'],
    ['GTIN-8', '96385075'],
    ['GTIN-8', '40170720'],
  ])('rejects the %s %s with a wrong check digit', (_, ean) => {
    expect(isValidEan(ean)).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['7 digits', '9638507'],
    ['12 digits (UPC-A)', '036000291452'],
    ['14 digits (GTIN-14)', '00012345600012'],
    ['9 digits', '963850740'],
  ])('rejects a wrong length: %s', (_, ean) => {
    expect(isValidEan(ean)).toBe(false);
  });

  it.each([
    ['spaces', '4006381 333931'],
    ['surrounding spaces', ' 96385074 '],
    ['letters', '400638133393A'],
    ['non-ASCII digits', '٩٦٣٨٥٠٧٤'],
  ])('rejects %s', (_, ean) => {
    expect(isValidEan(ean)).toBe(false);
  });
});
