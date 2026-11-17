// Dependency audit with exceptions (CU-320, Technical Specification 4.3, TH-07, Nachtrag
// MAR-1019): step (2) of the dependency audit. Runs `npm audit --json` over all dependencies
// including dev tooling and fails on every `high` or `critical` advisory unless it is entered in
// `audit-exceptions.json` (CU-321), not expired and without a fix that works without `--force`.
// Also fails on stale exceptions and on any error of `npm audit`. Usage:
// `node tools/qa/check-audit.mjs [repository root]`; exit code 1 on failure, which stops the CI.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const GHSA_ID = /^GHSA(-[a-z0-9]{4}){3}$/;
/** The GHSA-ID at the end of an advisory URL like `https://github.com/advisories/GHSA-…`. */
const GHSA_IN_URL = /\/(GHSA(?:-[a-z0-9]{4}){3})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Severities that stop the CI in step (2) (4.3). */
const BLOCKING_SEVERITIES = new Set(['high', 'critical']);
const FIELDS = /** @type {const} */ (['id', 'package', 'expires', 'reference', 'reason']);

/**
 * @typedef {object} AuditException
 * @property {string} id GHSA-ID of the advisory
 * @property {string} package name of the affected package
 * @property {string} expires last day (UTC, inclusive) on which the exception applies
 * @property {string} reference Paperclip task of the Nachtrag
 * @property {string} reason justification
 */

/**
 * Whether the value is a real calendar date written as `YYYY-MM-DD`.
 * @param {string} value
 */
function isDate(value) {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Checks the content of `audit-exceptions.json` (CU-321) and returns it typed.
 * @param {string} text
 * @returns {AuditException[]}
 */
export function parseAuditExceptions(text) {
  /** @type {unknown} */
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('audit-exceptions.json: no valid JSON');
  }
  const exceptions =
    typeof value === 'object' && value !== null
      ? /** @type {Record<string, unknown>} */ (value).exceptions
      : undefined;
  if (!Array.isArray(exceptions)) {
    throw new Error('audit-exceptions.json: "exceptions" must be a list');
  }
  return exceptions.map((entry, index) => {
    const where = `audit-exceptions.json: exception ${index + 1}`;
    if (typeof entry !== 'object' || entry === null) throw new Error(`${where}: no object`);
    const record = /** @type {Record<string, unknown>} */ (entry);
    for (const field of FIELDS) {
      const fieldValue = record[field];
      if (typeof fieldValue !== 'string' || fieldValue.trim() === '') {
        throw new Error(`${where}: "${field}" is missing`);
      }
    }
    const exception = /** @type {AuditException} */ (record);
    if (!GHSA_ID.test(exception.id)) {
      throw new Error(`${where}: "id" must be a GHSA-ID like GHSA-fc5q-39xc-vjpf`);
    }
    if (!isDate(exception.expires)) {
      throw new Error(`${where}: "expires" must be a valid date YYYY-MM-DD`);
    }
    return exception;
  });
}

/**
 * The `high` and `critical` advisories of an `npm audit --json` result (npm 11): the objects in
 * `vulnerabilities[<package>].via`; strings there refer to other packages and are skipped.
 * @param {Record<string, unknown>} vulnerabilities
 * @returns {{ id: string, name: string, severity: string, fixAvailable: unknown }[]}
 */
function blockingAdvisories(vulnerabilities) {
  /** @type {Map<string, { id: string, name: string, severity: string, fixAvailable: unknown }>} */
  const advisories = new Map();
  for (const [packageName, entry] of Object.entries(vulnerabilities)) {
    const { via = [], fixAvailable } = /** @type {{ via?: unknown[], fixAvailable?: unknown }} */ (
      entry ?? {}
    );
    for (const item of via) {
      if (typeof item !== 'object' || item === null) continue;
      const { url, name, severity } = /** @type {Record<string, unknown>} */ (item);
      if (typeof severity !== 'string' || !BLOCKING_SEVERITIES.has(severity)) continue;
      const advisoryName = typeof name === 'string' ? name : packageName;
      const id =
        (typeof url === 'string' ? GHSA_IN_URL.exec(url)?.[1] : undefined) ??
        (typeof url === 'string' ? url : 'unknown advisory');
      const key = `${id} ${advisoryName}`;
      if (!advisories.has(key))
        advisories.set(key, { id, name: advisoryName, severity, fixAvailable });
    }
  }
  return [...advisories.values()];
}

