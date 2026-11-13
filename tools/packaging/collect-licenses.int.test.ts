import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bundleApp } from './bundle-app.mjs';
import { collectLicenses } from './collect-licenses.mjs';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

// The real dependency tree of today's build passes the license check (FIND-222, Nachtrag
// MAR-687, MAR-693): server and launcher from the esbuild metafile of CU-276, the native
// packages in app/node_modules and the packages Vite bundles into web-ui.
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

  it('has no libvips section while sharp is not shipped (Nachtrag MAR-687)', () => {
    expect(notices).not.toContain('libvips');
  });
});
