import { describe, expect, it } from 'vitest';

import { canonicalJson, sha256Hex } from './content-hash.ts';

describe('canonicalJson (CU-152)', () => {
  it('gives the same text whatever the order of the keys, also in nested objects', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      canonicalJson({ a: { c: null, d: [2, 1] }, b: 1 }),
    );
  });

  it('sorts the keys, keeps lists in their order and has no whitespace', () => {
    expect(
      canonicalJson({ wiNrs: ['626199', '626198'], quantity: 2, batteryText: '82–90 %' }),
    ).toBe('{"batteryText":"82–90 %","quantity":2,"wiNrs":["626199","626198"]}');
  });
});

describe('sha256Hex (CU-152)', () => {
  it('is the SHA-256 in lower case hex', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
