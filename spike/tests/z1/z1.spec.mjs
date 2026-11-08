// Z-1 (S-7, T-5, T-6): launcher pages as file:// pages in Google Chrome. Test tooling only.
// Each test writes its own result file (status, values) for results.json, then asserts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.resolve(process.env.Z1_RESULTS_DIR ?? 'z1-results');
const APP_URL = 'http://127.0.0.1:4310/';
const SWITCH_LIMIT_MS = 3000;
const REF_NO = 'R-Z1T2-ABCD';

fs.mkdirSync(resultsDir, { recursive: true });

function saveResult(id, passed, summary, values, reason = '') {
  const result = { id, status: passed ? 'passed' : 'failed', summary, reason, values };
  fs.writeFileSync(path.join(resultsDir, `${id}.json`), JSON.stringify(result, null, 2));
  return result;
}

// Fresh copy of the pages per test; launcher-state.js is rewritten atomically so the page never
// loads a half-written file.
function preparePages(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `resellr-spike-z1-${name}-`));
  for (const f of ['lp-01.html', 'lp-02.html']) fs.copyFileSync(path.join(here, 'pages', f), path.join(dir, f));
  return dir;
}

function writeState(dir, state) {
  const tmp = path.join(dir, 'launcher-state.js.tmp');
  fs.writeFileSync(tmp, `window.launcherState = ${JSON.stringify(state)};\n`);
  fs.renameSync(tmp, path.join(dir, 'launcher-state.js'));
  return Date.now();
}

function collectConsole(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ text: msg.text(), url: page.url() });
  });
  page.on('pageerror', (err) => errors.push({ text: String(err), url: page.url() }));
  return errors;
}

// Any TrueType font serves as the "Inter" face: the check is about how the face is loaded.
function findFontFile() {
  const candidates = [
    process.env.Z1_FONT,
    'C:\\Windows\\Fonts\\arial.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
  ].filter(Boolean);
  return candidates.find((f) => fs.existsSync(f));
}

let appServer;
test.beforeAll(async () => {
  appServer = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html lang="de"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>app</title></head><body><p>resellr-spike app</p></body></html>');
  });
  await new Promise((resolve) => appServer.listen(4310, '127.0.0.1', resolve));
});

test.afterAll(async () => {
  await new Promise((resolve) => appServer.close(resolve));
});

test('Z1.1 ready: lp-01 switches to the http address', async ({ page }) => {
  const dir = preparePages('z11');
  const errors = collectConsole(page);
  writeState(dir, { phase: 'starting' });
  await page.goto(pathToFileURL(path.join(dir, 'lp-01.html')).href);
  await page.waitForTimeout(3000);
  const phaseBefore = await page.locator('#phase').textContent();
  const urlBefore = page.url();
  const writtenMs = writeState(dir, { phase: 'ready', url: APP_URL });
  let switchMs = null;
  try {
    await page.waitForURL(APP_URL, { timeout: 10_000 });
    switchMs = Date.now() - writtenMs;
  } catch {
    // switchMs stays null
  }
  await page.waitForLoadState('load').catch(() => {});
  await page.screenshot({ path: path.join(resultsDir, 'z1.1-ready.png') });
  const passed = urlBefore.startsWith('file:') && phaseBefore === 'starting' && switchMs !== null &&
    switchMs <= SWITCH_LIMIT_MS && errors.length === 0;
  saveResult('Z1.1', passed, switchMs === null ? 'kein Wechsel in 10 s' : `Wechsel nach ${switchMs} ms, ${errors.length} Konsolenfehler`, {
    urlBefore, phaseBefore, finalUrl: page.url(), switchMs, limitMs: SWITCH_LIMIT_MS, consoleErrors: errors,
    browserVersion: page.context().browser()?.version() ?? null,
  });
  expect(passed).toBeTruthy();
});

test('Z1.2 aborted: lp-01 switches to lp-02 with the reference number', async ({ page }) => {
  const dir = preparePages('z12');
  const errors = collectConsole(page);
  writeState(dir, { phase: 'starting' });
  await page.goto(pathToFileURL(path.join(dir, 'lp-01.html')).href);
  await page.waitForTimeout(3000);
  const writtenMs = writeState(dir, { phase: 'aborted', refNo: REF_NO });
  let switchMs = null;
  try {
    await page.waitForURL(/lp-02\.html\?ref=/, { timeout: 10_000 });
    switchMs = Date.now() - writtenMs;
  } catch {
    // switchMs stays null
  }
  const refShown = switchMs === null ? null : await page.locator('#ref').textContent();
  const refInUrl = new URL(page.url()).searchParams.get('ref');
  await page.screenshot({ path: path.join(resultsDir, 'z1.2-aborted.png') });
  const passed = switchMs !== null && switchMs <= SWITCH_LIMIT_MS && refInUrl === REF_NO && refShown === REF_NO;
  saveResult('Z1.2', passed, switchMs === null ? 'kein Wechsel in 10 s' : `Wechsel nach ${switchMs} ms, Referenznummer ${refShown}`, {
    finalUrl: page.url(), switchMs, limitMs: SWITCH_LIMIT_MS, refNoWritten: REF_NO, refInUrl, refShown, consoleErrors: errors,
  });
  expect(passed).toBeTruthy();
});

async function fontCheck(page, fileUrl) {
  const errors = collectConsole(page);
  await page.goto(fileUrl);
  const result = await page.evaluate(async () => {
    try {
      await document.fonts.load('400 12px Inter');
    } catch (err) {
      // reported through the face status below
    }
    await document.fonts.ready;
    const faces = [...document.fonts].map((f) => ({ family: f.family, weight: f.weight, status: f.status }));
    return { check: document.fonts.check('400 12px Inter'), faces };
  });
  return { ...result, consoleErrors: errors };
}

test('Z1.3 font: @font-face as data: URL and as relative file', async ({ page }) => {
  const fontFile = findFontFile();
  test.skip(!fontFile, 'no TrueType font found');
  const dir = preparePages('z13');
  fs.copyFileSync(fontFile, path.join(dir, 'inter.ttf'));
  const b64 = fs.readFileSync(fontFile).toString('base64');
  const page1 = (src) => `<!doctype html><html lang="de"><head><meta charset="utf-8"><link rel="icon" href="data:,">
<style>@font-face { font-family: 'Inter'; font-weight: 400; src: ${src} format('truetype'); } body { font: 400 12px Inter, sans-serif; }</style>
</head><body><p>resellr-spike Schrift</p></body></html>`;
  fs.writeFileSync(path.join(dir, 'font-data.html'), page1(`url(data:font/ttf;base64,${b64})`));
  fs.writeFileSync(path.join(dir, 'font-file.html'), page1(`url('inter.ttf')`));

  const dataUrl = await fontCheck(page, pathToFileURL(path.join(dir, 'font-data.html')).href);
  await page.screenshot({ path: path.join(resultsDir, 'z1.3-font-data.png') });
  const relative = await fontCheck(page, pathToFileURL(path.join(dir, 'font-file.html')).href);
  await page.screenshot({ path: path.join(resultsDir, 'z1.3-font-file.png') });

  const passed = dataUrl.check === true;
  saveResult('Z1.3', passed, `data:-URL check=${dataUrl.check}; relative Datei check=${relative.check} (notiert)`, {
    fontSource: path.basename(fontFile), dataUrl, relativeFile: relative,
  });
  expect(passed).toBeTruthy();
});
