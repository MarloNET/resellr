import type { Locator, Page } from '@playwright/test';

import { DATA_DIR_PATH_LENGTH, expect, test } from './fixtures/app-fixture.ts';
import { findReachabilityProblems } from './fixtures/reachability.ts';

/** Statements (a) to (d) of REQ-104 as UI-044 shows them. */
const STATEMENTS = [
  'resellr sichert Ihre Daten nicht selbst.',
  'Bitte sichern Sie sie regelmäßig selbst, zum Beispiel in OneDrive.',
  '1. resellr beenden.',
  '2. Den Datenordner vollständig an Ihren Sicherungsort kopieren.',
  'Der Datenordner liegt hier:',
  'Wichtig: Eine Kopie, die bei laufendem resellr entsteht, kann unbrauchbar sein.',
];

/** Rows of the matrix with the full frame and its navigation column (DER-95-06). */
const COLUMN_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const notice = (page: Page) => page.getByRole('region', { name: 'Sicherung einrichten' });
const scrollArea = (page: Page) => page.getByTestId('navigation-scroll-area');

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (result === null) throw new Error('element has no box');
  return result;
}

test.describe('Backup notice UI-044 in the navigation column (#137)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !COLUMN_ROWS.includes(testInfo.project.name),
      'full frame only in FM-1 to FM-4, FM-6',
    );
  });

  test('AC-REQ-104-01 after opening resellr the notice shows heading, statements and data folder', async ({
    page,
    server,
  }) => {
    expect(server.paths.dataDir).toHaveLength(DATA_DIR_PATH_LENGTH);

    await page.goto('/');

    const region = notice(page);
    await expect(region.getByRole('heading', { name: 'Sicherung einrichten' })).toBeVisible();
    for (const statement of STATEMENTS) await expect(region).toContainText(statement);
    await expect(region.getByTestId('backup-notice-path')).toHaveText(server.paths.dataDir);
    await expect(region).toContainText(`Der Datenordner liegt hier:${server.paths.dataDir}.`);
  });

  test('AC-REQ-104-01 in FM-6 the notice is visible without scrolling at the lower edge of the column', async ({
    page,
    server,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'FM-6', 'binding only in FM-6 (6.3)');
    await page.goto('/inserate');
    const region = notice(page);
    await expect(region.getByTestId('backup-notice-path')).toHaveText(server.paths.dataDir);

    const area = scrollArea(page);
    expect(await area.evaluate((element) => element.scrollTop)).toBe(0);
    expect(await area.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(
      true,
    );
    const viewport = page.viewportSize()!;
    const noticeBox = await box(region);
    expect(noticeBox.y).toBeGreaterThanOrEqual(0);
    expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(viewport.height);
    // Lower edge: the notice block (with its 8 px margin) ends at the end of the scrolling area.
    const areaBox = await box(area);
    const blockBox = await box(region.locator('xpath=..'));
    expect(
      Math.abs(blockBox.y + blockBox.height - (areaBox.y + areaBox.height)),
    ).toBeLessThanOrEqual(1);
    // No overlap with the entries.
    const lastEntry = await box(
      page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link').last(),
    );
    expect(noticeBox.y).toBeGreaterThanOrEqual(lastEntry.y + lastEntry.height);
  });

  test('AC-REQ-104-01 in FM-1 reports whether the notice is visible without scrolling', async ({
    page,
    server,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'FM-1', 'report only in FM-1 (6.3)');
    await page.goto('/inserate');
    const region = notice(page);
    await expect(region.getByTestId('backup-notice-path')).toHaveText(server.paths.dataDir);

    const noticeBox = await box(region);
    const visible = noticeBox.y + noticeBox.height <= page.viewportSize()!.height;
    // Only a report for the owner (6.3 "Nur Bericht"): never fails the run.
    testInfo.annotations.push({
      type: 'report',
      description: `FM-1: notice ${visible ? 'is' : 'is not'} completely visible without scrolling`,
    });
  });

  test('DER-95-06 text and path are readable and selectable by scrolling, the column stays usable', async ({
    page,
    server,
  }) => {
    await page.goto('/inserate');
    const region = notice(page);
    const path = region.getByTestId('backup-notice-path');
    await expect(path).toHaveText(server.paths.dataDir);

    // Nothing collapsed, hidden or cut off: every line lies completely inside the notice and
    // can be scrolled into the viewport.
    const regionBox = await box(region);
    for (const line of await region.locator('p, h2, button').all()) {
      await line.scrollIntoViewIfNeeded();
      const lineBox = await box(line);
      expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(lineBox.y).toBeGreaterThanOrEqual(0);
      expect(lineBox.width).toBeLessThanOrEqual(regionBox.width);
    }
    expect(await region.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(
      true,
    );

    // The path is selectable text: a triple click selects exactly the path.
    await path.scrollIntoViewIfNeeded();
    await path.click({ clickCount: 3 });
    expect(await page.evaluate(() => window.getSelection()?.toString().trim())).toBe(
      server.paths.dataDir,
    );

    // Head "resellr" visible, no horizontal scroll bar of the column, no text under 12 px,
    // every operable element reachable (6.3).
    expect(await findReachabilityProblems(page)).toEqual([]);
  });

  test('DER-95-06 "resellr beenden" can be used with the mouse and with Tab and Enter', async ({
    page,
  }) => {
    await page.goto('/inserate');
    const button = notice(page).getByRole('button', { name: 'resellr beenden' });

    await button.scrollIntoViewIfNeeded();
    await button.click();
    await expect(button).toBeFocused();

    await scrollArea(page).evaluate((element) => element.scrollTo(0, 0));
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Einstellungen' })
      .focus();
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    // Chrome scrolls the focused button into the visible part of the column.
    await expect(button).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Enter');
    // No effect until UI-045 (#142): the page stays as it is.
    await expect(page).toHaveURL(/\/inserate$/);
    await expect(button).toBeFocused();
  });
});

test.describe('Backup notice UI-044 without connection (#139)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !COLUMN_ROWS.includes(testInfo.project.name),
      'full frame only in FM-1 to FM-4, FM-6',
    );
  });

  test('DER-95-04 with the server ended the notice keeps "wird geladen …" and the content area shows P-06; after "Erneut versuchen" the data folder appears', async ({
    page,
    server,
  }) => {
    // The page is loaded; the server ends exactly when the status is requested, so that
    // request finds no server any more.
    await page.route(
      '**/api/ops/status',
      async (route) => {
        await server.kill();
        await route.continue();
      },
      { times: 1 },
    );

    try {
      await page.goto('/inserate');

      const content = page.getByTestId('content-area');
      const banner = content.getByRole('alert');
      await expect(banner).toContainText('resellr ist nicht erreichbar.');
      await expect(banner.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(1);
      await expect(notice(page).getByTestId('backup-notice-path')).toHaveText('wird geladen …');
      // The page is not replaced.
      await expect(content).toContainText('Noch keine Modell-Inserate');

      await server.restart();
      await banner.getByRole('button', { name: 'Erneut versuchen' }).click();

      await expect(notice(page).getByTestId('backup-notice-path')).toHaveText(server.paths.dataDir);
      await expect(page.getByRole('alert')).toHaveCount(0);
    } finally {
      // The other tests of this worker need the server.
      await server.restart();
    }
  });
});
