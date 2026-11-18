import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildLauncherPages, embedFonts } from './build-launcher-pages.mjs';

const FONTS_DIR = new URL('../../apps/web/src/assets/fonts/', import.meta.url);
const fontAsDataUrl = (name: string) =>
  `data:font/woff2;base64,${readFileSync(new URL(name, FONTS_DIR)).toString('base64')}`;

describe('page build (CU-272)', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = join(mkdtempSync(join(tmpdir(), 'resellr-launcher-pages-')), 'launcher-pages');
  });

  afterEach(() => rmSync(join(outDir, '..'), { recursive: true, force: true }));

  it('writes the pages, the script and the style sheet into the output folder', () => {
    buildLauncherPages(outDir);

    expect(readdirSync(outDir).sort()).toEqual([
      'launcher-pages.css',
      'launcher-pages.js',
      'lp-01.html',
      'lp-02.html',
      'lp-03.html',
    ]);
  });

  it('embeds Inter 4.1 regular and semibold (CU-060) as data: URLs (T-6)', () => {
    buildLauncherPages(outDir);

    const css = readFileSync(join(outDir, 'launcher-pages.css'), 'utf8');
    expect(css).toContain(`url('${fontAsDataUrl('Inter-Regular.woff2')}')`);
    expect(css).toContain(`url('${fontAsDataUrl('Inter-SemiBold.woff2')}')`);
    expect(css).not.toMatch(/url\('(?!data:)/);
  });

  it('fails when a referenced font file is missing', () => {
    const css = "src: url('./missing.woff2') format('woff2');";

    expect(() => embedFonts(css, outDir)).toThrow(/ENOENT/);
  });

  it('keeps the pages free of scripts and style sheets from elsewhere', () => {
    buildLauncherPages(outDir);

    for (const name of ['lp-01.html', 'lp-02.html', 'lp-03.html']) {
      const html = readFileSync(join(outDir, name), 'utf8');
      const sources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
      expect(sources).toEqual(['./launcher-pages.css', './launcher-pages.js']);
    }
  });
});
