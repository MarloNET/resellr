import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

/** Rows below 1366 CSS px, where R-1 stacks the form into one column (6.3). */
const REFLOW_ROWS = ['FM-3', 'FM-4'];

const form = (page: Page) => page.getByRole('form', { name: 'Modellvorlage anlegen' });
const field = (page: Page, name: string) => form(page).getByLabel(new RegExp(`^${name}\\*?$`));
const saveButton = (page: Page) => page.getByRole('button', { name: 'Modellvorlage speichern' });

/** The server keeps its data per worker: each test uses its own names. */
function uniqueName(base: string, title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base} ${hash.toString(36)}`;
}

/** Creates a manufacturer through the API like the user interface (`local-guard` G-2, G-4). */
async function createManufacturer(page: Page, baseUrl: string, name: string) {
  const response = await page.request.post(`${baseUrl}/api/manufacturers`, {
    headers: { origin: baseUrl },
    data: { name },
  });
  expect(response.status()).toBe(201);
}

test.describe('UI-007 Modellvorlage anlegen (CU-114)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('AC-REQ-008-01 a model template created from UI-006 is saved, the banner shows on UI-006 and the search finds it', async ({
    page,
    server,
  }, testInfo) => {
    const manufacturer = uniqueName('Lenovo', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, manufacturer);
    await page.goto('/modelle');

    await page.getByRole('link', { name: 'Modellvorlage anlegen' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Modellvorlage anlegen' }),
    ).toBeVisible();
    await expectReachable(page);
    await field(page, 'Geräteart').selectOption({ label: 'Notebook' });
    await field(page, 'Hersteller').selectOption({ label: manufacturer });
    await field(page, 'Modellbezeichnung').fill('ThinkPad E15 Gen 2');
    await field(page, 'Typbezeichnung').fill('20TD');
    await field(page, 'Herstellernummer').fill(' 20TD002MGE ');
    await field(page, 'Original-EAN').fill('2000000177007');
    await saveButton(page).click();

    await expect(page).toHaveURL(/\/modelle$/);
    await expect(page.getByText('Modellvorlage gespeichert')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Suchbegriff' }).fill(manufacturer);
    const row = page
      .getByRole('table', { name: 'Modellvorlagen' })
      .getByRole('row')
      .filter({ hasText: manufacturer });
    await expect(row.getByRole('cell')).toHaveText([
      'Notebook',
      manufacturer,
      'ThinkPad E15 Gen 2',
      '20TD',
      '20TD002MGE',
    ]);
  });

  test('AC-REQ-008-03 a model template with MPN "unbekannt" is listed as "unbekannt"', async ({
    page,
    server,
  }, testInfo) => {
    const manufacturer = uniqueName('Fujitsu', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, manufacturer);
    await page.goto('/modelle/neu');

    await field(page, 'Hersteller').selectOption({ label: manufacturer });
    await field(page, 'Modellbezeichnung').fill('Esprimo Q957');
    await form(page).getByRole('checkbox', { name: 'unbekannt' }).check();
    await saveButton(page).click();

    await expect(page.getByText('Modellvorlage gespeichert')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Suchbegriff' }).fill(manufacturer);
    await expect(
      page
        .getByRole('table', { name: 'Modellvorlagen' })
        .getByRole('row')
        .filter({ hasText: manufacturer })
        .getByRole('cell')
        .last(),
    ).toHaveText('unbekannt');
  });

  test('UI-007.validation DER-50-17 AC-REQ-008-02 the browser shows one message per field and focuses the first error', async ({
    page,
  }) => {
    await page.goto('/modelle/neu');

    await field(page, 'Herstellernummer').fill(`${'A'.repeat(20)}#${'B'.repeat(24)}`);
    await field(page, 'Original-EAN').fill('0194252146836');
    await saveButton(page).click();

    await expect(field(page, 'Hersteller')).toBeFocused();
    await expect(form(page).getByText('Hersteller fehlt')).toBeVisible();
    await expect(form(page).getByText('Modellbezeichnung: 1 bis 100 Zeichen')).toBeVisible();
    await expect(form(page).getByText('Herstellernummer: höchstens 40 Zeichen')).toBeVisible();
    await expect(form(page).getByText(/^Herstellernummer:/)).toHaveCount(1);
    await expect(
      form(page).getByText('EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer'),
    ).toBeVisible();
    await field(page, 'Herstellernummer').fill('');
    await field(page, 'Herstellernummer').blur();
    await expect(
      form(page).getByText('Herstellernummer: Wert eingeben oder ‚unbekannt‘ wählen'),
    ).toBeVisible();
    await expectReachable(page);
  });

  test('R-1 below 1366 px the form stacks into one column and every field and action stays reachable (FM-3, FM-4)', async ({
    page,
  }, testInfo) => {
    test.skip(!REFLOW_ROWS.includes(testInfo.project.name), 'R-1 sample in FM-3 and FM-4');
    await page.goto('/modelle/neu');
    await expect(form(page)).toBeVisible();

    const formBox = await form(page).boundingBox();
    const sectionBox = await form(page).getByRole('region', { name: 'Modelldaten' }).boundingBox();
    expect(sectionBox?.width).toBeCloseTo(formBox?.width ?? 0, 0);
    await expectReachable(page);
    await saveButton(page).click();
    await expect(field(page, 'Hersteller')).toBeFocused();
    await expectReachable(page);
  });
});
