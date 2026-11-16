import { describe, expect, it } from 'vitest';

import type { AttributeValueDefinition } from './attribute-values.schema.ts';
import { deviceCreateBodySchema, deviceCreateSchema, toWiNrKey } from './device.schema.ts';

const WI_NR_RULE = 'WI-Nr darf nur Buchstaben und Ziffern enthalten (1–20 Zeichen)';
const BATTERY_CAPACITY_RULE = 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“';

const BATTERY: AttributeValueDefinition = {
  id: 18,
  label: 'Akku',
  dataType: 'pick',
  systemRole: 'battery',
  minValue: null,
  maxValue: null,
  level: 'device',
  required: true,
  active: true,
};
const BATTERY_CAPACITY: AttributeValueDefinition = {
  ...BATTERY,
  id: 19,
  label: 'Akkukapazität',
  dataType: 'integer',
  systemRole: 'battery_capacity',
};
const PROCESSOR: AttributeValueDefinition = {
  ...BATTERY,
  id: 3,
  label: 'Prozessor',
  dataType: 'text',
  systemRole: null,
  level: 'model',
};
const ATTRIBUTES = [PROCESSOR, BATTERY, BATTERY_CAPACITY];
/** Value 41 "mit Akku" carries "Akku vorhanden", 42 "ohne Akku" does not. */
const BATTERY_VALUES = [
  { id: 41, batteryPresent: true },
  { id: 42, batteryPresent: false },
];

const body = (change: Record<string, unknown> = {}) => ({
  wiNr: '626198',
  supplierId: null,
  modelTemplateId: 7,
  conditionValueId: 1,
  visualGrade: '3',
  conditionDescription: '',
  values: { 18: 41, 19: { percent: 87 } },
  confirmedKeys: [],
  ...change,
});

const schema = deviceCreateSchema(ATTRIBUTES, { batteryValues: BATTERY_VALUES });

/** Path and text of each field error, in the order of the schema. */
const fieldErrors = (input: unknown) =>
  schema
    .safeParse(input)
    .error?.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

