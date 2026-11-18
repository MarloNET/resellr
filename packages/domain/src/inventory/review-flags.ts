import type { ReviewKey } from './device-prefill.ts';

/** The reviewed values of a device: the prefilled ones or the ones sent (2.5). */
export interface ReviewedValues {
  conditionValueId: number | null;
  visualGrade: number | null;
  /** Attribute values in their stored form (3.4); a missing key is no value. */
  values: Readonly<Record<string, unknown>>;
}

/** Whether two stored values are the same; objects regardless of the order of their keys. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((entry, index) => sameValue(entry, b[index]))
    );
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aKeys = Object.keys(a);
  return (
    aKeys.length === Object.keys(b).length &&
    aKeys.every((key) =>
      sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

/** The value a review flag stands for. */
function valueOf({ conditionValueId, visualGrade, values }: ReviewedValues, key: string): unknown {
  if (key === 'condition') return conditionValueId;
  if (key === 'visualGrade') return visualGrade;
  return values[key] ?? null;
}

/**
 * Remaining review flags (CU-118, REQ-013; Technical Specification 2.5): the flags less the
 * confirmed keys less the keys whose value differs from the reviewed one. Only an explicit
 * confirmation or a change lifts a flag (AC-REQ-013-02). For `POST /api/devices` `reviewKeys` and
 * `before` are the prefill, for `PATCH` (#190) the stored flags and values.
 */
export function remainingReviewKeys(
  reviewKeys: readonly ReviewKey[],
  confirmedKeys: readonly string[],
  before: ReviewedValues,
  after: ReviewedValues,
): ReviewKey[] {
  const confirmed = new Set(confirmedKeys);
  return reviewKeys.filter(
    (key) => !confirmed.has(key) && sameValue(valueOf(before, key), valueOf(after, key)),
  );
}

/** Capture status (AC-REQ-013-04): `checked` without a remaining flag, else `review_pending`. */
export const captureStatusOf = (reviewKeys: readonly string[]) =>
  reviewKeys.length === 0 ? ('checked' as const) : ('review_pending' as const);
