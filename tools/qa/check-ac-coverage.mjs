// AC coverage check (CU-284, Technical Specification 6.2, FIND-223): every AC-REQ-ID of the
// completed build steps in `ac-steps.json` (CU-299) must start the title of at least one
// automated test. Usage: `node tools/qa/check-ac-coverage.mjs [repository root]`; exit code 1
// if an AC is missing, which stops the CI.
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import ts from 'typescript';

const AC_ID = /^AC-REQ-\d{3}-\d{2}$/;
/** A test title that starts with an AC-REQ-ID followed by a space or the end of the title. */
const TITLE_WITH_AC_ID = /^(AC-REQ-\d{3}-\d{2})(?: |$)/;

/** Folders searched for tests (Technical Specification 6.2, Nachtrag MAR-305). */
export const SEARCH_ROOTS = ['apps', 'packages', 'tools', 'e2e'];
/** Unit, component and integration tests next to their unit, and the E2E suite. */
const TEST_FILE_PATTERN = '**/*.{test.ts,test.tsx,spec.ts}';
const IGNORED = [
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  'test/fixtures/**',
  // The examples of this check are no tests of the product.
  'tools/qa/check-ac-coverage.test.ts',
];

/** Test functions whose call registers a test; `.skip`, `.todo` and `.fixme` do not run it. */
const TEST_FUNCTIONS = new Set(['it', 'test']);
const RUNNING_MODIFIERS = new Set(['only', 'concurrent', 'sequential', 'fails']);

/**
 * @typedef {object} AcSteps
 * @property {Record<string, string[]>} steps AC-REQ-IDs per build step (S1 to S11)
 * @property {string[]} completedSteps build steps entered as completed at their acceptance
 */

/**
 * Checks the content of `ac-steps.json` and returns it typed.
 * @param {unknown} value
 * @returns {AcSteps}
 */
export function parseAcSteps(value) {
  if (typeof value !== 'object' || value === null) throw new Error('ac-steps.json: no object');
  const { steps, completedSteps } = /** @type {Record<string, unknown>} */ (value);
  if (typeof steps !== 'object' || steps === null || Array.isArray(steps)) {
    throw new Error('ac-steps.json: "steps" must map build steps to AC-REQ-IDs');
  }
  /** @type {Map<string, string>} */
  const stepOfId = new Map();
  for (const [step, ids] of Object.entries(steps)) {
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && AC_ID.test(id))) {
      throw new Error(`ac-steps.json: step ${step} must list AC-REQ-IDs like AC-REQ-001-05`);
    }
    for (const id of ids) {
      const other = stepOfId.get(id);
      if (other !== undefined) {
        throw new Error(`ac-steps.json: ${id} stands in step ${other} and in step ${step}`);
      }
      stepOfId.set(id, step);
    }
  }
  if (!Array.isArray(completedSteps) || !completedSteps.every((step) => step in steps)) {
    throw new Error('ac-steps.json: "completedSteps" must list steps of "steps"');
  }
  return /** @type {AcSteps} */ ({ steps, completedSteps });
}

/**
 * Whether `callee` registers a running test: `it`, `test`, also with `.only`, `.concurrent`,
 * `.sequential`, `.fails` or `.each(table)`; not `describe`, `.skip`, `.todo`, `.fixme`.
 * @param {ts.Expression} callee
 * @returns {boolean}
 */
function isTestFunction(callee) {
  if (ts.isIdentifier(callee)) return TEST_FUNCTIONS.has(callee.text);
  if (ts.isPropertyAccessExpression(callee)) {
    return RUNNING_MODIFIERS.has(callee.name.text) && isTestFunction(callee.expression);
  }
  // `it.each(table)('title', …)`
  if (ts.isCallExpression(callee) && ts.isPropertyAccessExpression(callee.expression)) {
    return callee.expression.name.text === 'each' && isTestFunction(callee.expression.expression);
  }
  return false;
}

/**
 * AC-REQ-IDs that start the title of a test (Vitest `it`/`test`, Playwright `test`) in the given
 * source text (6.2): only the first ID at the start of the title counts. `describe` titles,
 * skipped tests and comments do not count.
 * @param {string} source
 * @param {string} [fileName]
 * @returns {Set<string>}
 */
export function acIdsInTestTitles(source, fileName = 'test.ts') {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, kind);
  /** @type {Set<string>} */
  const ids = new Set();
  /** @param {ts.Node} node */
  const visit = (node) => {
    if (ts.isCallExpression(node) && isTestFunction(node.expression)) {
      const [title] = node.arguments;
      const text =
        title === undefined
          ? undefined
          : ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title)
            ? title.text
            : ts.isTemplateExpression(title)
              ? title.head.text
              : undefined;
      const id = text === undefined ? undefined : TITLE_WITH_AC_ID.exec(text)?.[1];
      if (id !== undefined) ids.add(id);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return ids;
}

/**
 * Compares the ACs of the completed steps with the test titles in the search roots below `root`.
 * @param {{ root: string, acSteps: AcSteps, searchRoots?: string[] }} input
 * @returns {{ required: string[], missing: string[] }}
 */
export function checkAcCoverage({ root, acSteps, searchRoots = SEARCH_ROOTS }) {
  const required = acSteps.completedSteps.flatMap((step) => acSteps.steps[step] ?? []).sort();
  const patterns = searchRoots.map((searchRoot) => `${searchRoot}/${TEST_FILE_PATTERN}`);
  const covered = new Set();
  for (const file of globSync(patterns, { cwd: root, exclude: IGNORED })) {
    const source = readFileSync(join(root, file), 'utf8');
    for (const id of acIdsInTestTitles(source, file)) covered.add(id);
  }
  return { required, missing: required.filter((id) => !covered.has(id)) };
}

/** @param {string} root */
function main(root) {
  const acSteps = parseAcSteps(
    JSON.parse(readFileSync(join(root, 'tools/qa/ac-steps.json'), 'utf8')),
  );
  const { required, missing } = checkAcCoverage({ root, acSteps });
  const steps = acSteps.completedSteps.join(', ') || 'none';

  if (missing.length > 0) {
    process.stderr.write(`AC coverage: completed steps ${steps}; no test title starts with:\n`);
    for (const id of missing) process.stderr.write(`  ${id}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `AC coverage: completed steps ${steps}; all ${required.length} ACs have a test.\n`,
  );
}

if (import.meta.main) main(process.argv[2] ?? fileURLToPath(new URL('../../', import.meta.url)));
