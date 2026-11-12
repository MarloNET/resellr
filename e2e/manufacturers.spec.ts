import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const PAGE = '/einstellungen/hersteller';

const manufacturers = (page: Page) => page.getByRole('region', { name: 'Hersteller' });
const nameField = (page: Page) =>
  page.getByRole('form', { name: 'Hersteller' }).getByRole('textbox', { name: /^Name/ });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Speichern', exact: true });
const createButton = (page: Page) =>
  manufacturers(page).getByRole('button', { name: 'Hersteller anlegen' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Hersteller anlegen' });
const row = (page: Page, name: string) =>
  manufacturers(page).getByRole('button', { name: new RegExp(`^${name}`) });

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
  return (await response.json()) as { id: number; version: number };
}

async function openManufacturer(page: Page, name: string) {
  await page.goto(PAGE);
  await row(page, name).click();
  await expect(nameField(page)).toHaveValue(name);
}

/** Opens UI-008 with "Hersteller anlegen" and confirms `name`. */
async function createThroughDialog(page: Page, name: string) {
  await createButton(page).click();
  await dialog(page)
    .getByRole('textbox', { name: /^Name des Herstellers/ })
    .fill(name);
  await dialog(page).getByRole('button', { name: 'Hersteller anlegen' }).click();
}

test.describe('UI-031 manufacturers (CU-098) and dialog UI-008 (CU-115)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('UI-031.success AC-REQ-100-01 DER-37-03 a name created through UI-008 is trimmed, chosen, active and "GPSR unvollständig"', async ({
    page,
  }, testInfo) => {
    const name = uniqueName('H1', testInfo.title, testInfo.project.name);
    await page.goto(PAGE);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Hersteller und GPSR' }),
    ).toBeVisible();

    await createThroughDialog(page, `  ${name}  `);

    const banner = page.getByRole('status').filter({ hasText: 'Gespeichert' });
    await expect(banner).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(row(page, name)).toHaveAttribute('aria-current', 'true');
    await expect(row(page, name)).toContainText('aktiv');
    await expect(row(page, name)).toContainText('GPSR unvollständig');
    await expect(nameField(page)).toHaveValue(name);
    // No deletion (P-01).
    await expect(page.getByRole('button', { name: /löschen/i })).toHaveCount(0);
    await expect(banner).toBeHidden({ timeout: 10_000 });
    await expectReachable(page);
  });

  test('AC-REQ-100-02 DER-37-12 an existing name in other case is reused and listed once', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Vorhanden', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, name);
    await page.goto(PAGE);

    await createThroughDialog(page, name.toLowerCase());

    await expect(dialog(page).getByRole('status')).toHaveText(
      `${name} gibt es bereits und wird verwendet`,
    );
    await dialog(page).getByRole('button', { name: 'Abbrechen' }).click();
    await expect(row(page, name)).toHaveAttribute('aria-current', 'true');
    await expect(
      manufacturers(page).getByRole('button', { name: new RegExp(`^${name}`, 'i') }),
    ).toHaveCount(1);
  });

  test('UI-008.validation AC-REQ-100-03 an empty and a too long name are rejected with the rule', async ({
    page,
  }) => {
    await page.goto(PAGE);
    await createButton(page).click();
    const field = dialog(page).getByRole('textbox', { name: /^Name des Herstellers/ });
    const confirm = dialog(page).getByRole('button', { name: 'Hersteller anlegen' });

    await confirm.click();
    await expect(dialog(page).getByText('Name: 1 bis 50 Zeichen')).toBeVisible();
    await expect(field).toBeFocused();

    await field.fill('x'.repeat(51));
    await confirm.click();
    await expect(dialog(page).getByText('Name: 1 bis 50 Zeichen')).toBeVisible();
    await expect(field).toHaveValue('x'.repeat(51));
  });

  test('UI-031.validation DER-37-04 DER-37-11 a rename shows the hint and a taken name is rejected at the field', async ({
    page,
    server,
  }, testInfo) => {
    const taken = uniqueName('Vergeben', testInfo.title, testInfo.project.name);
    const name = uniqueName('Umbenennen', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, taken);
    await createManufacturer(page, server.baseUrl, name);
    await openManufacturer(page, name);

    await nameField(page).fill(taken.toUpperCase());
    await expect(
      page.getByText('Umbenennung wirkt auf alle Modellvorlagen des Herstellers'),
    ).toBeVisible();
    await saveButton(page).click();

    await expect(page.getByText('Name ist bereits vergeben')).toBeVisible();
    await expect(nameField(page)).toBeFocused();
  });

  test('UI-031.success AC-REQ-101-02 a deactivated manufacturer stays listed and leaves the choice for new model templates', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Deaktivieren', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, name);
    await page.goto(PAGE);

    await page.getByRole('button', { name: `Deaktivieren: ${name}` }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
    await expect(row(page, name)).toContainText('deaktiviert');
    await expect(page.getByRole('button', { name: `Deaktivieren: ${name}` })).toHaveCount(0);
    const active = await page.request.get(`${server.baseUrl}/api/manufacturers?limit=200`);
    const names = ((await active.json()) as { items: { name: string }[] }).items.map(
      (item) => item.name,
    );
    expect(names).not.toContain(name);
  });

  test('UI-031.conflict DER-37-06 (a) a save after a change in another window shows P-05 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Konflikt', testInfo.title, testInfo.project.name);
    const created = await createManufacturer(page, server.baseUrl, name);
    await openManufacturer(page, name);
    // The other window renames it, so the version of this page is outdated.
    await page.request.patch(`${server.baseUrl}/api/manufacturers/${created.id}`, {
      headers: { origin: server.baseUrl },
      data: { version: created.version, name: `${name} B` },
    });

    await nameField(page).fill(`${name} C`);
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'in einem anderen Fenster geändert' });
    await expect(banner.getByRole('button', { name: 'Neu laden' })).toBeVisible();
    await expect(nameField(page)).toHaveValue(`${name} C`);
  });

  test('UI-031.unreachable DER-37-06 (b) the list without answer shows P-06 without replacing the page', async ({
    page,
  }) => {
    await page.route('**/api/manufacturers?*', (route) => route.abort('connectionrefused'));

    await page.goto(PAGE);

    const banner = page.getByRole('alert').filter({ hasText: 'resellr ist nicht erreichbar.' });
    await expect(banner.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Hersteller und GPSR' }),
    ).toBeVisible();
  });

  test('UI-031.wird-beendet DER-37-06 (c) a save refused with 503 shutting_down shows P-07 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Beenden', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, name);
    await openManufacturer(page, name);
    // Answer of the write gate in state `stopping` (2.0.4), without ending the shared server and
    // without sending the write: status and body of P-07, headers from a read of the same server.
    await page.route('**/api/manufacturers/*', async (route) => {
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

  test('UI-031.ausgang-unbekannt DER-37-05 a save shows "Speichern …" and without answer P-08, which locks further writes', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Abbruch', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, name);
    await openManufacturer(page, name);
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/manufacturers/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      await released;
      return route.abort('connectionreset');
    });

    await nameField(page).fill(`${name} neu`);
    await saveButton(page).click();
    await expect(page.getByRole('button', { name: 'Speichern …' })).toBeDisabled();
    release();

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
