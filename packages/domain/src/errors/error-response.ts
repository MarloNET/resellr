import { z } from 'zod';

import { ERROR_CODES, type ErrorCode } from './error-codes.ts';

// Same check pattern as `packages/runtime-shared/src/reference-number.ts` (Technical
// Specification 2.0.5, H-11); `packages/domain` must not import runtime-shared (4.1).
const REFERENCE_NUMBER_PATTERN = /^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

const errorCodes = Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]];

export const fieldErrorSchema = z.object({
  path: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;

/** Format of every rejection (Technical Specification 2.0.5). */
export const errorResponseSchema = z.object({
  error: z
    .object({
      code: z.enum(errorCodes),
      message: z.string(),
      fields: z.array(fieldErrorSchema),
      details: z.record(z.string(), z.unknown()),
      referenceNumber: z.string().regex(REFERENCE_NUMBER_PATTERN).nullable(),
    })
    // No collective text for field errors: the fields carry the messages (K-07).
    .refine((error) => error.code !== 'validation_failed' || error.message === '', {
      path: ['message'],
      message: 'message must be empty for validation_failed',
    }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
