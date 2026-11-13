import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, type Page, test } from '@playwright/test';
import {
  ensureLauncherStateFile,
  LAUNCHER_STATE_FILE_NAME,
  type LauncherState,
  writeLauncherState,
} from '@resellr/runtime-shared/runtime-state-files';

/**
 * Launcher pages (CU-271, Technical Specification 2.18, 6.1): the built pages as `file://` pages
 * in Google Chrome, with a `launcher-state.js` the test writes through CU-009 like `open` (T-5,
 * Nachtrag MAR-470).
 */

const BUILD_SCRIPT = 'tools/launcher-pages/build-launcher-pages.mjs';
/** The local address the page goes on to; the test answers it instead of a server. */
const APP_URL = 'http://127.0.0.1:4311/';

const LP_02_TITLE = 'resellr konnte nicht gestartet werden';
const LP_02_TEXT =
  'Der Start von resellr wurde abgebrochen. Bitte versuchen Sie es erneut: Öffnen Sie im ' +
  'Startmenü die Verknüpfung „resellr“. Besteht der Fehler weiter, informieren Sie den ' +
  'Betreiber und nennen Sie ihm diese Referenznummer:';
const REF_NO = 'R-7K2M-9QX4';

const LP_02_TIMEOUT_TITLE = 'resellr startet länger als erwartet';
const LP_02_TIMEOUT_TEXT = [
  'Der Start von resellr dauert länger als erwartet. Er kann noch gelingen. Lassen Sie dieses ' +
    'Fenster geöffnet und warten Sie einen Moment: resellr öffnet sich von selbst, sobald es ' +
    'bereit ist.',
  'Öffnet sich resellr nicht, laden Sie diese Seite neu (Browser-Aktualisierung, z. B. F5). ' +
    'Hilft das nicht, starten Sie resellr über die Verknüpfung „resellr“ im Startmenü.',
  'Besteht das Problem weiter, informieren Sie den Betreiber und nennen Sie ihm diese ' +
    'Referenznummer. Sie steht im Betriebsprotokoll von resellr:',
] as const;
/** Own number of `start_timeout`, different from the number of a later abort (K-07). */
const TIMEOUT_REF_NO = 'R-9QX4-7K2M';
const PROGRESS_LINE = 'resellr wird gestartet …';

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

/** Address of LP-02 with the URL parameter `ref`, encoded like CU-310 does it. */
function lp02Url(ref: string | null): string {
  const url = pathToFileURL(join(pagesDir, 'lp-02.html'));
  if (ref !== null) url.searchParams.set('ref', ref);
  return url.href;
}

/** Address of `LP-02.zeitueberschreitung` as CU-268 writes it for `timeout`: `request` and `ref`. */
function lp02TimeoutUrl(request: string, ref: string): string {
  const url = pathToFileURL(join(pagesDir, 'lp-02.html'));
  url.searchParams.set('request', request);
  url.searchParams.set('ref', ref);
  return url.href;
}

