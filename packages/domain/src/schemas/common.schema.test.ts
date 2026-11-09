import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  centsSchema,
  dateSchema,
  idSchema,
  listResponseSchema,
  timestampSchema,
  versionSchema,
} from './common.schema.ts';

describe('common schemas', () => {
  it.each([1, 42, Number.MAX_SAFE_INTEGER])('accepts the id %d', (id) => {
    expect(idSchema.safeParse(id).success).toBe(true);
  });

  it.each([0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1])('rejects the id %j', (id) => {
    expect(idSchema.safeParse(id).success).toBe(false);
  });

  it('accepts versions from 1 (Technical Specification 2.0.3)', () => {
    expect(versionSchema.safeParse(1).success).toBe(true);
    expect(versionSchema.safeParse(7).success).toBe(true);
    expect(versionSchema.safeParse(0).success).toBe(false);
    expect(versionSchema.safeParse(1.5).success).toBe(false);
  });

  it.each(['2026-11-07', '2028-02-29'])('accepts the calendar date %j', (date) => {
    expect(dateSchema.safeParse(date).success).toBe(true);
  });

  it.each(['07.11.2026', '2026-11-7', '2026-13-01', '2026-02-30', '2027-02-29', ''])(
    'rejects the calendar date %j',
    (date) => {
      expect(dateSchema.safeParse(date).success).toBe(false);
    },
  );

  it('accepts a UTC timestamp with milliseconds (Technical Specification 2.0.1)', () => {
    expect(timestampSchema.safeParse('2026-11-07T16:05:12.345Z').success).toBe(true);
  });

  it.each([
    ['without milliseconds', '2026-11-07T16:05:12Z'],
    ['with offset', '2026-11-07T17:05:12.345+01:00'],
    ['without zone', '2026-11-07T16:05:12.345'],
    ['date only', '2026-11-07'],
  ])('rejects a timestamp %s', (_, timestamp) => {
    expect(timestampSchema.safeParse(timestamp).success).toBe(false);
  });

  it('accepts whole cent amounts (Technical Specification 2.0.1)', () => {
    expect(centsSchema.safeParse(27900).success).toBe(true);
    expect(centsSchema.safeParse(0).success).toBe(true);
    expect(centsSchema.safeParse(279.5).success).toBe(false);
    expect(centsSchema.safeParse('27900').success).toBe(false);
  });

  it('describes a list response as { items, total }', () => {
    const schema = listResponseSchema(z.object({ id: idSchema }));
    expect(schema.parse({ items: [{ id: 1 }, { id: 2 }], total: 9 })).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      total: 9,
    });
    expect(schema.safeParse({ items: [], total: 0 }).success).toBe(true);
    expect(schema.safeParse({ items: [{ id: 0 }], total: 1 }).success).toBe(false);
    expect(schema.safeParse({ items: [] }).success).toBe(false);
    expect(schema.safeParse({ items: [], total: -1 }).success).toBe(false);
  });
});
