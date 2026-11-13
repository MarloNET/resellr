import { describe, expect, it } from 'vitest';

import { findPlaceholders, findRejectedPlaceholder } from './parse-placeholders.ts';

describe('placeholder parser (CU-069)', () => {
  it('finds every {…} in the order of the text', () => {
    expect(findPlaceholders('Akku {Akkukapazität}, Gerät {WI-Nr} und {Baustein:Abholung}')).toEqual(
      [
        { text: '{Akkukapazität}', name: 'Akkukapazität' },
        { text: '{WI-Nr}', name: 'WI-Nr' },
        { text: '{Baustein:Abholung}', name: 'Baustein:Abholung' },
      ],
    );
  });

  it('takes a single brace as plain text and the innermost pair of nested braces', () => {
    expect(findPlaceholders('a { b } c')).toEqual([{ text: '{ b }', name: ' b ' }]);
    expect(findPlaceholders('nur { offen')).toEqual([]);
    expect(findPlaceholders('{a{Preis}}')).toEqual([{ text: '{Preis}', name: 'Preis' }]);
    expect(findPlaceholders('leer {}')).toEqual([{ text: '{}', name: '' }]);
  });

  it('AC-REQ-026-02 names the unknown placeholder {Garantiezeit} of a text block', () => {
    expect(
      findRejectedPlaceholder('Garantie: {Garantiezeit} ab Kauf', 'text_block', new Set()),
    ).toEqual({ reason: 'unknown', placeholder: '{Garantiezeit}' });
  });

  it('DER-39-05 rejects {Baustein:Name} in a text block as not allowed', () => {
    expect(findRejectedPlaceholder('Siehe {Baustein:Abholung}', 'text_block', new Set())).toEqual({
      reason: 'not_allowed',
      placeholder: '{Baustein:Abholung}',
    });
  });

  it('names the first rejected placeholder of the text', () => {
    expect(
      findRejectedPlaceholder('{Baustein:A} und {Garantiezeit}', 'text_block', new Set()),
    ).toEqual({ reason: 'not_allowed', placeholder: '{Baustein:A}' });
  });

  it('accepts fixed placeholders, attribute labels and a text without placeholders', () => {
    const attributes = new Set(['ram']);
    expect(
      findRejectedPlaceholder(
        '{Hersteller} mit {RAM} GB, {Akkukapazität}',
        'text_block',
        attributes,
      ),
    ).toBeNull();
    expect(findRejectedPlaceholder('Abholung nach Absprache', 'text_block', attributes)).toBeNull();
  });
});
