import type { FieldError } from '@resellr/domain/errors/error-response';
import type { FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { ValidationError } from '../shared/domain-error.ts';

/** Zod codes for a request that does not have the shape of the schema: type, missing or unknown field. */
const STRUCTURE_CODES = new Set([
  'invalid_type',
  'unrecognized_keys',
  'invalid_union',
  'invalid_key',
  'invalid_element',
]);

/** Lets routes declare Zod schemas for body, parameters and query (CU-026, Baseline 9.2). */
export function registerZodValidation(app: FastifyInstance): void {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
}

/**
 * Turns a failed schema check into its rejection (Technical Specification 2.0.5):
 * - `bad_request` if it is not the body, or if the body does not have the shape of the schema
 *   (a program error of the user interface);
 * - otherwise `ValidationError` with the first message per field path.
 * Returns null for any other error.
 */
export function schemaErrorToDomainError(error: unknown): ValidationError | 'bad_request' | null {
  if (!hasZodFastifySchemaValidationErrors(error)) return null;
  if (error.validationContext !== 'body') return 'bad_request';

  const fields: FieldError[] = [];
  for (const issue of error.validation) {
    if (STRUCTURE_CODES.has(issue.keyword)) return 'bad_request';
    const path = issue.instancePath.split('/').filter(Boolean).join('.');
    if (path === '') return 'bad_request';
    if (fields.some((field) => field.path === path)) continue;
    const refinementCode = (issue.params as { params?: { code?: unknown } }).params?.code;
    fields.push({
      path,
      code: typeof refinementCode === 'string' ? refinementCode : issue.keyword,
      message: issue.message ?? issue.keyword,
    });
  }
  return new ValidationError(fields);
}
