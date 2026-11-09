import { errorResponseSchema } from '@resellr/domain/errors/error-response';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let handled: unknown;

const deviceSchema = z.object({
  wiNr: z
    .string()
    .min(1, 'WI-Nr: 1 bis 20 Zeichen')
    .max(20, 'WI-Nr: 1 bis 20 Zeichen')
    .regex(/^[A-Za-z0-9]*$/, 'WI-Nr darf nur Buchstaben und Ziffern enthalten'),
  note: z.string().max(5, 'Notiz: höchstens 5 Zeichen'),
  serial: z.string().superRefine((value, ctx) => {
    if (value.startsWith('-')) {
      ctx.addIssue({
        code: 'custom',
        message: 'Seriennummer ungültig',
        params: { code: 'serial_format' },
      });
    }
  }),
});

beforeEach(async () => {
  t = createTestApp();
  handled = undefined;
  t.app.post('/api/test/devices', { schema: { body: deviceSchema } }, async (request) => {
    handled = request.body;
    return { ok: true };
  });
  t.app.get(
    '/api/test/devices/:id',
    { schema: { params: z.object({ id: z.coerce.number().int().positive() }) } },
    async (request) => request.params,
  );
  t.app.get(
    '/api/test/devices',
    { schema: { querystring: z.object({ limit: z.coerce.number().int().max(200).default(50) }) } },
    async (request) => request.query,
  );
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const post = (payload: unknown) =>
  t.app.inject({
    method: 'POST',
    url: '/api/test/devices',
    headers: SAME_ORIGIN_WRITE,
    payload: payload as object,
  });
const parse = (body: string) => errorResponseSchema.parse(JSON.parse(body)).error;

describe('Zod schemas as request validation (E13)', () => {
  it('passes a matching body to the handler', async () => {
    const response = await post({ wiNr: '626198', note: '', serial: 'A1' });

    expect(response.statusCode).toBe(200);
    expect(handled).toEqual({ wiNr: '626198', note: '', serial: 'A1' });
  });

  it('a field rule violation answers 422 validation_failed with fields', async () => {
    const response = await post({ wiNr: '62-61', note: 'zu lang', serial: 'A1' });

    expect(response.statusCode).toBe(422);
    expect(parse(response.body)).toEqual({
      code: 'validation_failed',
      message: '',
      fields: [
        {
          path: 'wiNr',
          code: 'invalid_format',
          message: 'WI-Nr darf nur Buchstaben und Ziffern enthalten',
        },
        { path: 'note', code: 'too_big', message: 'Notiz: höchstens 5 Zeichen' },
      ],
      details: {},
      referenceNumber: null,
    });
    expect(handled).toBeUndefined();
  });

  it('keeps only the first message per path (2.0.5, v0.5.2)', async () => {
    const response = await post({ wiNr: 'x'.repeat(21) + '-', note: '', serial: 'A1' });

    expect(parse(response.body).fields).toEqual([
      { path: 'wiNr', code: 'too_big', message: 'WI-Nr: 1 bis 20 Zeichen' },
    ]);
  });

  it('takes the field code of a refinement from params.code', async () => {
    const response = await post({ wiNr: '1', note: '', serial: '-1' });

    expect(parse(response.body).fields).toEqual([
      { path: 'serial', code: 'serial_format', message: 'Seriennummer ungültig' },
    ]);
  });

  it.each([
    ['a missing field', { wiNr: '1', note: '' }],
    ['a field of the wrong type', { wiNr: 1, note: '', serial: 'A1' }],
    ['an array instead of an object', []],
  ])('%s answers 400 bad_request without fields', async (_case, payload) => {
    const response = await post(payload);

    expect(response.statusCode).toBe(400);
    expect(parse(response.body)).toEqual({
      code: 'bad_request',
      message: '',
      fields: [],
      details: {},
      referenceNumber: null,
    });
    expect(handled).toBeUndefined();
  });

  it('a structural error wins over field rule violations in the same body', async () => {
    const response = await post({ wiNr: '62-61', note: 'zu lang' });

    expect(response.statusCode).toBe(400);
    expect(parse(response.body).code).toBe('bad_request');
  });

  it.each([
    ['path parameter', '/api/test/devices/abc'],
    ['query parameter', '/api/test/devices?limit=500'],
  ])('an invalid %s answers 400 bad_request', async (_case, url) => {
    const response = await t.app.inject({ method: 'GET', url, headers: { host: HOST } });

    expect(response.statusCode).toBe(400);
    expect(parse(response.body).code).toBe('bad_request');
  });

  it('passes coerced parameters to the handler', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: '/api/test/devices/7',
      headers: { host: HOST },
    });

    expect(JSON.parse(response.body)).toEqual({ id: 7 });
  });

  it.each([
    ['malformed JSON', '{"wiNr":'],
    ['an empty JSON body', ''],
  ])('%s answers 400 bad_request', async (_case, payload) => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/test/devices',
      headers: SAME_ORIGIN_WRITE,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(parse(response.body).code).toBe('bad_request');
    expect(t.readErrorLog()).toEqual([]);
  });
});
