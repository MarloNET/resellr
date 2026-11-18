import { describe, expect, it } from 'vitest';

import { compareDecimal, parseDecimal } from './parse-decimal.ts';

describe('decimal input (E3)', () => {
  it.each([
    ['14,01', '14.01'],
    ['14.01', '14.01'],
    // Point and comma are always decimal separators, never thousands separators (MAR-198 Q-3).
    ['1.234', '1.234'],
    ['1,234', '1.234'],
    // Never read as a date (AC-REQ-005-02).
    ['3.4', '3.4'],
    ['13,3', '13.3'],
    ['16', '16'],
    ['0', '0'],
    ['0,5', '0.5'],
  ])('parses %j as %j', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each([
    ['trailing zeros after the separator', '14,10', '14.1'],
    ['only zeros after the separator', '14,00', '14'],
    ['leading zeros', '007,50', '7.5'],
    ['surrounding spaces', ' 14,01 ', '14.01'],
    ['a minus sign', '-2,5', '-2.5'],
    ['negative zero', '-0,0', '0'],
  ])('returns the canonical form for %s', (_, input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each([
    '1.234,56',
    '1.234.567',
    '1,234.5',
    '1,2,3',
    '',
    ' ',
    'abc',
    '14,',
    ',5',
    '.',
    '14 01',
    '1e3',
    '+5',
    '--5',
    '٣',
  ])('rejects %j as format error', (input) => {
    expect(parseDecimal(input)).toBeNull();
  });

  // Regression for FIND-247: removing the zeros must take linear time. A quadratic
  // implementation needs several seconds for these inputs; a linear one a few milliseconds.
  it.each([
    ['trailing zeros', `1,${'0'.repeat(200_000)}`, '1'],
    ['zeros before a last digit', `1,${'0'.repeat(200_000)}1`, `1.${'0'.repeat(200_000)}1`],
    ['leading zeros', `${'0'.repeat(200_000)}7,5`, '7.5'],
  ])('handles very long runs of %s in linear time', (_, input, expected) => {
    const start = performance.now();
    expect(parseDecimal(input)).toBe(expected);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe('comparison of canonical decimals', () => {
  it.each([
    ['10', '60', -1],
    ['60', '10', 1],
    ['13.3', '13.30', 0],
    ['9.99', '10', -1],
    ['-2.5', '-2.4', -1],
    ['-1', '0.5', -1],
    ['0.5', '0.25', 1],
    ['123456789012345678901', '123456789012345678902', -1],
  ])('compares %j with %j as %d', (left, right, expected) => {
    expect(compareDecimal(left, right)).toBe(expected);
  });
});
