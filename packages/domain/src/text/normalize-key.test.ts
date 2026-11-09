import { describe, expect, it } from 'vitest';

import { toKey, toModelNameKey } from './normalize-key.ts';

// "Käse" once precomposed (NFC) and once with a combining diaeresis (NFD).
const NFC = 'Käse';
const NFD = 'Käse';

describe('key normalization (E5)', () => {
  it('builds the same key for different Unicode normalization, case and outer spaces', () => {
    const variants = [NFC, NFD, 'KÄSE', 'KÄSE', '  käse ', '\tKäSE\n'];
    for (const variant of variants) {
      expect(toKey(variant)).toBe('käse');
    }
  });

  it('keeps inner spaces', () => {
    expect(toKey(' Text  Baustein ')).toBe('text  baustein');
  });

  it('builds the same model name key regardless of normalization, case and any spaces', () => {
    const variants = [
      'ThinkPad T14 Gen 3',
      'thinkpad t14 gen 3',
      'THINKPAD  T14GEN3',
      ' ThinkPad T14 Gen\t3 ',
    ];
    for (const variant of variants) {
      expect(toModelNameKey(variant)).toBe('thinkpadt14gen3');
    }
    expect(toModelNameKey(`Elite ${NFD}`)).toBe(toModelNameKey(`elite${NFC}`));
  });

  it('keeps different names apart', () => {
    expect(toKey('T14')).not.toBe(toKey('T15'));
    expect(toModelNameKey('T14 Gen 3')).not.toBe(toModelNameKey('T14 Gen 4'));
  });
});
