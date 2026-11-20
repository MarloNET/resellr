import { describe, expect, it } from 'vitest';

import {
  buildDevicePrefill,
  type ConditionCodeTranslation,
  type DevicePrefillInput,
  type PrefillAttribute,
  prefillPickListValueIds,
} from './device-prefill.ts';

const PROCESSOR = 3;
const KEYBOARD = 10;
const BATTERY = 11;
const CAPACITY = 12;
const RAM = 13;
const PORTS = 14;
const NOTE = 15;

const attribute = (
  id: number,
  dataType: PrefillAttribute['dataType'],
  change: Partial<PrefillAttribute> = {},
): PrefillAttribute => ({
  id,
  dataType,
  systemRole: null,
  level: 'device',
  active: true,
  ...change,
});

const ATTRIBUTES: PrefillAttribute[] = [
  attribute(PROCESSOR, 'text', { level: 'model' }),
  attribute(KEYBOARD, 'pick', { systemRole: 'keyboard_layout' }),
  attribute(BATTERY, 'pick', { systemRole: 'battery' }),
  attribute(CAPACITY, 'integer', { systemRole: 'battery_capacity' }),
  attribute(RAM, 'integer'),
  attribute(PORTS, 'ports'),
  attribute(NOTE, 'text'),
];

// Values of the lists keyboard layout, battery, port type, port position and condition.
const HUNGARIAN = 101;
const WITH_BATTERY = 201;
const USB_C = 301;
const HDMI = 302;
const LEFT = 401;
const REFURBISHED = 501;

/** MV-A of AC-REQ-013-01 with further defaults of the level device. */
const DEFAULTS = {
  [KEYBOARD]: HUNGARIAN,
  [BATTERY]: WITH_BATTERY,
  [CAPACITY]: { percent: 85 },
  [PORTS]: [
    { count: 2, typeId: USB_C, positionId: LEFT },
    { count: 1, typeId: HDMI, positionId: null },
  ],
};

const DGS: ConditionCodeTranslation = {
  plainText: 'Gebrauchsspuren',
  suggestedConditionValueId: REFURBISHED,
  suggestedVisualGrade: 3,
};

const input = (change: Partial<DevicePrefillInput> = {}): DevicePrefillInput => ({
  defaultDeviceValues: DEFAULTS,
  attributes: ATTRIBUTES,
  code: null,
  deactivatedValueIds: [],
  ...change,
});

