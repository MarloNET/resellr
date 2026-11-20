import { describe, expect, it } from 'vitest';

import {
  deviationLine,
  variantDeviations,
  variantDifferences,
  variantsMatch,
  type VariantSpec,
  type VariantTexts,
} from './compare-variants.ts';

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

  // Basis of the new model listing in AC-REQ-019-06 (#197): the keyboard layout is a variant attribute.
  it('reports only the keyboard layout for a device that differs from MI-A only there', () => {
    const KEYBOARD = 16;
    const miA = spec({ values: { [RAM]: 16, [OS]: 7, [KEYBOARD]: 40 } });
    const hungarian = spec({ values: { [RAM]: 16, [OS]: 7, [KEYBOARD]: 41 } });

    expect(variantDifferences(hungarian, miA, [RAM, OS, KEYBOARD])).toEqual([String(KEYBOARD)]);
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

describe('deviations with formatted values (CU-119, REQ-018, Technical Specification 2.6)', () => {
  const KEYBOARD = 16;
  const BATTERY = 20;
  const attributes = [
    { id: RAM, label: 'RAM' },
    { id: KEYBOARD, label: 'Tastaturlayout' },
  ];
  const side = (change: Partial<VariantSpec> = {}, texts: Partial<VariantTexts> = {}) => ({
    spec: spec(change),
    texts: { condition: 'Sehr gut', values: { RAM: '16GB' }, ...texts },
  });

  it('gives "Optik-Note: Gerät 4, Modell-Inserat 2" for a device that deviates only there', () => {
    const deviations = variantDeviations(side({ visualGrade: 4 }), side(), attributes);

    expect(deviations).toEqual([
      { key: 'visualGrade', label: 'Optik-Note', deviceValue: '4', listingValue: '2' },
    ]);
    expect(deviations.map(deviationLine)).toEqual(['Optik-Note: Gerät 4, Modell-Inserat 2']);
  });

  it('gives "RAM: Gerät 8GB, Modell-Inserat 16GB" with the readable values', () => {
    const device = side({ values: { [RAM]: 8 } }, { values: { RAM: '8GB' } });

    expect(variantDeviations(device, side(), attributes).map(deviationLine)).toEqual([
      'RAM: Gerät 8GB, Modell-Inserat 16GB',
    ]);
  });

  it('gives the condition by its label and both condition descriptions complete', () => {
    const device = side(
      { conditionValueId: 2, conditionDescription: 'Display- und Gehäuseschaden' },
      { condition: 'Gut' },
    );
    const listing = side({ conditionDescription: 'leichte Gebrauchsspuren' });

    expect(variantDeviations(device, listing, attributes)).toEqual([
      { key: 'condition', label: 'Zustand', deviceValue: 'Gut', listingValue: 'Sehr gut' },
      {
        key: 'conditionDescription',
        label: 'Zustandsbeschreibung',
        deviceValue: 'Display- und Gehäuseschaden',
        listingValue: 'leichte Gebrauchsspuren',
      },
    ]);
  });

  it('AC-REQ-018-03 battery capacity, OS version and case or edge spaces of the description give no deviation', () => {
    const device = side(
      {
        conditionDescription: ' Leichte Gebrauchsspuren ',
        values: { [RAM]: 16, [OS]: 14, [BATTERY]: { percent: 77 } },
      },
      { values: { RAM: '16GB', Betriebssystem: '14.6', Akkukapazität: '77 %' } },
    );
    const listing = side(
      {
        conditionDescription: 'leichte gebrauchsspuren',
        values: { [RAM]: 16, [OS]: 15, [BATTERY]: { percent: 85 } },
      },
      { values: { RAM: '16GB', Betriebssystem: '15.1', Akkukapazität: '85 %' } },
    );

    expect(variantDeviations(device, listing, attributes)).toEqual([]);
  });

  it('DER-59-01 a deactivated variant attribute without value at the device deviates from a value at the listing', () => {
    // The variant set holds active and deactivated attributes (K-03); the new device has no RAM.
    const device = side({ values: { [OS]: 7 } }, { values: {} });

    expect(variantDeviations(device, side(), attributes)).toEqual([
      { key: String(RAM), label: 'RAM', deviceValue: '–', listingValue: '16GB' },
    ]);
  });

  it('gives "–" for an empty condition description against a filled one', () => {
    const listing = side({ conditionDescription: 'Kratzer' });

    expect(variantDeviations(side(), listing, attributes)).toEqual([
      {
        key: 'conditionDescription',
        label: 'Zustandsbeschreibung',
        deviceValue: '–',
        listingValue: 'Kratzer',
      },
    ]);
  });

  it('AC-REQ-018-06 gives the deviation of the keyboard layout', () => {
    const device = side(
      { values: { [RAM]: 16, [OS]: 7, [KEYBOARD]: 41 } },
      { values: { RAM: '16GB', Tastaturlayout: 'Ungarisch' } },
    );
    const listing = side(
      { values: { [RAM]: 16, [OS]: 7, [KEYBOARD]: 40 } },
      { values: { RAM: '16GB', Tastaturlayout: 'Deutsch (QWERTZ)' } },
    );

    expect(variantDeviations(device, listing, attributes).map(deviationLine)).toEqual([
      'Tastaturlayout: Gerät Ungarisch, Modell-Inserat Deutsch (QWERTZ)',
    ]);
  });

  it('DER-59-04 compares multiple entries as a sorted list, other values do not count', () => {
    const PORTS_ATTRIBUTE = { id: PORTS, label: 'Anschlüsse' };
    const usbC = { count: 2, typeId: 41, positionId: null };
    const hdmi = { count: 1, typeId: 42, positionId: 7 };
    const withPorts = (ports: unknown[], os: number) =>
      side(
        { values: { [PORTS]: ports as VariantSpec['values'][string], [OS]: os } },
        { values: { Anschlüsse: '…' } },
      );

    expect(
      variantDeviations(withPorts([usbC, hdmi], 14), withPorts([hdmi, usbC], 15), [
        PORTS_ATTRIBUTE,
      ]),
    ).toEqual([]);
    expect(
      variantDeviations(withPorts([usbC], 14), withPorts([hdmi, usbC], 14), [PORTS_ATTRIBUTE]),
    ).toHaveLength(1);
  });
});
