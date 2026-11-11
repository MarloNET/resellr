import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDailyJsonlWriter } from '@resellr/runtime-shared/daily-jsonl-writer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AVAILABILITY_DAYS_FILE_NAME,
  type DaySummary,
  summarizeMissingDays,
} from './availability-aggregator.ts';

const CLI = fileURLToPath(new URL('../cli.ts', import.meta.url));
const HOUR = 60 * 60 * 1000;
const BUSINESS_DAY_MS = 10 * HOUR;

let root: string;
let logDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'resellr-availability-'));
  logDir = join(root, 'Protokolle');
  mkdirSync(logDir);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const summary = (date: string, availableMs = 0): DaySummary => ({
  date,
  availableMs,
  unavailableMs: 0,
  stoppedByUserMs: 0,
  pcOffMs: 0,
  unmeasuredMs: 0,
});

const writeDays = (summaries: DaySummary[]) =>
  writeFileSync(
    join(logDir, AVAILABILITY_DAYS_FILE_NAME),
    summaries.map((line) => `${JSON.stringify(line)}\n`).join(''),
  );

const readDays = (): DaySummary[] =>
  readFileSync(join(logDir, AVAILABILITY_DAYS_FILE_NAME), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DaySummary);

/** Checks every 5 minutes on a day from 6 to 20 o'clock (UTC+1), written like CU-265 writes them. */
function writeChecks(date: string) {
  let clock = Date.parse(`${date}T06:00:00+01:00`);
  const writer = createDailyJsonlWriter({
    dir: logDir,
    kind: 'availability',
    now: () => new Date(clock),
  });
  for (; clock <= Date.parse(`${date}T20:00:00+01:00`); clock += 5 * 60 * 1000)
    writer.write({ ok: true });
}

describe('daily summary in the log folder (CU-269, test clock)', () => {
  it('appends one line per missing day up to yesterday and deletes lines older than 24 months', () => {
    writeDays([summary('2024-11-10'), summary('2024-11-11'), summary('2026-11-08')]);
    writeChecks('2026-11-09');
    writeChecks('2026-11-10');
    const now = () => new Date('2026-11-11T07:00:00.000Z');

    const added = summarizeMissingDays({ logDir, now });

    expect(added).toEqual([
      summary('2026-11-09', BUSINESS_DAY_MS),
      summary('2026-11-10', BUSINESS_DAY_MS),
    ]);
    // 24 months before 11 November 2026: lines from 11 November 2024 on stay.
    expect(readDays()).toEqual([
      summary('2024-11-11'),
      summary('2026-11-08'),
      summary('2026-11-09', BUSINESS_DAY_MS),
      summary('2026-11-10', BUSINESS_DAY_MS),
    ]);
    // The raw log stays; its own limit of 30 days applies (CU-008).
    expect(readdirSync(logDir)).toContain('availability-2026-11-09.jsonl');

    // A second run on the same day adds nothing.
    expect(summarizeMissingDays({ logDir, now })).toEqual([]);
    expect(readDays()).toHaveLength(4);

    // A day later the line of 11 November 2024 is older than 24 months.
    summarizeMissingDays({ logDir, now: () => new Date('2026-11-12T07:00:00.000Z') });
    expect(readDays().map((line) => line.date)).toEqual([
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
  });

  it('begins with the oldest daily log file when there is no line yet', () => {
    writeChecks('2026-11-09');

    summarizeMissingDays({ logDir, now: () => new Date('2026-11-11T07:00:00.000Z') });

    expect(readDays()).toEqual([
      summary('2026-11-09', BUSINESS_DAY_MS),
      // No check on 10 November and no Windows start known: without measurement.
      { ...summary('2026-11-10'), unmeasuredMs: BUSINESS_DAY_MS },
    ]);
  });

  it('counts the gap up to now as PC off when the Windows start of this boot lies in it', () => {
    writeChecks('2026-11-09');

    summarizeMissingDays({
      logDir,
      now: () => new Date('2026-11-11T07:00:00.000Z'),
      bootTime: Date.parse('2026-11-11T06:55:00.000Z'),
    });

    expect(readDays()[1]).toEqual({ ...summary('2026-11-10'), pcOffMs: BUSINESS_DAY_MS });
  });

  it('writes nothing without daily log files and without lines', () => {
    expect(summarizeMissingDays({ logDir })).toEqual([]);
    expect(existsSync(join(logDir, AVAILABILITY_DAYS_FILE_NAME))).toBe(false);
  });
});

describe('availability-report <YYYY-MM> (CU-258, CU-270)', () => {
  function runLauncher(args: string[]): Promise<number> {
    const env = {
      PATH: process.env.PATH,
      LOCALAPPDATA: root,
      RESELLR_DATA_DIR: join(root, 'Daten'),
      RESELLR_LOG_DIR: logDir,
      RESELLR_HANDOVER_DIR: join(root, 'Fotoübergabe'),
      RESELLR_UPDATE_COPY_DIR: join(root, 'Update-Kopien'),
    };
    return new Promise((resolve) => {
      const child = execFile(process.execPath, [CLI, ...args], { env, windowsHide: true });
      child.on('exit', (code) => resolve(code ?? -1));
    });
  }

  it('writes the report of the month as a text file into the log folder', async () => {
    writeDays([
      summary('2026-09-30', BUSINESS_DAY_MS),
      { ...summary('2026-10-01', 9 * HOUR), unavailableMs: 1 * HOUR },
      { ...summary('2026-10-02', 7 * HOUR), stoppedByUserMs: 3 * HOUR },
    ]);

    await expect(runLauncher(['availability-report', '2026-10'])).resolves.toBe(0);

    const report = readFileSync(join(logDir, 'Verfügbarkeitsbericht-2026-10.txt'), 'utf8');
    expect(report).toContain('Verfügbarkeitsbericht 2026-10\r\n');
    expect(report).toContain('Tage mit Tageszusammenfassung: 2 von 31\r\n');
    expect(report).toContain(
      'Verfügbarkeit = verfügbar ÷ (verfügbar + nicht verfügbar): 94,11 %\r\n',
    );
    expect(report).toContain('verfügbar:           16 h 00 min\r\n');
    expect(report).toContain('nicht verfügbar:      1 h 00 min\r\n');
    expect(report).toContain('vom Nutzer beendet:   3 h 00 min\r\n');
  });

  it('fails with exit code 1 for a month that is not YYYY-MM', async () => {
    await expect(runLauncher(['availability-report', '2026-13'])).resolves.toBe(1);
    expect(readdirSync(logDir)).toEqual([]);
  });
});