describe('prefill of a device (CU-117, REQ-013; Technical Specification 2.5)', () => {
  it('prefills every attribute of the level device with a default and flags it for review', () => {
    const prefill = buildDevicePrefill(input());

    expect(prefill.values).toEqual(DEFAULTS);
    expect(prefill.reviewKeys).toEqual([
      String(KEYBOARD),
      String(BATTERY),
      String(CAPACITY),
      String(PORTS),
    ]);
    expect(prefill).toMatchObject({
      conditionValueId: null,
      visualGrade: null,
      conditionDescription: '',
      codeResult: { found: false, plainText: null },
    });
  });

  it('takes no value of the level model and no review key for it', () => {
    const prefill = buildDevicePrefill(
      input({ defaultDeviceValues: { [PROCESSOR]: 'i5-1135G7', [RAM]: 16 } }),
    );

    expect(prefill.values).toEqual({ [RAM]: 16 });
    expect(prefill.reviewKeys).toEqual([String(RAM)]);
  });

  it('DER-57-02 flags condition and visual grade suggested by the condition code, not its plain text', () => {
    const prefill = buildDevicePrefill(input({ defaultDeviceValues: {}, code: DGS }));

    expect(prefill).toEqual({
      conditionValueId: REFURBISHED,
      visualGrade: 3,
      conditionDescription: 'Gebrauchsspuren',
      values: {},
      reviewKeys: ['condition', 'visualGrade'],
      codeResult: { found: true, plainText: 'Gebrauchsspuren' },
    });
  });

  it('AC-REQ-015-04 prefills the suggested visual grade 4 with a review flag, and flags only what the entry suggests', () => {
    const prefill = buildDevicePrefill(
      input({
        defaultDeviceValues: {},
        code: { plainText: 'Neu', suggestedConditionValueId: null, suggestedVisualGrade: 4 },
      }),
    );

    expect(prefill.conditionValueId).toBeNull();
    expect(prefill.visualGrade).toBe(4);
    expect(prefill.reviewKeys).toEqual(['visualGrade']);
  });

  it('AC-REQ-015-03 takes no text and no suggestion for an unknown code', () => {
    const prefill = buildDevicePrefill(input({ defaultDeviceValues: {}, code: null }));

    expect(prefill).toMatchObject({
      conditionValueId: null,
      visualGrade: null,
      conditionDescription: '',
      reviewKeys: [],
      codeResult: { found: false, plainText: null },
    });
  });

  it('takes defaults only of active attributes', () => {
    const attributes = ATTRIBUTES.map((entry) =>
      entry.id === KEYBOARD ? { ...entry, active: false } : entry,
    );

    const prefill = buildDevicePrefill(input({ attributes }));

    expect(prefill.values).not.toHaveProperty(String(KEYBOARD));
    expect(prefill.reviewKeys).not.toContain(String(KEYBOARD));
  });

  it('DER-34-21 takes neither value nor review flag of a deactivated attribute, again once it is active again', () => {
    // "ThinkPad T14" with the default RAM 16 GB (2.5 "Nur aktive Merkmale").
    const defaultDeviceValues = { ...DEFAULTS, [RAM]: 16 };
    const withRam = (active: boolean) =>
      ATTRIBUTES.map((entry) => (entry.id === RAM ? { ...entry, active } : entry));

    const deactivated = buildDevicePrefill(
      input({ defaultDeviceValues, attributes: withRam(false) }),
    );
    expect(deactivated.values).not.toHaveProperty(String(RAM));
    expect(deactivated.reviewKeys).not.toContain(String(RAM));
    expect(deactivated.values).toEqual(DEFAULTS);

    const activeAgain = buildDevicePrefill(
      input({ defaultDeviceValues, attributes: withRam(true) }),
    );
    expect(activeAgain.values).toHaveProperty(String(RAM), 16);
    expect(activeAgain.reviewKeys).toContain(String(RAM));
  });

  it('DER-55-06 takes neither a deactivated pick list value nor a deactivated condition suggestion', () => {
    const prefill = buildDevicePrefill(
      input({ code: DGS, deactivatedValueIds: [HUNGARIAN, REFURBISHED] }),
    );

    expect(prefill.values).not.toHaveProperty(String(KEYBOARD));
    expect(prefill.conditionValueId).toBeNull();
    expect(prefill.reviewKeys).toEqual([
      'visualGrade',
      String(BATTERY),
      String(CAPACITY),
      String(PORTS),
    ]);
    // The plain text and the suggested visual grade of the code translation stay.
    expect(prefill.conditionDescription).toBe('Gebrauchsspuren');
    expect(prefill.visualGrade).toBe(3);
  });

  it('DER-55-06 drops the whole value of ports when one type or position is deactivated', () => {
    expect(buildDevicePrefill(input({ deactivatedValueIds: [HDMI] })).values).not.toHaveProperty(
      String(PORTS),
    );
    const prefill = buildDevicePrefill(input({ deactivatedValueIds: [LEFT] }));
    expect(prefill.values).not.toHaveProperty(String(PORTS));
    expect(prefill.reviewKeys).not.toContain(String(PORTS));
  });

  it('DER-55-06 prefills the values again once they are active again', () => {
    const prefill = buildDevicePrefill(input({ code: DGS, deactivatedValueIds: [] }));

    expect(prefill.values).toEqual(DEFAULTS);
    expect(prefill.conditionValueId).toBe(REFURBISHED);
    expect(prefill.reviewKeys).toContain(String(KEYBOARD));
    expect(prefill.reviewKeys).toContain('condition');
  });
});

describe('pick list values of a prefill (CU-117 input of CU-293 and CU-121)', () => {
  it('lists the pick list values of the defaults and the condition suggestion', () => {
    expect(prefillPickListValueIds(DEFAULTS, ATTRIBUTES, DGS).sort()).toEqual(
      [HUNGARIAN, WITH_BATTERY, USB_C, LEFT, HDMI, REFURBISHED].sort(),
    );
  });

  it('lists nothing for values without pick list', () => {
    expect(
      prefillPickListValueIds({ [RAM]: 16, [CAPACITY]: { percent: 85 } }, ATTRIBUTES, null),
    ).toEqual([]);
  });
});
