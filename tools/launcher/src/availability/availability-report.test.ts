import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { DaySummary } from './availability-aggregator.ts';
import { formatAvailabilityReport, reportFileName } from './availability-report.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const day = (date: string, shares: Partial<Omit<DaySummary, 'date'>>): DaySummary => ({
  date,
  availableMs: 0,
  unavailableMs: 0,
  stoppedByUserMs: 0,
  pcOffMs: 0,
  unmeasuredMs: 0,
  ...shares,
});

describe('monthly report (CU-270, OD-05 a)', () => {
  it('names the text file after the month', () => {
    expect(reportFileName('2026-10')).toBe('Verfügbarkeitsbericht-2026-10.txt');
  });

  it('adds up the days of the month and computes available ÷ (available + not available)', () => {
    const text = formatAvailabilityReport('2026-10', [
      day('2026-09-30', { availableMs: 10 * HOUR }),
      day('2026-10-01', {
        availableMs: 9 * HOUR,
        unavailableMs: 30 * MINUTE,
        pcOffMs: 30 * MINUTE,
      }),
      day('2026-10-02', {
        availableMs: 7 * HOUR,
        stoppedByUserMs: 2 * HOUR,
        unmeasuredMs: 1 * HOUR,
      }),
      day('2026-10-04', {}),
      day('2026-11-01', { unavailableMs: 10 * HOUR }),
    ]);

    expect(text.split('\r\n')).toEqual([
      'resellr – Verfügbarkeitsbericht 2026-10',
      'Geschäftszeit: Montag bis Samstag, 8 bis 18 Uhr (Europe/Berlin)',
      'Tage mit Tageszusammenfassung: 3 von 31',
      '',
      'Verfügbarkeit = verfügbar ÷ (verfügbar + nicht verfügbar): 96,96 %',
      '',
      'verfügbar:           16 h 00 min',
      'nicht verfügbar:      0 h 30 min',
      'vom Nutzer beendet:   2 h 00 min',
      'PC aus:               0 h 30 min',
      'ohne Messung:         1 h 00 min',
      '',
      '„vom Nutzer beendet“, „PC aus“ und „ohne Messung“ zählen weder als Ausfall noch als Geschäftszeit.',
      '',
    ]);
  });

  it('shows no availability when the month has no available or not available time', () => {
    const text = formatAvailabilityReport('2026-02', [day('2026-02-02', { pcOffMs: 10 * HOUR })]);

    expect(text).toContain('Tage mit Tageszusammenfassung: 1 von 28\r\n');
    expect(text).toContain(
      'Verfügbarkeit = verfügbar ÷ (verfügbar + nicht verfügbar): keine Messung\r\n',
    );
    expect(text).toContain('PC aus:              10 h 00 min\r\n');
  });

  it('never rounds an availability below 100 % up to 100 %', () => {
    const text = formatAvailabilityReport('2026-10', [
      day('2026-10-01', { availableMs: 100_000 * MINUTE, unavailableMs: 1 * MINUTE }),
    ]);

    expect(text).toContain('nicht verfügbar): 99,99 %\r\n');
  });
});

describe('Verfügbarkeitsbericht.cmd (CU-277)', () => {
  const script = readFileSync(
    new URL('../../../packaging/Verfügbarkeitsbericht.cmd', import.meta.url),
    'utf8',
  );

  it('starts availability-report of the launcher in the program folder for the previous month', () => {
    expect(script).toContain("(Get-Date).AddMonths(-1).ToString('yyyy-MM')");
    expect(script).toContain(
      '"%~dp0node.exe" "%~dp0app\\launcher.mjs" availability-report %MONTH%',
    );
    expect(script).toContain('if not defined MONTH exit /b 1');
  });

  it('has Windows line ends only', () => {
    expect(script.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
  });
});
