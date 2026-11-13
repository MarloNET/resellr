import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bundleApp } from './bundle-app.mjs';
import { collectLicenses } from './collect-licenses.mjs';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

// The real dependency tree of today's build passes the license check (FIND-222, Nachtrag
// MAR-687, MAR-693, MAR-720, MAR-758): server and launcher from the esbuild metafile of CU-276 and its
// closure over dependencies, the native packages in app/node_modules and the packages Vite
// bundles into web-ui.
describe('collectLicenses on the real bundle', { timeout: 60_000 }, () => {
  let root: string;
  let notices: string;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'resellr-licenses-'));
    const programDir = join(root, 'resellr');
    const webDist = join(root, 'web-dist');
    mkdirSync(webDist, { recursive: true });
    writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>resellr</title>');
    // On Windows `LICENSE` lies next to node.exe; the test gives the build a stand-in.
    const nodeLicense = join(root, 'node-LICENSE');
    writeFileSync(nodeLicense, 'Node.js is licensed for use as follows:');

    const { metafile } = await bundleApp({ repoRoot: REPO_ROOT, programDir, webDist });
    const target = collectLicenses({ repoRoot: REPO_ROOT, programDir, metafile, nodeLicense });
    notices = readFileSync(target, 'utf8');
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes THIRD-PARTY-NOTICES.txt with Node.js and Inter', () => {
    expect(notices).toContain('Node.js is licensed for use as follows:');
    expect(notices).toMatch(/^Inter$/m);
    expect(notices).toContain('SIL OPEN FONT LICENSE');
  });

  it('lists bundled, native and web-ui packages', () => {
    for (const name of ['fastify', 'better-sqlite3', 'react', 'react-dom', 'tailwindcss']) {
      expect(notices).toMatch(new RegExp(`^${name}@\\d`, 'm'));
    }
  });

  it('accepts the BlueOak-1.0.0 packages and the packages without license file (Nachtrag MAR-693)', () => {
    expect(notices).toMatch(/^glob@\d.*\nLizenz: BlueOak-1\.0\.0$/m);
    expect(notices).toMatch(
      /^abstract-logging@[^\n]*\n[^\n]*\n=+\n\nLizenztext nicht im Paket enthalten, Quelle: https:\/\/jsumners\.mit-license\.org\//m,
    );
    expect(notices).toMatch(
      /^react-remove-scroll-bar@[^\n]*\n[^\n]*\n=+\n\nLizenztext nicht im Paket enthalten, Quelle: https:\/\/github\.com\/theKashey\//m,
    );
  });

  it('lists the dependencies pre-bundled into glob (Nachtrag MAR-720)', () => {
    for (const name of [
      'minimatch',
      '@isaacs/nonrecursive-glob-match',
      'minipass',
      'path-scurry',
      'lru-cache',
    ]) {
      expect(notices).toMatch(new RegExp(`^${name}@\\d.*\\nLizenz: BlueOak-1\\.0\\.0$`, 'm'));
    }
    for (const name of ['brace-expansion', 'balanced-match']) {
      expect(notices).toMatch(new RegExp(`^${name}@\\d.*\\nLizenz: MIT$`, 'm'));
    }
  });

  it('has the libvips section of sharp and the texts of LGPL-3.0 and GPL-3.0 (Nachtrag MAR-687, MAR-758)', () => {
    expect(notices).toMatch(/^libvips aus @img\/sharp-(win32-x64|libvips-[^@\n]+)@\d/m);
    expect(notices).toContain('GNU LESSER GENERAL PUBLIC LICENSE');
    expect(notices).toContain('GNU GENERAL PUBLIC LICENSE');
  });

  it('refers a libvips package without license file to the appended texts (Nachtrag MAR-758)', () => {
    const libvipsPackages = [...notices.matchAll(/^(@img\/sharp-libvips-[^@\n]+@[^\n]+)$/gm)].map(
      (match) => match[1],
    );
    for (const pkg of libvipsPackages) {
      expect(notices).toContain(
        `${pkg}\nLizenz: LGPL-3.0-or-later\n${'='.repeat(80)}\n\nLizenztext nicht im Paket enthalten. Es gelten LGPL-3.0 und GPL-3.0, Texte am Ende dieser Datei; Bibliotheken und Quellcode im Abschnitt „libvips aus ${pkg}“.`,
      );
    }
  });
});
