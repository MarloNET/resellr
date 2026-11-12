import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Page } from '@playwright/test';

import { type AppServer, expect, test } from './fixtures/app-fixture.ts';

/** Rows of the matrix with the full frame and its navigation column (UI-044). */
const COLUMN_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const DONE = 'resellr ist beendet. Sie können den Datenordner jetzt kopieren.';
const UNKNOWN_TITLE = 'Es ließ sich nicht feststellen, ob resellr beendet wurde.';
const UNKNOWN_TEXT =
  'Ausgang unbekannt. resellr antwortet nicht mehr. Kopieren Sie den Datenordner deshalb noch ' +
  'nicht. Starten Sie resellr über die Verknüpfung „resellr“ im Startmenü und beenden Sie es ' +
  'danach erneut. Läuft resellr noch, öffnet die Verknüpfung die normale Oberfläche.';
const MI_A_SHOP_PRICE_CENTS = 27_900;

/** "resellr beenden" in the notice, then "resellr beenden" in UI-045. */
async function confirmShutdown(page: Page): Promise<void> {
  await page
    .getByRole('region', { name: 'Sicherung einrichten' })
    .getByRole('button', { name: 'resellr beenden' })
    .click();
  await page
    .getByRole('dialog', { name: 'resellr beenden' })
    .getByRole('button', { name: 'resellr beenden' })
    .click();
}

