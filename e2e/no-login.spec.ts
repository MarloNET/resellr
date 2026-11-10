import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';

/** The 14 settings areas of UI-025 in Release 0.1 (Technical Specification 4.2, OD-02 A). */
const SETTINGS_AREAS = [
  'haendlermarke',
  'geraetearten',
  'auswahllisten',
  'titelmuster',
  'textbausteine',
  'hersteller',
  'lieferanten',
  'code-uebersetzung',
  'zustandszuordnung',
  'kategoriezuordnung',
  'merkmalszuordnung',
  'beschreibungsvorlagen',
  'kanaele',
  'datenblatt-layout',
];

/**
 * Every screen address of Technical Specification 4.2 with the frame and without redirect, with
 * an example for each parameter. `/`, `/einstellungen` and `/beendet` follow in their own lists.
 */
const SCREEN_ADDRESSES = [
  '/inserate',
  '/inserate/1',
  '/inserate/1/fotos',
  '/inserate/1/kanaele/ebay',
  '/inserate/1/vergleich',
  '/inserate/1/kanaele/ebay/aenderungen',
  '/inserate/1/kanaele/ebay/kopieren',
  '/geraete',
  '/geraete/neu',
  '/geraete/1',
  '/geraete/1/datenblatt',
  '/modelle',
  '/modelle/neu',
  '/modelle/1',
  '/protokoll',
  ...SETTINGS_AREAS.map((area) => `/einstellungen/${area}`),
];

/** Addresses that redirect on first use (Technical Specification 4.2), with their target. */
const REDIRECT_ADDRESSES = [
  ['/', '/inserate'],
  ['/einstellungen', '/einstellungen/haendlermarke'],
] as const;

/** Address of UI-046, shown without the frame after resellr has ended. */
const END_ADDRESS = '/beendet';

/** Addresses UI-001 "Zugang" and UI-040 "Zugangspasswort" (15th settings area) would have. */
const UI_001_AND_UI_040_ADDRESSES = ['/zugang', '/einstellungen/zugangspasswort'];

/** Words of a login, a user account, an access password or a password reset. */
const ACCESS_TEXT = /passwort|anmeld|zugang|benutzerkonto|konto anlegen|registrier|login/i;

/** The page, once rendered, asks for no login, password or account. */
async function expectNoAccessPrompt(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);

  expect(response?.status(), path).toBe(200);
  await expect(page.locator('#root > *').first(), path).toBeVisible();
  await expect(page.locator('input[type="password"]'), path).toHaveCount(0);
  expect(await page.locator('body').innerText(), path).not.toMatch(ACCESS_TEXT);
}

/** The page shows the frame at `expectedPath` and asks for no login, password or account. */
async function expectNoAccessPage(page: Page, path: string, expectedPath = path): Promise<void> {
  await expectNoAccessPrompt(page, path);

  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === expectedPath);
  expect(await page.locator('body').innerText(), path).not.toMatch(ACCESS_TEXT);
}

test.describe('Use without login, no accounts and no access password (Technical Specification 2.20)', () => {
  test('AC-REQ-001-05 every screen address opens without login and asks for no password', async ({
    page,
  }) => {
    // Redirects first: `/einstellungen` leads to the last used area once one has been opened.
    for (const [path, target] of REDIRECT_ADDRESSES) await expectNoAccessPage(page, path, target);
    for (const path of SCREEN_ADDRESSES) await expectNoAccessPage(page, path);
    await expectNoAccessPrompt(page, END_ADDRESS);
  });

  test('AC-REQ-001-05 the navigation and the API need no login and offer no account function', async ({
    page,
  }) => {
    await page.goto('/inserate');
    const entries = await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link')
      .allInnerTexts();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.filter((entry) => ACCESS_TEXT.test(entry))).toEqual([]);

    for (const path of ['/api/ops/health', '/api/ops/status']) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers(), path).not.toHaveProperty('set-cookie');
    }
    for (const path of ['/api/login', '/api/users', '/api/password-reset']) {
      expect((await page.request.get(path)).status(), path).toBe(404);
    }
  });

  test('DER-97-02 the addresses of UI-001 and UI-040 deliver no access or password page', async ({
    page,
  }) => {
    for (const path of UI_001_AND_UI_040_ADDRESSES) {
      await expectNoAccessPage(page, path);
      await expect(page.getByTestId('content-area'), path).toBeEmpty();
    }
  });

  test('DER-97-02 no settings area offers an access password', async ({ page }) => {
    for (const area of SETTINGS_AREAS) {
      await page.goto(`/einstellungen/${area}`);
      await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();

      await expect(page.getByText(/zugangspasswort/i), area).toHaveCount(0);
      await expect(page.locator('input[type="password"]'), area).toHaveCount(0);
    }
  });
});
