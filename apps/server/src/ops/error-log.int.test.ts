import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

/** Field values and request content a failing request carries; none may reach the log. */
const VALUES = {
  wiNr: '626198',
  note: 'Kratzer am Deckel',
  search: 'MacBook-Suche',
  pathId: '4711',
  cookie: 'session-Abc123',
  userAgent: 'Testbrowser/9.9',
};
const VALUE_PATTERN = new RegExp(Object.values(VALUES).join('|'));

const FIELDS_OF_2_19 = [
  'appVersion',
  'function',
  'level',
  'message',
  'refNo',
  'stack',
  'startId',
  'ts',
];

beforeEach(async () => {
  t = createTestApp();
  t.app.post('/api/test/devices/:id', async () => {
    throw new Error('SQLITE_FULL: database or disk is full');
  });
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const failingWrite = (payload: string | Record<string, unknown>) =>
  t.app.inject({
    method: 'POST',
    url: `/api/test/devices/${VALUES.pathId}?search=${VALUES.search}`,
    headers: {
      ...SAME_ORIGIN_WRITE,
      cookie: `sid=${VALUES.cookie}`,
      'user-agent': VALUES.userAgent,
    },
    payload,
  });

describe('error log without field values and request content (CU-036, REQ-069)', () => {
  it('REQ-069 a technical error is logged without field values, path, query or headers', async () => {
    const response = await failingWrite({ wiNr: VALUES.wiNr, note: VALUES.note });

    expect(response.statusCode).toBe(500);
    const entries = t.readErrorLog();
    expect(entries).toEqual([
      expect.objectContaining({ level: 'error', function: 'http POST /api/test/devices/:id' }),
    ]);
    expect(entries.map((entry) => Object.keys(entry).sort())).toEqual([FIELDS_OF_2_19]);
    expect(JSON.stringify(entries)).not.toMatch(VALUE_PATTERN);
  });

  it('REQ-069 a rejected malformed request is logged without its content', async () => {
    const response = await failingWrite(`{"wiNr":"${VALUES.wiNr}","note":"${VALUES.note}"`);

    expect(response.statusCode).toBe(400);
    const entries = t.readErrorLog();
    expect(entries).toEqual([expect.objectContaining({ level: 'warn' })]);
    expect(entries.map((entry) => Object.keys(entry).sort())).toEqual([FIELDS_OF_2_19]);
    expect(JSON.stringify(entries)).not.toMatch(VALUE_PATTERN);
  });

  it('REQ-069 a request from another host is logged without its content', async () => {
    const response = await t.app.inject({
      method: 'GET',
      url: `/api/test/devices/${VALUES.pathId}?search=${VALUES.search}`,
      headers: { host: 'resellr.example', cookie: `sid=${VALUES.cookie}` },
    });

    expect(response.statusCode).toBe(403);
    const entries = t.readErrorLog();
    expect(entries).toEqual([
      expect.objectContaining({ level: 'warn', function: 'http.local-guard' }),
    ]);
    expect(entries.map((entry) => Object.keys(entry).sort())).toEqual([FIELDS_OF_2_19]);
    expect(JSON.stringify(entries)).not.toMatch(VALUE_PATTERN);
  });
});