/**
 * Evaluates the output of `npm audit --json` against the exceptions (rules (a) to (f) of the
 * Nachtrag MAR-1019). Pure: no network, no file access.
 * @param {{ audit: string, exceptions: string, today: string }} input `audit` is the stdout of
 *   `npm audit --json`, `exceptions` the text of `audit-exceptions.json`, `today` the UTC date
 *   `YYYY-MM-DD`
 * @returns {{ failures: string[], warnings: string[] }}
 */
export function evaluateAudit({ audit, exceptions, today }) {
  /** @type {AuditException[]} */
  let entries;
  try {
    entries = parseAuditExceptions(exceptions);
  } catch (error) {
    return { failures: [/** @type {Error} */ (error).message], warnings: [] };
  }

  /** @type {unknown} */
  let report;
  try {
    report = JSON.parse(audit);
  } catch {
    return { failures: ['npm audit: output is no valid JSON'], warnings: [] };
  }
  if (typeof report !== 'object' || report === null) {
    return { failures: ['npm audit: output is no JSON object'], warnings: [] };
  }
  const { error, message, vulnerabilities } = /** @type {Record<string, unknown>} */ (report);
  if (error !== undefined) {
    // npm 11 puts the cause into `summary` and `detail`, or into `message` beside empty ones (for
    // example when the registry is not reachable).
    const { summary, detail } =
      typeof error === 'object' && error !== null
        ? /** @type {Record<string, unknown>} */ (error)
        : { summary: error, detail: undefined };
    const cause = [summary, detail, message]
      .filter((part) => typeof part === 'string' && part.trim() !== '')
      .join(' ');
    return { failures: [`npm audit: error: ${cause || 'without a message'}`], warnings: [] };
  }
  if (typeof vulnerabilities !== 'object' || vulnerabilities === null) {
    return { failures: ['npm audit: output has no "vulnerabilities"'], warnings: [] };
  }

  /** @type {string[]} */
  const failures = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {Set<AuditException>} */
  const used = new Set();
  for (const advisory of blockingAdvisories(
    /** @type {Record<string, unknown>} */ (vulnerabilities),
  )) {
    const label = `${advisory.id} (${advisory.name}, ${advisory.severity})`;
    // (a) The GHSA-ID and the package name must both match.
    const exception = entries.find(
      (entry) => entry.id === advisory.id && entry.package === advisory.name,
    );
    if (exception === undefined) {
      failures.push(`${label}: no exception in audit-exceptions.json`);
      continue;
    }
    used.add(exception);
    // (b) `expires` is inclusive; the date strings compare in calendar order.
    if (today > exception.expires) {
      failures.push(`${label}: exception expired on ${exception.expires} (${exception.reference})`);
      continue;
    }
    // (c) A fix without `--force` ends the exception. npm reports it as `fixAvailable: true`; an
    // object there names a dependency update that `npm audit fix` only applies with `--force`.
    if (advisory.fixAvailable === true) {
      failures.push(`${label}: fix available, update the package and remove the exception`);
      continue;
    }
    // (f) Every exception in use is visible as an annotation.
    warnings.push(
      `${exception.id} (${exception.package}) allowed until ${exception.expires} (${exception.reference})`,
    );
  }
  // (d) An exception without an advisory is stale and is removed in the PR that brings the fix.
  for (const entry of entries) {
    if (!used.has(entry)) {
      failures.push(
        `${entry.id} (${entry.package}): npm audit no longer reports it, exception stale, remove the entry`,
      );
    }
  }
  return { failures, warnings };
}

/** @param {string} failure */
function fail(failure) {
  process.stderr.write(`::error::${failure}\n`);
  process.exitCode = 1;
}

/** @param {string} root */
function main(root) {
  /** @type {string} */
  let exceptions;
  try {
    exceptions = readFileSync(join(root, 'tools/qa/audit-exceptions.json'), 'utf8');
  } catch (error) {
    fail(`audit-exceptions.json: cannot be read: ${/** @type {Error} */ (error).message}`);
    return;
  }
  // The exit code of `npm audit` is not zero for every finding; the parsed stdout decides (e).
  const result = spawnSync('npm', ['audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    fail(`npm audit: cannot be run: ${result.error.message}`);
    return;
  }
  const { failures, warnings } = evaluateAudit({
    audit: result.stdout ?? '',
    exceptions,
    today: new Date().toISOString().slice(0, 10),
  });

  for (const warning of warnings) process.stdout.write(`::warning::${warning}\n`);
  if (failures.length > 0) {
    for (const failure of failures) fail(failure);
    return;
  }
  process.stdout.write('Dependency audit: no high or critical advisory without an exception.\n');
}

if (import.meta.main) main(process.argv[2] ?? fileURLToPath(new URL('../../', import.meta.url)));
