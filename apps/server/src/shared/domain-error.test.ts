import { describe, expect, it } from 'vitest';

import {
  ConfirmationRequired,
  ConflictError,
  DomainError,
  NotFoundError,
  RuleViolation,
  ShuttingDownError,
  ValidationError,
} from './domain-error.ts';

describe('domain errors (CU-033)', () => {
  it('maps every class to its error code', () => {
    const errors: [DomainError, string][] = [
      [
        new ValidationError([{ path: 'wiNr', code: 'wi_nr_format', message: 'x' }]),
        'validation_failed',
      ],
      [new RuleViolation('confirmation_required'), 'confirmation_required'],
      [new ConflictError('stale_stock'), 'stale_stock'],
      [new NotFoundError(), 'not_found'],
      [new ConfirmationRequired('possible_duplicate'), 'confirmation_required'],
      [new ShuttingDownError(), 'shutting_down'],
    ];

    for (const [error, code] of errors) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(code);
    }
  });

  it('uses the usage "default" unless the service sets one (FIND-209)', () => {
    expect(new NotFoundError().usage).toBe('default');
    expect(new RuleViolation('not_found', { usage: 'default' }).usage).toBe('default');
  });

  it('accepts only usages that have a text in the message catalog (MAR-239, F-1)', () => {
    // @ts-expect-error `not_found` has no text for the usage `device`.
    expect(new NotFoundError({ usage: 'device' }).usage).toBe('device');
    // @ts-expect-error The catalog has no text for `internal_error` in S1.
    expect(new RuleViolation('internal_error', { usage: 'default' }).usage).toBe('default');
  });

  it('carries fields, details and message arguments', () => {
    const fields = [{ path: 'name', code: 'too_big', message: 'Name: 1 bis 100 Zeichen' }];
    const validation = new ValidationError(fields);
    const rule = new RuleViolation('confirmation_required', {
      details: { listingId: 9 },
      messageArgs: ['626198'],
    });

    expect(validation.fields).toEqual(fields);
    expect(validation.details).toEqual({});
    expect(rule.details).toEqual({ listingId: 9 });
    expect(rule.messageArgs).toEqual(['626198']);
  });

  it('puts the kind of question into details.kind', () => {
    const error = new ConfirmationRequired('variant_deviation', { details: { deviations: [] } });

    expect(error.details).toEqual({ kind: 'variant_deviation', deviations: [] });
  });
});
