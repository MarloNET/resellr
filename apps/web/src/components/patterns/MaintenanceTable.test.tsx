import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MaintenanceTable,
  type MaintenanceTableProps,
  moveEntry,
  OrderControls,
  useDragOrder,
} from './MaintenanceTable.tsx';

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

  it('shows the row actions beside the row, outside of the button that chooses it', () => {
    const onAction = vi.fn();
    const { region, onSelect } = renderTable({
      renderActions: (entry) => (
        <button type="button" onClick={() => onAction(entry.id)}>
          Deaktivieren
        </button>
      ),
    });

    const actions = within(region).getAllByRole('button', { name: 'Deaktivieren' });
    expect(actions).toHaveLength(2);
    expect(actions[1]!.closest('li')!.textContent).toContain('Tablet');
    expect(actions[1]!.parentElement!.closest('button')).toBeNull();
    fireEvent.click(actions[1]!);
    expect(onAction).toHaveBeenCalledWith(2);
    expect(onSelect).not.toHaveBeenCalled();
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

  it('shows the empty text in the list area with "Anlegen" as primary button below it', () => {
    const { onCreate, region } = renderTable({ items: [], emptyText: 'Noch keine Gerätearten' });

    expect(within(region).getByText('Noch keine Gerätearten')).toBeTruthy();
    const create = within(region).getAllByRole('button');
    expect(create.map((button) => button.textContent)).toEqual(['+Geräteart anlegen']);
    expect(create[0]?.className).toContain('bg-primary');
    fireEvent.click(create[0]!);
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('shows no empty text while the placeholder stands or entries exist', () => {
    renderTable({ emptyText: 'Noch keine Gerätearten' });
    expect(screen.queryByText('Noch keine Gerätearten')).toBeNull();
    cleanup();

    renderTable({ items: [], emptyText: 'Noch keine Gerätearten', placeholder: <p>Lade …</p> });
    expect(screen.queryByText('Noch keine Gerätearten')).toBeNull();
  });

  it('shows the placeholder instead of the rows', () => {
    renderTable({ placeholder: <p role="status">Lade Gerätearten …</p> });

    expect(screen.getByRole('status').textContent).toBe('Lade Gerätearten …');
    expect(screen.queryByRole('button', { name: 'Notebook' })).toBeNull();
  });

  it('shows neither the number nor "Anlegen" where the screen has none (UI-028)', () => {
    const { region } = renderTable({
      showCount: false,
      createLabel: undefined,
      onCreate: undefined,
    });

    expect(within(region).queryByText('2')).toBeNull();
    expect(
      within(region)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Notebook', 'Tablet']);
  });
});

/** Panel of 360 px as in UI-027: list 320 px and two gaps of 16 px leave `root − 712` px. */
const PANEL_WIDTH = 360;
const rootFor = (available: number) => available + 320 + 2 * 16 + PANEL_WIDTH;

/**
 * Viewport `full` or narrower, and a `ResizeObserver` that reports the width of the root element
 * set with the returned `resize`; without `observer` there is none, as in jsdom.
 */
function stubLayout({
  full,
  width,
  observer = true,
}: {
  full: boolean;
  width: number;
  observer?: boolean;
}) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      media,
      matches: full,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
  let current = width;
  const callbacks: (() => void)[] = [];
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width: current }) as DOMRect,
  );
  vi.stubGlobal(
    'ResizeObserver',
    observer
      ? class {
          constructor(callback: () => void) {
            callbacks.push(callback);
          }
          observe() {}
          disconnect() {}
        }
      : undefined,
  );
  return (next: number) => {
    current = next;
    act(() => callbacks.forEach((callback) => callback()));
  };
}

/** Without `renderTable`: behind an open sheet the list is `aria-hidden`. */
function renderWithPanel() {
  render(
    <MaintenanceTable
      title="Gerätearten"
      items={ENTRIES}
      getId={(entry) => entry.id}
      selectedId={1}
      onSelect={vi.fn()}
      renderItem={(entry) => entry.name}
      panel={{
        title: 'Merkmal bearbeiten',
        width: PANEL_WIDTH,
        content: <p>Inhalt</p>,
        onClose: vi.fn(),
      }}
    >
      <p>Detail</p>
    </MaintenanceTable>,
  );
}

const panelForm = () => ({
  beside: screen.queryByRole('complementary', { name: 'Merkmal bearbeiten' }) !== null,
  sheet: screen.queryByRole('dialog', { name: 'Merkmal bearbeiten' }) !== null,
});

