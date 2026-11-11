import { readFileSync } from 'node:fs';

import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';
import { describe, expect, it } from 'vitest';

import { parseCommand, runCli } from './cli.ts';

describe('parseCommand (CU-258)', () => {
  it.each([
    [['open'], { name: 'open' }],
    [['supervise'], { name: 'supervise' }],
    [['stop'], { name: 'stop', forUpdate: false }],
    [['stop', '--for-update'], { name: 'stop', forUpdate: true }],
    [['availability-report', '2026-10'], { name: 'availability-report', month: '2026-10' }],
  ])('reads %j', (args, command) => {
    expect(parseCommand(args)).toEqual(command);
  });

  it.each([
    [[]],
    [['unknown']],
    [['OPEN']],
    [['open', 'http://example.com/']],
    [['supervise', '--now']],
    [['stop', '--force']],
    [['stop', '--for-update', '--for-update']],
    [['availability-report']],
    [['availability-report', '2026-13']],
    [['availability-report', '2026-1']],
    [['availability-report', '2026-10', 'x']],
  ])('rejects %j', (args) => {
    expect(parseCommand(args)).toBeNull();
  });
});

describe('runCli exit codes (CU-258, CU-006)', () => {
  // An empty environment: a command that touched the folders would fail differently.
  const env = {};

  it.each([[[]], [['unknown']], [['stop', '--force']]])(
    'ends an invalid call %j with exit code 1',
    async (args) => {
      await expect(runCli(args, env)).resolves.toBe(LauncherExitCode.Failed);
    },
  );

  // `supervise` follows with #119, `stop` with #123, `availability-report` with #116.
  it.each([[['supervise']], [['stop', '--for-update']], [['availability-report', '2026-10']]])(
    'ends the command %j that is not built yet with exit code 1',
    async (args) => {
      await expect(runCli(args, env)).resolves.toBe(LauncherExitCode.Failed);
    },
  );

  it('ends open with exit code 1 when the data folder cannot be determined', async () => {
    await expect(runCli(['open'], env)).resolves.toBe(LauncherExitCode.Failed);
  });
});

describe('launcher entry and its logs (CU-258, CU-296)', () => {
  it('writes the events of runOpen through CU-296, not through DailyJsonlWriter directly (Nachtrag MAR-366)', () => {
    const source = readFileSync(new URL('./cli.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('daily-jsonl-writer');
    expect(source).toContain("from './launcher-log.ts'");
  });
});
