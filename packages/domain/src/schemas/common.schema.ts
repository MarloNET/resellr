import { z } from 'zod';

// Basic schemas of the JSON API (Technical Specification 2.0.1, 2.0.3).

/** Integer key (SQLite `INTEGER PRIMARY KEY`). */
export const idSchema = z.int().positive();
export type Id = z.infer<typeof idSchema>;

/** Version of an editable entity, starts at 1. */
export const versionSchema = z.int().min(1);
export type Version = z.infer<typeof versionSchema>;

/** Calendar date `YYYY-MM-DD`. */
export const dateSchema = z.iso.date();
export type CalendarDate = z.infer<typeof dateSchema>;

/** Timestamp in ISO 8601, UTC with milliseconds, e.g. `2026-11-07T16:05:12.345Z`. */
export const timestampSchema = z.iso.datetime({ precision: 3 });
export type Timestamp = z.infer<typeof timestampSchema>;

/** Money as whole cents (`…Cents`). */
export const centsSchema = z.int();
export type Cents = z.infer<typeof centsSchema>;

/** Counts of REQ-053 (2.8.4); `{0, 0, 0}` while there is no channel content (4.4.0). */
export const impactSchema = z.object({
  updated: z.int().nonnegative(),
  rerelease: z.int().nonnegative(),
  manualReview: z.int().nonnegative(),
});

/** List response `{ items, total }`. */
export function listResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({ items: z.array(itemSchema), total: z.int().nonnegative() });
}

export type ListResponse<T> = { items: T[]; total: number };
