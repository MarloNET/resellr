import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from './error-codes.ts';

// Table "HTTP / Code" from Technical Specification 2.0.5, plus 405 for OPTIONS (G-6, 2.0.2).
const GENERAL_CODES: [string, number][] = [
  ['bad_request', 400],
  ['forbidden_host', 403],
  ['forbidden_origin', 403],
  ['not_found', 404],
  ['method_not_allowed', 405],
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

// Domain codes of 2.0.6, added by the feature tasks that raise them.
const DOMAIN_CODES: [string, number][] = [
  ['already_assigned', 422],
  ['article_number_taken', 422],
  ['attribute_has_values', 422],
  ['device_not_assigned', 422],
  ['device_not_available', 422],
  ['device_type_deactivated', 422],
  ['device_type_in_use', 422],
  ['name_taken', 422],
  ['manufacturer_deactivated', 422],
  ['other_model_template', 422],
  ['pick_list_value_deactivated', 422],
  ['placeholder_not_allowed', 422],
  ['supplier_deactivated', 422],
  ['variant_duplicate', 422],
  ['variant_flag_would_merge_listings', 422],
  ['wi_nr_taken', 422],
];

describe('error codes (E7)', () => {
  it.each(GENERAL_CODES)('maps %s to HTTP %i', (code, status) => {
    expect(ERROR_CODES).toHaveProperty(code, status);
  });

  it.each(DOMAIN_CODES)('maps the domain code %s to HTTP %i (2.0.6)', (code, status) => {
    expect(ERROR_CODES).toHaveProperty(code, status);
  });

  it('contains exactly the general and the domain codes', () => {
    expect(Object.keys(ERROR_CODES).sort()).toEqual(
      [...GENERAL_CODES, ...DOMAIN_CODES].map(([code]) => code).sort(),
    );
  });

  it('lists the codes alphabetically (hotspot rule, Technical Specification 4.5)', () => {
    const codes = Object.keys(ERROR_CODES);
    expect(codes).toEqual([...codes].sort());
  });
});
