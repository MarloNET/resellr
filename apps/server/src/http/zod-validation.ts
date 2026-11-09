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

/** A request that does not have the shape of its schema; `reason` holds codes and paths only. */
export interface BadRequest {
  badRequest: string;
}

/**
 * Turns a failed schema check into its rejection (Technical Specification 2.0.5, Nachtrag MAR-240):
 * - `bad_request` if it is not the body (a), if the body has a structural error (c), or if an
 *   error has no field path (d): a program error of the user interface;
 * - otherwise `ValidationError` with the first message per field path.
 * Returns null for any other error.
 */
export function schemaErrorToDomainError(error: unknown): ValidationError | BadRequest | null {
  if (!hasZodFastifySchemaValidationErrors(error)) return null;

  const issues = error.validation.map((issue) => ({
    issue,
    path: issue.instancePath.split('/').filter(Boolean).join('.'),
  }));
  const isStructural = ({ issue, path }: (typeof issues)[number]) =>
    STRUCTURE_CODES.has(issue.keyword) || path === '';
  if (error.validationContext !== 'body' || issues.some(isStructural)) {
    const found = issues.map(({ issue, path }) => `${issue.keyword} at ${path || '(root)'}`);
    return { badRequest: `${error.validationContext}: ${found.join(', ')}` };
  }

  const fields: FieldError[] = [];
  for (const { issue, path } of issues) {
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
