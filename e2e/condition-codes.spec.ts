import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const PAGE = '/einstellungen/code-uebersetzung';

const entries = (page: Page) => page.getByRole('region', { name: 'Code-Übersetzungen' });
const codeField = (page: Page) => page.getByRole('textbox', { name: /^Zustandscode/ });
const plainTextField = (page: Page) => page.getByRole('textbox', { name: /^Klartext/ });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Speichern', exact: true });
const createButton = (page: Page) => page.getByRole('button', { name: 'Übersetzung anlegen' });

/** The server keeps its data per worker: each test uses its own codes (at most 20 characters). */
function uniqueCode(base: string, title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base}${hash.toString(36)}`.slice(0, 20);
}

/** Creates an entry through the API like the user interface (`local-guard` G-2, G-4). */
async function createEntry(page: Page, baseUrl: string, code: string, plainText: string) {
  const response = await page.request.post(`${baseUrl}/api/condition-codes`, {
    headers: { origin: baseUrl },
    data: { code, plainText },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; version: number };
}

async function openEntry(page: Page, code: string) {
  await page.goto(PAGE);
  await entries(page)
    .getByRole('button', { name: new RegExp(`^${code}`) })
    .click();
  await expect(codeField(page)).toHaveValue(code);
}

test.describe('UI-033 condition codes (CU-100)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('UI-033.success AC-REQ-022-01 DER-38-03 DER-38-09 a new entry is saved, resolved and every action is reachable', async ({
    page,
    server,
  }, testInfo) => {
    const code = uniqueCode('DGS', testInfo.title, testInfo.project.name);
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Code-Übersetzung' })).toBeVisible();
    await expect(page.getByText('Änderungen wirken nur auf künftig erfasste Codes.')).toBeVisible();

    await createButton(page).first().click();
    await expect(saveButton(page)).toBeDisabled();
    await codeField(page).fill(code);
    await plainTextField(page).fill('Gebrauchsspuren am Gehäuse');
    await page.getByRole('combobox', { name: /^Vorschlag Optik-Note/ }).selectOption('2');
    await saveButton(page).click();

    const banner = page.getByRole('status').filter({ hasText: 'Gespeichert' });
    await expect(banner).toBeVisible();
    const row = entries(page).getByRole('button', { name: new RegExp(`^${code}`) });
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(row).toContainText('alle');
    // DER-38-07: without a further change "Speichern" is disabled again.
    await expect(saveButton(page)).toBeDisabled();
    const resolved = await page.request.get(
      `${server.baseUrl}/api/condition-codes/resolve?code=${code.toLowerCase()}`,
    );
    expect(await resolved.json()).toEqual({
      found: true,
      plainText: 'Gebrauchsspuren am Gehäuse',
      suggestedConditionValueId: null,
      suggestedVisualGrade: 2,
    });
    // The banner closes after 5 s. Only then the page is checked, so the check does not count
    // the "×" of a banner that closes while it runs.
    await expect(banner).toBeHidden({ timeout: 10_000 });
    await expectReachable(page);
  });

  test('UI-033.validation AC-REQ-022-02 AC-REQ-022-04 DER-38-05 a duplicate code and an empty plain text are rejected at the field', async ({
    page,
    server,
  }, testInfo) => {
    const code = uniqueCode('DUP', testInfo.title, testInfo.project.name);
    await createEntry(page, server.baseUrl, code, 'Erster Eintrag');
    await page.goto(PAGE);
    await createButton(page).click();

    await codeField(page).fill(code.toLowerCase());
    await saveButton(page).click();
    await expect(page.getByText('Klartext: 1 bis 500 Zeichen')).toBeVisible();
    await expect(plainTextField(page)).toBeFocused();

    await plainTextField(page).fill('Zweiter Eintrag');
    await saveButton(page).click();
    await expect(
      page.getByText('Diesen Code gibt es für diesen Lieferanten bereits'),
    ).toBeVisible();
    await expect(codeField(page)).toBeFocused();
  });

  test('UI-033.validation DER-38-11 a supplier deactivated in another window is rejected at the field "Lieferant" and the choice is reloaded', async ({
    page,
    server,
  }, testInfo) => {
    const code = uniqueCode('DEA', testInfo.title, testInfo.project.name);
    const supplierName = `Lieferant ${code}`;
    const supplier = await page.request.post(`${server.baseUrl}/api/suppliers`, {
      headers: { origin: server.baseUrl },
      data: { name: supplierName, active: true },
    });
    expect(supplier.status()).toBe(201);
    const { id, version } = (await supplier.json()) as { id: number; version: number };
    await page.goto(PAGE);
    await createButton(page).first().click();
    await codeField(page).fill(code);
    await plainTextField(page).fill('Gebrauchsspuren');
    const supplierField = page.getByRole('combobox', { name: 'Lieferant' });
    await supplierField.selectOption({ label: supplierName });
    // The other window deactivates the supplier after this page has offered it.
    const deactivated = await page.request.patch(`${server.baseUrl}/api/suppliers/${id}`, {
      headers: { origin: server.baseUrl },
      data: { version, active: false },
    });
    expect(deactivated.status()).toBe(200);

    const reloaded = page.waitForResponse(
      (response) =>
        response.url().includes('/api/suppliers') && response.request().method() === 'GET',
    );
    await saveButton(page).click();

    await expect(page.getByText(`Lieferant ${supplierName} ist deaktiviert`)).toBeVisible();
    await expect(supplierField).toBeFocused();
    await reloaded;
    await expect(codeField(page)).toHaveValue(code);
    await expect(plainTextField(page)).toHaveValue('Gebrauchsspuren');
    await expect(entries(page).getByRole('button', { name: new RegExp(`^${code}`) })).toHaveCount(
      0,
    );

    // DER-38-12: "Bitte wählen" instead of "alle"; the rejected supplier is not offered again.
    await expect(supplierField.locator('option:checked')).toHaveText('Bitte wählen');
    await expect(supplierField.getByRole('option', { name: supplierName })).toHaveCount(0);
    await saveButton(page).click();
    await expect(page.getByText('Lieferant: Lieferanten oder „alle“ wählen')).toBeVisible();
    await expect(supplierField).toBeFocused();
    await supplierField.selectOption({ label: 'alle' });
    await saveButton(page).click();
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await expect(entries(page).getByRole('button', { name: new RegExp(`^${code}`) })).toHaveCount(
      1,
    );
  });

  test('UI-033.success DER-38-08 an entry is deleted only after the confirmation P-04', async ({
    page,
    server,
  }, testInfo) => {
    const code = uniqueCode('DEL', testInfo.title, testInfo.project.name);
    await createEntry(page, server.baseUrl, code, 'Wird gelöscht');
    await openEntry(page, code);

    await page.getByRole('button', { name: 'Löschen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Übersetzung löschen' });
    await expect(dialog).toContainText(`„${code}“ (Lieferant: alle) wird gelöscht.`);
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Löschen' })).toBeFocused();

    await page.getByRole('button', { name: 'Löschen' }).click();
    await dialog.getByRole('button', { name: 'Löschen' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
    await expect(entries(page).getByRole('button', { name: new RegExp(`^${code}`) })).toHaveCount(
      0,
    );
    const resolved = await page.request.get(
      `${server.baseUrl}/api/condition-codes/resolve?code=${code}`,
    );
    expect(((await resolved.json()) as { found: boolean }).found).toBe(false);
  });

  test('UI-033.conflict DER-38-06 (a) a save after a change in another window shows P-05 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const code = uniqueCode('KON', testInfo.title, testInfo.project.name);
    const created = await createEntry(page, server.baseUrl, code, 'Alt');
    await openEntry(page, code);
    // The other window changes it, so the version of this page is outdated.
    await page.request.patch(`${server.baseUrl}/api/condition-codes/${created.id}`, {
      headers: { origin: server.baseUrl },
      data: { version: created.version, plainText: 'Anderes Fenster' },
    });

    await plainTextField(page).fill('Dieses Fenster');
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'in einem anderen Fenster geändert' });
    await expect(banner.getByRole('button', { name: 'Neu laden' })).toBeVisible();
    await expect(plainTextField(page)).toHaveValue('Dieses Fenster');
  });

  test('UI-033.unreachable DER-38-06 (b) the list without answer shows P-06 without replacing the page', async ({
    page,
  }) => {
    await page.route('**/api/condition-codes?*', (route) => route.abort('connectionrefused'));

    await page.goto(PAGE);

    const banner = page.getByRole('alert').filter({ hasText: 'resellr ist nicht erreichbar.' });
    await expect(banner.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Code-Übersetzung' })).toBeVisible();
  });

  test('UI-033.wird-beendet DER-38-06 (c) a save refused with 503 shutting_down shows P-07 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const code = uniqueCode('END', testInfo.title, testInfo.project.name);
    await createEntry(page, server.baseUrl, code, 'Alt');
    await openEntry(page, code);
    // Answer of the write gate in state `stopping` (2.0.4), without ending the shared server and
    // without sending the write: status and body of P-07, headers from a read of the same server.
    await page.route('**/api/condition-codes/*', async (route) => {
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

    await plainTextField(page).fill('Neu');
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'resellr wird gerade beendet.' });
    await expect(banner).toBeVisible();
    await expect(banner).not.toContainText(/R-[0-9A-Z]{4}-/);
    await expect(plainTextField(page)).toHaveValue('Neu');
  });

  test('UI-033.ausgang-unbekannt DER-38-06 (d) a save without answer shows "Ausgang unbekannt, bitte neu laden." and locks further writes', async ({
    page,
    server,
  }, testInfo) => {
    const code = uniqueCode('ABB', testInfo.title, testInfo.project.name);
    await createEntry(page, server.baseUrl, code, 'Alt');
    await openEntry(page, code);
    await page.route('**/api/condition-codes/*', (route) =>
      route.request().method() === 'PATCH' ? route.abort('connectionreset') : route.continue(),
    );

    await plainTextField(page).fill('Neu');
    await saveButton(page).click();

    const banner = page
      .getByRole('alert')
      .filter({ hasText: 'Ausgang unbekannt, bitte neu laden.' });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button')).toHaveCount(0);
    await expect(saveButton(page)).toBeDisabled();
    await expect(createButton(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Löschen' })).toBeDisabled();
    await expect(plainTextField(page)).toHaveValue('Neu');
  });
});
