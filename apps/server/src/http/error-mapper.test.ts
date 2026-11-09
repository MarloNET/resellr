import { errorResponseSchema } from '@resellr/domain/errors/error-response';
import { MESSAGES } from '@resellr/domain/messages/messages.de';
import { isReferenceNumber } from '@resellr/runtime-shared/reference-number';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import {
  ConfirmationRequired,
  ConflictError,
  NotFoundError,
  RuleViolation,
  ShuttingDownError,
  ValidationError,
} from '../shared/domain-error.ts';
import { catalogMessage } from './error-mapper.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let committed: boolean;

/** Stand-in for the unit of work (#111): commits only if the action returns. */
const inTransaction = async <T>(action: () => Promise<T>): Promise<T> => {
  const result = await action();
  committed = true;
  return result;
};

beforeEach(async () => {
  t = createTestApp();
  committed = false;
  t.app.post('/api/test/devices', async () =>
    inTransaction(async () => {
      throw new Error('SQLITE_FULL: database or disk is full');
    }),
  );
  t.app.get('/api/test/devices/:id', async () => {
    throw new TypeError("Cannot read properties of undefined (reading 'wiNr')");
  });
  t.app.get('/api/test/throw-value', async () => {
    throw { wiNr: '626198' };
  });
  t.app.get('/api/test/not-found', async () => {
    throw new NotFoundError();
  });
  t.app.post('/api/test/validation', async () => {
    throw new ValidationError([
      {
        path: 'wiNr',
        code: 'wi_nr_format',
        message: 'WI-Nr darf nur Buchstaben und Ziffern enthalten (1–20 Zeichen)',
      },
    ]);
  });
  t.app.post('/api/test/conflict', async () => {
    throw new ConflictError('version_conflict');
  });
  t.app.post('/api/test/confirm', async () => {
    throw new ConfirmationRequired('possible_duplicate');
  });
  t.app.post('/api/test/rule', async () => {
    throw new RuleViolation('confirmation_required', { details: { a: 1 } });
  });
  t.app.post('/api/test/stopping', async () => {
    throw new ShuttingDownError();
  });
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const parse = (body: string) => errorResponseSchema.parse(JSON.parse(body)).error;

describe('technical errors (E10)', () => {
  it('a technical error in a write answers 500 internal_error with reference number and no commit', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/devices',
      headers: SAME_ORIGIN_WRITE,
      payload: { wiNr: '626198' },
    });

    expect(response.statusCode).toBe(500);
    const error = parse(response.body);
    expect(error).toMatchObject({ code: 'internal_error', fields: [], details: {} });
    expect(error.message).toBe('');
    expect(isReferenceNumber(error.referenceNumber)).toBe(true);
    expect(committed).toBe(false);
  });

  it('writes one entry with the same reference number and without field values', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/devices?search=geheim',
      headers: SAME_ORIGIN_WRITE,
      payload: { wiNr: '626198' },
    });

    const { referenceNumber } = parse(response.body);
    const entries = t.readErrorLog();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 'error',
      refNo: referenceNumber,
      function: 'http POST /api/test/devices',
      message: 'Error: SQLITE_FULL: database or disk is full',
      appVersion: '0.1.0-test',
    });
    expect(entries[0]?.stack).toEqual(expect.stringContaining('SQLITE_FULL'));
    expect(JSON.stringify(entries)).not.toContain('626198');
    expect(JSON.stringify(entries)).not.toContain('geheim');
  });

  it('logs the route pattern, not the requested path', async () => {
    await t.app.inject({ method: 'GET', url: '/api/test/devices/626198', headers: { host: HOST } });

    const [entry] = t.readErrorLog();
    expect(entry?.function).toBe('http GET /api/test/devices/:id');
  });

  it('a thrown value that is not an Error is logged by its type only', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/test/throw-value',
      headers: { host: HOST },
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(t.readErrorLog())).not.toContain('626198');
  });

  it('the response shows no stack, error name or internal text (REQ-073)', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/test/devices/1',
      headers: { host: HOST },
    });

    expect(response.body).not.toMatch(/TypeError|wiNr|at |\.ts/);
  });

  it('each technical error gets its own reference number', async () => {
    const first = await t.app.inject({
      method: 'GET',
      url: '/api/test/devices/1',
      headers: { host: HOST },
    });
    const second = await t.app.inject({
      method: 'GET',
      url: '/api/test/devices/1',
      headers: { host: HOST },
    });

    expect(parse(first.body).referenceNumber).not.toBe(parse(second.body).referenceNumber);
    expect(t.readErrorLog().map((entry) => entry.refNo)).toEqual([
      parse(first.body).referenceNumber,
      parse(second.body).referenceNumber,
    ]);
  });
});

describe('domain errors are mapped to the error format (2.0.5)', () => {
  it.each([
    ['NotFoundError', 'GET', '/api/test/not-found', 404, 'not_found', MESSAGES['M-15']],
    ['ConflictError', 'POST', '/api/test/conflict', 409, 'version_conflict', ''],
    ['ConfirmationRequired', 'POST', '/api/test/confirm', 422, 'confirmation_required', ''],
    [
      'RuleViolation without catalog text',
      'POST',
      '/api/test/rule',
      422,
      'confirmation_required',
      '',
    ],
    ['ShuttingDownError', 'POST', '/api/test/stopping', 503, 'shutting_down', ''],
  ] as const)('%s', async (_case, method, url, status, code, message) => {
    const response = await t.app.inject({
      method,
      url,
      headers: method === 'GET' ? { host: HOST } : SAME_ORIGIN_WRITE,
      payload: method === 'GET' ? undefined : {},
    });

    expect(response.statusCode).toBe(status);
    expect(parse(response.body)).toMatchObject({ code, message, referenceNumber: null });
    expect(t.readErrorLog()).toEqual([]);
  });

  it('ValidationError answers 422 with fields and an empty message (K-07)', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/validation',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });

    expect(response.statusCode).toBe(422);
    expect(parse(response.body)).toEqual({
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
    });
  });

  it('ConfirmationRequired names the question in details.kind', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/confirm',
      headers: SAME_ORIGIN_WRITE,
      payload: {},
    });

    expect(parse(response.body).details).toEqual({ kind: 'possible_duplicate' });
  });
});

describe('catalog text (FIND-209)', () => {
  it('picks the text of <code>.<usage> from the message catalog', () => {
    expect(catalogMessage('not_found')).toBe(MESSAGES['M-15']);
    expect(catalogMessage('not_found', 'default')).toBe(MESSAGES['M-15']);
  });

  it('is empty when the code has no default text, e.g. internal_error (MAR-239, F-1)', () => {
    expect(catalogMessage('internal_error')).toBe('');
    expect(catalogMessage('version_conflict')).toBe('');
    // @ts-expect-error A usage without catalog text is a compile error.
    expect(catalogMessage('not_found', 'device')).toBe('');
  });

  it('is always empty for validation_failed (K-07)', () => {
    expect(catalogMessage('validation_failed')).toBe('');
  });
});

describe('errors before routing (MAR-240)', () => {
  it('a malformed URL answers 400 bad_request and is logged as warning without the URL', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/%E0%A4%A',
      headers: { host: HOST },
    });

    expect(response.statusCode).toBe(400);
    expect(parse(response.body)).toMatchObject({ code: 'bad_request', referenceNumber: null });
    expect(t.readErrorLog()).toEqual([
      expect.objectContaining({
        level: 'warn',
        refNo: null,
        function: 'http GET (no route)',
        message: 'bad_request FST_ERR_BAD_URL',
      }),
    ]);
  });
});
