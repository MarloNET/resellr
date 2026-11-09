import type { ButtonHTMLAttributes } from 'react';

import { cn } from './cn.ts';

/** DESIGN.md "Buttons": one primary per area, secondary with border, destructive in error. */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary border-primary',
  secondary: 'bg-surface text-text border-border-input',
  destructive: 'bg-surface text-error border-error',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** Button classes, also for links that look like a button (shadcn/ui `buttonVariants`). */
export function buttonClassName(variant: ButtonVariant = 'secondary', className?: string): string {
  return cn(
    'inline-flex h-control items-center justify-center gap-2 rounded-control border px-4',
    'text-body font-semibold whitespace-nowrap no-underline',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, className)} {...props} />;
}
