import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const PAGE = '/einstellungen/lieferanten';

const suppliers = (page: Page) => page.getByRole('region', { name: 'Lieferanten' });
const nameField = (page: Page) => page.getByRole('textbox', { name: /^Name/ });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Speichern', exact: true });
const createButton = (page: Page) => page.getByRole('button', { name: 'Lieferant anlegen' });

/** The server keeps its data per worker: each test uses its own names. */
function uniqueName(base: string, title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base} ${hash.toString(36)}`;
}

/** Creates a supplier through the API like the user interface (`local-guard` G-2, G-4). */
async function createSupplier(page: Page, baseUrl: string, name: string) {
  const response = await page.request.post(`${baseUrl}/api/suppliers`, {
    headers: { origin: baseUrl },
    data: { name, active: true },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; version: number };
}

async function openSupplier(page: Page, name: string) {
  await page.goto(PAGE);
  await suppliers(page)
    .getByRole('button', { name: new RegExp(name) })
    .click();
  await expect(nameField(page)).toHaveValue(name);
}

test.describe('UI-032 suppliers (CU-099)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('UI-032.success AC-REQ-099-01 DER-36-03 a new supplier is saved, listed as active and every action is reachable', async ({
    page,
  }, testInfo) => {
    const name = uniqueName('L1', testInfo.title, testInfo.project.name);
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Lieferanten' })).toBeVisible();

    await createButton(page).first().click();
    await expect(saveButton(page)).toBeDisabled();
    await nameField(page).fill(name);
    await saveButton(page).click();

    const banner = page.getByRole('status').filter({ hasText: 'Gespeichert' });
    await expect(banner).toBeVisible();
    const row = suppliers(page).getByRole('button', { name: new RegExp(name) });
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(row).toContainText('aktiv');
    // DER-36-07: without a further change "Speichern" is disabled again.
    await expect(saveButton(page)).toBeDisabled();
    // DER-36-08: no deletion.
    await expect(page.getByRole('button', { name: /löschen/i })).toHaveCount(0);
    // The banner closes after 5 s. Only then the page is checked, so the check does not count
    // the "×" of a banner that closes while it runs.
    await expect(banner).toBeHidden({ timeout: 10_000 });
    await expectReachable(page);
  });

  test('UI-032.validation AC-REQ-099-02 DER-36-05 a too long and a taken name are rejected at the field', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Doppelt', testInfo.title, testInfo.project.name);
    await createSupplier(page, server.baseUrl, name);
    await page.goto(PAGE);
    await createButton(page).click();

    await nameField(page).fill('x'.repeat(101));
    await saveButton(page).click();
    await expect(page.getByText('Name: 1 bis 100 Zeichen')).toBeVisible();
    await expect(nameField(page)).toBeFocused();

    await nameField(page).fill(name.toLowerCase());
    await saveButton(page).click();
    await expect(page.getByText('Name ist bereits vergeben')).toBeVisible();
    await expect(nameField(page)).toBeFocused();
  });

  test('UI-032.success AC-REQ-099-03 deactivating keeps the supplier in the list with its status', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Deaktivieren', testInfo.title, testInfo.project.name);
    await createSupplier(page, server.baseUrl, name);
    await openSupplier(page, name);

    await page.getByRole('switch', { name: 'Status' }).click();
    await saveButton(page).click();

    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
    await expect(suppliers(page).getByRole('button', { name: new RegExp(name) })).toContainText(
      'deaktiviert',
    );
    const active = await page.request.get(`${server.baseUrl}/api/suppliers?limit=200`);
    const names = ((await active.json()) as { items: { name: string }[] }).items.map(
      (item) => item.name,
    );
    expect(names).not.toContain(name);
  });

  test('UI-032.conflict DER-36-06 (a) a save after a change in another window shows P-05 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Konflikt', testInfo.title, testInfo.project.name);
    const created = await createSupplier(page, server.baseUrl, name);
    await openSupplier(page, name);
    // The other window renames it, so the version of this page is outdated.
    await page.request.patch(`${server.baseUrl}/api/suppliers/${created.id}`, {
      headers: { origin: server.baseUrl },
      data: { version: created.version, name: `${name} B` },
    });

    await nameField(page).fill(`${name} C`);
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'in einem anderen Fenster geändert' });
    await expect(banner.getByRole('button', { name: 'Neu laden' })).toBeVisible();
    await expect(nameField(page)).toHaveValue(`${name} C`);
  });

  test('UI-032.unreachable DER-36-06 (b) the list without answer shows P-06 without replacing the page', async ({
    page,
  }) => {
    await page.route('**/api/suppliers?*', (route) => route.abort('connectionrefused'));

    await page.goto(PAGE);

    const banner = page.getByRole('alert').filter({ hasText: 'resellr ist nicht erreichbar.' });
    await expect(banner.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Lieferanten' })).toBeVisible();
  });

  test('UI-032.wird-beendet DER-36-06 (c) a save refused with 503 shutting_down shows P-07 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Beenden', testInfo.title, testInfo.project.name);
    await createSupplier(page, server.baseUrl, name);
    await openSupplier(page, name);
    // Answer of the write gate in state `stopping` (2.0.4), without ending the shared server and
    // without sending the write: status and body of P-07, headers from a read of the same server.
    await page.route('**/api/suppliers/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      const read = await route.fetch({ url: `${server.baseUrl}/api/ops/health`, method: 'GET' });
      return route.fulfill({
        response: read,
        status: 503,
        json: {
          error: {
            code: 'shutting_down',
            message: '',
            fields: [],
            details: {},
            referenceNumber: null,
          },
        },
      });
    });

    await nameField(page).fill(`${name} neu`);
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'resellr wird gerade beendet.' });
    await expect(banner).toBeVisible();
    await expect(banner).not.toContainText(/R-[0-9A-Z]{4}-/);
    await expect(nameField(page)).toHaveValue(`${name} neu`);
  });

  test('UI-032.ausgang-unbekannt DER-36-09 a save without answer shows P-08 and locks further writes', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Abbruch', testInfo.title, testInfo.project.name);
    await createSupplier(page, server.baseUrl, name);
    await openSupplier(page, name);
    await page.route('**/api/suppliers/*', (route) =>
      route.request().method() === 'PATCH' ? route.abort('connectionreset') : route.continue(),
    );

    await nameField(page).fill(`${name} neu`);
    await saveButton(page).click();

    const banner = page
      .getByRole('alert')
      .filter({ hasText: 'Ausgang unbekannt, bitte neu laden.' });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button')).toHaveCount(0);
    await expect(saveButton(page)).toBeDisabled();
    await expect(createButton(page)).toBeDisabled();
    await expect(nameField(page)).toHaveValue(`${name} neu`);
  });
});
