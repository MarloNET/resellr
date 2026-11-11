import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Page } from '@playwright/test';

import { type AppServer, expect, test } from './fixtures/app-fixture.ts';

/** Rows of the matrix with the full frame and its navigation column (UI-044). */
const COLUMN_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

/** End marker of an orderly shutdown in the data folder (Technical Specification 2.17, step 6). */
const SHUTDOWN_MARKER_FILE_NAME = 'shutdown-marker.json';

const QUESTION =
  'resellr jetzt beenden? Nicht gespeicherte Eingaben gehen verloren. ' +
  'Danach können Sie den Datenordner kopieren.';

// `includeHidden`: while the modal dialog is open, the page behind it is hidden from assistive
// technology (`aria-hidden`), the button stays in the DOM.
const noticeButton = (page: Page) =>
  page
    .getByRole('region', { name: 'Sicherung einrichten', includeHidden: true })
    .getByRole('button', { name: 'resellr beenden', includeHidden: true });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'resellr beenden' });

/** Health of the running server: state and the id of the current start. */
async function health(server: AppServer): Promise<unknown> {
  const response = await fetch(`${server.baseUrl}/api/ops/health`);
  return response.json();
}

/**
 * Sample of the stored data (AC-REQ-105-02): every table with all its rows, read from the
 * database of the running server, and the files of the data folder.
 */
function dataSample(server: AppServer): unknown {
  const db = new DatabaseSync(join(server.paths.dataDir, 'resellr.db'), { readOnly: true });
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row.name));
    const rows = Object.fromEntries(
      tables.map((table) => [table, db.prepare(`SELECT * FROM "${table}"`).all()]),
    );
    return { rows, files: readdirSync(server.paths.dataDir).sort() };
  } finally {
    db.close();
  }
}

/**
 * Content of the end marker in the data folder, `null` without one. The server of a test worker
 * is shared by its tests, so an earlier test may have shut it down and left a marker: a test
 * compares the marker before and after instead of expecting none.
 */
function shutdownMarker(server: AppServer): string | null {
  const path = join(server.paths.dataDir, SHUTDOWN_MARKER_FILE_NAME);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/** Every `POST /api/ops/shutdown` the page sends. */
function shutdownRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/ops/shutdown')) {
      requests.push(request.url());
    }
  });
  return requests;
}

test.describe('Question UI-045 from the backup notice (#142)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !COLUMN_ROWS.includes(testInfo.project.name),
      'full frame only in FM-1 to FM-4, FM-6',
    );
  });

  test('AC-REQ-105-01 "resellr beenden" at the notice shows the question of REQ-105, and resellr keeps running until the user confirms', async ({
    page,
    server,
  }) => {
    const requests = shutdownRequests(page);
    await page.goto('/inserate');
    const before = await health(server);
    expect(before).toMatchObject({ state: 'ready' });
    const markerBefore = shutdownMarker(server);

    await noticeButton(page).click();

    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole('heading', { name: 'resellr beenden' })).toBeVisible();
    await expect(dialog(page)).toContainText(QUESTION);
    await expect(dialog(page).getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await expect(noticeButton(page)).toBeDisabled();
    // Nothing is sent and the server runs on while the question is open.
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
    expect(await health(server)).toEqual(before);
    expect(shutdownMarker(server)).toEqual(markerBefore);

    await dialog(page).getByRole('button', { name: 'Abbrechen' }).click();
    await expect(noticeButton(page)).toBeFocused();
  });

  test('AC-REQ-105-02 after "Abbrechen" resellr runs on unchanged and no data are changed', async ({
    page,
    server,
  }) => {
    const requests = shutdownRequests(page);
    await page.goto('/inserate');
    await expect(page.getByTestId('backup-notice-path')).toHaveText(server.paths.dataDir);
    const healthBefore = await health(server);
    const sampleBefore = dataSample(server);
    const markerBefore = shutdownMarker(server);

    await noticeButton(page).click();
    await dialog(page).getByRole('button', { name: 'Abbrechen' }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(noticeButton(page)).toBeEnabled();
    await expect(noticeButton(page)).toBeFocused();
    await expect(page).toHaveURL(/\/inserate$/);
    expect(requests).toEqual([]);
    expect(await health(server)).toEqual(healthBefore);
    expect(dataSample(server)).toEqual(sampleBefore);
    expect(shutdownMarker(server)).toEqual(markerBefore);
  });

  test('DER-96-01 Esc closes the question, and Enter on "Abbrechen" does not shut down', async ({
    page,
    server,
  }) => {
    const requests = shutdownRequests(page);
    await page.goto('/inserate');

    await noticeButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(noticeButton(page)).toBeFocused();

    // Enter confirms only with the focus on "resellr beenden"; it starts on "Abbrechen".
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toHaveCount(0);

    expect(requests).toEqual([]);
    expect(await health(server)).toMatchObject({ state: 'ready' });
  });
});
