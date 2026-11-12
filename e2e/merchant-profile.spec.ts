import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const PAGE = '/einstellungen/haendlermarke';
const LOGO_NOTICE =
  'Das Logo erscheint auf dem Datenblatt. Die Druckqualität stellt der Händler sicher.';

const nameField = (page: Page) => page.getByRole('textbox', { name: /^Name der Händlermarke/ });
const contactField = (page: Page) => page.getByRole('textbox', { name: /^Kontaktangaben/ });
const saveButton = (page: Page) => page.getByRole('button', { name: /^Speichern/ });

interface Profile {
  brandName: string;
  contactText: string;
  version: number;
}

/**
 * The profile is a single row and the server keeps its data per worker: each test reads the
 * current version and uses its own name.
 */
async function readProfile(page: Page, baseUrl: string): Promise<Profile> {
  const response = await page.request.get(`${baseUrl}/api/merchant-profile`);
  expect(response.status()).toBe(200);
  return (await response.json()) as Profile;
}

function uniqueName(base: string, title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base} ${hash.toString(36)}`;
}

async function openPage(page: Page) {
  await page.goto(PAGE);
  await expect(page.getByRole('heading', { level: 1, name: 'Händlermarke' })).toBeVisible();
  await expect(nameField(page)).toBeEnabled();
}

test.describe('UI-026 merchant profile (CU-097)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('UI-026.success DER-42-03 DER-42-08 name and contact details are saved, the notice is shown and every action is reachable', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Händler', testInfo.title, testInfo.project.name);
    await openPage(page);
    await expect(page.getByRole('region', { name: 'Logo' })).toContainText(LOGO_NOTICE);

    await nameField(page).fill(name);
    await contactField(page).fill('Musterstraße 1\n12345 Musterstadt');
    await saveButton(page).click();

    const banner = page.getByRole('status').filter({ hasText: 'Händlermarke gespeichert' });
    await expect(banner).toBeVisible();
    // DER-42-11: no dialog UI-043 after the save.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await readProfile(page, server.baseUrl)).toMatchObject({
      brandName: name,
      contactText: 'Musterstraße 1\n12345 Musterstadt',
    });
    // The saved values are shown again after reloading.
    await openPage(page);
    await expect(nameField(page)).toHaveValue(name);
    await expect(contactField(page)).toHaveValue('Musterstraße 1\n12345 Musterstadt');
    await expectReachable(page);
  });

  test('UI-026.validation DER-42-05 an empty name and too long contact details are rejected at the fields', async ({
    page,
  }) => {
    await openPage(page);

    await nameField(page).fill('');
    await contactField(page).fill('x'.repeat(501));
    await saveButton(page).click();

    await expect(page.getByText('Name: 1 bis 100 Zeichen')).toBeVisible();
    await expect(page.getByText('Kontaktangaben: höchstens 500 Zeichen')).toBeVisible();
    await expect(nameField(page)).toBeFocused();
  });

  test('UI-026.conflict DER-42-07 (a) a save after a change in another window shows P-05 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Konflikt', testInfo.title, testInfo.project.name);
    await openPage(page);
    // The other window saves, so the version of this page is outdated.
    const { version, contactText } = await readProfile(page, server.baseUrl);
    const other = await page.request.put(`${server.baseUrl}/api/merchant-profile`, {
      headers: { origin: server.baseUrl },
      data: { version, brandName: `${name} B`, contactText },
    });
    expect(other.status()).toBe(200);

    await nameField(page).fill(`${name} C`);
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'in einem anderen Fenster geändert' });
    await expect(banner.getByRole('button', { name: 'Neu laden' })).toBeVisible();
    await expect(nameField(page)).toHaveValue(`${name} C`);

    await banner.getByRole('button', { name: 'Neu laden' }).click();
    await expect(nameField(page)).toHaveValue(`${name} B`);
  });

  test('UI-026.unreachable DER-42-07 (b) the profile without answer shows P-06 without replacing the page', async ({
    page,
  }) => {
    await page.route('**/api/merchant-profile', (route) => route.abort('connectionrefused'));

    await page.goto(PAGE);

    const banner = page.getByRole('alert').filter({ hasText: 'resellr ist nicht erreichbar.' });
    await expect(banner.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Händlermarke' })).toBeVisible();
  });

  test('UI-026.wird-beendet DER-42-07 (c) a save refused with 503 shutting_down shows P-07 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Beenden', testInfo.title, testInfo.project.name);
    await openPage(page);
    // Answer of the write gate in state `stopping` (2.0.4), without ending the shared server and
    // without sending the write: status and body of P-07, headers from a read of the same server.
    await page.route('**/api/merchant-profile', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
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

    await nameField(page).fill(name);
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'resellr wird gerade beendet.' });
    await expect(banner).toBeVisible();
    await expect(banner).not.toContainText(/R-[0-9A-Z]{4}-/);
    await expect(nameField(page)).toHaveValue(name);
  });

  test('UI-026.speichert UI-026.ausgang-unbekannt DER-42-06 "Speichern …" locks the inputs, a save without answer shows P-08 and locks further writes', async ({
    page,
  }, testInfo) => {
    const name = uniqueName('Abbruch', testInfo.title, testInfo.project.name);
    await openPage(page);
    // The write hangs until the test lets it break off without an HTTP answer.
    let breakOff = () => {};
    const broken = new Promise<void>((resolve) => (breakOff = resolve));
    await page.route('**/api/merchant-profile', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      await broken;
      return route.abort('connectionreset');
    });

    await nameField(page).fill(name);
    await saveButton(page).click();

    await expect(page.getByRole('button', { name: 'Speichern …' })).toBeDisabled();
    await expect(nameField(page)).toBeDisabled();
    await expect(contactField(page)).toBeDisabled();
    breakOff();

    const banner = page
      .getByRole('alert')
      .filter({ hasText: 'Ausgang unbekannt, bitte neu laden.' });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button')).toHaveCount(0);
    await expect(saveButton(page)).toBeDisabled();
    await expect(nameField(page)).toHaveValue(name);
  });
});
