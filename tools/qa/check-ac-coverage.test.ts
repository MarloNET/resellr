import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { acIdsInTestTitles, checkAcCoverage, parseAcSteps } from './check-ac-coverage.mjs';

const SCRIPT = fileURLToPath(new URL('./check-ac-coverage.mjs', import.meta.url));

const STEPS = {
  S1: ['AC-REQ-001-05', 'AC-REQ-001-07'],
  S2: ['AC-REQ-004-01'],
};

describe('acIdsInTestTitles', () => {
  it('finds an AC-REQ-ID at the start of an it or test title', () => {
    const source = `
      it('AC-REQ-001-05 accepts a request without login', () => {});
      test("AC-REQ-004-01 creates a device type", async () => {});
      test(\`AC-REQ-018-02 trotzdem zuordnen\`, async ({ page }) => {});
    `;

    expect(acIdsInTestTitles(source)).toEqual(
      new Set(['AC-REQ-001-05', 'AC-REQ-004-01', 'AC-REQ-018-02']),
    );
  });

  it('counts it.each, test.only, it.concurrent and Playwright tests with options', () => {
    const source = `
      it.each(['localhost:4310', 'evil.example'])(
        'AC-REQ-001-07 rejects Host %s with 403 forbidden_host',
        async (host) => {},
      );
      test.only('AC-REQ-002-01 x', () => {});
      it.concurrent('AC-REQ-003-01 x', () => {});
      test('AC-REQ-005-01 x', { tag: '@fm-7' }, async () => {});
    `;

    expect(acIdsInTestTitles(source)).toEqual(
      new Set(['AC-REQ-001-07', 'AC-REQ-002-01', 'AC-REQ-003-01', 'AC-REQ-005-01']),
    );
  });

  it('does not count skipped tests, describe titles, comments or an ID inside the title', () => {
    const source = `
      it.skip('AC-REQ-001-05 skipped', () => {});
      it.todo('AC-REQ-001-06 later');
      test.fixme('AC-REQ-001-08 broken', async () => {});
      it.skip.each([1])('AC-REQ-001-10 skipped table', () => {});
      describe('AC-REQ-001-09 group', () => {});
      test.describe('AC-REQ-002-09 group', () => {});
      // Never read as a date (AC-REQ-005-02).
      // it('AC-REQ-006-01 commented out', () => {});
      /* test('AC-REQ-007-01 commented out', () => {}); */
      const title = "it('AC-REQ-008-01 inside a string', () => {})";
      it('rejects a wrong host (AC-REQ-001-07)', () => {});
      it('AC-REQ-001-071 is not an AC-REQ-ID', () => {});
      it('AC-REQ-003-04: no space after the ID', () => {});
      it('AC-REQ-003-05 AC-REQ-003-06 only the first ID counts', () => {});
    `;

    expect(acIdsInTestTitles(source)).toEqual(new Set(['AC-REQ-003-05']));
  });

  it('counts a title that is only the ID, and a template title with a placeholder', () => {
    const source = `
      it('AC-REQ-001-05', () => {});
      it(\`AC-REQ-001-07 rejects \${host}\`, () => {});
    `;

    expect(acIdsInTestTitles(source)).toEqual(new Set(['AC-REQ-001-05', 'AC-REQ-001-07']));
  });

  it('does not count a template title without a space after the ID', () => {
    const source = 'it(`AC-REQ-001-05${suffix}`, () => {});';

    expect(acIdsInTestTitles(source)).toEqual(new Set());
  });

  it.each([
    ['describe.skip', "describe.skip('g', () => { it('AC-REQ-001-05 x', () => {}); });"],
    ['describe.todo', "describe.todo('g', () => { it('AC-REQ-001-05 x', () => {}); });"],
    [
      'describe.skip.each',
      "describe.skip.each([1])('g %s', () => { it('AC-REQ-001-05 x', () => {}); });",
    ],
    ['describe.skipIf', "describe.skipIf(ci)('g', () => { it('AC-REQ-001-05 x', () => {}); });"],
    [
      'test.describe.skip',
      "test.describe.skip('g', () => { test('AC-REQ-001-05 x', async () => {}); });",
    ],
    [
      'test.describe.fixme',
      "test.describe.fixme('g', () => { test('AC-REQ-001-05 x', async () => {}); });",
    ],
    [
      'a nested skipped group',
      "describe('a', () => { describe.skip('b', () => { describe('c', () => { it('AC-REQ-001-05 x', () => {}); }); }); });",
    ],
    [
      'describe with { skip: true }',
      "describe('g', { skip: true }, () => { it('AC-REQ-001-05 x', () => {}); });",
    ],
    ['it with { skip: true }', "it('AC-REQ-001-05 x', { skip: true }, () => {});"],
    ['it with { todo: true }', "it('AC-REQ-001-05 x', { todo: true }, () => {});"],
    ['it with { skip: condition }', "it('AC-REQ-001-05 x', { skip: ci }, () => {});"],
  ])('does not count a test in %s', (_, source) => {
    expect(acIdsInTestTitles(source)).toEqual(new Set());
  });

  it('counts tests in running groups and with options that do not skip', () => {
    const source = `
      describe('a', () => { it('AC-REQ-001-05 x', () => {}); });
      test.describe.serial('b', () => { test('AC-REQ-001-07 x', async () => {}); });
      describe.each([1])('c %s', () => { it('AC-REQ-002-01 x', () => {}); });
      describe('d', { skip: false }, () => { it('AC-REQ-002-02 x', () => {}); });
      it('AC-REQ-002-03 x', { skip: false, timeout: 100 }, () => {});
    `;

    expect(acIdsInTestTitles(source)).toEqual(
      new Set([
        'AC-REQ-001-05',
        'AC-REQ-001-07',
        'AC-REQ-002-01',
        'AC-REQ-002-02',
        'AC-REQ-002-03',
      ]),
    );
  });

  it('reads JSX in component tests', () => {
    const source =
      'it(\'AC-REQ-104-01 shows the notice\', () => { render(<Notice path="x" />); });';

    expect(acIdsInTestTitles(source, 'Notice.test.tsx')).toEqual(new Set(['AC-REQ-104-01']));
  });
});

