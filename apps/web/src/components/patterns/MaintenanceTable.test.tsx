import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceTable, type MaintenanceTableProps } from './MaintenanceTable.tsx';

interface Entry {
  id: number;
  name: string;
}

const ENTRIES: Entry[] = [
  { id: 1, name: 'Notebook' },
  { id: 2, name: 'Tablet' },
];

function renderTable(props: Partial<MaintenanceTableProps<Entry>> = {}) {
  const onSelect = vi.fn();
  const onCreate = vi.fn();
  render(
    <MaintenanceTable
      title="Gerätearten"
      items={ENTRIES}
      getId={(entry) => entry.id}
      selectedId={1}
      onSelect={onSelect}
      renderItem={(entry) => entry.name}
      createLabel="Geräteart anlegen"
      onCreate={onCreate}
      {...props}
    >
      <p>Detail</p>
    </MaintenanceTable>,
  );
  return { onSelect, onCreate, region: screen.getByRole('region', { name: 'Gerätearten' }) };
}

afterEach(cleanup);

describe('maintenance table P-01 (CU-094)', () => {
  it('lists the entries with the number of entries and marks the chosen one', () => {
    const { region } = renderTable();

    expect(within(region).getByRole('heading', { name: 'Gerätearten' })).toBeTruthy();
    expect(within(region).getByText('2')).toBeTruthy();
    const rows = within(region).getAllByRole('button', { name: /Notebook|Tablet/ });
    expect(rows.map((row) => [row.textContent, row.getAttribute('aria-current')])).toEqual([
      ['Notebook', 'true'],
      ['Tablet', null],
    ]);
    expect(screen.getByText('Detail')).toBeTruthy();
  });

  it('chooses an entry and creates a new one', () => {
    const { onSelect, onCreate } = renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Tablet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Geräteart anlegen' }));

    expect(onSelect).toHaveBeenCalledWith(ENTRIES[1]);
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('locks choosing and creating while disabled (P-08)', () => {
    renderTable({ disabled: true });

    for (const button of screen.getAllByRole<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
    }
  });

  it('shows the placeholder instead of the rows', () => {
    renderTable({ placeholder: <p role="status">Lade Gerätearten …</p> });

    expect(screen.getByRole('status').textContent).toBe('Lade Gerätearten …');
    expect(screen.queryByRole('button', { name: 'Notebook' })).toBeNull();
  });
});
