import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from './cn.ts';

/**
 * Table (CU-058, Technical Specification 2.0.10, R-1 (2)): scrolls horizontally in its own
 * container so the page never does; the first column stays fixed. Rows 36 px, column heads
 * in text-secondary, row hover bg, tabular figures (DESIGN.md "Tabellen", "Typografie").
 * The first column stays fixed only while the container is at least 24rem wide: in a narrower
 * one it would cover every other column at each scroll position, so there it scrolls with them
 * (2.0.10, addenda MAR-831 and MAR-834). `MaintenanceTable` keeps its tables wider than that;
 * the rule protects containers it does not control, e.g. a table in a `Dialog` or `Sheet`.
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div data-table-scroll="" className="@container w-full min-w-0 overflow-x-auto">
      <table
        className={cn(
          'w-full border-collapse bg-surface text-body tabular-nums',
          '@sm:[&_tr>*:first-child]:sticky @sm:[&_tr>*:first-child]:left-0 [&_tr>*:first-child]:bg-inherit',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('h-table-row border-b border-border bg-surface hover:bg-bg', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('px-2 text-left align-middle font-semibold text-text-secondary', className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-2 py-2 align-top [overflow-wrap:anywhere]', className)} {...props} />
  );
}