describe('parseAcSteps', () => {
  it('accepts steps with AC-REQ-IDs and completed steps among them', () => {
    const value = { steps: STEPS, completedSteps: ['S1'] };

    expect(parseAcSteps(value)).toEqual(value);
  });

  it.each([
    [{ steps: STEPS }, '"completedSteps" must list steps of "steps"'],
    [{ steps: STEPS, completedSteps: ['S3'] }, '"completedSteps" must list steps of "steps"'],
    [{ steps: STEPS, completedSteps: ['toString'] }, '"completedSteps" must list steps of "steps"'],
    [{ steps: STEPS, completedSteps: [1] }, '"completedSteps" must list steps of "steps"'],
    [{ steps: { S1: ['REQ-001'] }, completedSteps: [] }, 'step S1 must list AC-REQ-IDs'],
    [{ completedSteps: [] }, '"steps" must map build steps to AC-REQ-IDs'],
    [
      { steps: { S1: ['AC-REQ-001-05'], S2: ['AC-REQ-001-05'] }, completedSteps: [] },
      'AC-REQ-001-05 stands in step S1 and in step S2',
    ],
  ])('rejects %j', (value, message) => {
    expect(() => parseAcSteps(value)).toThrow(message);
  });
});

describe('checkAcCoverage', () => {
  let root: string;
  const writeFile = (path: string, content: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'resellr-ac-coverage-'));
    writeFile('apps/server/src/http/listen-address.test.ts', "it('AC-REQ-001-07 x', () => {});");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('E9 is green with an empty list of completed steps', () => {
    expect(checkAcCoverage({ root, acSteps: { steps: STEPS, completedSteps: [] } })).toEqual({
      required: [],
      missing: [],
    });
  });

  it('E9 reports an AC-REQ-ID of a completed step that starts no test title', () => {
    const result = checkAcCoverage({ root, acSteps: { steps: STEPS, completedSteps: ['S1'] } });

    expect(result).toEqual({
      required: ['AC-REQ-001-05', 'AC-REQ-001-07'],
      missing: ['AC-REQ-001-05'],
    });
  });

  it('finds titles in component, integration and E2E tests of every workspace', () => {
    writeFile('apps/web/src/app/router.test.tsx', "it('AC-REQ-001-05 x', () => {});");
    writeFile('tools/demo/run-demo.int.test.ts', "it('AC-REQ-004-01 x', () => {});");
    writeFile('e2e/flow-02-einbuchen.spec.ts', "test('AC-REQ-018-02 x', async () => {});");
    const steps = { ...STEPS, S4: ['AC-REQ-018-02'] };

    const result = checkAcCoverage({
      root,
      acSteps: { steps, completedSteps: ['S1', 'S2', 'S4'] },
    });

    expect(result.missing).toEqual([]);
  });

  it('E9 stops the CI with exit code 1 and names the missing AC', () => {
    writeFile('tools/qa/ac-steps.json', JSON.stringify({ steps: STEPS, completedSteps: ['S1'] }));

    const result = spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('AC-REQ-001-05');
    expect(result.stderr).not.toContain('AC-REQ-001-07');
  });

  it('searches only the given roots', () => {
    writeFile('examples/a.test.ts', "it('AC-REQ-001-05 x', () => {});");
    const acSteps = { steps: STEPS, completedSteps: ['S1'] };

    expect(checkAcCoverage({ root, acSteps }).missing).toEqual(['AC-REQ-001-05']);
    expect(checkAcCoverage({ root, acSteps, searchRoots: ['examples'] }).missing).toEqual([
      'AC-REQ-001-07',
    ]);
  });

  it('ignores node_modules, build output, coverage, its own examples and files that are no tests', () => {
    const test = "it('AC-REQ-001-05 x', () => {});";
    writeFile('apps/web/node_modules/x/a.test.ts', test);
    writeFile('apps/web/dist/a.test.ts', test);
    writeFile('apps/web/coverage/a.test.ts', test);
    writeFile('tools/qa/check-ac-coverage.test.ts', test);
    writeFile('test/lint-boundaries.test.ts', test);
    writeFile('apps/server/src/http/local-guard.ts', test);

    const result = checkAcCoverage({ root, acSteps: { steps: STEPS, completedSteps: ['S1'] } });

    expect(result.missing).toEqual(['AC-REQ-001-05']);
  });
});

describe('check-ac-coverage.mjs in the repository', () => {
  const acSteps = parseAcSteps(
    JSON.parse(readFileSync(new URL('./ac-steps.json', import.meta.url), 'utf8')),
  );

  it('lists the ACs of S1 in the step list and S1 as completed (CU-299, Nachtrag MAR-305)', () => {
    expect(acSteps).toEqual({
      steps: { S1: ['AC-REQ-001-05', 'AC-REQ-001-07'] },
      completedSteps: ['S1'],
    });
  });

  it('passes with exit code 0 for the current step list', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('AC coverage: completed steps S1; all 2 ACs have a test.');
  });
});
