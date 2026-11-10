// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const WEB_ROOT = resolve(import.meta.dirname, '..');

/**
 * URL strings in the production bundle that are no requests: XML namespaces of react-dom,
 * links inside error messages of React and React Router, React Router's base for parsing
 * relative URLs (`new URL(path, 'http://localhost')`) when no window is present, and from Zod
 * (error response schema of the API client) the `$schema` identifiers of its JSON Schema output.
 */
const NON_REQUEST_URLS = [
  'http://json-schema.org/draft-04/schema#',
  'http://json-schema.org/draft-07/schema#',
  'http://localhost',
  'https://json-schema.org/draft/2020-12/schema',
  'https://reactrouter.com/en/main/routers/picking-a-router.',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/XML/1998/namespace',
];

function filesBelow(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

describe('E6 bundle without external resources (REQ-079)', () => {
  let outDir: string;
  let files: string[];

  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'resellr-web-build-'));
    // Vitest sets NODE_ENV=test; the shipped bundle is the production build.
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({ root: WEB_ROOT, logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
    files = filesBelow(outDir);
  }, 120_000);

  afterAll(() => rmSync(outDir, { recursive: true, force: true }));

  it('index.html references only local assets', () => {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');

    expect(html).not.toMatch(/https?:\/\/|(src|href)="\/\//);
    for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      expect(url).toMatch(/^\/assets\//);
    }
  });

  it('bundles Inter 4.1 Regular and SemiBold as woff2 and loads them from /assets', () => {
    const fonts = files
      .filter((file) => file.endsWith('.woff2'))
      .map((file) => file.slice(outDir.length));
    expect(fonts).toHaveLength(2);
    expect(fonts.some((font) => font.startsWith('/assets/Inter-Regular-'))).toBe(true);
    expect(fonts.some((font) => font.startsWith('/assets/Inter-SemiBold-'))).toBe(true);

    const css = files
      .filter((file) => file.endsWith('.css'))
      .map((file) => readFileSync(file, 'utf8'));
    const fontUrls = css.join('\n').match(/url\([^)]*\)/g) ?? [];
    expect(fontUrls.length).toBeGreaterThanOrEqual(2);
    for (const url of fontUrls) expect(url).toMatch(/^url\("?\/assets\//);
  });

  it('CSS and JavaScript contain no URL of another host', () => {
    const text = files
      .filter((file) => /\.(css|js)$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const urls = [...new Set(text.match(/https?:\/\/[^\s"'`)\\]+/g) ?? [])];

    const external = urls.filter(
      (url) =>
        !url.startsWith('http://127.0.0.1') &&
        !NON_REQUEST_URLS.some((allowed) => url === allowed || url.startsWith(`${allowed}/`)) &&
        !url.startsWith('https://react.dev/errors/') &&
        // Template with a variable host, e.g. Zod's IPv6 check `new URL(`http://[${value}]`)`.
        !/^https?:\/\/\[?\$\{\w+\}\]?$/.test(url),
    );
    expect(external).toEqual([]);
    expect(text).not.toMatch(/@import\s+url|url\(\s*["']?\/\//);
  });
});
