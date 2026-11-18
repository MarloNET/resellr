import { describe, expect, it } from 'vitest';

import type { ReviewKey } from './device-prefill.ts';
import { captureStatusOf, remainingReviewKeys, type ReviewedValues } from './review-flags.ts';

const CAPACITY = 12;
const PORTS = 14;
const BATTERY = 11;

const PREFILL: ReviewedValues = {
  conditionValueId: 5,
  visualGrade: 3,
  values: {
    [BATTERY]: 201,
    [CAPACITY]: { percent: 85 },
    [PORTS]: [{ count: 2, typeId: 301, positionId: null }],
  },
};
const key = (id: number) => String(id) as ReviewKey;
const KEYS: ReviewKey[] = ['condition', 'visualGrade', key(BATTERY), key(CAPACITY), key(PORTS)];

describe('remaining review flags (CU-118, REQ-013; Technical Specification 2.5)', () => {
  it('keeps every flag of a value neither confirmed nor changed', () => {
    expect(remainingReviewKeys(KEYS, [], PREFILL, PREFILL)).toEqual(KEYS);
  });

  it('AC-REQ-013-02 lifts the flag of the battery capacity confirmed unchanged', () => {
    expect(remainingReviewKeys(KEYS, [String(CAPACITY)], PREFILL, PREFILL)).toEqual([
      'condition',
      'visualGrade',
      String(BATTERY),
      String(PORTS),
    ]);
  });

  it('lifts the flag of every value that differs from the prefilled one', () => {
    const changed: ReviewedValues = {
      conditionValueId: 6,
      visualGrade: 3,
      values: {
        [BATTERY]: 201,
        [CAPACITY]: { notDeterminable: true },
        [PORTS]: [{ count: 3, typeId: 301, positionId: null }],
      },
    };

    expect(remainingReviewKeys(KEYS, [], PREFILL, changed)).toEqual([
      'visualGrade',
      String(BATTERY),
    ]);
  });

  it('lifts the flag of a removed value', () => {
    const removed: ReviewedValues = { ...PREFILL, values: { [BATTERY]: 201, [PORTS]: [] } };

    expect(remainingReviewKeys(KEYS, [], PREFILL, removed)).toEqual([
      'condition',
      'visualGrade',
      String(BATTERY),
    ]);
  });

  it('compares objects regardless of the order of their keys', () => {
    const reordered: ReviewedValues = {
      ...PREFILL,
      values: {
        ...PREFILL.values,
        [PORTS]: [{ positionId: null, typeId: 301, count: 2 }],
      },
    };

    expect(remainingReviewKeys(KEYS, [], PREFILL, reordered)).toEqual(KEYS);
  });

  it('never adds a flag for a confirmed key without a flag', () => {
    expect(remainingReviewKeys([key(BATTERY)], ['condition'], PREFILL, PREFILL)).toEqual([
      String(BATTERY),
    ]);
  });
});

describe('capture status (REQ-013, AC-REQ-013-04)', () => {
  it('AC-REQ-013-04 is "review_pending" while a flag remains and "checked" without one', () => {
    expect(captureStatusOf(['12'])).toBe('review_pending');
    expect(captureStatusOf([])).toBe('checked');
  });
});
