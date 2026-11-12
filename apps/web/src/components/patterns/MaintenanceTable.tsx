import { useState, type DragEvent, type ReactNode } from 'react';

import { Button } from '../ui/Button.tsx';
import { cn } from '../ui/cn.ts';

export interface MaintenanceTableProps<T> {
  /** Heading of the list, e.g. "Gerätearten". */
  title: string;
  items: readonly T[];
  getId: (item: T) => number;
  /** Entry shown in the detail area; `null` while a new entry is created or none is chosen. */
  selectedId: number | null;
  onSelect: (item: T) => void;
  /** Content of a row, e.g. name and status chip. */
  renderItem: (item: T) => ReactNode;
  /**
   * Row actions of P-01, e.g. "Deaktivieren" (UI-031): beside the row, not inside the button
   * that chooses it.
   */
  renderActions?: (item: T) => ReactNode;
  /** Number of entries beside the heading; off where the screen does not show it (UI-028). */
  showCount?: boolean;
  /**
   * Label of the "Anlegen" button and its action; without them there is none, e.g. for the
   * pick lists, which cannot be created (UI-028, RQ-07).
   */
  createLabel?: string;
  onCreate?: () => void;
  /** Locks selection and "Anlegen", e.g. while saving (P-08) or after an unknown outcome. */
  disabled?: boolean;
  /** Text or placeholder instead of the rows, e.g. the loading text of the screen. */
  placeholder?: ReactNode;
  /**
   * Text of `.empty` (e.g. "Noch keine Lieferanten"): without entries it stands in the middle
   * of the list area, with the "Anlegen" button as primary button below it.
   */
  emptyText?: string;
  /** Detail area of the chosen entry. */
  children: ReactNode;
}

/**
 * Maintenance table P-01 (CU-094, design chapter 5): list of the entries with "Anlegen" and
 * the detail area of the chosen entry. Single column as base form, so the detail area stands
 * below the list below the breakpoint `full`; from `full` on it stands beside it (R-1 (1),
 * Technical Specification 2.0.10). The order of the rows of a detail area follows P-01 with
 * `OrderControls` and `useDragOrder` below.
 */
export function MaintenanceTable<T>({
  title,
  items,
  getId,
  selectedId,
  onSelect,
  renderItem,
  renderActions,
  showCount = true,
  createLabel,
  onCreate,
  disabled = false,
  placeholder,
  emptyText,
  children,
}: MaintenanceTableProps<T>) {
  const empty = placeholder === undefined && emptyText !== undefined && items.length === 0;
  const canCreate = createLabel !== undefined && onCreate !== undefined;
  const createButton = (variant: 'primary' | 'secondary', className: string) => (
    <Button variant={variant} className={className} disabled={disabled} onClick={onCreate}>
      <span aria-hidden="true">+</span>
      {createLabel}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4 full:flex-row full:items-start">
      <section
        aria-label={title}
        className="flex flex-col rounded-control border border-border bg-surface full:w-80 full:shrink-0"
      >
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <h2 className="m-0 text-section font-semibold">{title}</h2>
          {showCount && (
            <span className="rounded-chip bg-bg px-2 text-label text-text-secondary">
              {items.length}
            </span>
          )}
        </header>
        {empty ? (
          <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
            <p className="m-0 text-body text-text-secondary">{emptyText}</p>
            {canCreate && createButton('primary', '')}
          </div>
        ) : (
          (placeholder ?? (
            <ul className="m-0 flex list-none flex-col gap-1 p-2">
              {items.map((item) => {
                const id = getId(item);
                const current = id === selectedId;
                return (
                  <li key={id} className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-current={current ? 'true' : undefined}
                      disabled={disabled}
                      onClick={() => onSelect(item)}
                      className={cn(
                        'flex w-full min-w-0 flex-1 cursor-pointer flex-col rounded-control border px-4 py-2 text-left',
                        'disabled:cursor-not-allowed',
                        current ? 'border-primary bg-bg' : 'border-transparent hover:bg-bg',
                      )}
                    >
                      {renderItem(item)}
                    </button>
                    {renderActions?.(item)}
                  </li>
                );
              })}
            </ul>
          ))
        )}
        {!empty && canCreate && (
          <footer className="border-t border-border p-2">
            {createButton('secondary', 'w-full')}
          </footer>
        )}
      </section>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** The entries with the one at `from` moved to `to` (P-01 "Reihenfolge"). */
export function moveEntry<T>(entries: readonly T[], from: number, to: number): T[] {
  const moved = [...entries];
  const [entry] = moved.splice(from, 1);
  if (entry !== undefined) moved.splice(to, 0, entry);
  return moved;
}

export interface OrderControlsProps {
  /** Position of the row, from 0. */
  index: number;
  count: number;
  disabled: boolean;
  onMove: (from: number, to: number) => void;
}

/**
 * Order of a row (P-01): its number, the grip for dragging and the buttons "Hoch" and "Runter"
 * as keyboard alternative to dragging (design chapter 5 "Tastatur").
 */
export function OrderControls({ index, count, disabled, onMove }: OrderControlsProps) {
  const arrow = 'h-8 min-w-8 px-2';
  return (
    <span className="flex items-center gap-1">
      <span
        aria-hidden="true"
        className={cn('select-none text-text-secondary', disabled ? '' : 'cursor-grab')}
      >
        ⠿
      </span>
      <span className="min-w-6 text-right">{index + 1}</span>
      <Button
        aria-label="Hoch"
        className={arrow}
        disabled={disabled || index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <span aria-hidden="true">↑</span>
      </Button>
      <Button
        aria-label="Runter"
        className={arrow}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <span aria-hidden="true">↓</span>
      </Button>
    </span>
  );
}

/**
 * Dragging of rows (P-01): returns the attributes of the row at `index`. Dropping a row onto
 * another calls `onMove(from, to)`; nothing can be dragged while `disabled`.
 */
export function useDragOrder({
  disabled,
  onMove,
}: {
  disabled: boolean;
  onMove: (from: number, to: number) => void;
}) {
  const [dragged, setDragged] = useState<number | null>(null);

  return (index: number) => ({
    draggable: !disabled,
    'data-dragging': dragged === index ? '' : undefined,
    onDragStart: (event: DragEvent) => {
      if (disabled) return;
      setDragged(index);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    },
    onDragOver: (event: DragEvent) => {
      if (dragged !== null) event.preventDefault();
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (dragged !== null && dragged !== index && !disabled) onMove(dragged, index);
      setDragged(null);
    },
    onDragEnd: () => setDragged(null),
  });
}