/** The lines of visible text on the page. */
const visibleLines = async (page: Page) =>
  (await page.locator('body').innerText()).split('\n').filter(Boolean);

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
      // Entries of earlier calls stay in the file, so each viewport is a call of its own.
      const request = `call-2-${viewport.width}`;
      const stateLoads = countStateLoads(page);
      await page.route(`${APP_URL}**`, (route) =>
        route.fulfill({ contentType: 'text/html', body: '<title>resellr</title>' }),
      );
      // No entry of the own call yet (FIND-312): only the rule "another request → no change".
      writeState({ request: 'another-call', phase: 'aborted', refNo: 'R-7K3M-Q9TX' });

      await page.goto(lp01Url(request));
      // A state of another call changes nothing, however often the page reads it.
      writeState({ request: 'another-call', phase: 'ready', url: APP_URL });
      const loadsBefore = stateLoads();
      await expect.poll(stateLoads).toBeGreaterThanOrEqual(loadsBefore + 2);
      await expect(page).toHaveTitle('resellr startet');
      const historyLength = await page.evaluate(() => history.length);

      writeState({ request, phase: 'ready', url: APP_URL });

      await page.waitForURL(APP_URL, { timeout: 5000 });
      // `location.replace`: LP-01 leaves no history entry, so going back does not lead to it.
      expect(await page.evaluate(() => history.length)).toBe(historyLength);
      expect(errors).toEqual([]);
    });
  });

  test.describe(`LP-02 at ${viewport.width} px`, () => {
    test.use({ viewport });

    test('LP-02.default DER-103-01 shows the title, the text and the reference number as selectable text, nothing else', async ({
      page,
    }) => {
      const errors = collectErrors(page);

      await page.goto(lp02Url(REF_NO));

      await expect(page).toHaveTitle(LP_02_TITLE);
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - main:
          - heading "${LP_02_TITLE}" [level=1]
          - paragraph: "${LP_02_TEXT}"
          - paragraph: ${REF_NO}
      `);
      // No error codes, file paths or table names: the page holds only these texts (REQ-073).
      expect(await visibleLines(page)).toEqual([LP_02_TITLE, LP_02_TEXT, REF_NO]);

      // Selectable: the user can select the number and copy it.
      const refNo = page.getByText(REF_NO, { exact: true });
      await expect(refNo).toHaveCSS('user-select', 'auto');
      await refNo.selectText();
      expect(await page.evaluate(() => window.getSelection()?.toString().trim())).toBe(REF_NO);

      // Error style for the title strip only (DESIGN.md: error #B42318 on #FEE4E2).
      const title = page.getByRole('heading', { level: 1 });
      await expect(title).toHaveCSS('color', 'rgb(180, 35, 24)');
      await expect(title).toHaveCSS('background-color', 'rgb(254, 228, 226)');
      await expect(page.getByText(LP_02_TEXT)).toHaveCSS('color', 'rgb(31, 41, 55)');

      // Fully readable: the card fits the window, nothing scrolls sideways.
      const card = await page.getByRole('main').boundingBox();
      expect(card!.x).toBeGreaterThanOrEqual(0);
      expect(card!.x + card!.width).toBeLessThanOrEqual(viewport.width);
      expect(card!.width).toBeLessThanOrEqual(560);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

for (const viewport of [
  { width: 480, height: 600 },
  { width: 1366, height: 600 },
]) {
  test.describe(`LP-02.zeitueberschreitung at ${viewport.width} px`, () => {
    test.use({ viewport });

    test('LP-02.zeitueberschreitung DER-103-04 shows the title, the three paragraphs, the reference number and the progress line, nothing else', async ({
      page,
    }) => {
      const errors = collectErrors(page);
      const request = `timeout-1-${viewport.width}`;
      writeState({ request, phase: 'timeout', url: lp02TimeoutUrl(request, TIMEOUT_REF_NO) });

      await page.goto(lp02TimeoutUrl(request, TIMEOUT_REF_NO));

      await expect(page).toHaveTitle(LP_02_TIMEOUT_TITLE);
      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - main:
          - heading "${LP_02_TIMEOUT_TITLE}" [level=1]
          - paragraph: "${LP_02_TIMEOUT_TEXT[0]}"
          - paragraph: "${LP_02_TIMEOUT_TEXT[1]}"
          - paragraph: "${LP_02_TIMEOUT_TEXT[2]}"
          - paragraph: ${TIMEOUT_REF_NO}
          - paragraph: ${PROGRESS_LINE}
          - progressbar "${PROGRESS_LINE}"
      `);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
      // Not "abgebrochen" and no technical detail: the page holds only these texts (REQ-073).
      expect(await visibleLines(page)).toEqual([
        LP_02_TIMEOUT_TITLE,
        ...LP_02_TIMEOUT_TEXT,
        TIMEOUT_REF_NO,
        PROGRESS_LINE,
      ]);

      const refNo = page.getByText(TIMEOUT_REF_NO, { exact: true });
      await refNo.selectText();
      expect(await page.evaluate(() => window.getSelection()?.toString().trim())).toBe(
        TIMEOUT_REF_NO,
      );

      // Warn style for the title strip, not the error style (DESIGN.md: #92400E on #FEF3C7).
      const title = page.getByRole('heading', { level: 1 });
      await expect(title).toHaveCSS('color', 'rgb(146, 64, 14)');
      await expect(title).toHaveCSS('background-color', 'rgb(254, 243, 199)');

      const card = await page.getByRole('main').boundingBox();
      expect(card!.x).toBeGreaterThanOrEqual(0);
      expect(card!.x + card!.width).toBeLessThanOrEqual(viewport.width);
      expect(card!.width).toBeLessThanOrEqual(560);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

test('DER-103-04 LP-01 goes on to LP-02.zeitueberschreitung with the number of start_timeout when open writes timeout', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const request = 'timeout-2';

  await page.goto(lp01Url(request));
  await expect(page).toHaveTitle('resellr startet');
  const historyLength = await page.evaluate(() => history.length);

  writeState({ request, phase: 'timeout', url: lp02TimeoutUrl(request, TIMEOUT_REF_NO) });

  await page.waitForURL((url) => url.pathname.endsWith('/lp-02.html'), { timeout: 5000 });
  await expect(page).toHaveTitle(LP_02_TIMEOUT_TITLE);
  expect(await visibleLines(page)).toEqual([
    LP_02_TIMEOUT_TITLE,
    ...LP_02_TIMEOUT_TEXT,
    TIMEOUT_REF_NO,
    PROGRESS_LINE,
  ]);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect(errors).toEqual([]);
});

test.describe('DER-103-05 LP-02.zeitueberschreitung after the time-out', () => {
  test('keeps waiting while the state is timeout, also after a reload, and goes on to the local address by itself on ready', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const request = 'timeout-3';
    const stateLoads = countStateLoads(page);
    await page.route(`${APP_URL}**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>resellr</title>' }),
    );
    writeState({ request, phase: 'timeout', url: lp02TimeoutUrl(request, TIMEOUT_REF_NO) });

    await page.goto(lp02TimeoutUrl(request, TIMEOUT_REF_NO));
    const loadsBefore = stateLoads();
    await expect.poll(stateLoads).toBeGreaterThanOrEqual(loadsBefore + 2);
    await page.reload();
    await expect(page).toHaveTitle(LP_02_TIMEOUT_TITLE);
    const historyLength = await page.evaluate(() => history.length);

    writeState({ request, phase: 'ready', url: APP_URL });

    await page.waitForURL(APP_URL, { timeout: 5000 });
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    expect(errors).toEqual([]);
  });

  test('shows LP-02.default with the number of the abort when open writes aborted', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const request = 'timeout-4';
    writeState({ request, phase: 'timeout', url: lp02TimeoutUrl(request, TIMEOUT_REF_NO) });
    await page.goto(lp02TimeoutUrl(request, TIMEOUT_REF_NO));
    await expect(page).toHaveTitle(LP_02_TIMEOUT_TITLE);

    writeState({ request, phase: 'aborted', url: lp02Url(REF_NO), refNo: REF_NO });

    await expect(page).toHaveTitle(LP_02_TITLE, { timeout: 5000 });
    expect(await visibleLines(page)).toEqual([LP_02_TITLE, LP_02_TEXT, REF_NO]);
    expect(errors).toEqual([]);
  });

  test('a reload shows the current state: the local address after ready, LP-02.default after an abort', async ({
    page,
  }) => {
    await page.route(`${APP_URL}**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>resellr</title>' }),
    );
    // The result came while the page was not reading, e.g. while it reloads.
    writeState({ request: 'timeout-5', phase: 'ready', url: APP_URL });
    await page.goto(lp02TimeoutUrl('timeout-5', TIMEOUT_REF_NO));
    await page.waitForURL(APP_URL, { timeout: 5000 });

    writeState({ request: 'timeout-6', phase: 'aborted', url: lp02Url(REF_NO), refNo: REF_NO });
    await page.goto(lp02TimeoutUrl('timeout-6', TIMEOUT_REF_NO));
    await expect(page).toHaveTitle(LP_02_TITLE, { timeout: 5000 });
    expect(await visibleLines(page)).toEqual([LP_02_TITLE, LP_02_TEXT, REF_NO]);
  });

  test('shows no number in the time-out state that does not match the pattern (H-11)', async ({
    page,
  }) => {
    const request = 'timeout-7';
    writeState({ request, phase: 'timeout', url: lp02TimeoutUrl(request, '<b>R-7K2M-9QX4</b>') });

    await page.goto(lp02TimeoutUrl(request, '<b>R-7K2M-9QX4</b>'));

    expect(await visibleLines(page)).toEqual([
      LP_02_TIMEOUT_TITLE,
      ...LP_02_TIMEOUT_TEXT,
      PROGRESS_LINE,
    ]);
    expect(await page.locator('b').count()).toBe(0);
  });
});

test.describe('LP-02.default reference number', () => {
  for (const [name, ref] of [
    ['a letter outside Crockford Base32', 'R-7K2M-9QXI'],
    ['lower case', 'r-7k2m-9qx4'],
    ['a path', 'C:\\Users\\resellr\\Protokolle'],
    ['markup', '<b>R-7K2M-9QX4</b>'],
    ['an error code', 'internal_error'],
  ] as const) {
    test(`DER-103-01 does not show a number with ${name}`, async ({ page }) => {
      const errors = collectErrors(page);

      await page.goto(lp02Url(ref));

      expect(await visibleLines(page)).toEqual([LP_02_TITLE, LP_02_TEXT]);
      expect(await page.locator('b').count()).toBe(0);
      expect(errors).toEqual([]);
    });
  }

  test('DER-103-01 shows no number without the parameter ref and reads no launcher-state.js', async ({
    page,
  }) => {
    const stateLoads = countStateLoads(page);

    await page.goto(lp02Url(null));

    expect(await visibleLines(page)).toEqual([LP_02_TITLE, LP_02_TEXT]);
    await page.waitForTimeout(1500);
    expect(stateLoads()).toBe(0);
  });
});

test('DER-103-01 LP-01 goes on to LP-02 with the reference number when open writes aborted for its request', async ({
  page,
}) => {
  const errors = collectErrors(page);
  // Like CU-268 writes `aborted`: the address of LP-02 with `ref`, also for `gave_up`.
  const aborted = (request: string, refNo: string) =>
    writeState({ request, phase: 'aborted', url: lp02Url(refNo), refNo });
  aborted('another-call', 'R-ABCD-EFGH');

  await page.goto(lp01Url('call-8'));
  await expect(page).toHaveTitle('resellr startet');
  const historyLength = await page.evaluate(() => history.length);

  aborted('call-8', REF_NO);

  await page.waitForURL((url) => url.pathname.endsWith('/lp-02.html'), { timeout: 5000 });
  await expect(page).toHaveTitle(LP_02_TITLE);
  expect(await visibleLines(page)).toEqual([LP_02_TITLE, LP_02_TEXT, REF_NO]);
  // `location.replace`: going back does not lead to LP-01.
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect(errors).toEqual([]);
});

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

test('F-01 two LP-01 of calls waiting at the same time both go on to the local address', async ({
  context,
}) => {
  await context.route(`${APP_URL}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>resellr</title>' }),
  );
  ensureLauncherStateFile(pagesDir);
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  const errors = pages.map(collectErrors);
  const loads = pages.map(countStateLoads);
  await pages[0]!.goto(lp01Url('call-5'));
  await pages[1]!.goto(lp01Url('call-6'));
  // Both pages read the file before either result is there.
  for (const stateLoads of loads) await expect.poll(stateLoads).toBeGreaterThanOrEqual(1);

  // Like two `open` calls whose results come right after each other.
  writeState({ request: 'call-5', phase: 'ready', url: APP_URL });
  writeState({ request: 'call-6', phase: 'ready', url: APP_URL });

  for (const page of pages) await page.waitForURL(APP_URL, { timeout: 5000 });
  expect(errors).toEqual([[], []]);
});

test('FIND-311 shows no console error before the first write when open created the file', async ({
  page,
}) => {
  await page.route(`${APP_URL}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>resellr</title>' }),
  );
  rmSync(join(pagesDir, LAUNCHER_STATE_FILE_NAME), { force: true });
  // `open` creates the file through CU-268 before it opens LP-01.
  ensureLauncherStateFile(pagesDir);
  const errors = collectErrors(page);
  const stateLoads = countStateLoads(page);

  await page.goto(lp01Url('call-7'));
  await expect.poll(stateLoads).toBeGreaterThanOrEqual(3);
  await expect(page).toHaveTitle('resellr startet');
  expect(errors).toEqual([]);

  writeState({ request: 'call-7', phase: 'ready', url: APP_URL });

  await page.waitForURL(APP_URL, { timeout: 5000 });
  expect(errors).toEqual([]);
});

const LP_03_LOADING = 'resellr wird beendet …';
const LP_03_SUCCESS = [
  'resellr ist beendet.',
  'Sie können den Datenordner jetzt kopieren.',
  'Der Datenordner liegt hier:',
] as const;
const LP_03_ERROR_TITLE = 'resellr konnte nicht beendet werden';
const LP_03_ERROR_TEXT =
  'resellr läuft weiter. Bitte versuchen Sie es erneut. Besteht der Fehler weiter, informieren ' +
  'Sie den Betreiber und nennen Sie ihm diese Referenznummer:';
const LP_03_NOT_RUNNING = [
  'resellr läuft nicht',
  'Es gibt nichts zu beenden. Zum Starten öffnen Sie im Startmenü die Verknüpfung „resellr“.',
] as const;
/** A data folder under a user profile with a space and an umlaut, long enough to wrap. */
const DATA_DIR =
  'C:\\Users\\Jörg Müller\\AppData\\Local\\resellr\\Daten\\Ein sehr langer Ordnername für den Test';

/** Address of LP-03 for a call of `stop`, encoded like CU-310 does it. */
function lp03Url(request: string, dir = pagesDir): string {
  const url = pathToFileURL(join(dir, 'lp-03.html'));
  url.searchParams.set('request', request);
  return url.href;
}

/** The card fits the window and nothing scrolls sideways (480 px and up). */
async function expectCardFits(page: Page, width: number) {
  const card = await page.locator('main:visible').boundingBox();
  expect(card!.x).toBeGreaterThanOrEqual(0);
  expect(card!.x + card!.width).toBeLessThanOrEqual(width);
  expect(card!.width).toBeLessThanOrEqual(560);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

for (const viewport of [
  { width: 480, height: 600 },
  { width: 1366, height: 600 },
]) {
  test.describe(`LP-03 at ${viewport.width} px`, () => {
    test.use({ viewport });

    test('LP-03.loading DER-104-01 shows only the line "resellr wird beendet …" until the result of its call', async ({
      page,
    }) => {
      const errors = collectErrors(page);
      const stateLoads = countStateLoads(page);
      const request = `stop-1-${viewport.width}`;
      // A result of another call changes nothing.
      writeState({ request: 'another-stop', phase: 'stopped', dataDir: DATA_DIR });

      await page.goto(lp03Url(request));
      const loadsBefore = stateLoads();
      await expect.poll(stateLoads).toBeGreaterThanOrEqual(loadsBefore + 2);

      await expect(page).toHaveTitle('resellr wird beendet');
      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - main:
          - status: ${LP_03_LOADING}
      `);
      expect(await visibleLines(page)).toEqual([LP_03_LOADING]);
      await expectCardFits(page, viewport.width);
      expect(errors).toEqual([]);
    });

    test('LP-03.success DER-104-01 shows the title, both sentences and the data folder as selectable text', async ({
      page,
    }) => {
      const errors = collectErrors(page);
      const request = `stop-2-${viewport.width}`;
      await page.goto(lp03Url(request));
      await expect(page).toHaveTitle('resellr wird beendet');

      writeState({ request, phase: 'stopped', dataDir: DATA_DIR });

      await expect(page).toHaveTitle('resellr ist beendet', { timeout: 5000 });
      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - main:
          - heading "${LP_03_SUCCESS[0]}" [level=1]
          - paragraph: ${LP_03_SUCCESS[1]}
          - paragraph: "${LP_03_SUCCESS[2]}"
          - paragraph: "${DATA_DIR.replaceAll('\\', '\\\\')}"
      `);
      await expect(page.getByRole('main')).toHaveCount(1);
      expect(await visibleLines(page)).toEqual([...LP_03_SUCCESS, DATA_DIR]);

      const dataDir = page.getByText(DATA_DIR, { exact: true });
      await expect(dataDir).toHaveCSS('user-select', 'auto');
      await dataDir.selectText();
      expect(await page.evaluate(() => window.getSelection()?.toString().trim())).toBe(DATA_DIR);
      await expectCardFits(page, viewport.width);
      expect(errors).toEqual([]);
    });

    test('LP-03.error shows the title, the text and the reference number as selectable text', async ({
      page,
    }) => {
      const errors = collectErrors(page);
      const request = `stop-3-${viewport.width}`;
      await page.goto(lp03Url(request));

      writeState({ request, phase: 'error', refNo: REF_NO });

      await expect(page).toHaveTitle(LP_03_ERROR_TITLE, { timeout: 5000 });
      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - main:
          - heading "${LP_03_ERROR_TITLE}" [level=1]
          - paragraph: "${LP_03_ERROR_TEXT}"
          - paragraph: ${REF_NO}
      `);
      // No error codes, file paths or table names (REQ-073).
      expect(await visibleLines(page)).toEqual([LP_03_ERROR_TITLE, LP_03_ERROR_TEXT, REF_NO]);
      await page.getByText(REF_NO, { exact: true }).selectText();
      expect(await page.evaluate(() => window.getSelection()?.toString().trim())).toBe(REF_NO);
      await expectCardFits(page, viewport.width);
      expect(errors).toEqual([]);
    });

    test('LP-03.nicht-aktiv DER-104-03 shows "resellr läuft nicht" and the text without a data folder', async ({
      page,
    }) => {
      const errors = collectErrors(page);
      const request = `stop-4-${viewport.width}`;
      await page.goto(lp03Url(request));

      writeState({ request, phase: 'not_running' });

      await expect(page).toHaveTitle('resellr läuft nicht', { timeout: 5000 });
      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - main:
          - heading "${LP_03_NOT_RUNNING[0]}" [level=1]
          - paragraph: "${LP_03_NOT_RUNNING[1]}"
      `);
      expect(await visibleLines(page)).toEqual([...LP_03_NOT_RUNNING]);
      await expectCardFits(page, viewport.width);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('LP-03 values from launcher-state.js', () => {
  for (const [name, refNo] of [
    ['markup', '<b>R-7K2M-9QX4</b>'],
    ['an error code', 'internal_error'],
    ['no number', null],
  ] as const) {
    test(`LP-03.error shows no reference number with ${name} (H-11)`, async ({ page }) => {
      const request = `stop-5-${name}`;
      await page.goto(lp03Url(request));

      writeState({ request, phase: 'error', refNo });

      await expect(page).toHaveTitle(LP_03_ERROR_TITLE, { timeout: 5000 });
      expect(await visibleLines(page)).toEqual([LP_03_ERROR_TITLE, LP_03_ERROR_TEXT]);
      expect(await page.locator('b').count()).toBe(0);
    });
  }

  test('LP-03.success shows the data folder as text, never as markup', async ({ page }) => {
    const request = 'stop-6';
    await page.goto(lp03Url(request));

    writeState({ request, phase: 'stopped', dataDir: 'C:\\<b>Daten</b>' });

    await expect(page).toHaveTitle('resellr ist beendet', { timeout: 5000 });
    expect(await visibleLines(page)).toEqual([...LP_03_SUCCESS, 'C:\\<b>Daten</b>']);
    expect(await page.locator('b').count()).toBe(0);
  });

  test('LP-03 stops reading launcher-state.js once it shows the result', async ({ page }) => {
    const request = 'stop-7';
    const stateLoads = countStateLoads(page);
    await page.goto(lp03Url(request));
    writeState({ request, phase: 'not_running' });
    await expect(page).toHaveTitle('resellr läuft nicht', { timeout: 5000 });

    const loadsAfter = stateLoads();
    // A later entry of the same call changes nothing on the page.
    writeState({ request, phase: 'stopped', dataDir: DATA_DIR });
    await page.waitForTimeout(2500);

    expect(stateLoads()).toBe(loadsAfter);
    expect(await visibleLines(page)).toEqual([...LP_03_NOT_RUNNING]);
  });
});

/**
 * DER-104-01 with the launcher, the supervisor and a stand-in server as processes: `stop` opens
 * LP-03, sends `stop` over the pipe, and after the end the page shows `.success`. Without the
 * registry under Linux the launcher opens LP-03 through the default browser; a stand-in
 * `explorer.exe` records its address, and the test opens it in Chrome.
 */
test.describe('LP-03 with resellr-launcher stop', () => {
  const LAUNCHER = 'tools/launcher/src/cli.ts';
  const FAKE_SERVER = 'tools/launcher/test/fake-server.ts';
  let stopRoot: string;
  const children: ChildProcess[] = [];

  test.beforeEach(() => {
    stopRoot = mkdtempSync(join(tmpdir(), 'resellr-lp-03-e2e-'));
  });

  test.afterEach(() => {
    for (const child of children.splice(0)) child.kill();
    rmSync(stopRoot, { recursive: true, force: true });
  });

  function freePort(): Promise<number> {
    return new Promise((resolve) => {
      const server = createServer().listen(0, '127.0.0.1', () => {
        const { port } = server.address() as { port: number };
        server.close(() => resolve(port));
      });
    });
  }

  test('DER-104-01 shows loading while the server stops, then .success with the data folder', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const programDir = join(stopRoot, 'Programs', 'resellr #1 Jörg');
    const stopPagesDir = join(programDir, 'launcher-pages');
    execFileSync(process.execPath, [BUILD_SCRIPT, stopPagesDir]);
    const dataDir = join(stopRoot, 'Daten von Jörg');
    const logDir = join(stopRoot, 'Protokolle');
    mkdirSync(dataDir);
    writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ port: await freePort() }));
    const fakesDir = join(stopRoot, 'fakes');
    mkdirSync(fakesDir);
    const opened = join(stopRoot, 'opened.txt');
    writeFileSync(join(fakesDir, 'explorer.exe'), `#!/bin/sh\nprintf '%s' "$1" > "${opened}"\n`);
    chmodSync(join(fakesDir, 'explorer.exe'), 0o755);
    const gate = join(stopRoot, 'shutdown-gate');
    const env = {
      PATH: `${fakesDir}:${process.env.PATH}`,
      LOCALAPPDATA: stopRoot,
      RESELLR_DATA_DIR: dataDir,
      RESELLR_LOG_DIR: logDir,
      RESELLR_HANDOVER_DIR: join(stopRoot, 'Fotoübergabe'),
      RESELLR_UPDATE_COPY_DIR: join(stopRoot, 'Update-Kopien'),
      RESELLR_TEST_PROGRAM_DIR: programDir,
      RESELLR_TEST_SERVER_ENTRY: FAKE_SERVER,
      FAKE_SERVER_DIR: stopRoot,
      // The stand-in server answers the shutdown only once this file exists.
      FAKE_SERVER_SHUTDOWN_GATE: gate,
      TMPDIR: tmpdir(),
    };
    const run = (command: string[]) => {
      const child = spawn(process.execPath, [LAUNCHER, ...command], { env, stdio: 'ignore' });
      children.push(child);
      return new Promise<number | null>((resolve) => child.on('exit', resolve));
    };

    const supervisor = run(['supervise']);
    // The supervisor checks the server only from `ready` on (CU-262).
    await expect
      .poll(
        () =>
          existsSync(logDir) &&
          readdirSync(logDir)
            .filter((name) => name.startsWith('availability-'))
            .some((name) => readFileSync(join(logDir, name), 'utf8').includes('"ok":true')),
        { timeout: 15_000 },
      )
      .toBe(true);

    const stop = run(['stop']);
    await expect.poll(() => existsSync(opened), { timeout: 10_000 }).toBe(true);
    const lp03 = readFileSync(opened, 'utf8');
    expect(lp03.split('?')[0]).toBe(pathToFileURL(join(stopPagesDir, 'lp-03.html')).href);

    await page.goto(lp03);
    await expect(page).toHaveTitle('resellr wird beendet');
    expect(await visibleLines(page)).toEqual([LP_03_LOADING]);

    writeFileSync(gate, '');

    await expect(page).toHaveTitle('resellr ist beendet', { timeout: 10_000 });
    expect(await visibleLines(page)).toEqual([...LP_03_SUCCESS, dataDir]);
    await page.getByText(dataDir, { exact: true }).selectText();
    expect(await page.evaluate(() => window.getSelection()?.toString().trim())).toBe(dataDir);
    expect(await stop).toBe(0);
    expect(await supervisor).toBe(0);
    expect(errors).toEqual([]);
  });
});
