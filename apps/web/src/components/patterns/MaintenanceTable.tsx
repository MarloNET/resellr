import type { ReactNode } from 'react';

import { Button } from '../ui/Button.tsx';
import { cn } from '../ui/cn.ts';

export interface MaintenanceTableProps<T> {
  /** Heading of the list, e.g. "Gerätearten"; the number of entries stands beside it. */
  title: string;
  items: readonly T[];
  getId: (item: T) => number;
  /** Entry shown in the detail area; `null` while a new entry is created or none is chosen. */
  selectedId: number | null;
  onSelect: (item: T) => void;
  /** Content of a row, e.g. name and status chip. */
  renderItem: (item: T) => ReactNode;
  /** Label of the "Anlegen" button. */
  createLabel: string;
  onCreate: () => void;
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
 * Technical Specification 2.0.10). The order by dragging and buttons follows with the first
 * screen that orders its entries (attributes, #151).
 */
export function MaintenanceTable<T>({
  title,
  items,
  getId,
  selectedId,
  onSelect,
  renderItem,
  createLabel,
  onCreate,
  disabled = false,
  placeholder,
  emptyText,
  children,
}: MaintenanceTableProps<T>) {
  const empty = placeholder === undefined && emptyText !== undefined && items.length === 0;
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
          <span className="rounded-chip bg-bg px-2 text-label text-text-secondary">
            {items.length}
          </span>
        </header>
        {empty ? (
          <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
            <p className="m-0 text-body text-text-secondary">{emptyText}</p>
            {createButton('primary', '')}
          </div>
        ) : (
          (placeholder ?? (
            <ul className="m-0 flex list-none flex-col gap-1 p-2">
              {items.map((item) => {
                const id = getId(item);
                const current = id === selectedId;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-current={current ? 'true' : undefined}
                      disabled={disabled}
                      onClick={() => onSelect(item)}
                      className={cn(
                        'flex w-full cursor-pointer flex-col rounded-control border px-4 py-2 text-left',
                        'disabled:cursor-not-allowed',
                        current ? 'border-primary bg-bg' : 'border-transparent hover:bg-bg',
                      )}
                    >
                      {renderItem(item)}
                    </button>
                  </li>
                );
              })}
            </ul>
          ))
        )}
        {!empty && (
          <footer className="border-t border-border p-2">
            {createButton('secondary', 'w-full')}
          </footer>
        )}
      </section>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
