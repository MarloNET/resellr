import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const designMd = readFileSync(
  resolve(import.meta.dirname, '../../../../docs/ux/DESIGN.md'),
  'utf8',
);
const tokensCss = readFileSync(resolve(import.meta.dirname, 'tokens.css'), 'utf8');
const tailwindCss = readFileSync(resolve(import.meta.dirname, 'tailwind.css'), 'utf8');

function cssVariable(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(tokensCss)?.[1]?.trim();
}

/** Colour rows of DESIGN.md: `| token | #hex |` or `| token | #fg auf #bg |`. */
function designColours(): Array<[token: string, fg: string, bg?: string]> {
  const rows = [
    ...designMd.matchAll(/^\| ([a-z-]+) \| (#[0-9A-F]{6})(?: auf (#[0-9A-F]{6}))? \|/gm),
  ];
  return rows.map(([, token, fg, bg]) => [token!, fg!, bg]);
}

describe('E7 design tokens match DESIGN.md', () => {
  it('has every colour of DESIGN.md', () => {
    const colours = designColours();
    expect(colours.map(([token]) => token)).toEqual([
      'bg',
      'surface',
      'border',
      'text',
      'text-secondary',
      'primary',
      'on-primary',
      'status-draft',
      'status-approved',
      'status-published',
      'flag-warn',
      'error',
    ]);
    for (const [token, fg, bg] of colours) {
      expect(cssVariable(`resellr-${token}`), token).toBe(fg.toLowerCase());
      if (bg) expect(cssVariable(`resellr-${token}-bg`), `${token}-bg`).toBe(bg.toLowerCase());
    }
    // "Eingabefelder zusätzlich 1 px #9CA3AF"
    expect(designMd).toContain('Eingabefelder zusätzlich 1 px #9CA3AF');
    expect(cssVariable('resellr-border-input')).toBe('#9ca3af');
  });

  it('has the type scale of DESIGN.md with Inter and no size below 12 px', () => {
    expect(designMd).toContain(
      'Seitentitel 22/28 semibold, Abschnitt 16/24 semibold, Text 14/20, Hilfstext/Label 12/16. Mindestgröße 12 px.',
    );
    const scale = {
      'page-title': ['22px', '28px'],
      section: ['16px', '24px'],
      body: ['14px', '20px'],
      label: ['12px', '16px'],
    };
    for (const [name, [size, lineHeight]] of Object.entries(scale)) {
      expect(cssVariable(`resellr-text-${name}`)).toBe(size);
      expect(cssVariable(`resellr-text-${name}-line-height`)).toBe(lineHeight);
    }
    expect(cssVariable('resellr-font-family')).toBe("'Inter', sans-serif");
    expect(cssVariable('resellr-font-weight-semibold')).toBe('600');

    // E8: the theme offers only these sizes, all at least 12 px.
    expect(tailwindCss).toContain('--text-*: initial;');
    const sizes = [...tokensCss.matchAll(/--resellr-text-[a-z-]+:\s*(\d+)px;/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });

  it('has radius 6 px, chips 4 px, the 8 px grid and the density of DESIGN.md', () => {
    expect(designMd).toContain(
      'Eckenradius 6 px (Felder, Buttons, Karten), Chips 4 px. 8er-Raster.',
    );
    expect(cssVariable('resellr-radius-control')).toBe('6px');
    expect(cssVariable('resellr-radius-chip')).toBe('4px');
    expect(cssVariable('resellr-grid')).toBe('8px');
    expect(cssVariable('resellr-control-height')).toBe('36px');
    expect(cssVariable('resellr-table-row-height')).toBe('36px');
    expect(cssVariable('resellr-nav-width')).toBe('208px');
    expect(cssVariable('resellr-nav-header-height')).toBe('40px');
    expect(cssVariable('resellr-nav-item-height')).toBe('28px');
    expect(tailwindCss).toContain('--radius-*: initial;');
    expect(tailwindCss).toContain('--color-*: initial;');
  });

  it('has exactly one breakpoint `full` at 1366 px; below it the single-column base form applies', () => {
    const breakpoints = [...tailwindCss.matchAll(/--breakpoint-([a-z*-]+):\s*([^;]+);/g)].map(
      ([, name, value]) => [name, value],
    );
    expect(breakpoints).toEqual([
      ['*', 'initial'],
      ['full', '1366px'],
    ]);
  });

  it('E6 loads Inter from the bundled woff2 files only', () => {
    const sources = [...tokensCss.matchAll(/url\('([^']+)'\)/g)].map(([, url]) => url);
    expect(sources).toEqual([
      '../assets/fonts/Inter-Regular.woff2',
      '../assets/fonts/Inter-SemiBold.woff2',
    ]);
    expect(`${tokensCss}\n${tailwindCss}`).not.toMatch(/https?:\/\/|@import\s+url/);
  });
});
