import { describe, expect, it } from 'vitest';

import {
  batteryPresentRequiredSchema,
  PICK_LIST_KEYS,
  pickListSchema,
  pickListValueCreateSchema,
  pickListValueLabelSchema,
  pickListValueOrderSchema,
  pickListValueSchema,
  pickListValueUpdateSchema,
} from './pick-list.schema.ts';

const LABEL_TEXT = 'Wert: 1 bis 100 Zeichen';
const BATTERY_TEXT = 'Kennzeichen ‚Akku vorhanden‘ fehlt';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('pick list schemas (CU-064)', () => {
  it('knows exactly the nine pick lists of the initial settings (3.1, RQ-07)', () => {
    expect(PICK_LIST_KEYS).toEqual([
      'condition',
      'keyboard_layout',
      'power_supply',
      'battery',
      'storage_type',
      'display_surface',
      'operating_system',
      'port_type',
      'port_position',
    ]);
  });

  it('trims the value and accepts 100 characters', () => {
    expect(pickListValueLabelSchema.parse('  Ungarisch (QWERTZ) ')).toBe('Ungarisch (QWERTZ)');
    expect(pickListValueLabelSchema.parse(` ${'a'.repeat(100)} `)).toBe('a'.repeat(100));
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['101 characters', 'a'.repeat(101)],
  ])('rejects a value that is %s with one text', (_case, label) => {
    expect(messagesOf(pickListValueLabelSchema.safeParse(label))).toEqual([LABEL_TEXT]);
  });

  it('DER-35-10 rejects an empty flag "Akku vorhanden" with the text of UI-028', () => {
    const result = batteryPresentRequiredSchema.safeParse(null);
    expect(messagesOf(result)).toEqual([BATTERY_TEXT]);
    expect(result.error?.issues[0]).toMatchObject({ params: { code: 'battery_present_missing' } });
    expect(batteryPresentRequiredSchema.parse(true)).toBe(true);
    expect(batteryPresentRequiredSchema.parse(false)).toBe(false);
  });

  it('needs label and active to create a value; batteryPresent may be null or missing', () => {
    expect(pickListValueCreateSchema.parse({ label: ' neu ', active: true })).toEqual({
      label: 'neu',
      active: true,
    });
    expect(
      pickListValueCreateSchema.parse({ label: 'ohne Akku', active: true, batteryPresent: null }),
    ).toEqual({ label: 'ohne Akku', active: true, batteryPresent: null });
    expect(pickListValueCreateSchema.safeParse({ label: 'neu' }).success).toBe(false);
    expect(pickListValueCreateSchema.safeParse({ label: 'a', active: true, id: 1 }).success).toBe(
      false,
    );
  });

  it('needs the version to change a value; the other fields are optional', () => {
    expect(pickListValueUpdateSchema.parse({ version: 2 })).toEqual({ version: 2 });
    expect(pickListValueUpdateSchema.parse({ version: 2, active: false })).toEqual({
      version: 2,
      active: false,
    });
    expect(pickListValueUpdateSchema.safeParse({ label: 'neu' }).success).toBe(false);
    expect(messagesOf(pickListValueUpdateSchema.safeParse({ version: 2, label: ' ' }))).toEqual([
      LABEL_TEXT,
    ]);
  });

  it('needs the version of the list and the value ids for the order', () => {
    expect(pickListValueOrderSchema.parse({ version: 1, valueIds: [3, 1, 2] })).toEqual({
      version: 1,
      valueIds: [3, 1, 2],
    });
    expect(pickListValueOrderSchema.safeParse({ valueIds: [1] }).success).toBe(false);
  });

  it('describes the answers with the fields of 2.1', () => {
    const list = { id: 4, key: 'battery', name: 'Akku', isBatteryList: true, version: 1 };
    const value = {
      id: 9,
      label: 'mit Akku (defekt)',
      active: true,
      batteryPresent: true,
      sortOrder: 2,
      version: 1,
    };
    expect(pickListSchema.parse(list)).toEqual(list);
    expect(pickListValueSchema.parse(value)).toEqual(value);
    expect(pickListValueSchema.parse({ ...value, batteryPresent: null }).batteryPresent).toBe(null);
  });
});
