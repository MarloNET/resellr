import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from './error-codes.ts';

// Table "HTTP / Code" from Technical Specification 2.0.5.
const GENERAL_CODES: [string, number][] = [
  ['bad_request', 400],
  ['forbidden_host', 403],
  ['forbidden_origin', 403],
  ['not_found', 404],
  ['version_conflict', 409],
  ['stale_content', 409],
  ['stale_stock', 409],
  ['file_too_large', 413],
  ['unsupported_media_type', 415],
  ['validation_failed', 422],
  ['confirmation_required', 422],
  ['shutting_down', 503],
  ['internal_error', 500],
];

describe('error codes (E7)', () => {
  it.each(GENERAL_CODES)('maps %s to HTTP %i', (code, status) => {
    expect(ERROR_CODES).toHaveProperty(code, status);
  });

  it('contains exactly the general codes of Technical Specification 2.0.5', () => {
    expect(Object.keys(ERROR_CODES).sort()).toEqual(GENERAL_CODES.map(([code]) => code).sort());
  });

  it('lists the codes alphabetically (hotspot rule, Technical Specification 4.5)', () => {
    const codes = Object.keys(ERROR_CODES);
    expect(codes).toEqual([...codes].sort());
  });
});
