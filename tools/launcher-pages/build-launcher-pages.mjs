// Page build (CU-272, Technical Specification 2.18 "Launcher-Seiten", T-6): copies the launcher
// pages (CU-271) into the output folder and embeds Inter 4.1 (CU-060) into the style sheet as
// `data:` URLs, because Chrome loads no fonts from `file://` pages.
// Usage: `node tools/launcher-pages/build-launcher-pages.mjs [output folder]`; without an argument
// the pages go to `tools/launcher-pages/dist/launcher-pages`.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const SOURCE_DIR = fileURLToPath(new URL('.', import.meta.url));
const STYLE_SHEET = 'launcher-pages.css';
const SCRIPT = 'launcher-pages.js';
const PAGE = /^lp-\d{2}\.html$/;
/** A font file the style sheet references with a relative path. */
const FONT_URL = /url\('([^':]+\.woff2)'\)/g;

/**
 * Replaces each relative `url('….woff2')` in `css` with the file as `data:` URL; paths are
 * relative to `cssDir`. A missing file fails the build.
 * @param {string} css
 * @param {string} cssDir
 * @returns {string}
 */
export function embedFonts(css, cssDir) {
  return css.replace(FONT_URL, (_, path) => {
    const font = readFileSync(resolve(cssDir, path)).toString('base64');
    return `url('data:font/woff2;base64,${font}')`;
  });
}

/**
 * Writes the launcher pages, their script and the style sheet with embedded fonts to `outDir`.
 * @param {string} outDir
 */
export function buildLauncherPages(outDir) {
  mkdirSync(outDir, { recursive: true });
  const files = readdirSync(SOURCE_DIR).filter((name) => PAGE.test(name));
  for (const name of [...files, SCRIPT]) copyFileSync(join(SOURCE_DIR, name), join(outDir, name));
  const css = readFileSync(join(SOURCE_DIR, STYLE_SHEET), 'utf8');
  writeFileSync(join(outDir, STYLE_SHEET), embedFonts(css, SOURCE_DIR));
}

if (import.meta.main) {
  buildLauncherPages(resolve(process.argv[2] ?? join(SOURCE_DIR, 'dist', 'launcher-pages')));
}
