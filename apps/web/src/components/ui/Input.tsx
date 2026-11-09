import type { InputHTMLAttributes } from 'react';

import { cn } from './cn.ts';

/** Text field, 36 px high with the 1 px input border (DESIGN.md "Farben", "Form und Dichte"). */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-control w-full min-w-0 rounded-control border border-border-input bg-surface px-3',
        'text-body text-text aria-invalid:border-error disabled:bg-bg',
        className,
      )}
      {...props}
    />
  );
}
