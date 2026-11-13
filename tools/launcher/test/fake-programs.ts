import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Stand-in for `resellr-server` (`fake-server.ts`), for the test hook `RESELLR_TEST_SERVER_ENTRY`. */
export const FAKE_SERVER = fileURLToPath(new URL('./fake-server.ts', import.meta.url));

/** Reference number the fake server writes into `start-result.json`. */
export const FAKE_REF_NO = 'R-ABCD-EFGH';

/** Reference number of the fake server's `500 internal_error` on `POST /api/ops/shutdown`. */
export const FAKE_SHUTDOWN_REF_NO = 'R-5T0P-FA1X';

/**
 * Stand-ins for `reg`, Chrome and `explorer.exe` under Linux: shell scripts in a temporary
 * folder that is put in front of `PATH`. Chrome and `explorer.exe` record their arguments.
 */
export interface FakePrograms {
  /** Path of the fake Chrome, as the registry reports it. */
  chromePath: string;
  /** `PATH` with the folder of the fake programs first. */
  path: string;
  /** Lets `reg query` report `value` as the default value of the key under `HKCU` or `HKLM`. */
  registerChrome(hive: 'HKCU' | 'HKLM', value: string): void;
  /** Arguments the fake Chrome was started with, or null until it ran. */
  chromeArgs(): string[] | null;
  /** Every start of the fake Chrome, its arguments joined by spaces, in order. */
  chromeCalls(): string[];
  /** Arguments the fake `explorer.exe` was started with, or null until it ran. */
  explorerArgs(): string[] | null;
  /** Calls of `reg`, one line of arguments each, in order. */
  regCalls(): string[];
  remove(): void;
}

const writeScript = (path: string, body: string) => {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
};

/**
 * Output of `reg query` under a German Windows (CRLF); without an entry it fails with exit code 1.
 * `printf` instead of `echo`, which would read `\c` in the key as an escape sequence.
 */
const regScript = (dir: string) => `
printf '%s\\n' "$*" >> "${dir}/reg-calls.txt"
case "$2" in
  HKCU\\\\*) hive=HKCU ;;
  HKLM\\\\*) hive=HKLM ;;
  *) hive=none ;;
esac
if [ -f "${dir}/reg-$hive.txt" ]; then
  printf '\\r\\n%s\\r\\n    (Standard)    REG_SZ    %s\\r\\n\\r\\n' "$2" "$(cat "${dir}/reg-$hive.txt")"
  exit 0
fi
echo "FEHLER: Der angegebene Registrierungsschlüssel bzw. Wert wurde nicht gefunden." >&2
exit 1`;

/**
 * Writes the arguments, one per line, and renames the file so a reader never sees half of it;
 * appends them as one line to `<file>.all`, so parallel starts are all counted.
 */
const recorderScript = (file: string) =>
  `printf '%s\\n' "$*" >> "${file}.all"
printf '%s\\n' "$@" > "${file}.$$.tmp" && mv "${file}.$$.tmp" "${file}"`;

export function createFakePrograms(): FakePrograms {
  const dir = mkdtempSync(join(tmpdir(), 'resellr-launcher-fakes-'));
  // A folder with a space, like `C:\Program Files\Google\Chrome\Application`.
  const chromePath = join(dir, 'Google Chrome', 'chrome');
  const chromeArgsFile = join(dir, 'chrome-args.txt');
  const explorerArgsFile = join(dir, 'explorer-args.txt');

  writeScript(join(dir, 'reg'), regScript(dir));
  writeScript(join(dir, 'explorer.exe'), recorderScript(explorerArgsFile));
  mkdirSync(dirname(chromePath));
  writeScript(chromePath, recorderScript(chromeArgsFile));

  const readLines = (file: string): string[] | null =>
    existsSync(file) ? readFileSync(file, 'utf8').split('\n').slice(0, -1) : null;

  return {
    chromePath,
    path: `${dir}${delimiter}${process.env.PATH ?? ''}`,
    registerChrome: (hive, value) => writeFileSync(join(dir, `reg-${hive}.txt`), value),
    chromeArgs: () => readLines(chromeArgsFile),
    chromeCalls: () => readLines(`${chromeArgsFile}.all`) ?? [],
    explorerArgs: () => readLines(explorerArgsFile),
    regCalls: () => readLines(join(dir, 'reg-calls.txt')) ?? [],
    remove: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Waits until `read` returns a value other than null, at most `timeoutMs`. */
export async function waitFor<T>(read: () => T | null, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value !== null) return value;
    if (Date.now() > deadline) throw new Error('Condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
