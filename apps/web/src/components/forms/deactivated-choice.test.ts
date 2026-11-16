import { describe, expect, it } from 'vitest';

import { choiceOptions, findMissingChoices, type ChoiceField } from './deactivated-choice.ts';

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

  it('marks nothing on a stored entry that is active', () => {
    expect(choiceOptions([WEST], { storedId: 1, markDeactivated: true })).toEqual([
      { id: 1, label: 'Lieferant West' },
    ]);
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
});
