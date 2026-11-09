import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatWithUnit,
  formatYesNo,
} from './format-value.ts';

describe('output formats (E4)', () => {
  it.each([
    [27900, '279,00 €'],
    [5000, '50,00 €'],
    [123456, '1.234,56 €'],
    [100000000, '1.000.000,00 €'],
    [5, '0,05 €'],
    [0, '0,00 €'],
    [-1999, '-19,99 €'],
  ])('formats %i cents as %j', (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d as cent amount', (cents) => {
    expect(() => formatMoney(cents)).toThrow(RangeError);
  });

  it.each([
    ['13.3', '13,3'],
    ['14.01', '14,01'],
    ['1234', '1234'],
    [16, '16'],
    [-2, '-2'],
    [1234, '1234'],
  ])('formats the number %j as %j', (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });

  // FIND-250: a fractional number has no defined rounding and large numbers would turn into
  // exponent notation, so fractional values come as canonical decimal strings.
  it.each([13.3, 0.1 + 0.2, 1e21, 1e-7, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects the number %d',
    (value) => {
      expect(() => formatNumber(value)).toThrow(RangeError);
    },
  );

  it.each([
    ['16', 'GB', false, '16GB'],
    ['13,3', 'Zoll', true, '13,3 Zoll'],
    ['16', '', true, '16'],
  ])('formats %j with unit %j (spacing %s) as %j', (value, unit, unitSpacing, expected) => {
    expect(formatWithUnit(value, unit, unitSpacing)).toBe(expected);
  });

  it('formats yes and no in German', () => {
    expect(formatYesNo(true)).toBe('Ja');
    expect(formatYesNo(false)).toBe('Nein');
  });

  it.each([
    ['2026-11-07', '07.11.2026'],
    ['2027-01-31', '31.01.2027'],
    ['2028-02-29', '29.02.2028'],
    ['2000-02-29', '29.02.2000'],
  ])('formats the date %j as %j', (date, expected) => {
    expect(formatDate(date)).toBe(expected);
  });

  it.each([
    '07.11.2026',
    '2026-11-07T16:05:12.345Z',
    '2026-13-01',
    '2026-00-10',
    '2026-02-30',
    '2026-02-29',
    '2100-02-29',
    '2026-04-31',
    '2026-01-00',
    '',
  ])('rejects %j as calendar date', (date) => {
    expect(() => formatDate(date)).toThrow(RangeError);
  });

  it.each([
    ['winter time', '2026-11-07T16:05:12.345Z', '07.11.2026 17:05'],
    ['summer time', '2026-07-01T10:00:00.000Z', '01.07.2026 12:00'],
    ['date change in Berlin', '2026-12-31T23:30:00.000Z', '01.01.2027 00:30'],
  ])('formats a timestamp in Europe/Berlin (%s)', (_, timestamp, expected) => {
    expect(formatDateTime(timestamp)).toBe(expected);
  });

  it('rejects an invalid timestamp', () => {
    expect(() => formatDateTime('gestern')).toThrow(RangeError);
  });
});
