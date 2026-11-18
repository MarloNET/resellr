import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { evaluateAudit, parseAuditExceptions } from './check-audit.mjs';

const PICOMATCH_EXCEPTION = {
  id: 'GHSA-fc5q-39xc-vjpf',
  package: 'picomatch',
  expires: '2026-12-29',
  reference: 'MAR-1019',
  reason: 'ReDoS only through glob patterns from configuration files in the repository.',
};

const PICOMATCH_ADVISORY = {
  source: 1247710,
  name: 'picomatch',
  dependency: 'picomatch',
  title: 'picomatch vulnerable to ReDoS through single-branch repeated extglobs',
  url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
  severity: 'high',
  range: '<=4.0.7',
};

/** Excerpt of `npm audit --json` (npm 11) at the time of the Nachtrag MAR-1019. */
const PICOMATCH_REPORT = {
  auditReportVersion: 2,
  vulnerabilities: {
    picomatch: {
      name: 'picomatch',
      severity: 'high',
      isDirect: false,
      via: [PICOMATCH_ADVISORY],
      effects: ['vite', 'vitest'],
      range: '*',
      nodes: ['node_modules/picomatch'],
      fixAvailable: { name: 'vitest', version: '3.1.4', isSemVerMajor: true },
    },
    vite: {
      name: 'vite',
      severity: 'high',
      isDirect: true,
      via: ['picomatch'],
      effects: ['vitest'],
      range: '*',
      nodes: ['node_modules/vite'],
      fixAvailable: { name: 'vitest', version: '3.1.4', isSemVerMajor: true },
    },
    minimatch: {
      name: 'minimatch',
      severity: 'moderate',
      isDirect: false,
      via: [
        {
          name: 'minimatch',
          url: 'https://github.com/advisories/GHSA-g3hv-75wg-m249',
          severity: 'moderate',
        },
      ],
      effects: [],
      range: '10.0.0 - 10.0.3',
      nodes: ['node_modules/minimatch'],
      fixAvailable: true,
    },
  },
};

type Report = typeof PICOMATCH_REPORT;

function evaluate({
  report = PICOMATCH_REPORT as unknown,
  exceptions = [PICOMATCH_EXCEPTION] as unknown[],
  today = '2026-11-17',
} = {}) {
  return evaluateAudit({
    audit: JSON.stringify(report),
    exceptions: JSON.stringify({ exceptions }),
    today,
  });
}

/** The picomatch report with an extra package entry. */
function withPackage(name: string, entry: object): Report {
  return {
    ...PICOMATCH_REPORT,
    vulnerabilities: { ...PICOMATCH_REPORT.vulnerabilities, [name]: entry },
  } as Report;
}

