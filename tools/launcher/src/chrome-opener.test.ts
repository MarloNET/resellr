import * as childProcess from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakePrograms, type FakePrograms, waitFor } from '../test/fake-programs.ts';
import { createChromeOpener, parseRegDefaultValue } from './chrome-opener.ts';

// Spies around the real functions, so the options of every child process can be checked.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: vi.fn(actual.spawn), execFile: vi.fn(actual.execFile) };
});

const URL = 'http://127.0.0.1:4310/';
const unref = vi.spyOn(childProcess.ChildProcess.prototype, 'unref');

describe('parseRegDefaultValue (CU-267)', () => {
  it.each([
    ['a German Windows', '(Standard)'],
    ['an English Windows', '(Default)'],
  ])('reads the default value of %s', (_, name) => {
    const output = [
      '',
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
      `    ${name}    REG_SZ    C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`,
      '',
    ].join('\r\n');
    expect(parseRegDefaultValue(output)).toBe(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    );
  });

  it('removes quotes around the path', () => {
    expect(parseRegDefaultValue('    (Standard)    REG_SZ    "C:\\Chrome\\chrome.exe"\r\n')).toBe(
      'C:\\Chrome\\chrome.exe',
    );
  });

  it.each([
    ['an empty answer', ''],
    [
      'a key without default value',
      'HKEY_LOCAL_MACHINE\\…\\chrome.exe\r\n    Path    REG_SZ    C:\\x\r\n',
    ],
    ['an empty default value', '    (Standard)    REG_SZ    \r\n'],
  ])('returns null for %s', (_, output) => {
    expect(parseRegDefaultValue(output)).toBeNull();
  });
});

describe('child processes of the chrome opener (FIND-213)', () => {
  let fakes: FakePrograms;
  const originalPath = process.env.PATH;

  beforeEach(() => {
    fakes = createFakePrograms();
    process.env.PATH = fakes.path;
    vi.mocked(childProcess.spawn).mockClear();
    vi.mocked(childProcess.execFile).mockClear();
    unref.mockClear();
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    fakes.remove();
  });

  it('starts reg query with windowsHide', async () => {
    await createChromeOpener({ warn: () => {} }).open(URL);
    await waitFor(fakes.explorerArgs);

    const calls = vi.mocked(childProcess.execFile).mock.calls;
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call[0]).toBe('reg');
      expect(call[2]).toMatchObject({ windowsHide: true });
    }
  });

  it('starts Chrome detached, without stdio and unreferenced, so it outlives the launcher', async () => {
    fakes.registerChrome('HKCU', fakes.chromePath);
    await createChromeOpener({ warn: () => {} }).open(URL);
    await waitFor(fakes.chromeArgs);

    expectDetachedStart(fakes.chromePath);
  });

  it('starts explorer.exe detached, without stdio and unreferenced (DER-102-05)', async () => {
    await createChromeOpener({ warn: () => {} }).open(URL);
    await waitFor(fakes.explorerArgs);

    expectDetachedStart('explorer.exe');
  });
});

function expectDetachedStart(command: string) {
  const spawn = vi.mocked(childProcess.spawn);
  expect(spawn).toHaveBeenCalledOnce();
  const [file, args, options] = spawn.mock.calls[0] as [
    string,
    string[],
    childProcess.SpawnOptions,
  ];
  expect(file).toBe(command);
  expect(args).toEqual([URL]);
  // `windowsHide` would hide the browser window itself; it applies to all other children only.
  expect(options).toEqual({ detached: true, stdio: 'ignore' });
  // `unref()` lets the launcher end while the browser keeps running.
  const child = spawn.mock.results[0]!.value as childProcess.ChildProcess;
  expect(unref.mock.contexts).toEqual([child]);
}
