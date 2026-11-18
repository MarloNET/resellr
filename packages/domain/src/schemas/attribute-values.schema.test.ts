import { describe, expect, it } from 'vitest';

import {
  attributeValuesSchema,
  mergeAttributeValues,
  type AttributeValueDefinition,
} from './attribute-values.schema.ts';

const attribute = (change: Partial<AttributeValueDefinition>): AttributeValueDefinition => ({
  id: 1,
  label: 'Merkmal',
  dataType: 'text',
  systemRole: null,
  minValue: null,
  maxValue: null,
  level: 'model',
  required: false,
  active: true,
  ...change,
});

const issuesOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => result.error?.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

/** The values of one attribute with id 1 at level model. */
const one = (definition: Partial<AttributeValueDefinition>, value: unknown) =>
  attributeValuesSchema([attribute(definition)], 'model').safeParse({ 1: value });

const SCREEN_DIAGONAL = { id: 21, label: 'Bildschirmdiagonale', dataType: 'decimal' } as const;

describe('attribute values schema (CU-067, Technical Specification 2.5)', () => {
  it('AC-REQ-005-02 "14.01" of a decimal is stored as the number 14,01 and never as a date', () => {
    const schema = attributeValuesSchema(
      [attribute({ ...SCREEN_DIAGONAL, minValue: null, maxValue: null })],
      'model',
    );
    expect(schema.parse({ 21: '14.01' })).toEqual({ 21: '14.01' });
    expect(schema.parse({ 21: '14,01' })).toEqual({ 21: '14.01' });
    expect(schema.parse({ 21: ' 14,010 ' })).toEqual({ 21: '14.01' });
  });

  it('AC-REQ-005-03 "3 bis 4" of an integer with range 1–5 is rejected naming the attribute and the range', () => {
    expect(
      issuesOf(
        one(
          { label: 'Prozessorkerne', dataType: 'integer', minValue: '1', maxValue: '5' },
          '3 bis 4',
        ),
      ),
    ).toEqual([{ path: '1', message: 'Prozessorkerne: ganze Zahl von 1 bis 5' }]);
  });

  it('AC-REQ-005-05 "2 × USB-A 3.1" and "1 × HDMI" are stored with count and type', () => {
    const ports = { label: 'Anschlüsse', dataType: 'ports' as const };
    const schema = attributeValuesSchema([attribute({ id: 30, ...ports })], 'model');
    expect(
      schema.parse({
        30: [
          { count: '2', typeId: 41, positionId: null },
          { count: 1, typeId: 42, positionId: 7 },
        ],
      }),
    ).toEqual({
      30: [
        { count: 2, typeId: 41, positionId: null },
        { count: 1, typeId: 42, positionId: 7 },
      ],
    });
  });

  it('AC-REQ-005-01 a required attribute of level model is a required field of the model template', () => {
    const schema = attributeValuesSchema(
      [attribute({ ...SCREEN_DIAGONAL, minValue: '10', maxValue: '60', required: true })],
      'model',
    );
    expect(issuesOf(schema.safeParse({}))).toEqual([
      { path: '21', message: 'Bildschirmdiagonale fehlt' },
    ]);
    expect(schema.parse({ 21: '15,6' })).toEqual({ 21: '15.6' });
    expect(issuesOf(schema.safeParse({ 21: '61' }))).toEqual([
      { path: '21', message: 'Bildschirmdiagonale: Zahl von 10 bis 60' },
    ]);
  });

  describe('row "alle": required attribute without value', () => {
    it.each([
      ['text null', 'text', null],
      ['text of spaces', 'text', '   '],
      ['integer empty', 'integer', ''],
      ['decimal null', 'decimal', null],
      ['boolean null', 'boolean', null],
      ['pick null', 'pick', null],
      ['ports []', 'ports', []],
    ] as const)('rejects %s with "<Merkmal> fehlt"', (_case, dataType, value) => {
      expect(issuesOf(one({ label: 'RAM', dataType, required: true }, value))).toEqual([
        { path: '1', message: 'RAM fehlt' },
      ]);
    });

    it('rejects a missing key of a required attribute', () => {
      expect(
        issuesOf(
          attributeValuesSchema([attribute({ label: 'RAM', required: true })], 'model').safeParse(
            {},
          ),
        ),
      ).toEqual([{ path: '1', message: 'RAM fehlt' }]);
    });

    it('stores no key for an attribute without value that is not required', () => {
      expect(one({ dataType: 'integer' }, null).data).toEqual({});
      expect(one({ dataType: 'text' }, '  ').data).toEqual({});
    });

    it('does not ask for a deactivated attribute but keeps its stored value valid (REQ-005)', () => {
      expect(one({ required: true, active: false }, null).data).toEqual({});
      expect(one({ required: true, active: false }, 'alt').data).toEqual({ 1: 'alt' });
    });

    it('AC-REQ-005-11 a schema built after "Wieder aktivieren" asks for the required attribute again', () => {
      const ram = { label: 'RAM', dataType: 'integer', level: 'device', required: true } as const;
      const deactivated = attributeValuesSchema([attribute({ ...ram, active: false })], 'device');
      expect(deactivated.safeParse({}).success).toBe(true);

      const activated = attributeValuesSchema([attribute({ ...ram, active: true })], 'device');

      expect(issuesOf(activated.safeParse({}))).toEqual([{ path: '1', message: 'RAM fehlt' }]);
      expect(activated.parse({ 1: 16 })).toEqual({ 1: 16 });
    });

    it('reports a missing required value beside the field errors of other attributes', () => {
      const schema = attributeValuesSchema(
        [
          attribute({ id: 1, label: 'RAM', dataType: 'integer', required: true }),
          attribute({ id: 2, label: 'SSD', dataType: 'integer' }),
        ],
        'model',
      );
      expect(issuesOf(schema.safeParse({ 2: 'viel' }))).toEqual([
        { path: '1', message: 'RAM fehlt' },
        { path: '2', message: 'SSD: ganze Zahl' },
      ]);
    });
  });

  describe('row "Ganzzahl"', () => {
    it.each([
      ['both bounds', '1', '1024', 'RAM: ganze Zahl von 1 bis 1024'],
      ['a minimum only', '1', null, 'RAM: ganze Zahl ab 1'],
      ['a maximum only', null, '1024', 'RAM: ganze Zahl bis 1024'],
      ['no bounds', null, null, 'RAM: ganze Zahl'],
    ])('names the rule with %s', (_case, minValue, maxValue, message) => {
      expect(
        issuesOf(one({ label: 'RAM', dataType: 'integer', minValue, maxValue }, '1,5')),
      ).toEqual([{ path: '1', message }]);
    });

    it.each(['1.024', '1,5', '16 GB', '+16', '9007199254740992', '1e3'])(
      'rejects the format %j with the same text',
      (input) => {
        expect(issuesOf(one({ label: 'RAM', dataType: 'integer' }, input))).toEqual([
          { path: '1', message: 'RAM: ganze Zahl' },
        ]);
      },
    );

    it('includes the bounds and accepts the input with spaces, a minus sign and the stored number', () => {
      const definition = { dataType: 'integer' as const, minValue: '-5', maxValue: '5' };
      expect(one(definition, ' -5 ').data).toEqual({ 1: -5 });
      expect(one(definition, '5').data).toEqual({ 1: 5 });
      expect(one(definition, 3).data).toEqual({ 1: 3 });
      expect(one(definition, '6').success).toBe(false);
    });

    it('treats another JSON type as structural error, not as field error', () => {
      const issues = one({ dataType: 'integer' }, { value: 1 }).error?.issues ?? [];
      expect(issues.map((issue) => issue.code)).toEqual(['invalid_union']);
    });
  });

  describe('row "Dezimalzahl"', () => {
    it.each([
      ['both bounds', '0.5', '6', 'Prozessortakt: Zahl von 0,5 bis 6'],
      ['a minimum only', '0.5', null, 'Prozessortakt: Zahl ab 0,5'],
      ['a maximum only', null, '6', 'Prozessortakt: Zahl bis 6'],
      ['no bounds', null, null, 'Prozessortakt: Zahl'],
    ])('names the rule with %s and a decimal comma', (_case, minValue, maxValue, message) => {
      expect(
        issuesOf(
          one({ label: 'Prozessortakt', dataType: 'decimal', minValue, maxValue }, 'schnell'),
        ),
      ).toEqual([{ path: '1', message }]);
    });

    it('compares exactly, bounds included, without thousands separators in the message', () => {
      const definition = {
        label: 'Akku',
        dataType: 'decimal' as const,
        minValue: '0.1',
        maxValue: '1024',
      };
      expect(one(definition, '0,1').data).toEqual({ 1: '0.1' });
      expect(one(definition, '1024,0').data).toEqual({ 1: '1024' });
      expect(issuesOf(one(definition, '0,0999999999999999999'))).toEqual([
        { path: '1', message: 'Akku: Zahl von 0,1 bis 1024' },
      ]);
      expect(issuesOf(one(definition, '1.234,5'))).toEqual([
        { path: '1', message: 'Akku: Zahl von 0,1 bis 1024' },
      ]);
    });
  });

  describe('row "Text"', () => {
    it('stores the text without the spaces at the edges and accepts 200 characters', () => {
      expect(one({}, '  Intel Core i5  ').data).toEqual({ 1: 'Intel Core i5' });
      expect(one({}, 'a'.repeat(200)).data).toEqual({ 1: 'a'.repeat(200) });
    });

    it('rejects 201 characters with "<Merkmal>: höchstens 200 Zeichen"', () => {
      expect(issuesOf(one({ label: 'Prozessor' }, 'a'.repeat(201)))).toEqual([
        { path: '1', message: 'Prozessor: höchstens 200 Zeichen' },
      ]);
    });
  });

  describe('row "Mehrfachangabe Anzahl × Typ"', () => {
    const ports = { label: 'Anschlüsse', dataType: 'ports' as const };

    it.each([0, '0', '1,5', 'abc', -1])('rejects the count %j', (count) => {
      expect(issuesOf(one(ports, [{ count, typeId: 41, positionId: null }]))).toEqual([
        { path: '1', message: 'Anschlüsse: Anzahl als ganze Zahl ab 1' },
      ]);
    });

    it('rejects an entry without type with "<Merkmal>: Typ fehlt"', () => {
      expect(issuesOf(one(ports, [{ count: 1, typeId: null, positionId: null }]))).toEqual([
        { path: '1', message: 'Anschlüsse: Typ fehlt' },
      ]);
    });

    it('checks the entries in list order, count before type', () => {
      expect(
        issuesOf(
          one(ports, [
            { count: 1, typeId: null, positionId: null },
            { count: 0, typeId: 41, positionId: null },
          ]),
        ),
      ).toEqual([{ path: '1', message: 'Anschlüsse: Typ fehlt' }]);
      expect(issuesOf(one(ports, [{ count: 0, typeId: null, positionId: null }]))).toEqual([
        { path: '1', message: 'Anschlüsse: Anzahl als ganze Zahl ab 1' },
      ]);
    });
  });

  describe('row "Ja/Nein, Auswahl aus Liste"', () => {
    it('stores true/false and the id of the list value', () => {
      expect(one({ dataType: 'boolean' }, false).data).toEqual({ 1: false });
      expect(one({ dataType: 'pick' }, 7).data).toEqual({ 1: 7 });
    });
  });

  describe('levels and keys', () => {
    it('holds only the attributes of the level and rejects others as unknown keys', () => {
      const schema = attributeValuesSchema(
        [
          attribute({ id: 1, label: 'Prozessor', level: 'model' }),
          attribute({ id: 2, label: 'RAM', dataType: 'integer', level: 'device', required: true }),
        ],
        'model',
      );
      expect(schema.parse({ 1: 'i5' })).toEqual({ 1: 'i5' });
      expect(schema.safeParse({ 1: 'i5', 2: 16 }).error?.issues[0]?.code).toBe('unrecognized_keys');
    });

    it('accepts the stored value of the role battery_capacity', () => {
      const definition = {
        label: 'Akkukapazität',
        dataType: 'integer' as const,
        systemRole: 'battery_capacity' as const,
      };
      expect(one(definition, { percent: 85 }).data).toEqual({ 1: { percent: 85 } });
      expect(one(definition, { notDeterminable: true }).data).toEqual({
        1: { notDeterminable: true },
      });
      expect(issuesOf(one(definition, { percent: 101 }))).toEqual([
        { path: '1', message: 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“' },
      ]);
    });
  });

  describe('row "Rolle battery_capacity": required by the flag "Akku vorhanden" (2.5)', () => {
    const BATTERY = attribute({
      id: 17,
      label: 'Akku',
      dataType: 'pick',
      systemRole: 'battery',
      level: 'device',
      required: true,
    });
    const CAPACITY = attribute({
      id: 18,
      label: 'Akkukapazität',
      dataType: 'integer',
      systemRole: 'battery_capacity',
      level: 'device',
    });
    const RAM = attribute({ id: 12, label: 'RAM', dataType: 'integer', level: 'device' });
    const WITH_BATTERY = { id: 4, label: 'mit Akku', batteryPresent: true };
    const DEFECTIVE = { id: 5, label: 'mit Akku (defekt)', batteryPresent: true };
    const WITHOUT_BATTERY = { id: 6, label: 'ohne Akku', batteryPresent: false };
    const BATTERY_VALUES = [WITH_BATTERY, DEFECTIVE, WITHOUT_BATTERY];
    const CAPACITY_RULE = 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“';
    const CAPACITY_MISSING = [{ path: '18', message: CAPACITY_RULE }];

    const deviceValues = (
      attributes: AttributeValueDefinition[],
      values: Record<string, unknown>,
      batteryValues: { id: number; batteryPresent: boolean | null }[] = BATTERY_VALUES,
    ) => attributeValuesSchema(attributes, 'device', { batteryValues }).safeParse(values);

    it('DER-35-12 the requirement follows the flag batteryPresent and not the name of the value', () => {
      const renamed = { ...DEFECTIVE, label: 'Akku defekt' };
      expect(issuesOf(deviceValues([BATTERY, CAPACITY], { 17: 5 }, [renamed]))).toEqual(
        CAPACITY_MISSING,
      );
      // A value named like one with a battery, but without the flag, needs no capacity.
      const namedLikeBattery = { ...WITHOUT_BATTERY, label: 'mit Akku (defekt)' };
      expect(deviceValues([BATTERY, CAPACITY], { 17: 6 }, [namedLikeBattery]).data).toEqual({
        17: 6,
      });
    });

    it('rejects a battery value with the flag without capacity, beside the other field errors', () => {
      expect(issuesOf(deviceValues([BATTERY, CAPACITY], { 17: 4 }))).toEqual(CAPACITY_MISSING);
      expect(issuesOf(deviceValues([BATTERY, CAPACITY], { 17: 5, 18: null }))).toEqual(
        CAPACITY_MISSING,
      );
      expect(issuesOf(deviceValues([BATTERY, CAPACITY, RAM], { 12: 'viel', 17: 4 }))).toEqual([
        { path: '12', message: 'RAM: ganze Zahl' },
        { path: '18', message: CAPACITY_RULE },
      ]);
    });

    it('accepts a battery value with the flag and a capacity or "nicht ermittelbar"', () => {
      expect(deviceValues([BATTERY, CAPACITY], { 17: 4, 18: { percent: '85' } }).data).toEqual({
        17: 4,
        18: { percent: 85 },
      });
      expect(
        deviceValues([BATTERY, CAPACITY], { 17: 5, 18: { notDeterminable: true } }).data,
      ).toEqual({ 17: 5, 18: { notDeterminable: true } });
    });

    it('needs no capacity for a value without the flag or without a battery value', () => {
      expect(deviceValues([BATTERY, CAPACITY], { 17: 6 }).data).toEqual({ 17: 6 });
      expect(deviceValues([{ ...BATTERY, required: false }, CAPACITY], {}).data).toEqual({});
      // Whether capacity is required depends only on the flag, not on its own "Pflicht".
      expect(deviceValues([BATTERY, { ...CAPACITY, required: true }], { 17: 6 }).data).toEqual({
        17: 6,
      });
      expect(issuesOf(deviceValues([BATTERY, { ...CAPACITY, required: true }], { 17: 4 }))).toEqual(
        CAPACITY_MISSING,
      );
    });

    it('battery active with "mit Akku" and capacity deactivated, no value: no error', () => {
      expect(deviceValues([BATTERY, { ...CAPACITY, active: false }], { 17: 4 }).data).toEqual({
        17: 4,
      });
    });

    it('capacity active, no value: the rule of the battery capacity', () => {
      expect(issuesOf(deviceValues([BATTERY, CAPACITY], { 17: 4 }))).toEqual(CAPACITY_MISSING);
    });

    it('battery value with the flag and an invalid capacity: exactly one field error', () => {
      expect(issuesOf(deviceValues([BATTERY, CAPACITY], { 17: 4, 18: { percent: 101 } }))).toEqual(
        CAPACITY_MISSING,
      );
    });

    it('battery deactivated with the stored value "mit Akku", capacity active without value: no error', () => {
      expect(deviceValues([{ ...BATTERY, active: false }, CAPACITY], { 17: 4 }).data).toEqual({
        17: 4,
      });
    });

    it('needs no capacity without the values of the list battery', () => {
      expect(
        attributeValuesSchema([BATTERY, CAPACITY], 'device').safeParse({ 17: 4 }).data,
      ).toEqual({ 17: 4 });
    });
  });

  describe('values of deactivated attributes: only the structure of the stored format (2.5, FIND-350)', () => {
    const RAM = { label: 'RAM', dataType: 'integer', minValue: '1', maxValue: '1024' } as const;
    const codesOf = (result: { error?: { issues: { code: string }[] } }) =>
      result.error?.issues.map((issue) => issue.code);

    // Both are level "Gerät"; the default device values of a model template are checked
    // without "Pflicht" (2.4), so the caller passes the definitions with `required: false`.
    it.each([
      ['values', true],
      ['defaultDeviceValues', false],
    ])(
      'DER-34-18 RAM 1–1024 deactivated with 2048 in %s: no error; active: the full rule; an object: structural error',
      (_values, required) => {
        const ram = (active: boolean) =>
          attributeValuesSchema(
            [attribute({ ...RAM, level: 'device', required, active })],
            'device',
          );
        expect(ram(false).safeParse({ 1: 2048 }).data).toEqual({ 1: 2048 });
        expect(issuesOf(ram(true).safeParse({ 1: 2048 }))).toEqual([
          { path: '1', message: 'RAM: ganze Zahl von 1 bis 1024' },
        ]);
        expect(codesOf(ram(false).safeParse({ 1: { value: 2048 } }))).toEqual(['invalid_type']);
      },
    );

    it('DER-34-18 a deactivated attribute is never asked for, whatever its definition', () => {
      expect(one({ ...RAM, required: true, active: false }, null).data).toEqual({});
      expect(
        attributeValuesSchema(
          [attribute({ ...RAM, required: true, active: false })],
          'model',
        ).safeParse({}).data,
      ).toEqual({});
    });

    it.each([
      ['text', {}, 'a'.repeat(200), 'a'.repeat(200)],
      ['integer', RAM, -3, -3],
      ['decimal', { minValue: '10', maxValue: '60' }, '61.5', '61.5'],
      ['boolean', {}, true, true],
      ['pick', {}, 99, 99],
      [
        'ports',
        {},
        [{ count: 2, typeId: 41, positionId: null }],
        [{ count: 2, typeId: 41, positionId: null }],
      ],
    ] as const)(
      'DER-34-18 keeps the stored %s value without its rules',
      (dataType, definition, value, stored) => {
        expect(one({ ...definition, dataType, active: false }, value).data).toEqual({ 1: stored });
      },
    );

    it('DER-34-18 keeps the stored value of the role battery_capacity', () => {
      const capacity = {
        dataType: 'integer',
        systemRole: 'battery_capacity',
        active: false,
      } as const;
      expect(one(capacity, { percent: 85 }).data).toEqual({ 1: { percent: 85 } });
      expect(one(capacity, { notDeterminable: true }).data).toEqual({
        1: { notDeterminable: true },
      });
    });

    it.each([
      ['text', 'a'.repeat(201)],
      ['text', 7],
      ['integer', '2048'],
      ['integer', 1.5],
      ['integer', 9007199254740992],
      ['decimal', '14,01'],
      ['decimal', 14.01],
      ['decimal', 'schnell'],
      ['boolean', 'ja'],
      ['pick', 0],
      ['pick', '7'],
      ['ports', [{ count: 0, typeId: 41, positionId: null }]],
      ['ports', [{ count: '2', typeId: 41, positionId: null }]],
      ['ports', [{ count: 1, typeId: null, positionId: null }]],
      ['ports', [{ count: 1, typeId: 41 }]],
      ['ports', { count: 1, typeId: 41, positionId: null }],
      // "" is no value only for text and [] only for ports (2.5); else another form.
      ['text', []],
      ['integer', ''],
      ['integer', '  '],
      ['integer', []],
      ['decimal', ''],
      ['decimal', []],
      ['boolean', ''],
      ['boolean', []],
      ['pick', ''],
      ['pick', []],
      ['ports', ''],
    ] as const)(
      'DER-34-18 rejects the deactivated %s value %j in another form as structural error, never as field error',
      (dataType, value) => {
        expect(codesOf(one({ dataType, active: false }, value))).toEqual(['invalid_type']);
      },
    );

    it.each([
      ['text', null],
      ['text', ''],
      ['text', '   '],
      ['integer', null],
      ['decimal', null],
      ['boolean', null],
      ['pick', null],
      ['ports', null],
      ['ports', []],
    ] as const)('DER-34-18 takes the deactivated %s value %j as no value', (dataType, value) => {
      expect(one({ dataType, active: false }, value).data).toEqual({});
    });

    it.each([{ percent: 101 }, { percent: '85' }, { notDeterminable: false }, 85, '', [[]]])(
      'DER-34-18 rejects the deactivated battery capacity %j as structural error',
      (value) => {
        const capacity = {
          dataType: 'integer',
          systemRole: 'battery_capacity',
          active: false,
        } as const;
        expect(codesOf(one(capacity, value))).toEqual(['invalid_type']);
      },
    );

    it('DER-34-18 a valid deactivated value adds no error beside the field error of an active attribute', () => {
      const schema = attributeValuesSchema(
        [
          attribute({ id: 1, ...RAM, active: false }),
          attribute({ id: 2, label: 'SSD', dataType: 'integer' }),
        ],
        'model',
      );
      expect(schema.safeParse({ 1: 2048, 2: 'viel' }).error?.issues).toMatchObject([
        { path: ['2'], code: 'custom', message: 'SSD: ganze Zahl' },
      ]);
    });
  });
});

describe('mergeAttributeValues (CU-067, Technical Specification 2.5 "Merkmalswerte bei PATCH sind Änderungen")', () => {
  const stored = { 12: 16, 13: 512, 18: { percent: 85 } };

  it('DER-34-20 a key overwrites the stored value', () => {
    expect(mergeAttributeValues(stored, { 12: 32, 21: '13.3' })).toEqual({
      12: 32,
      13: 512,
      18: { percent: 85 },
      21: '13.3',
    });
  });

  it('DER-34-20 null removes the stored value', () => {
    expect(mergeAttributeValues(stored, { 13: null, 99: null })).toEqual({
      12: 16,
      18: { percent: 85 },
    });
  });

  it('DER-34-20 a missing key leaves the stored value unchanged', () => {
    expect(mergeAttributeValues(stored, {})).toEqual(stored);
  });

  it('DER-34-20 without the object all stored values stay', () => {
    expect(mergeAttributeValues(stored, undefined)).toEqual(stored);
  });

  it('changes neither the stored values nor the changes', () => {
    const changes = { 12: 32, 13: null };
    const before = structuredClone(stored);
    mergeAttributeValues(stored, changes);
    expect(stored).toEqual(before);
    expect(changes).toEqual({ 12: 32, 13: null });
  });
});
