import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, type Page, test } from '@playwright/test';
import {
  LAUNCHER_STATE_FILE_NAME,
  type LauncherState,
  writeLauncherState,
} from '@resellr/runtime-shared/runtime-state-files';

/**
 * Launcher pages (CU-271, Technical Specification 2.18, 6.1): the built pages as `file://` pages
 * in Google Chrome, with a `launcher-state.js` the test rewrites like `open` (T-5).
 */

const BUILD_SCRIPT = 'tools/launcher-pages/build-launcher-pages.mjs';
/** The local address the page goes on to; the test answers it instead of a server. */
const APP_URL = 'http://127.0.0.1:4311/';

const LP_01_TEXT =
  'Bitte haben Sie einen Moment Geduld. Der Start dauert diesmal länger als sonst, zum Beispiel ' +
  'weil resellr Ihre Daten prüft. Lassen Sie dieses Fenster geöffnet. resellr öffnet sich von ' +
  'selbst, sobald es bereit ist.';

let root: string;
let pagesDir: string;

test.beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'resellr-launcher-pages-e2e-'));
  // A program folder with a space, an umlaut and `#`, like a user folder (Nachtrag MAR-382).
  pagesDir = join(root, 'resellr #1 Jörg', 'launcher-pages');
  execFileSync(process.execPath, [BUILD_SCRIPT, pagesDir]);
});

test.afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Address of LP-01 for a call, encoded like CU-310 does it. */
function lp01Url(request: string): string {
  const url = pathToFileURL(join(pagesDir, 'lp-01.html'));
  url.searchParams.set('request', request);
  return url.href;
}

const writeState = (state: Partial<LauncherState> & Pick<LauncherState, 'request' | 'phase'>) =>
  writeLauncherState(pagesDir, { url: null, refNo: null, dataDir: null, ...state });

/** Console errors and uncaught exceptions of the page. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Number of loads of `launcher-state.js` so far. */
function countStateLoads(page: Page): () => number {
  const loads: string[] = [];
  page.on('requestfinished', (request) => {
    if (request.url().includes(`/${LAUNCHER_STATE_FILE_NAME}?`)) loads.push(request.url());
  });
  return () => loads.length;
}

for (const viewport of [
  { width: 480, height: 600 },
  { width: 1366, height: 600 },
]) {
  test.describe(`LP-01 at ${viewport.width} px`, () => {
    test.use({ viewport });

    test('LP-01.default DER-102-03 shows the title, the text and the progress line, nothing else', async ({
      page,
    }) => {
      const errors = collectErrors(page);
      writeState({ request: 'another-call', phase: 'ready', url: APP_URL });

      await page.goto(lp01Url('call-1'));

      await expect(page).toHaveTitle('resellr startet');
      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - main:
          - heading "resellr startet" [level=1]
          - paragraph: "${LP_01_TEXT}"
          - paragraph: resellr wird gestartet …
          - progressbar "resellr wird gestartet …"
      `);
      // Indeterminate: no value and no percentage.
      await expect(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
      // No finding of the start check and no technical detail: the page holds only these texts.
      expect((await page.locator('body').innerText()).split('\n').filter(Boolean)).toEqual([
        'resellr startet',
        LP_01_TEXT,
        'resellr wird gestartet …',
      ]);

      // Fully readable: the card fits the window, nothing scrolls sideways.
      const card = await page.locator('main').boundingBox();
      expect(card!.x).toBeGreaterThanOrEqual(0);
      expect(card!.x + card!.width).toBeLessThanOrEqual(viewport.width);
      expect(card!.width).toBeLessThanOrEqual(560);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      // Inter 4.1 from the embedded data: URLs (T-6).
      const loadedWeights = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts]
          .filter((font) => font.family.replaceAll('"', '') === 'Inter' && font.status === 'loaded')
          .map((font) => font.weight)
          .sort();
      });
      expect(loadedWeights).toEqual(['400', '600']);
      expect(errors).toEqual([]);
    });

    test('DER-102-04 goes on to the local address by itself on ready of its own request only', async ({
      page,
    }) => {
      const errors = collectErrors(page);
      const stateLoads = countStateLoads(page);
      await page.route(`${APP_URL}**`, (route) =>
        route.fulfill({ contentType: 'text/html', body: '<title>resellr</title>' }),
      );
      writeState({ request: 'call-2', phase: 'aborted', refNo: 'R-7K3M-Q9TX' });

      await page.goto(lp01Url('call-2'));
      // A state of another call changes nothing, however often the page reads it.
      writeState({ request: 'another-call', phase: 'ready', url: APP_URL });
      const loadsBefore = stateLoads();
      await expect.poll(stateLoads).toBeGreaterThanOrEqual(loadsBefore + 2);
      await expect(page).toHaveTitle('resellr startet');
      const historyLength = await page.evaluate(() => history.length);

      writeState({ request: 'call-2', phase: 'ready', url: APP_URL });

      await page.waitForURL(APP_URL, { timeout: 5000 });
      // `location.replace`: LP-01 leaves no history entry, so going back does not lead to it.
      expect(await page.evaluate(() => history.length)).toBe(historyLength);
      expect(errors).toEqual([]);
    });
  });
}

test('DER-102-04 reloads launcher-state.js every second over the fixed relative path', async ({
  page,
}) => {
  const requests: { url: string; at: number }[] = [];
  page.on('requestfinished', (request) => {
    if (request.url().includes(LAUNCHER_STATE_FILE_NAME))
      requests.push({ url: request.url(), at: Date.now() });
  });
  writeState({ request: 'another-call', phase: 'ready', url: APP_URL });

  await page.goto(lp01Url('call-3'));
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(3);

  const stateFile = pathToFileURL(join(pagesDir, LAUNCHER_STATE_FILE_NAME)).href;
  for (const { url } of requests) expect(url.split('?')[0]).toBe(stateFile);
  // A changing query, so Chrome does not take the script from its cache.
  expect(new Set(requests.map(({ url }) => url)).size).toBe(requests.length);
  const gaps = requests.slice(1).map(({ at }, index) => at - requests[index]!.at);
  for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(900);
});

test('keeps reading when launcher-state.js does not exist yet and goes on once it says ready', async ({
  page,
}) => {
  await page.route(`${APP_URL}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>resellr</title>' }),
  );
  rmSync(join(pagesDir, LAUNCHER_STATE_FILE_NAME), { force: true });
  const stateLoads = countStateLoads(page);
  const failedLoads: string[] = [];
  page.on('requestfailed', (request) => failedLoads.push(request.url()));

  await page.goto(lp01Url('call-4'));
  await expect.poll(() => failedLoads.length).toBeGreaterThanOrEqual(2);
  expect(stateLoads()).toBe(0);

  writeState({ request: 'call-4', phase: 'ready', url: APP_URL });

  await page.waitForURL(APP_URL, { timeout: 5000 });
});
