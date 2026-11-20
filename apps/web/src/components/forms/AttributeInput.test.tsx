import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import {
  AttributeInput,
  type AttributeInputDefinition,
  attributeInputOf,
  type AttributeInputValue,
} from './AttributeInput.tsx';

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

// T15 (Technical Specification 6.2, Nachtrag MAR-1058): stored and chosen pick list values.
describe('choices of pick list values (CU-112, T15, Nachtrag MAR-1058)', () => {
  const KEYBOARD_LIST = 2;
  const PORT_TYPE_LIST = 8;
  const PORT_POSITION_LIST = 9;
  const value = (id: number, label: string, active = true) => ({
    id,
    label,
    active,
    batteryPresent: null,
    sortOrder: id,
    version: 1,
  });
  let lists: Record<number, ReturnType<typeof value>[]>;

  beforeEach(() => {
    lists = {
      [KEYBOARD_LIST]: [value(31, 'Deutsch'), value(32, 'Ungarisch', false), value(33, 'Schweiz')],
      [PORT_TYPE_LIST]: [value(81, 'USB-C', false), value(82, 'HDMI')],
      [PORT_POSITION_LIST]: [value(91, 'hinten')],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/pick-lists?')) {
          const items = [
            { id: KEYBOARD_LIST, key: 'keyboard_layout' },
            { id: PORT_TYPE_LIST, key: 'port_type' },
            { id: PORT_POSITION_LIST, key: 'port_position' },
          ].map((list) => ({ ...list, name: list.key, isBatteryList: false, version: 1 }));
          return Response.json({ items, total: items.length });
        }
        const id = Number(/\/api\/pick-lists\/(\d+)\/values/.exec(url)?.[1]);
        return Response.json({ items: lists[id] ?? [], total: lists[id]?.length ?? 0 });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const KEYBOARD = {
    id: 15,
    label: 'Tastaturlayout',
    dataType: 'pick',
    systemRole: 'keyboard_layout',
    pickListId: KEYBOARD_LIST,
    unit: null,
  } as const;
  const PORTS = {
    id: 14,
    label: 'Anschlüsse',
    dataType: 'ports',
    systemRole: null,
    pickListId: null,
    unit: null,
  } as const;

  function Harness({
    attribute,
    initial,
    storedIds,
  }: {
    attribute: AttributeInputDefinition;
    initial: AttributeInputValue;
    storedIds: number[];
  }) {
    const [input, setInput] = useState(initial);
    return (
      <AttributeInput
        attribute={attribute}
        value={input}
        required={false}
        dropped={new Set()}
        storedIds={storedIds}
        control={{ id: 'field', 'aria-label': attribute.label } as never}
        onChange={setInput}
        onBlur={() => {}}
      />
    );
  }

  function renderInput(
    attribute: AttributeInputDefinition,
    initial: AttributeInputValue,
    storedIds: number[],
  ) {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Harness attribute={attribute} initial={initial} storedIds={storedIds} />
      </QueryClientProvider>,
    );
    return queryClient;
  }

  /** Reads the lists again and waits until the inputs show them (TanStack notifies later). */
  async function reload(queryClient: QueryClient) {
    await act(async () => {
      await queryClient.refetchQueries();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  /** The text of the chosen option. */
  const shown = (select: HTMLElement) =>
    (select as HTMLSelectElement).selectedOptions[0]?.textContent;

  const optionsOf = (select: HTMLElement) =>
    within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);

  it('T15 a choice from a list shows its stored, deactivated value with "(deaktiviert)" as chosen', async () => {
    renderInput(KEYBOARD, 32, [32]);

    const select = screen.getByRole('combobox', { name: 'Tastaturlayout' });
    await waitFor(() => expect(shown(select)).toBe('Ungarisch (deaktiviert)'));
    expect(optionsOf(select)).toEqual(['', 'Deutsch', 'Ungarisch (deaktiviert)', 'Schweiz']);
  });

  it('T15 the type of a port entry shows its stored, deactivated value with "(deaktiviert)" as chosen', async () => {
    renderInput(PORTS, [{ count: '2', typeId: 81, positionId: 91 }], [81, 91]);

    const type = screen.getByRole('combobox', { name: 'Anschlüsse Typ' });
    await waitFor(() => expect(shown(type)).toBe('USB-C (deaktiviert)'));
  });

  it('T15 a chosen value deactivated after the list is read again stays chosen without a mark and goes with another choice', async () => {
    const queryClient = renderInput(KEYBOARD, null, []);
    const select = screen.getByRole('combobox', { name: 'Tastaturlayout' });
    await waitFor(() => expect(optionsOf(select)).toContain('Schweiz'));
    fireEvent.change(select, { target: { value: '33' } });

    lists[KEYBOARD_LIST] = [
      value(31, 'Deutsch'),
      value(32, 'Ungarisch', false),
      value(33, 'Schweiz', false),
    ];
    await reload(queryClient);

    expect(shown(select)).toBe('Schweiz');
    expect(optionsOf(select)).toEqual(['', 'Deutsch', 'Schweiz']);
    fireEvent.change(select, { target: { value: '31' } });
    expect(optionsOf(select)).toEqual(['', 'Deutsch']);
  });

  it('T15 a chosen port type deactivated after the reload stays chosen without a mark', async () => {
    const queryClient = renderInput(PORTS, [{ count: '1', typeId: 82, positionId: null }], []);
    const type = screen.getByRole('combobox', { name: 'Anschlüsse Typ' });
    await waitFor(() => expect(shown(type)).toBe('HDMI'));

    lists[PORT_TYPE_LIST] = [value(81, 'USB-C', false), value(82, 'HDMI', false)];
    await reload(queryClient);

    expect(shown(type)).toBe('HDMI');
    expect(optionsOf(type)).toEqual(['Bitte wählen', 'HDMI']);
  });
});
