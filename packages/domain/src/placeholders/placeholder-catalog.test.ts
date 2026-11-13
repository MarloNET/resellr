import { describe, expect, it } from 'vitest';

import {
  FIXED_PLACEHOLDER_NAMES,
  fixedPlaceholdersFor,
  isFixedPlaceholderName,
  isPlaceholderAllowed,
  lookUpPlaceholder,
  type PlaceholderUsage,
} from './placeholder-catalog.ts';

describe('placeholder catalog (CU-068)', () => {
  it('lists the 19 fixed names of Requirements chapter 9.7', () => {
    expect(FIXED_PLACEHOLDER_NAMES).toHaveLength(19);
  });

  it.each(FIXED_PLACEHOLDER_NAMES)('takes the fixed name %j', (name) => {
    expect(isFixedPlaceholderName(name)).toBe(true);
  });

  it.each(['hersteller', ' Hersteller ', 'STÜCKZAHL', 'zustandsbezeichnung kanal'])(
    'compares %j after trimming and without regard to case',
    (name) => {
      expect(isFixedPlaceholderName(name)).toBe(true);
    },
  );

  it.each(['Baustein:Abholung', 'baustein:', 'BAUSTEIN:Rechtliches'])(
    'takes %j, which would be read as {Baustein:Name}',
    (name) => {
      expect(isFixedPlaceholderName(name)).toBe(true);
    },
  );

  it.each(['RAM', 'Herstellerangabe', 'Bausteine', 'Zustand Kanal'])('leaves %j free', (name) => {
    expect(isFixedPlaceholderName(name)).toBe(false);
  });
});

describe('placeholder catalog: admissibility per usage (CU-068, Requirements chapter 9.7)', () => {
  const NO_ATTRIBUTES = new Set<string>();
  const allowed = (usage: PlaceholderUsage, name: string, attributes = NO_ATTRIBUTES) => {
    const entry = lookUpPlaceholder(name, attributes);
    if (entry === undefined) throw new Error(`unknown placeholder ${name}`);
    return isPlaceholderAllowed(usage, entry);
  };

  it('knows the fixed names, {Baustein:Name} and the given attribute labels, compared by toKey', () => {
    const attributes = new Set(['ram']);
    expect(lookUpPlaceholder('Hersteller', attributes)).toEqual({
      kind: 'fixed',
      name: 'Hersteller',
      group: 'model_data',
    });
    expect(lookUpPlaceholder(' wi-nr ', attributes)).toMatchObject({ name: 'WI-Nr' });
    expect(lookUpPlaceholder('Baustein:Abholung', attributes)).toEqual({ kind: 'text_block' });
    expect(lookUpPlaceholder('RAM', attributes)).toEqual({ kind: 'attribute' });
    expect(lookUpPlaceholder('Garantiezeit', attributes)).toBeUndefined();
  });

  it('keeps {Akkukapazität} a stock placeholder although an attribute has this label', () => {
    expect(lookUpPlaceholder('Akkukapazität', new Set(['akkukapazität']))).toMatchObject({
      kind: 'fixed',
      group: 'stock',
    });
  });

  it('the text block takes all placeholders but {Baustein:Name}', () => {
    for (const name of FIXED_PLACEHOLDER_NAMES) expect(allowed('text_block', name)).toBe(true);
    expect(allowed('text_block', 'RAM', new Set(['ram']))).toBe(true);
    expect(allowed('text_block', 'Baustein:Abholung')).toBe(false);
  });

  it('the description template takes all placeholders', () => {
    for (const name of FIXED_PLACEHOLDER_NAMES) {
      expect(allowed('description_template', name)).toBe(true);
    }
    expect(allowed('description_template', 'Baustein:Abholung')).toBe(true);
  });

  it.each(['title_pattern', 'condition_extra'] as const)(
    '%s takes model data and listing values without {Lieferumfang} and {Preis}',
    (usage) => {
      const taken = FIXED_PLACEHOLDER_NAMES.filter((name) => allowed(usage, name));
      expect(taken).toEqual([
        'Hersteller',
        'Modellbezeichnung',
        'Typbezeichnung',
        'Herstellernummer',
        'Geräteart',
        'Artikelnummer',
        'EAN',
        'Zustand',
        'Optik-Note',
        'Zustandsbeschreibung',
      ]);
      expect(allowed(usage, 'RAM', new Set(['ram']))).toBe(true);
      expect(allowed(usage, 'Baustein:Abholung')).toBe(false);
    },
  );

  it('lists the fixed placeholders of the text block as {Name} in the order of chapter 9.7', () => {
    expect(fixedPlaceholdersFor('text_block')).toEqual(
      FIXED_PLACEHOLDER_NAMES.map((name) => `{${name}}`),
    );
  });
});
