import { describe, expect, it } from 'vitest';

import { attributeInputOf } from './AttributeInput.tsx';

describe('input of a stored value (CU-112, 3.4)', () => {
  const of = (dataType: string, systemRole: string | null = null) =>
    ({ dataType, systemRole }) as Parameters<typeof attributeInputOf>[0];

  it('shows numbers as text, decimals with comma', () => {
    expect(attributeInputOf(of('integer'), 16)).toBe('16');
    expect(attributeInputOf(of('decimal'), '13.3')).toBe('13,3');
  });

  it('keeps text, yes/no and pick list values', () => {
    expect(attributeInputOf(of('text'), 'Schwarz')).toBe('Schwarz');
    expect(attributeInputOf(of('boolean'), false)).toBe(false);
    expect(attributeInputOf(of('pick'), 111)).toBe(111);
  });

  it('shows ports with the count as text and the battery capacity as percent or "nicht ermittelbar"', () => {
    expect(attributeInputOf(of('ports'), [{ count: 2, typeId: 81, positionId: null }])).toEqual([
      { count: '2', typeId: 81, positionId: null },
    ]);
    expect(attributeInputOf(of('integer', 'battery_capacity'), { percent: 85 })).toEqual({
      percent: '85',
    });
    expect(attributeInputOf(of('integer', 'battery_capacity'), { notDeterminable: true })).toEqual({
      notDeterminable: true,
    });
  });
});
