import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildOperationsManual, PDF_NAME } from './build-operations-manual.mjs';

const SCRIPT = join(import.meta.dirname, 'build-operations-manual.mjs');

// Prints with Google Chrome (channel `chrome`), which the Linux CI provides for the E2E tests.
describe('buildOperationsManual (CU-316)', { timeout: 60_000 }, () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'resellr-manual-'));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('writes Betriebshandbuch.pdf with at least one page into the program folder', async () => {
    const programDir = join(root, 'package');

    const target = await buildOperationsManual({ programDir });

    expect(target).toBe(join(programDir, PDF_NAME));
    const pdf = readFileSync(target);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.toString('latin1')).toMatch(/\/Type\s*\/Page\b/);
    expect(existsSync(`${target}.partial`)).toBe(false);
  });

  it('exits with code 1 and writes no PDF when the manual is missing', async () => {
    const programDir = join(root, 'missing');

    await expect(
      buildOperationsManual({ programDir, source: join(root, 'betriebshandbuch.md') }),
    ).rejects.toThrow(/ENOENT/);
    expect(existsSync(join(programDir, PDF_NAME))).toBe(false);
  });

  it('exits with code 1 and a message on stderr when the build fails', () => {
    // A file in place of the program folder cannot hold the PDF.
    const result = spawnSync(process.execPath, [SCRIPT, SCRIPT], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Operations manual PDF failed');
  });
});
