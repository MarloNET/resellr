import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { manualHtml } from './build-operations-manual.mjs';

const FONTS_DIR = new URL('../../apps/web/src/assets/fonts/', import.meta.url);
const fontAsDataUrl = (name: string) =>
  `data:font/woff2;base64,${readFileSync(new URL(name, FONTS_DIR)).toString('base64')}`;
const MANUAL = readFileSync(
  new URL('../../docs/operations/betriebshandbuch.md', import.meta.url),
  'utf8',
);

describe('operations manual HTML (CU-316)', () => {
  it('turns headings, tables and code of the manual into HTML', () => {
    const html = manualHtml(
      [
        '# Betriebshandbuch',
        '',
        '| Ordner | Speicherort |',
        '| --- | --- |',
        '| Datenordner | `%LOCALAPPDATA%\\resellr\\Daten` |',
        '',
        '1. Laden Sie `resellr-setup-<Version>.exe` herunter.',
      ].join('\n'),
    );

    expect(html).toContain('<h1>Betriebshandbuch</h1>');
    expect(html).toMatch(/<table>[\s\S]*<th>Ordner<\/th>[\s\S]*<td>Datenordner<\/td>/);
    expect(html).toContain('<code>%LOCALAPPDATA%\\resellr\\Daten</code>');
    // Placeholders in code stay text and do not become elements.
    expect(html).toContain('<code>resellr-setup-&lt;Version&gt;.exe</code>');
    expect(html).toContain('<html lang="de">');
  });

  it('embeds Inter 4.1 regular and semibold (CU-060) as data: URLs', () => {
    const html = manualHtml('# Betriebshandbuch');

    expect(html).toContain(`url('${fontAsDataUrl('Inter-Regular.woff2')}')`);
    expect(html).toContain(`url('${fontAsDataUrl('Inter-SemiBold.woff2')}')`);
  });

  it('refers to no file or address outside the document, for the whole manual', () => {
    const html = manualHtml(MANUAL);

    expect(html).toContain('<h2>1. Überblick: Ordner und Verknüpfungen</h2>');
    expect(html).not.toMatch(/url\(\s*(?!['"]?data:)/);
    expect(html).not.toMatch(/<(link|img|script|iframe|object|embed)\b/i);
    expect(html).not.toMatch(/\bsrc\s*=/i);
  });

  describe('without a font file', () => {
    let fontsDir: string;

    beforeEach(() => {
      fontsDir = mkdtempSync(join(tmpdir(), 'resellr-manual-fonts-'));
    });

    afterEach(() => rmSync(fontsDir, { recursive: true, force: true }));

    it('fails instead of printing in a substitute font', () => {
      expect(() => manualHtml('# Betriebshandbuch', fontsDir)).toThrow(/Inter-Regular\.woff2/);
    });
  });
});
