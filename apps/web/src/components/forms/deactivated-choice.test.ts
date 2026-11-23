import { describe, expect, it } from 'vitest';

import {
  choiceOptions,
  findMissingChoices,
  findMissingListChoices,
  type ChoiceField,
  type ListChoice,
} from './deactivated-choice.ts';

const WEST = { id: 1, label: 'Lieferant West', active: true };
const OST = { id: 2, label: 'Lieferant Ost', active: true };
const NORD = { id: 3, label: 'Lieferant Nord', active: false };
const GUT = { id: 11, label: 'Gut', active: true };

const supplierText = (name: string) => `Lieferant ${name} ist deaktiviert`;
const conditionText = (value: string) => `Vorschlag Zustand ${value} ist deaktiviert`;

describe('choiceOptions (CU-319, T9)', () => {
  it('offers the active entries only', () => {
    expect(choiceOptions([WEST, NORD, OST], { storedId: null })).toEqual([
      { id: 1, label: 'Lieferant West' },
      { id: 2, label: 'Lieferant Ost' },
    ]);
  });

  it('adds the stored, deactivated entry with "(deaktiviert)" when markDeactivated is set', () => {
    expect(choiceOptions([WEST, NORD], { storedId: 3, markDeactivated: true })).toEqual([
      { id: 1, label: 'Lieferant West' },
      { id: 3, label: 'Lieferant Nord (deaktiviert)' },
    ]);
  });

  it('adds the stored, deactivated entry without a mark otherwise', () => {
    expect(choiceOptions([WEST, NORD], { storedId: 3 })).toEqual([
      { id: 1, label: 'Lieferant West' },
      { id: 3, label: 'Lieferant Nord' },
    ]);
  });

  it('adds every stored, deactivated entry of storedIds with "(deaktiviert)" (port types, #190)', () => {
    expect(
      choiceOptions([WEST, NORD, { ...OST, active: false }], {
        storedId: null,
        storedIds: [3, 2],
        markDeactivated: true,
      }),
    ).toEqual([
      { id: 1, label: 'Lieferant West' },
      { id: 3, label: 'Lieferant Nord (deaktiviert)' },
      { id: 2, label: 'Lieferant Ost (deaktiviert)' },
    ]);
  });

  it('marks nothing on a stored entry that is active', () => {
    expect(choiceOptions([WEST], { storedId: 1, markDeactivated: true })).toEqual([
      { id: 1, label: 'Lieferant West' },
    ]);
  });
});

describe('choiceOptions with chosenId (CU-319, T14, Nachtrag MAR-1058)', () => {
  it('offers a chosen, deactivated entry that is not stored without "(deaktiviert)", also with markDeactivated', () => {
    expect(
      choiceOptions([WEST, NORD], { storedId: null, chosenId: 3, markDeactivated: true }),
    ).toEqual([
      { id: 1, label: 'Lieferant West' },
      { id: 3, label: 'Lieferant Nord' },
    ]);
  });

  it('marks a chosen entry equal to storedId with "(deaktiviert)"', () => {
    expect(
      choiceOptions([WEST, NORD], { storedId: 3, chosenId: 3, markDeactivated: true }),
    ).toEqual([
      { id: 1, label: 'Lieferant West' },
      { id: 3, label: 'Lieferant Nord (deaktiviert)' },
    ]);
  });

  it('marks a chosen entry held by storedIds with "(deaktiviert)"', () => {
    expect(
      choiceOptions([WEST, NORD], {
        storedId: null,
        storedIds: [3],
        chosenId: 3,
        markDeactivated: true,
      }),
    ).toEqual([
      { id: 1, label: 'Lieferant West' },
      { id: 3, label: 'Lieferant Nord (deaktiviert)' },
    ]);
  });

  it('marks a stored, deactivated entry while another, deactivated entry is chosen', () => {
    const SUED = { id: 4, label: 'Lieferant Süd', active: false };
    expect(
      choiceOptions([WEST, NORD, SUED], { storedId: 3, chosenId: 4, markDeactivated: true }),
    ).toEqual([
      { id: 1, label: 'Lieferant West' },
      { id: 3, label: 'Lieferant Nord (deaktiviert)' },
      { id: 4, label: 'Lieferant Süd' },
    ]);
  });

  it('gives the same result as before without chosenId or with chosenId null', () => {
    const items = [WEST, NORD, OST];
    const before = choiceOptions(items, { storedId: 3, markDeactivated: true });

    expect(choiceOptions(items, { storedId: 3, chosenId: null, markDeactivated: true })).toEqual(
      before,
    );
  });
});

