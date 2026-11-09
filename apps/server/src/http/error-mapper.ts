import { ERROR_CODES, type ErrorCode } from '@resellr/domain/errors/error-codes';
import type { ErrorResponse, FieldError } from '@resellr/domain/errors/error-response';
import { ERROR_MESSAGES, type ErrorMessageUsage } from '@resellr/domain/messages/messages.de';
import { createReferenceNumber } from '@resellr/runtime-shared/reference-number';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import type { ErrorLog } from '../ops/index.ts';
import { DomainError } from '../shared/domain-error.ts';
import { schemaErrorToDomainError } from './zod-validation.ts';

type MessageText = string | ((...args: string[]) => string);
const catalog: Partial<Record<string, MessageText>> = ERROR_MESSAGES;

const lookup = (code: ErrorCode, usage: string, args: readonly string[]): string => {
  if (code === 'validation_failed') return '';
  const text = catalog[`${code}.${usage}`];
  if (text === undefined) return '';
  return typeof text === 'function' ? text(...args) : text;
};

/**
 * Text of `<code>.<usage>` from the message catalog (Technical Specification 2.0.5, FIND-209),
 * `default` without a usage. Empty when the code has no `default` text (e.g. `internal_error`,
 * MAR-239 F-1), and always for `validation_failed` (K-07).
 */
export function catalogMessage<C extends ErrorCode>(
  code: C,
  usage?: ErrorMessageUsage<C>,
  args: readonly string[] = [],
): string {
  return lookup(code, usage ?? 'default', args);
}

interface ErrorParts {
  message?: string;
  fields?: FieldError[];
  details?: Record<string, unknown>;
  referenceNumber?: string | null;
}

/** Sends a rejection in the error format of Technical Specification 2.0.5. */
export function sendError(
  reply: FastifyReply,
  code: ErrorCode,
  parts: ErrorParts = {},
): FastifyReply {
  const body: ErrorResponse = {
    error: {
      code,
      message: parts.message ?? catalogMessage(code),
      fields: parts.fields ?? [],
      details: parts.details ?? {},
      referenceNumber: parts.referenceNumber ?? null,
    },
  };
  return reply.code(ERROR_CODES[code]).type('application/json; charset=utf-8').send(body);
}

const sendDomainError = (reply: FastifyReply, error: DomainError) =>
  sendError(reply, error.code, {
    message: lookup(error.code, error.usage, error.messageArgs),
    fields: 'fields' in error ? (error.fields as FieldError[]) : [],
    details: error.details,
  });

/** Status of a client error raised by Fastify or a plugin, e.g. malformed JSON; else null. */
const clientErrorStatus = (error: unknown): number | null => {
  const status = (error as Partial<FastifyError> | null)?.statusCode;
  return error instanceof Error && typeof status === 'number' && status >= 400 && status < 500
    ? status
    : null;
};

const CLIENT_ERROR_CODES: Partial<Record<number, ErrorCode>> = {
  // `@fastify/static` refuses dot files and paths outside its folder with 403.
  403: 'not_found',
  404: 'not_found',
  413: 'file_too_large',
  415: 'unsupported_media_type',
};

/**
 * Error handler of the app (CU-023): domain errors and schema errors become their rejection;
 * every other error is technical: `500 internal_error` with a new reference number that is
 * written to the error log together with the function, without field values (REQ-073).
 * The error leaves the action, so its transaction is not committed (2.0.4).
 */
export function createErrorHandler(errorLog: ErrorLog) {
  return (error: unknown, request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    if (error instanceof DomainError) return sendDomainError(reply, error);

    const schemaError = schemaErrorToDomainError(error);
    if (schemaError === 'bad_request') return sendError(reply, 'bad_request');
    if (schemaError) return sendDomainError(reply, schemaError);

    // Rejected by Fastify or a plugin, e.g. malformed JSON: not a technical error.
    const status = clientErrorStatus(error);
    if (status !== null) return sendError(reply, CLIENT_ERROR_CODES[status] ?? 'bad_request');

    const referenceNumber = createReferenceNumber();
    // The route pattern, not the requested path: the path can hold search texts or values.
    const route = request.routeOptions.url ?? 'unknown route';
    errorLog.error({ refNo: referenceNumber, function: `http ${request.method} ${route}`, error });
    return sendError(reply, 'internal_error', { referenceNumber });
  };
}
