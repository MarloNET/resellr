import { describe, expect, it } from 'vitest';

import { variantDifferences, variantsMatch, type VariantSpec } from './compare-variants.ts';

const RAM = 12;
const OS = 14;
const PORTS = 30;

const spec = (change: Partial<VariantSpec> = {}): VariantSpec => ({
  conditionValueId: 1,
  visualGrade: 2,
  conditionDescription: '',
  values: { [RAM]: 16, [OS]: 7 },
  ...change,
});

describe('comparison rule of variant data (CU-119, Requirements 6.0)', () => {
  it('reports no difference for equal variant data', () => {
    expect(variantDifferences(spec(), spec(), [RAM, OS])).toEqual([]);
    expect(variantsMatch(spec(), spec(), [RAM, OS])).toBe(true);
  });

  it('compares condition, visual grade and the value of each variant attribute', () => {
    const other = spec({
      conditionValueId: 2,
      visualGrade: 4,
      values: { [RAM]: 8, [OS]: 7 },
    });

    expect(variantDifferences(spec(), other, [RAM, OS])).toEqual([
      'condition',
      'visualGrade',
      String(RAM),
    ]);
    expect(variantsMatch(spec(), other, [RAM, OS])).toBe(false);
  });

  it('compares only the attributes of the given variant set', () => {
    const other = spec({ values: { [RAM]: 8, [OS]: 7 } });

    expect(variantDifferences(spec(), other, [OS])).toEqual([]);
    expect(variantsMatch(spec(), other, [OS])).toBe(true);
  });

  it('compares the condition description after trim and lower case, two empty ones are equal', () => {
    const described = (conditionDescription: string) => spec({ conditionDescription });

    expect(
      variantsMatch(described(' Kratzer am Deckel '), described('kratzer am deckel'), []),
    ).toBe(true);
    expect(variantsMatch(described(''), described('   '), [])).toBe(true);
    expect(variantDifferences(described(''), described('Kratzer'), [])).toEqual([
      'conditionDescription',
    ]);
  });

  it('treats a missing value as equal only to a missing value', () => {
    const withoutRam = spec({ values: { [OS]: 7 } });

    expect(variantsMatch(withoutRam, withoutRam, [RAM, OS])).toBe(true);
    expect(variantDifferences(withoutRam, spec(), [RAM, OS])).toEqual([String(RAM)]);
  });

  it('compares multiple entries (ports) as a sorted list', () => {
    const usbC = { count: 2, typeId: 41, positionId: null };
    const hdmi = { count: 1, typeId: 42, positionId: 7 };
    const withPorts = (ports: unknown[]) =>
      spec({ values: { [PORTS]: ports as VariantSpec['values'][string] } });

    expect(variantsMatch(withPorts([usbC, hdmi]), withPorts([hdmi, usbC]), [PORTS])).toBe(true);
    expect(variantsMatch(withPorts([usbC]), withPorts([{ ...usbC, count: 1 }]), [PORTS])).toBe(
      false,
    );
  });
});