describe('findMissingChoices (CU-319, T9)', () => {
  const field = (overrides: Partial<ChoiceField>): ChoiceField => ({
    path: 'supplierId',
    id: 1,
    storedId: null,
    before: [WEST, OST],
    message: supplierText,
    ...overrides,
  });

  it('reports a field with a new value whose id is missing after the reload, with its text', () => {
    expect(
      findMissingChoices([field({})], { supplierId: [{ ...WEST, active: false }, OST] }),
    ).toEqual([{ path: 'supplierId', id: 1, message: 'Lieferant Lieferant West ist deaktiviert' }]);
  });

  it('takes the name from the list before the reload', () => {
    expect(findMissingChoices([field({})], { supplierId: [OST] })).toEqual([
      { path: 'supplierId', id: 1, message: 'Lieferant Lieferant West ist deaktiviert' },
    ]);
  });

  it('reports every field with a missing new value, in the order of the fields', () => {
    const fields = [
      field({}),
      field({
        path: 'suggestedConditionValueId',
        id: 11,
        before: [GUT],
        message: conditionText,
      }),
    ];
    expect(
      findMissingChoices(fields, {
        supplierId: [OST],
        suggestedConditionValueId: [{ ...GUT, active: false }],
      }).map((missing) => missing.message),
    ).toEqual([
      'Lieferant Lieferant West ist deaktiviert',
      'Vorschlag Zustand Gut ist deaktiviert',
    ]);
  });

  it('does not report the stored value, even if it is deactivated', () => {
    expect(
      findMissingChoices([field({ id: 3, storedId: 3, before: [NORD] })], { supplierId: [NORD] }),
    ).toEqual([]);
  });

  it('does not report a value that is in the reloaded list again', () => {
    expect(findMissingChoices([field({})], { supplierId: [WEST, OST] })).toEqual([]);
  });

  it('does not report an empty field', () => {
    expect(findMissingChoices([field({ id: null })], { supplierId: [OST] })).toEqual([]);
  });

  it('does not report a field whose list was not reloaded', () => {
    expect(findMissingChoices([field({})], {})).toEqual([]);
  });

  it('reports the field of details.path with another missing value chosen during the reload, but not with null (Nachtrag MAR-963)', () => {
    // Supplier "West" was rejected; during the reload "Ost" was chosen, now deactivated too.
    const reloaded = {
      supplierId: [
        { ...WEST, active: false },
        { ...OST, active: false },
      ],
    };

    expect(findMissingChoices([field({ id: 2 })], reloaded)).toEqual([
      { path: 'supplierId', id: 2, message: 'Lieferant Lieferant Ost ist deaktiviert' },
    ]);
    expect(findMissingChoices([field({ id: null })], reloaded)).toEqual([]);
  });
});

describe('findMissingListChoices (CU-319, T9, #190)', () => {
  const UNGARISCH = { id: 21, label: 'Ungarisch', active: true };
  const DEUTSCH = { id: 22, label: 'Deutsch (QWERTZ)', active: true };
  const USB_C = { id: 31, label: 'USB-C', active: true };
  const VORN = { id: 41, label: 'vorn', active: true };
  const attributeText = (label: string) => (value: string) => `${label}: ${value} ist deaktiviert`;
  const choice = (overrides: Partial<ListChoice>): ListChoice => ({
    path: 'values.16',
    id: 21,
    stored: false,
    list: '11',
    message: attributeText('Tastaturlayout'),
    ...overrides,
  });
  const lists = {
    '11': { before: [UNGARISCH, DEUTSCH], after: [{ ...UNGARISCH, active: false }, DEUTSCH] },
    '8': { before: [USB_C], after: [{ ...USB_C, active: false }] },
    '9': { before: [VORN], after: [VORN] },
  };
  const rejected = { path: 'conditionValueId', id: 1 };

  it('checks each choice against the list it comes from, two lists in one field (ports)', () => {
    const choices = [
      choice({}),
      choice({ path: 'values.22', id: 31, list: '8', message: attributeText('Anschlüsse') }),
      choice({ path: 'values.22', id: 41, list: '9', message: attributeText('Anschlüsse') }),
    ];

    expect(findMissingListChoices(choices, lists, rejected)).toEqual([
      { path: 'values.16', id: 21, message: 'Tastaturlayout: Ungarisch ist deaktiviert' },
      { path: 'values.22', id: 31, message: 'Anschlüsse: USB-C ist deaktiviert' },
    ]);
  });

  it('does not report a stored entry, even if it is deactivated (UI-010)', () => {
    expect(findMissingListChoices([choice({ stored: true })], lists, rejected)).toEqual([]);
  });

  it('reports only the rejected entry at details.path when its list could not be read again', () => {
    const failed = { '11': { before: [UNGARISCH, DEUTSCH], after: null } };

    expect(
      findMissingListChoices([choice({}), choice({ path: 'values.17', id: 22 })], failed, {
        path: 'values.16',
        id: 21,
      }),
    ).toEqual([
      { path: 'values.16', id: 21, message: 'Tastaturlayout: Ungarisch ist deaktiviert' },
    ]);
    expect(
      findMissingListChoices([choice({ id: 22 })], failed, { path: 'values.16', id: 21 }),
    ).toEqual([]);
  });
});
