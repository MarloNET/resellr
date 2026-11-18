/**
 * Error codes with their HTTP status (Technical Specification 2.0.5). S1 holds the general
 * codes; each feature task adds the domain codes of 2.0.6 it raises, in alphabetical order
 * (hotspot rule, Technical Specification 4.5).
 */
export const ERROR_CODES = {
  already_assigned: 422,
  article_number_taken: 422,
  attribute_has_values: 422,
  bad_request: 400,
  confirmation_required: 422,
  device_not_available: 422,
  device_type_deactivated: 422,
  file_too_large: 413,
  forbidden_host: 403,
  forbidden_origin: 403,
  internal_error: 500,
  manufacturer_deactivated: 422,
  method_not_allowed: 405,
  name_taken: 422,
  not_found: 404,
  other_model_template: 422,
  pick_list_value_deactivated: 422,
  placeholder_not_allowed: 422,
  shutting_down: 503,
  stale_content: 409,
  stale_stock: 409,
  supplier_deactivated: 422,
  unsupported_media_type: 415,
  validation_failed: 422,
  variant_duplicate: 422,
  variant_flag_would_merge_listings: 422,
  version_conflict: 409,
  wi_nr_taken: 422,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_CODES;
