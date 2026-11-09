/** Joins class names and skips empty ones (shadcn/ui `cn` without tailwind-merge). */
export function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}
