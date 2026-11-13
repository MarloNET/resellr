import { join } from 'node:path';

import type { Page } from '@playwright/test';
import { modelTemplateSearchKey } from '@resellr/domain/schemas/model-template.schema';
import { toModelNameKey } from '@resellr/domain/text/normalize-key';
import BetterSqlite3 from 'better-sqlite3';

import { type AppServer, expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const PAGE = '/modelle';

const searchField = (page: Page) => page.getByRole('searchbox', { name: 'Suchbegriff' });
const hitList = (page: Page) => page.getByRole('table', { name: 'Modellvorlagen' });
const createLink = (page: Page) => page.getByRole('link', { name: 'Modellvorlage anlegen' });

/**
 * Types the search term and waits for the answer of its search: until then the previous list is
 * still shown and is then replaced by the loading state.
 */
async function search(page: Page, term: string) {
  const answered = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/model-templates' && url.searchParams.get('q') === term;
  });
  await searchField(page).fill(term);
  await answered;
}

/** The server keeps its data per worker: each test uses its own names. */
function uniqueName(base: string, title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base} ${hash.toString(36)}`;
}

/** Creates a manufacturer through the API like the user interface (`local-guard` G-2, G-4). */
async function createManufacturer(page: Page, baseUrl: string, name: string): Promise<number> {
  const response = await page.request.post(`${baseUrl}/api/manufacturers`, {
    headers: { origin: baseUrl },
    data: { name },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: number }).id;
}

/** Id of a device type of the initial settings (CU-071). */
async function deviceTypeId(page: Page, baseUrl: string, name: string): Promise<number> {
  const response = await page.request.get(`${baseUrl}/api/device-types?limit=200`);
  const { items } = (await response.json()) as { items: { id: number; name: string }[] };
  const found = items.find((item) => item.name === name);
  if (found === undefined) throw new Error(`No device type ${name}`);
  return found.id;
}

/**
 * Stores a model template in the database of the running server. Creating one through the API
 * follows with #177; until then the search is tested on rows written like 3.3 describes them,
 * with `search_key` from the same function the catalog uses.
 */
function insertModelTemplate(
  server: AppServer,
  template: {
    deviceTypeId: number;
    manufacturerId: number;
    modelName: string;
    typeDesignation: string | null;
    mpn: string | null;
  },
): number {
  const sqlite = new BetterSqlite3(join(server.paths.dataDir, 'resellr.db'));
  try {
    sqlite.pragma('busy_timeout = 5000');
    const at = new Date().toISOString();
    const { lastInsertRowid } = sqlite
      .prepare(
        `INSERT INTO model_template (device_type_id, manufacturer_id, model_name, model_name_key,
           type_designation, mpn, mpn_unknown, original_ean, model_values, default_device_values,
           search_key, import_review_pending, import_review_keys, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, '{}', '{}', ?, 0, '[]', 1, ?, ?)`,
      )
      .run(
        template.deviceTypeId,
        template.manufacturerId,
        template.modelName,
        toModelNameKey(template.modelName),
        template.typeDesignation,
        template.mpn,
        template.mpn === null ? 1 : 0,
        modelTemplateSearchKey(template),
        at,
        at,
      );
    return Number(lastInsertRowid);
  } finally {
    sqlite.close();
  }
}

/** MV-A of AC-REQ-009-01 with a manufacturer name of its own per test. */
async function insertMvA(page: Page, server: AppServer, manufacturerName: string) {
  const manufacturerId = await createManufacturer(page, server.baseUrl, manufacturerName);
  const id = insertModelTemplate(server, {
    deviceTypeId: await deviceTypeId(page, server.baseUrl, 'Notebook'),
    manufacturerId,
    modelName: 'MacBook Pro 13',
    typeDesignation: 'A1708',
    mpn: 'MHGT3D/A',
  });
  return id;
}

test.describe('UI-006 Modell-Bibliothek (CU-113)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('UI-006.default DER-51-01 AC-REQ-009-01 the list and the search "macbook pro" show MV-A with all columns, the search field has the focus', async ({
    page,
    server,
  }, testInfo) => {
    const manufacturer = uniqueName('Apple', testInfo.title, testInfo.project.name);
    const id = await insertMvA(page, server, manufacturer);

    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Modell-Bibliothek' })).toBeVisible();
    await expect(searchField(page)).toBeFocused();
    await expect(page.getByText(/^\d+ Modellvorlagen$/)).toBeVisible();
    await expectReachable(page);

    await search(page, 'macbook pro');
    const row = hitList(page).getByRole('row').filter({ hasText: manufacturer });
    await expect(row.getByRole('cell')).toHaveText([
      'Notebook',
      manufacturer,
      'MacBook Pro 13',
      'A1708',
      'MHGT3D/A',
    ]);
    await expect(row.getByRole('link', { name: 'MacBook Pro 13' })).toHaveAttribute(
      'href',
      `/modelle/${id}`,
    );
    await expectReachable(page);
  });

  test('AC-REQ-009-02 the search "MHGT3" finds MV-A', async ({ page, server }, testInfo) => {
    const manufacturer = uniqueName('Apple', testInfo.title, testInfo.project.name);
    await insertMvA(page, server, manufacturer);
    await page.goto(PAGE);

    await search(page, 'MHGT3');

    await expect(hitList(page).getByRole('row').filter({ hasText: manufacturer })).toHaveCount(1);
  });

  test('UI-006.validation AC-REQ-009-04 a search term with 1 character shows "Mindestens 2 Zeichen"', async ({
    page,
  }) => {
    await page.goto(PAGE);

    await searchField(page).fill('m');

    await expect(page.getByText('Mindestens 2 Zeichen')).toBeVisible();
    await expect(searchField(page)).toHaveAttribute('aria-invalid', 'true');
    await expectReachable(page);
  });

  test('UI-006.empty (Treffer) AC-REQ-009-03 the search "Zenbook" shows "Keine Modellvorlage gefunden" and offers creating one', async ({
    page,
  }) => {
    await page.goto(PAGE);

    await searchField(page).fill('Zenbook');

    await expect(page.getByText('Keine Modellvorlage gefunden')).toBeVisible();
    await expectReachable(page);
    await createLink(page).click();
    await expect(page).toHaveURL(/\/modelle\/neu$/);
  });

  test('DER-51-06 a row click and the arrow keys with Enter open UI-007 with the model template', async ({
    page,
    server,
  }, testInfo) => {
    const manufacturer = uniqueName('Apple', testInfo.title, testInfo.project.name);
    const id = await insertMvA(page, server, manufacturer);
    await page.goto(PAGE);

    await search(page, manufacturer);
    await hitList(page)
      .getByRole('row')
      .filter({ hasText: manufacturer })
      .getByText('A1708')
      .click();
    await expect(page).toHaveURL(new RegExp(`/modelle/${id}$`));

    await page.goto(PAGE);
    await search(page, manufacturer);
    await expect(hitList(page).getByRole('row')).toHaveCount(2);
    await searchField(page).press('ArrowDown');
    await expect(hitList(page).getByRole('link', { name: 'MacBook Pro 13' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/modelle/${id}$`));
  });

  test('DER-51-06 "Modellvorlage anlegen" opens UI-007 for a new model template', async ({
    page,
  }) => {
    await page.goto(PAGE);

    await createLink(page).click();

    await expect(page).toHaveURL(/\/modelle\/neu$/);
  });

  test('DER-51-07 the list without answer shows P-06 without replacing the page', async ({
    page,
  }) => {
    await page.route('**/api/model-templates*', (route) => route.abort('connectionrefused'));

    await page.goto(PAGE);

    const banner = page.getByRole('alert').filter({ hasText: 'resellr ist nicht erreichbar.' });
    await expect(banner.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await expect(searchField(page)).toBeVisible();
    await expectReachable(page);
  });
});
