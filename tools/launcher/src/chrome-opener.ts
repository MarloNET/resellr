import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';

/** Registry keys where the Chrome installer registers `chrome.exe`, asked in this order (2.18). */
export const CHROME_APP_PATHS_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
] as const;

/** Default browser of Windows, used when Chrome is not registered (2.18, DER-102-05). */
const DEFAULT_BROWSER_COMMAND = 'explorer.exe';

// The default value is named `(Standard)` or `(Default)` depending on the language of Windows;
// `reg` separates name, type and value by four spaces.
const DEFAULT_VALUE_LINE = /^\s+\([^)]+\) {4}REG_SZ {4}(.*)$/m;

/** Reads the path from the output of `reg query <key> /ve`; null without a default value. */
export function parseRegDefaultValue(output: string): string | null {
  const value = DEFAULT_VALUE_LINE.exec(output)?.[1]
    ?.trim()
    .replace(/^"(.*)"$/, '$1');
  return value ? value : null;
}

export interface ChromeOpenerOptions {
  /** Writes a warning into the operations log. */
  warn(event: string): void;
}

export interface ChromeOpener {
  /** Opens an address or file in a normal Chrome tab, or in the default browser. */
  open(target: string): Promise<void>;
}

/**
 * Finds Chrome and opens a target in it (CU-267, Technical Specification 2.18 "Chrome finden").
 * Chrome and `explorer.exe` start detached, without stdio and unreferenced, so they keep running
 * after the launcher ends; `reg` starts with `windowsHide` (FIND-213).
 */
export function createChromeOpener({ warn }: ChromeOpenerOptions): ChromeOpener {
  const open = async (target: string): Promise<void> => {
    const chromePath = await findChrome();
    if (chromePath !== null) {
      await startDetached(chromePath, [target]);
      return;
    }
    warn('chrome_not_found');
    await startDetached(DEFAULT_BROWSER_COMMAND, [target]);
  };

  return { open };
}

/** Path of `chrome.exe` from `HKCU`, then `HKLM`; null if neither names an existing file. */
async function findChrome(): Promise<string | null> {
  for (const key of CHROME_APP_PATHS_KEYS) {
    const path = parseRegDefaultValue(await regQueryDefault(key));
    if (path !== null && existsSync(path)) return path;
  }
  return null;
}

/** Output of `reg query <key> /ve`; empty if the key is missing or `reg` cannot run. */
function regQueryDefault(key: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('reg', ['query', key, '/ve'], { windowsHide: true }, (error, stdout) =>
      resolve(error ? '' : stdout),
    );
  });
}

/** Starts a program that outlives the launcher; rejects if it cannot be started. */
async function startDetached(command: string, args: string[]): Promise<void> {
  // No `windowsHide`: it would hide the browser window itself.
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  await once(child, 'spawn');
  child.unref();
}
