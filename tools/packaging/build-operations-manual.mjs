// Operations manual PDF (CU-316, Technical Specification 2.19 "Build des Pakets", Baseline 10.3,
// Nachtrag MAR-599): converts the operations manual (CU-280) with `marked` to HTML, embeds Inter 4.1
// (CU-060) as `data:` URLs like CU-272 and prints it in Google Chrome to
// `<program folder>/Betriebshandbuch.pdf`, which the installer script (CU-273) requires.
// Usage: `node tools/packaging/build-operations-manual.mjs [<program folder>]`; without an argument
// the PDF goes to `build/package`, the default `StageDir` of CU-273. Exits with code 1 if the
// manual, a font file or Google Chrome is missing.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { chromium } from '@playwright/test';
import { marked } from 'marked';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MANUAL = join(REPO_ROOT, 'docs', 'operations', 'betriebshandbuch.md');
const FONTS_DIR = join(REPO_ROOT, 'apps', 'web', 'src', 'assets', 'fonts');
const DEFAULT_PROGRAM_DIR = join(REPO_ROOT, 'build', 'package');
export const PDF_NAME = 'Betriebshandbuch.pdf';

/** Inter 4.1 cuts of CU-060 the manual uses. */
const FONTS = [
  { file: 'Inter-Regular.woff2', weight: 400 },
  { file: 'Inter-SemiBold.woff2', weight: 600 },
];

const STYLE = `
  @page { size: A4; margin: 20mm 18mm 22mm; }
  body { font-family: 'Inter', sans-serif; font-size: 10pt; line-height: 1.45; color: #1a1a1a; }
  h1 { font-size: 20pt; font-weight: 600; margin: 0 0 12pt; }
  h2 { font-size: 14pt; font-weight: 600; margin: 20pt 0 8pt; break-after: avoid; }
  h3 { font-size: 11pt; font-weight: 600; margin: 14pt 0 6pt; break-after: avoid; }
  strong { font-weight: 600; }
  code { font-family: Consolas, 'Courier New', monospace; font-size: 9pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9pt; }
  tr { break-inside: avoid; }
  th, td { border: 0.5pt solid #9a9a9a; padding: 3pt 5pt; text-align: left; vertical-align: top; }
  th { font-weight: 600; background: #eeeeee; }
  li { margin: 2pt 0; }
`;

/**
 * Turns the manual into one self-contained HTML document: Inter as `data:` URLs, no other file
 * or address. A missing font file fails the build.
 * @param {string} markdown
 * @param {string} [fontsDir]
 * @returns {string}
 */
export function manualHtml(markdown, fontsDir = FONTS_DIR) {
  const fontFaces = FONTS.map(({ file, weight }) => {
    const font = readFileSync(join(fontsDir, file)).toString('base64');
    return `@font-face { font-family: 'Inter'; font-style: normal; font-weight: ${weight}; src: url('data:font/woff2;base64,${font}') format('woff2'); }`;
  }).join('\n');
  const body = marked.parse(markdown, { async: false, gfm: true });
  return [
    '<!doctype html>',
    '<html lang="de">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>Betriebshandbuch resellr</title>',
    `<style>${fontFaces}\n${STYLE}</style>`,
    '</head>',
    `<body>${body}</body>`,
    '</html>',
  ].join('\n');
}

const FOOTER = `
  <div style="font-family: sans-serif; font-size: 8pt; width: 100%; text-align: center; color: #555;">
    Seite <span class="pageNumber"></span> von <span class="totalPages"></span>
  </div>`;

/**
 * Prints the manual in Google Chrome to `<programDir>/Betriebshandbuch.pdf`. The file appears only
 * once the PDF is complete.
 * @param {{ programDir: string, source?: string, fontsDir?: string,
 *   launchOptions?: import('@playwright/test').LaunchOptions }} options
 *   `launchOptions` replaces the launch in Google Chrome (channel `chrome`).
 * @returns {Promise<string>} path of the PDF
 */
export async function buildOperationsManual({
  programDir,
  source = MANUAL,
  fontsDir = FONTS_DIR,
  launchOptions = { channel: 'chrome' },
}) {
  const html = manualHtml(readFileSync(source, 'utf8'), fontsDir);
  const browser = await chromium.launch(launchOptions);
  let pdf;
  try {
    const page = await browser.newPage();
    // The document loads nothing; any request would be a mistake in the manual.
    await page.route('**/*', (route) => route.abort());
    await page.setContent(html, { waitUntil: 'load' });
    // Prints only after Inter is ready, never in a substitute font.
    await page.evaluate('document.fonts.ready.then(() => undefined)');
    pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: FOOTER,
    });
  } finally {
    await browser.close();
  }
  mkdirSync(programDir, { recursive: true });
  const target = join(programDir, PDF_NAME);
  const partial = `${target}.partial`;
  try {
    writeFileSync(partial, pdf);
    renameSync(partial, target);
  } finally {
    rmSync(partial, { force: true });
  }
  return target;
}

if (import.meta.main) {
  const programDir = resolve(process.argv[2] ?? DEFAULT_PROGRAM_DIR);
  try {
    const target = await buildOperationsManual({ programDir });
    process.stdout.write(`Operations manual PDF: ${target}\n`);
  } catch (error) {
    process.stderr.write(
      `Operations manual PDF failed: ${error instanceof Error ? error.message : error}\n`,
    );
    process.exitCode = 1;
  }
}
