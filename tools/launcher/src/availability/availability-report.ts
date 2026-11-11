import { join } from 'node:path';

import { writeFileAtomic } from '@resellr/runtime-shared/runtime-state-files';

import { type DaySummary, readDaySummaries } from './availability-aggregator.ts';

const MINUTE = 60_000;

/** Name of the report of a month in the log folder (2.19 "Verfügbarkeitsberichte"). */
export function reportFileName(month: string): string {
  return `Verfügbarkeitsbericht-${month}.txt`;
}

const SHARES: readonly [label: string, key: keyof Omit<DaySummary, 'date'>][] = [
  ['verfügbar:', 'availableMs'],
  ['nicht verfügbar:', 'unavailableMs'],
  ['vom Nutzer beendet:', 'stoppedByUserMs'],
  ['PC aus:', 'pcOffMs'],
  ['ohne Messung:', 'unmeasuredMs'],
];

/**
 * Text of the monthly report (CU-270, Technical Specification 2.18, OD-05 a, REQ-065): the
 * shares of the business hours summed over the lines of `availability-days.jsonl` of the month
 * and availability = available ÷ (available + not available). The other three shares are shown
 * apart and count neither as outage nor as business hours. The availability is cut off, not
 * rounded, so a value below 100 % never shows as 100 %. Windows line ends for Notepad.
 */
export function formatAvailabilityReport(month: string, summaries: readonly DaySummary[]): string {
  const days = summaries.filter((summary) => summary.date.startsWith(`${month}-`));
  const total = (key: keyof Omit<DaySummary, 'date'>) =>
    days.reduce((sum, summary) => sum + (Number.isFinite(summary[key]) ? summary[key] : 0), 0);

  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const measured = total('availableMs') + total('unavailableMs');
  const availability =
    measured > 0
      ? `${(Math.floor((total('availableMs') / measured) * 10_000) / 100).toFixed(2).replace('.', ',')} %`
      : 'keine Messung';

  return [
    `resellr – Verfügbarkeitsbericht ${month}`,
    'Geschäftszeit: Montag bis Samstag, 8 bis 18 Uhr (Europe/Berlin)',
    `Tage mit Tageszusammenfassung: ${days.length} von ${daysInMonth}`,
    '',
    `Verfügbarkeit = verfügbar ÷ (verfügbar + nicht verfügbar): ${availability}`,
    '',
    ...SHARES.map(([label, key]) => `${label.padEnd(20)}${formatDuration(total(key))}`),
    '',
    '„vom Nutzer beendet“, „PC aus“ und „ohne Messung“ zählen weder als Ausfall noch als Geschäftszeit.',
    '',
  ].join('\r\n');
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / MINUTE);
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(3)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/**
 * Writes the report of a month as a text file into the log folder and returns its path
 * (command `availability-report <YYYY-MM>`, file `Verfügbarkeitsbericht.cmd`). It only reads
 * `availability-days.jsonl`; the supervisor writes the daily lines.
 */
export function writeAvailabilityReport({
  logDir,
  month,
}: {
  logDir: string;
  month: string;
}): string {
  const path = join(logDir, reportFileName(month));
  writeFileAtomic(path, formatAvailabilityReport(month, readDaySummaries(logDir)));
  return path;
}
