import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakePrograms, type FakePrograms, waitFor } from '../test/fake-programs.ts';
import { CHROME_APP_PATHS_KEYS, createChromeOpener } from './chrome-opener.ts';

const URL = 'http://127.0.0.1:4310/';

describe('chrome opener with real child processes (CU-267)', () => {
  let fakes: FakePrograms;
  const originalPath = process.env.PATH;

  beforeEach(() => {
    fakes = createFakePrograms();
    process.env.PATH = fakes.path;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    fakes.remove();
  });

  it('DER-102-01 opens the address in Chrome from App Paths under HKCU as a normal tab', async () => {
    fakes.registerChrome('HKCU', fakes.chromePath);
    const warn = vi.fn();

    await createChromeOpener({ warn }).open(URL);

    // Only the address: no `--app`, so Chrome shows a normal tab (Baseline 6.1).
    expect(await waitFor(fakes.chromeArgs)).toEqual([URL]);
    expect(fakes.regCalls()).toEqual([`query ${CHROME_APP_PATHS_KEYS[0]} /ve`]);
    expect(fakes.explorerArgs()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('asks HKLM when HKCU has no entry', async () => {
    fakes.registerChrome('HKLM', fakes.chromePath);
    const warn = vi.fn();

    await createChromeOpener({ warn }).open(URL);

    expect(await waitFor(fakes.chromeArgs)).toEqual([URL]);
    expect(fakes.regCalls()).toEqual([
      `query ${CHROME_APP_PATHS_KEYS[0]} /ve`,
      `query ${CHROME_APP_PATHS_KEYS[1]} /ve`,
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('DER-102-05 opens the address through explorer.exe and warns when neither hive has Chrome', async () => {
    const warn = vi.fn();

    await createChromeOpener({ warn }).open(URL);

    expect(await waitFor(fakes.explorerArgs)).toEqual([URL]);
    expect(fakes.chromeArgs()).toBeNull();
    expect(warn).toHaveBeenCalledExactlyOnceWith('chrome_not_found');
  });

  it('falls back to explorer.exe when the registered Chrome file does not exist', async () => {
    fakes.registerChrome('HKCU', `${fakes.chromePath}-removed`);
    const warn = vi.fn();

    await createChromeOpener({ warn }).open(URL);

    expect(await waitFor(fakes.explorerArgs)).toEqual([URL]);
    expect(warn).toHaveBeenCalledExactlyOnceWith('chrome_not_found');
  });

  it('rejects when neither reg nor explorer.exe can be started, after the warning', async () => {
    process.env.PATH = '/nonexistent';
    const warn = vi.fn();

    await expect(createChromeOpener({ warn }).open(URL)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(warn).toHaveBeenCalledExactlyOnceWith('chrome_not_found');
  });
});