describe('evaluateAudit', () => {
  it('allows an excepted advisory with one warning and no failure', () => {
    expect(evaluate()).toEqual({
      failures: [],
      warnings: ['GHSA-fc5q-39xc-vjpf (picomatch) allowed until 2026-12-29 (MAR-1019)'],
    });
  });

  it('fails on another high advisory of the same package', () => {
    const report = withPackage('picomatch', {
      ...PICOMATCH_REPORT.vulnerabilities.picomatch,
      via: [
        PICOMATCH_ADVISORY,
        { ...PICOMATCH_ADVISORY, url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' },
      ],
    });

    const { failures, warnings } = evaluate({ report });

    expect(failures).toEqual([
      'GHSA-aaaa-bbbb-cccc (picomatch, high): no exception in audit-exceptions.json',
    ]);
    expect(warnings).toHaveLength(1);
  });

  it('fails on an excepted GHSA-ID reported for another package', () => {
    const report = withPackage('other', {
      name: 'other',
      severity: 'high',
      via: [{ ...PICOMATCH_ADVISORY, name: 'other' }],
      fixAvailable: false,
    });

    expect(evaluate({ report }).failures).toEqual([
      'GHSA-fc5q-39xc-vjpf (other, high): no exception in audit-exceptions.json',
    ]);
  });

  it('fails on a critical advisory without an exception', () => {
    const report = withPackage('tinypool', {
      name: 'tinypool',
      severity: 'critical',
      via: [
        {
          name: 'tinypool',
          url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff',
          severity: 'critical',
        },
      ],
      fixAvailable: false,
    });

    expect(evaluate({ report }).failures).toEqual([
      'GHSA-dddd-eeee-ffff (tinypool, critical): no exception in audit-exceptions.json',
    ]);
  });

  it('ignores moderate advisories', () => {
    const report = { vulnerabilities: { minimatch: PICOMATCH_REPORT.vulnerabilities.minimatch } };

    expect(evaluate({ report, exceptions: [] })).toEqual({ failures: [], warnings: [] });
  });

  it('still allows the exception on the day of expires', () => {
    expect(evaluate({ today: '2026-12-29' }).failures).toEqual([]);
  });

  it('fails the day after expires', () => {
    expect(evaluate({ today: '2026-12-30' })).toEqual({
      failures: [
        'GHSA-fc5q-39xc-vjpf (picomatch, high): exception expired on 2026-12-29 (MAR-1019)',
      ],
      warnings: [],
    });
  });

  it('fails when a fix is available without --force', () => {
    const report = withPackage('picomatch', {
      ...PICOMATCH_REPORT.vulnerabilities.picomatch,
      fixAvailable: true,
    });

    expect(evaluate({ report })).toEqual({
      failures: [
        'GHSA-fc5q-39xc-vjpf (picomatch, high): fix available, update the package and remove the exception',
      ],
      warnings: [],
    });
  });

  it('keeps the exception when the fix names a dependency update, even within its major version', () => {
    // An object in `fixAvailable` always means `npm audit fix --force`; only `true` ends it (c).
    const report = withPackage('picomatch', {
      ...PICOMATCH_REPORT.vulnerabilities.picomatch,
      fixAvailable: { name: 'vitest', version: '5.1.1', isSemVerMajor: false },
    });

    expect(evaluate({ report })).toEqual({
      failures: [],
      warnings: ['GHSA-fc5q-39xc-vjpf (picomatch) allowed until 2026-12-29 (MAR-1019)'],
    });
  });

  it('fails on a stale exception that npm audit no longer reports', () => {
    const report = { vulnerabilities: { minimatch: PICOMATCH_REPORT.vulnerabilities.minimatch } };

    expect(evaluate({ report })).toEqual({
      failures: [
        'GHSA-fc5q-39xc-vjpf (picomatch): npm audit no longer reports it, exception stale, remove the entry',
      ],
      warnings: [],
    });
  });

  it('fails on an error response of npm audit', () => {
    const report = { error: { code: 'ENOTFOUND', summary: 'request to registry failed' } };

    expect(evaluate({ report }).failures).toEqual(['npm audit: error: request to registry failed']);
  });

  it('names the cause when the registry is not reachable', () => {
    // npm 11 leaves `summary` and `detail` empty and puts the cause into `message`.
    const report = {
      message: 'request to https://registry.npmjs.org/ failed, reason: connect ECONNREFUSED',
      error: { summary: '', detail: '' },
    };

    expect(evaluate({ report }).failures).toEqual([
      'npm audit: error: request to https://registry.npmjs.org/ failed, reason: connect ECONNREFUSED',
    ]);
  });

  it('fails on output that is no valid JSON', () => {
    const result = evaluateAudit({
      audit: 'npm error code ENOTFOUND',
      exceptions: JSON.stringify({ exceptions: [PICOMATCH_EXCEPTION] }),
      today: '2026-11-17',
    });

    expect(result.failures).toEqual(['npm audit: output is no valid JSON']);
  });

  it('fails on output without vulnerabilities', () => {
    expect(evaluate({ report: {} }).failures).toEqual([
      'npm audit: output has no "vulnerabilities"',
    ]);
  });

  it('fails on an invalid exceptions file', () => {
    const result = evaluateAudit({
      audit: JSON.stringify(PICOMATCH_REPORT),
      exceptions: '{ "exceptions": [',
      today: '2026-11-17',
    });

    expect(result).toEqual({
      failures: ['audit-exceptions.json: no valid JSON'],
      warnings: [],
    });
    expect(
      evaluate({ exceptions: [{ ...PICOMATCH_EXCEPTION, id: 'CVE-2026-112366' }] }).failures,
    ).toHaveLength(1);
  });
});

describe('parseAuditExceptions', () => {
  it('returns the entries of a valid file', () => {
    expect(parseAuditExceptions(JSON.stringify({ exceptions: [PICOMATCH_EXCEPTION] }))).toEqual([
      PICOMATCH_EXCEPTION,
    ]);
  });

  it('accepts the exceptions file of the repository', () => {
    const file = fileURLToPath(new URL('./audit-exceptions.json', import.meta.url));

    expect(() => parseAuditExceptions(readFileSync(file, 'utf8'))).not.toThrow();
  });

  it.each(['id', 'package', 'expires', 'reference', 'reason'])('rejects a missing %s', (field) => {
    const entry: Record<string, string> = { ...PICOMATCH_EXCEPTION };
    delete entry[field];

    expect(() => parseAuditExceptions(JSON.stringify({ exceptions: [entry] }))).toThrow(
      `audit-exceptions.json: exception 1: "${field}" is missing`,
    );
  });

  it.each(['GHSA-FC5Q-39XC-VJPF', 'GHSA-fc5q-39xc', 'CVE-2026-112366'])(
    'rejects the id %s',
    (id) => {
      const text = JSON.stringify({ exceptions: [{ ...PICOMATCH_EXCEPTION, id }] });

      expect(() => parseAuditExceptions(text)).toThrow('"id" must be a GHSA-ID');
    },
  );

  it.each(['2026-02-30', '29.12.2026', '2026-13-01'])('rejects the date %s', (expires) => {
    const text = JSON.stringify({ exceptions: [{ ...PICOMATCH_EXCEPTION, expires }] });

    expect(() => parseAuditExceptions(text)).toThrow('"expires" must be a valid date');
  });

  it('rejects a file without an exceptions list', () => {
    expect(() => parseAuditExceptions('{}')).toThrow('"exceptions" must be a list');
  });
});