describe('device schema (CU-116, Technical Specification 2.5)', () => {
  it('AC-REQ-012-01 accepts a device with WI-Nr "626198" and stores the visual grade as a number', () => {
    expect(schema.parse(body())).toEqual({
      wiNr: '626198',
      supplierId: null,
      modelTemplateId: 7,
      conditionValueId: 1,
      visualGrade: 3,
      conditionDescription: '',
      values: { 18: 41, 19: { percent: 87 } },
      confirmedKeys: [],
    });
  });

  it('AC-REQ-012-04 accepts the WI-Nr "A637607" with letters and digits', () => {
    expect(schema.parse(body({ wiNr: 'A637607' })).wiNr).toBe('A637607');
  });

  it.each([
    ['empty', ''],
    ['with a space', '626 198'],
    ['with a space at the edge', ' 626198'],
    ['with a hyphen', '62-61'],
    ['longer than 20 characters', 'A'.repeat(21)],
  ])('AC-REQ-012-03 rejects a WI-Nr %s naming the WI-Nr rule', (_case, wiNr) => {
    expect(fieldErrors(body({ wiNr }))).toEqual([{ path: 'wiNr', message: WI_NR_RULE }]);
    expect(schema.safeParse(body({ wiNr })).error?.issues[0]).toMatchObject({
      params: { code: 'wi_nr_format' },
    });
  });

  it('accepts a WI-Nr with 20 characters', () => {
    expect(schema.safeParse(body({ wiNr: 'A'.repeat(20) })).success).toBe(true);
  });

  it('DER-54-11 rejects a device without model template with "Bitte eine Modellvorlage wählen"', () => {
    expect(fieldErrors(body({ modelTemplateId: null }))).toEqual([
      { path: 'modelTemplateId', message: 'Bitte eine Modellvorlage wählen' },
    ]);
  });

  it('DER-54-05 reports the WI-Nr "62-61" and the battery capacity 101 together, each at its field', () => {
    expect(fieldErrors(body({ wiNr: '62-61', values: { 18: 41, 19: { percent: 101 } } }))).toEqual(
      [
        { path: 'wiNr', message: WI_NR_RULE },
        { path: 'values.19', message: BATTERY_CAPACITY_RULE },
      ],
    );
  });

  it('rejects a device without condition with "Zustand fehlt"', () => {
    expect(fieldErrors(body({ conditionValueId: null }))).toEqual([
      { path: 'conditionValueId', message: 'Zustand fehlt' },
    ]);
  });

  it.each([null, '', '0', '6', '2,5', 'drei', 3.5])(
    'rejects the visual grade %j with "Optik-Note: ganze Zahl von 1 bis 5"',
    (visualGrade) => {
      expect(fieldErrors(body({ visualGrade }))).toEqual([
        { path: 'visualGrade', message: 'Optik-Note: ganze Zahl von 1 bis 5' },
      ]);
    },
  );

  it('accepts the visual grade as a number and with spaces at the edges', () => {
    expect(schema.parse(body({ visualGrade: 5 })).visualGrade).toBe(5);
    expect(schema.parse(body({ visualGrade: ' 1 ' })).visualGrade).toBe(1);
  });

  it('accepts a condition description of 1,000 characters and rejects a longer one', () => {
    expect(schema.parse(body({ conditionDescription: 'x'.repeat(1000) })).conditionDescription)
      .toHaveLength(1000);
    expect(fieldErrors(body({ conditionDescription: 'x'.repeat(1001) }))).toEqual([
      { path: 'conditionDescription', message: 'Zustandsbeschreibung: höchstens 1.000 Zeichen' },
    ]);
  });

  it('stores the condition description without spaces at the edges', () => {
    expect(schema.parse(body({ conditionDescription: '  Kratzer  ' })).conditionDescription).toBe(
      'Kratzer',
    );
  });

  it('checks the values only by the attributes of the level device', () => {
    expect(fieldErrors(body({ values: {} }))).toEqual([{ path: 'values.18', message: 'Akku fehlt' }]);
    expect(schema.safeParse(body({ values: { 3: 'i5', 18: 42 } })).error?.issues[0]).toMatchObject({
      code: 'unrecognized_keys',
    });
  });

  it('without the attributes of the device type checks only the fixed fields', () => {
    const fixed = deviceCreateSchema(null);
    expect(fixed.parse(body({ values: { 99: 'x' } })).values).toEqual({ 99: 'x' });
  });

  it('accepts no supplier and a supplier id', () => {
    expect(schema.parse(body({ supplierId: null })).supplierId).toBeNull();
    expect(schema.parse(body({ supplierId: 4 })).supplierId).toBe(4);
  });
});

describe('request shape of POST /api/devices (CU-116, 2.0.5)', () => {
  it('lets every rule a user can violate pass, so the service reports them together', () => {
    expect(
      deviceCreateBodySchema.safeParse(
        body({ wiNr: '62-61', modelTemplateId: null, conditionValueId: null, visualGrade: '' }),
      ).success,
    ).toBe(true);
  });

  it.each([
    ['an unknown field', { extra: 1 }],
    ['a missing field', { confirmedKeys: undefined }],
    ['a WI-Nr of another type', { wiNr: 626198 }],
    ['values of another type', { values: [] }],
  ])('rejects %s as a structural error', (_case, change) => {
    const issues = deviceCreateBodySchema.safeParse(body(change)).error?.issues ?? [];
    expect(issues.map(({ code }) => code)).toEqual([
      expect.stringMatching(/^(unrecognized_keys|invalid_type)$/),
    ]);
  });
});

describe('WI-Nr key (3.3 `wi_nr_key`)', () => {
  it('compares the WI-Nr without regard to case', () => {
    expect(toWiNrKey('A637607')).toBe(toWiNrKey('a637607'));
    expect(toWiNrKey('A637607')).toBe('a637607');
  });
});