describe('side panel of P-01 beside or as sheet (CU-094, addendum MAR-834)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('overlays as sheet with 479 px of room for the detail area', () => {
    stubLayout({ full: true, width: rootFor(479) });
    renderWithPanel();
    expect(panelForm()).toEqual({ beside: false, sheet: true });
  });

  it('stands beside with 480 px of room for the detail area', () => {
    stubLayout({ full: true, width: rootFor(480) });
    renderWithPanel();
    expect(panelForm()).toEqual({ beside: true, sheet: false });
  });

  it('stays a sheet up to 503 px of room and stands beside again from 504 px on', () => {
    const resize = stubLayout({ full: true, width: rootFor(479) });
    renderWithPanel();

    resize(rootFor(480));
    expect(panelForm()).toEqual({ beside: false, sheet: true });
    resize(rootFor(503));
    expect(panelForm()).toEqual({ beside: false, sheet: true });
    resize(rootFor(504));
    expect(panelForm()).toEqual({ beside: true, sheet: false });
    resize(rootFor(480));
    expect(panelForm()).toEqual({ beside: true, sheet: false });
    resize(rootFor(479));
    expect(panelForm()).toEqual({ beside: false, sheet: true });
  });

  it('stands beside from `full` on without ResizeObserver', () => {
    stubLayout({ full: true, width: 0, observer: false });
    renderWithPanel();
    expect(panelForm()).toEqual({ beside: true, sheet: false });
  });

  it('always overlays as sheet below `full`', () => {
    stubLayout({ full: false, width: rootFor(2000) });
    renderWithPanel();
    expect(panelForm()).toEqual({ beside: false, sheet: true });
  });
});

/** Rows ordered with the controls of P-01, as a screen uses them. */
function OrderedRows({ disabled = false, onMove }: { disabled?: boolean; onMove: () => void }) {
  const dragProps = useDragOrder({ disabled, onMove });
  return (
    <ul>
      {['Deutsch', 'Englisch', 'Ungarisch'].map((name, index) => (
        <li key={name} data-testid={name} {...dragProps(index)}>
          {name}
          <OrderControls index={index} count={3} disabled={disabled} onMove={onMove} />
        </li>
      ))}
    </ul>
  );
}

/** `DataTransfer` of a drag in the browser; jsdom has none. */
const dataTransfer = () => ({ effectAllowed: '', setData: vi.fn(), getData: vi.fn() });

describe('order of the rows of P-01 (CU-094)', () => {
  it('moves an entry to another position', () => {
    expect(moveEntry([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(moveEntry([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveEntry([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
  });

  it('numbers the rows and moves one with "Hoch" and "Runter"', () => {
    const onMove = vi.fn();
    render(<OrderedRows onMove={onMove} />);

    const middle = within(screen.getByTestId('Englisch'));
    expect(middle.getByText('2')).toBeTruthy();
    fireEvent.click(middle.getByRole('button', { name: 'Hoch' }));
    fireEvent.click(middle.getByRole('button', { name: 'Runter' }));

    expect(onMove.mock.calls).toEqual([
      [1, 0],
      [1, 2],
    ]);
  });

  it('offers no "Hoch" in the first row and no "Runter" in the last one', () => {
    render(<OrderedRows onMove={vi.fn()} />);

    const first = within(screen.getByTestId('Deutsch'));
    const last = within(screen.getByTestId('Ungarisch'));
    expect(first.getByRole<HTMLButtonElement>('button', { name: 'Hoch' }).disabled).toBe(true);
    expect(first.getByRole<HTMLButtonElement>('button', { name: 'Runter' }).disabled).toBe(false);
    expect(last.getByRole<HTMLButtonElement>('button', { name: 'Runter' }).disabled).toBe(true);
  });

  it('moves a row dropped onto another one', () => {
    const onMove = vi.fn();
    render(<OrderedRows onMove={onMove} />);
    const source = screen.getByTestId('Ungarisch');
    const target = screen.getByTestId('Deutsch');

    expect(source.getAttribute('draggable')).toBe('true');
    fireEvent.dragStart(source, { dataTransfer: dataTransfer() });
    fireEvent.dragOver(target, { dataTransfer: dataTransfer() });
    fireEvent.drop(target, { dataTransfer: dataTransfer() });

    expect(onMove).toHaveBeenCalledExactlyOnceWith(2, 0);
  });

  it('neither drags nor moves while disabled (P-08)', () => {
    const onMove = vi.fn();
    render(<OrderedRows disabled onMove={onMove} />);
    const source = screen.getByTestId('Ungarisch');

    expect(source.getAttribute('draggable')).toBe('false');
    fireEvent.dragStart(source, { dataTransfer: dataTransfer() });
    fireEvent.drop(screen.getByTestId('Deutsch'), { dataTransfer: dataTransfer() });
    for (const button of screen.getAllByRole<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
    }
    expect(onMove).not.toHaveBeenCalled();
  });
});
