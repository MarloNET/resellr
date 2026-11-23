import type { Attribute } from '@resellr/domain/schemas/attribute.schema';
import { attributeValuesSchema } from '@resellr/domain/schemas/attribute-values.schema';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { AttributeFieldsForm, attributeRequestValues } from './AttributeFieldsForm.tsx';

const attribute = (id: number, label: string, change: Partial<Attribute> = {}): Attribute => ({
  id,
  deviceTypeId: 1,
  label,
  dataType: 'text',
  systemRole: null,
  unit: null,
  unitSpacing: true,
  minValue: null,
  maxValue: null,
  pickListId: null,
  level: 'model',
  variantForming: false,
  required: false,
  datasheetBlock: 'technical',
  sortOrder: id,
  active: true,
  version: 1,
  ...change,
});

const ATTRIBUTES = [
  attribute(3, 'Displaygröße', { dataType: 'decimal', required: true, sortOrder: 2 }),
  attribute(1, 'Prozessor', { required: true, sortOrder: 1 }),
  attribute(2, 'Touchscreen', { dataType: 'boolean', sortOrder: 3 }),
  attribute(4, 'Optisches Laufwerk', { sortOrder: 4, active: false }),
  attribute(5, 'RAM', { dataType: 'integer', level: 'device', required: true, sortOrder: 5 }),
  attribute(6, 'Anschlüsse', { dataType: 'ports', sortOrder: 6 }),
  attribute(7, 'Akkukapazität', {
    dataType: 'integer',
    systemRole: 'battery_capacity',
    level: 'device',
    sortOrder: 7,
  }),
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ items: [], total: 0 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderLevel(level: 'model' | 'device', withRequired: boolean) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AttributeFieldsForm
        attributes={ATTRIBUTES}
        level={level}
        inputs={{}}
        errors={{ 1: 'Prozessor fehlt' }}
        withRequired={withRequired}
        dropped={new Set()}
        onChange={() => {}}
        onBlur={() => {}}
        reviewMark={(definition) => (definition.id === 2 ? <span>zu prüfen</span> : null)}
      />
    </QueryClientProvider>,
  );
  return Array.from(document.querySelectorAll('label[for]'), (label) => label.textContent);
}

describe('attribute fields (CU-111, 2.5)', () => {
  it('DER-50-11 builds the fields of the active attributes of the level in their order, "*" at required ones', () => {
    expect(renderLevel('model', true)).toEqual([
      'Prozessor*',
      'Displaygröße*',
      'Touchscreen',
      'Anschlüsse',
    ]);
    expect(screen.getByRole('textbox', { name: 'Prozessor' }).getAttribute('aria-required')).toBe(
      'true',
    );
  });

  it('shows the error of a field and the place for its review mark', () => {
    renderLevel('model', true);

    const processor = screen.getByRole('textbox', { name: 'Prozessor' });
    expect(processor.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Prozessor fehlt')).toBeTruthy();
    expect(screen.getByText('zu prüfen')).toBeTruthy();
  });

  it('DER-50-10 shows the attributes of the level device without "*" where the level asks for none', () => {
    expect(renderLevel('device', false)).toEqual(['RAM', 'Akkukapazität']);
    expect(screen.getByRole('textbox', { name: 'RAM' }).getAttribute('aria-required')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'nicht ermittelbar' })).toBeTruthy();
  });
});

describe('attribute values of a request (CU-111, CU-112, 2.5)', () => {
  it('sends every asked attribute of the level, an empty input as no value', () => {
    expect(attributeRequestValues(ATTRIBUTES, 'model', { 3: '14,01' })).toEqual({
      1: '',
      3: '14,01',
      2: null,
      6: [],
    });
    expect(attributeRequestValues(ATTRIBUTES, 'device', { 7: { percent: ' ' } })).toEqual({
      5: '',
      7: null,
    });
  });

  it('leaves out untouched port entries and keeps the others as entered', () => {
    expect(
      attributeRequestValues(ATTRIBUTES, 'model', {
        6: [
          { count: '2', typeId: 61, positionId: null },
          { count: '', typeId: null, positionId: null },
        ],
      })[6],
    ).toEqual([{ count: '2', typeId: 61, positionId: null }]);
  });

  it('sends the battery capacity "nicht ermittelbar"', () => {
    expect(
      attributeRequestValues(ATTRIBUTES, 'device', { 7: { notDeterminable: true } })[7],
    ).toEqual({ notDeterminable: true });
  });
});

describe('deactivated and reactivated attributes (CU-111, 2.5, REQ-005)', () => {
  /** RAM deactivated (`active: false`) or reactivated (`active: true`), required either way. */
  const withRam = (active: boolean) =>
    ATTRIBUTES.map((definition) => (definition.id === 5 ? { ...definition, active } : definition));

  function renderDevice(attributes: readonly Attribute[], errors = {}) {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <AttributeFieldsForm
          attributes={attributes}
          level="device"
          inputs={{}}
          errors={errors}
          withRequired
          dropped={new Set()}
          onChange={() => {}}
          onBlur={() => {}}
        />
      </QueryClientProvider>,
    );
    return Array.from(document.querySelectorAll('label[for]'), (label) => label.textContent);
  }

  it('DER-34-22 shows no field for a deactivated attribute, and the request sends no key for it, so its stored value stays', () => {
    expect(renderDevice(withRam(false))).toEqual(['Akkukapazität']);
    expect(screen.queryByRole('textbox', { name: 'RAM' })).toBeNull();

    // Not even `null`, which would remove the stored value (2.5 "Merkmalswerte bei PATCH").
    expect(attributeRequestValues(withRam(false), 'device', { 5: '16' })).toEqual({ 7: null });
  });

  it('DER-34-22 shows a reactivated required attribute as an empty required field "*", and the check in the browser names "RAM fehlt" before sending', () => {
    const attributes = withRam(true);
    const values = attributeRequestValues(attributes, 'device', {});
    const issues = attributeValuesSchema(attributes, 'device').safeParse(values).error?.issues;

    expect(issues?.map(({ path, message }) => [path.join('.'), message])).toEqual([
      ['5', 'RAM fehlt'],
    ]);
    expect(renderDevice(attributes, { 5: issues?.[0]?.message })).toEqual([
      'RAM*',
      'Akkukapazität',
    ]);
    const ram = screen.getByRole<HTMLInputElement>('textbox', { name: 'RAM' });
    expect(ram.value).toBe('');
    expect(ram.getAttribute('aria-required')).toBe('true');
    expect(ram.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('RAM fehlt')).toBeTruthy();
  });
});
