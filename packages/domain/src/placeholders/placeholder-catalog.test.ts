import { describe, expect, it } from 'vitest';

import { FIXED_PLACEHOLDER_NAMES, isFixedPlaceholderName } from './placeholder-catalog.ts';

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
