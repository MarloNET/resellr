import { describe, expect, it } from 'vitest';

import { errorResponseSchema } from './error-response.ts';

const validationFailed = {
  error: {
    code: 'validation_failed',
    message: '',
    fields: [
      {
        path: 'wiNr',
        code: 'wi_nr_format',
        message: 'WI-Nr darf nur Buchstaben und Ziffern enthalten (1–20 Zeichen)',
      },
    ],
    details: {},
    referenceNumber: null,
  },
};

const internalError = {
  error: {
    code: 'internal_error',
    message: 'Technischer Fehler',
    fields: [],
    details: {},
    referenceNumber: 'R-7K2M-9QX4',
  },
};

function withError(changes: Record<string, unknown>) {
  return { error: { ...internalError.error, ...changes } };
}

function withoutErrorField(field: string) {
  const error: Record<string, unknown> = { ...internalError.error };
  delete error[field];
  return { error };
}

describe('error response schema (E2)', () => {
  it('accepts the example from Technical Specification 2.0.5', () => {
    expect(errorResponseSchema.parse(validationFailed)).toEqual(validationFailed);
  });

  it('accepts an internal error with a reference number', () => {
    expect(errorResponseSchema.parse(internalError)).toEqual(internalError);
  });

  it('accepts details with any content', () => {
    const conflict = withError({
      code: 'confirmation_required',
      details: { kind: 'possible_duplicate', matches: [{ id: 4 }] },
      referenceNumber: null,
    });
    expect(errorResponseSchema.safeParse(conflict).success).toBe(true);
  });

  it('rejects a response without code', () => {
    expect(errorResponseSchema.safeParse(withoutErrorField('code')).success).toBe(false);
  });

  it.each(['', 'unknown_code'])('rejects the code %j', (code) => {
    expect(errorResponseSchema.safeParse(withError({ code })).success).toBe(false);
  });

  it.each(['message', 'fields', 'details', 'referenceNumber'])(
    'rejects a response without %s',
    (field) => {
      expect(errorResponseSchema.safeParse(withoutErrorField(field)).success).toBe(false);
    },
  );

  it('rejects a body without the error envelope', () => {
    expect(errorResponseSchema.safeParse(internalError.error).success).toBe(false);
  });

  it.each([
    ['lower case', 'r-7k2m-9qx4'],
    ['forbidden letter O', 'R-7K2M-9QXO'],
    ['wrong grouping', 'R-7K2M9-QX4'],
    ['empty text', ''],
  ])('rejects a reference number with %s', (_, referenceNumber) => {
    expect(errorResponseSchema.safeParse(withError({ referenceNumber })).success).toBe(false);
  });

  it('accepts null as reference number', () => {
    expect(errorResponseSchema.safeParse(withError({ referenceNumber: null })).success).toBe(true);
  });

  it('rejects validation_failed with a non-empty message (K-07)', () => {
    const withSummary = {
      error: { ...validationFailed.error, message: 'Bitte die markierten Felder prüfen.' },
    };
    expect(errorResponseSchema.safeParse(withSummary).success).toBe(false);
  });

  it('rejects a field error without message', () => {
    const fieldWithoutMessage = {
      error: { ...validationFailed.error, fields: [{ path: 'wiNr', code: 'wi_nr_format' }] },
    };
    expect(errorResponseSchema.safeParse(fieldWithoutMessage).success).toBe(false);
  });
});
