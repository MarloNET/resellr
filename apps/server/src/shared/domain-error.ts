import type { ErrorCode } from '@resellr/domain/errors/error-codes';
import type { FieldError } from '@resellr/domain/errors/error-response';
import type { ErrorMessageUsage } from '@resellr/domain/messages/messages.de';

export interface DomainErrorOptions<C extends ErrorCode> {
  /**
   * Usage of the code, selects the text `<code>.<usage>` in the message catalog (FIND-209);
   * only usages the catalog has. Without it `default` applies.
   */
  usage?: ErrorMessageUsage<C>;
  details?: Record<string, unknown>;
  /** Arguments of a catalog text with placeholders, e.g. the WI-Nr in `wi_nr_taken`. */
  messageArgs?: string[];
}

/** The options of any code, checked by the constructor of the subclass. */
type AnyDomainErrorOptions = Omit<DomainErrorOptions<ErrorCode>, 'usage'> & { usage?: string };

/**
 * Expected rejection of a request. `error-mapper` turns it into the error format of
 * Technical Specification 2.0.5; it is never written to the error log.
 */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;
  readonly usage: string;
  readonly details: Record<string, unknown>;
  readonly messageArgs: string[];

  constructor({ usage = 'default', details = {}, messageArgs = [] }: AnyDomainErrorOptions = {}) {
    super();
    this.name = new.target.name;
    this.usage = usage;
    this.details = details;
    this.messageArgs = messageArgs;
  }
}

/** Field rules violated: `422 validation_failed` with one entry per field (2.0.5). */
export class ValidationError extends DomainError {
  override readonly code = 'validation_failed';
  readonly fields: FieldError[];

  constructor(fields: FieldError[], options?: DomainErrorOptions<'validation_failed'>) {
    super(options);
    this.fields = fields;
  }
}

/**
 * A structural error a service only finds against the stored state, e.g. a flag the user
 * interface does not offer for this attribute (2.0.5 rule (4), 2.1): `400 bad_request`, logged
 * as a warning like a structural error of the schema. `reason` holds field names and rule
 * codes only, never values.
 */
export class BadRequestError extends DomainError {
  override readonly code = 'bad_request';
  readonly reason: string;

  constructor(reason: string) {
    super();
    this.reason = reason;
  }
}

/** Domain rule violated, e.g. `wi_nr_taken` (2.0.6). */
export class RuleViolation<C extends ErrorCode = ErrorCode> extends DomainError {
  override readonly code: C;

  constructor(code: C, options?: DomainErrorOptions<C>) {
    super(options);
    this.code = code;
  }
}

export type ConflictCode = 'version_conflict' | 'stale_content' | 'stale_stock';

/** Version or content hash differs from the stored state (2.0.3). */
export class ConflictError<C extends ConflictCode = ConflictCode> extends DomainError {
  override readonly code: C;

  constructor(code: C, options?: DomainErrorOptions<C>) {
    super(options);
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  override readonly code = 'not_found';

  constructor(options?: DomainErrorOptions<'not_found'>) {
    super(options);
  }
}

/** A question to the user is needed first; `details.kind` names it (2.0.5). */
export class ConfirmationRequired extends DomainError {
  override readonly code = 'confirmation_required';

  constructor(kind: string, options: DomainErrorOptions<'confirmation_required'> = {}) {
    super({ ...options, details: { kind, ...options.details } });
  }
}

/** resellr is shutting down and accepts no new writes (2.0.4, P-07). */
export class ShuttingDownError extends DomainError {
  override readonly code = 'shutting_down';

  constructor(options?: DomainErrorOptions<'shutting_down'>) {
    super(options);
  }
}