/** Whether the server answers at all. */
async function answers(server: AppServer): Promise<boolean> {
  try {
    await fetch(`${server.baseUrl}/api/ops/health`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Precondition of AC-REQ-105-03: MI-A of the requirements test data with the shop price 279,00 €,
 * written while the server runs. The price function of #62 does not exist yet, so the rows are
 * written through a second connection, like the AC-REQ-105-04 test of the server does.
 */
function writeMiAShopPrice(server: AppServer): void {
  const ts = '2026-11-10T08:00:00.000Z';
  const db = new DatabaseSync(join(server.paths.dataDir, 'resellr.db'));
  try {
    db.exec(`
      INSERT INTO device_type (id, name, name_key, active, sort_order, version, created_at, updated_at)
        VALUES (9101, 'E2E Notebook 143', 'e2e notebook 143', 1, 9101, 1, '${ts}', '${ts}');
      INSERT INTO manufacturer (id, name, name_key, active, gpsr_complete, version, created_at, updated_at)
        VALUES (9101, 'E2E Hersteller 143', 'e2e hersteller 143', 1, 0, 1, '${ts}', '${ts}');
      INSERT INTO model_template (id, device_type_id, manufacturer_id, model_name, model_name_key,
          type_designation, mpn_unknown, model_values, default_device_values, search_key,
          import_review_pending, import_review_keys, version, created_at, updated_at)
        VALUES (9101, 9101, 9101, 'MacBook Pro 13', 'macbook pro 13', 'A1989', 1, '{}', '{}',
          'e2e macbook pro 13 a1989', 0, '[]', 1, '${ts}', '${ts}');
      INSERT INTO pick_list (key, name, is_battery_list, version)
        SELECT 'condition', 'Zustand', 0, 1
        WHERE NOT EXISTS (SELECT 1 FROM pick_list WHERE key = 'condition');
      INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version)
        SELECT 9101, id, 'gebraucht E2E 143', 'gebraucht e2e 143', 9101, 1, 1
        FROM pick_list WHERE key = 'condition';
      INSERT INTO channel (id, code, name, active, title_max_length, vb_allowed, sort_order,
          condition_mappings_version, version, created_at, updated_at)
        VALUES (9101, 'e2e-shop-143', 'Shop E2E 143', 1, 128, 0, 9101, 1, 1, '${ts}', '${ts}');
      INSERT INTO listing (id, model_template_id, condition_value_id, visual_grade,
          condition_description, condition_description_key, variant_values, other_device_values,
          article_number, article_number_key, ean_mode, display_title, quantity, stock_json,
          stock_hash, version, created_at, updated_at)
        VALUES (9101, 9101, 9101, 2, 'leichte Gebrauchsspuren', 'leichte gebrauchsspuren', '{}',
          '{}', 'E2E-143', 'e2e-143', 'original', 'MI-A', 0, '{}', '', 1, '${ts}', '${ts}');
      INSERT INTO listing_price (listing_id, channel_id, amount_cents, vb, source)
        VALUES (9101, 9101, ${MI_A_SHOP_PRICE_CENTS}, 0, 'manual');
    `);
  } finally {
    db.close();
  }
}

/** Shop price of MI-A in cents, read from the database of the running server. */
function miAShopPrice(server: AppServer): unknown {
  const db = new DatabaseSync(join(server.paths.dataDir, 'resellr.db'), { readOnly: true });
  try {
    return db
      .prepare(
        `SELECT p.amount_cents FROM listing_price p JOIN listing l ON l.id = p.listing_id
         WHERE l.display_title = 'MI-A' AND p.channel_id = 9101`,
      )
      .get()?.amount_cents;
  } finally {
    db.close();
  }
}

test.describe('End state UI-046 after "resellr beenden" (#143)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !COLUMN_ROWS.includes(testInfo.project.name),
      'full frame only in FM-1 to FM-4, FM-6',
    );
  });

  // Every test ends the server of its worker; the next test of the worker needs it running.
  test.afterEach(async ({ server }) => {
    if (!(await answers(server))) await server.restart();
  });

  test('AC-REQ-105-03 after confirming, resellr shows the end message, is unusable until the next start, and MI-A keeps its shop price 279,00 €', async ({
    page,
    server,
  }) => {
    writeMiAShopPrice(server);
    await page.goto('/inserate');
    await expect(page.getByTestId('backup-notice-path')).toHaveText(server.paths.dataDir);

    await confirmShutdown(page);

    await expect(page.getByRole('heading', { level: 1, name: DONE })).toBeVisible();
    await expect(page).toHaveURL(/\/beendet$/);
    await expect(page.getByText('Der Datenordner liegt hier:')).toBeVisible();
    await expect(page.getByTestId('terminated-path')).toHaveText(server.paths.dataDir);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Sicherung einrichten' })).toHaveCount(0);
    await expect(page.getByRole('button')).toHaveCount(0);

    // Not usable until the next start: the server has ended, nothing answers, and the page
    // sends no further request.
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await expect.poll(() => answers(server), { timeout: 10_000 }).toBe(false);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
    await expect(page.reload()).rejects.toThrow(/ERR_CONNECTION_REFUSED/);

    // Next start: the stored shop price of MI-A is unchanged.
    await server.restart();
    expect(miAShopPrice(server)).toBe(MI_A_SHOP_PRICE_CENTS);
    await page.goto('/inserate');
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('DER-96-06 on a connection loss UI-046.unknown appears without path and without "Erneut versuchen"', async ({
    page,
    server,
  }) => {
    await page.goto('/inserate');
    await expect(page.getByTestId('backup-notice-path')).toHaveText(server.paths.dataDir);

    // The server ends on purpose before the request: the connection is lost.
    await server.kill();
    await confirmShutdown(page);

    await expect(page.getByRole('heading', { level: 1, name: UNKNOWN_TITLE })).toBeVisible();
    await expect(page).toHaveURL(/\/beendet$/);
    await expect(page.getByText(UNKNOWN_TEXT)).toBeVisible();
    await expect(page.getByText(server.paths.dataDir)).toHaveCount(0);
    await expect(page.getByText('Der Datenordner liegt hier:')).toHaveCount(0);
    await expect(page.getByRole('button')).toHaveCount(0);
    await expect(page.getByText('Erneut versuchen')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });

  test('DER-96-06 without an answer within 30 s UI-046.unknown appears without path and without "Erneut versuchen"', async ({
    page,
    server,
  }) => {
    await page.clock.install();
    // The request is held on its way and never answered.
    await page.route('**/api/ops/shutdown', () => {});
    await page.goto('/inserate');
    await expect(page.getByTestId('backup-notice-path')).toHaveText(server.paths.dataDir);

    await confirmShutdown(page);
    await expect(page.getByRole('dialog', { name: 'resellr beenden' })).toContainText(
      'resellr wird beendet …',
    );
    await page.clock.runFor(29_000);
    await expect(page).toHaveURL(/\/inserate$/);
    await page.clock.runFor(1_000);

    await expect(page.getByRole('heading', { level: 1, name: UNKNOWN_TITLE })).toBeVisible();
    await expect(page).toHaveURL(/\/beendet$/);
    await expect(page.getByText(UNKNOWN_TEXT)).toBeVisible();
    await expect(page.getByText(server.paths.dataDir)).toHaveCount(0);
    await expect(page.getByRole('button')).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});
