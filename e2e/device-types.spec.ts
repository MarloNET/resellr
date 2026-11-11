import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const PAGE = '/einstellungen/geraetearten';

const deviceTypes = (page: Page) => page.getByRole('region', { name: 'Gerätearten' });
const nameField = (page: Page) => page.getByRole('textbox', { name: /^Name/ });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Geräteart speichern' });

/** The server keeps its data per worker: each test uses its own names. */
function uniqueName(base: string, title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base} ${hash.toString(36)}`;
}

/** Creates a device type through the API like the user interface (`local-guard` G-2, G-4). */
async function createDeviceType(page: Page, baseUrl: string, name: string) {
  const response = await page.request.post(`${baseUrl}/api/device-types`, {
    headers: { origin: baseUrl },
    data: { name, active: true },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; version: number };
}

async function openDeviceType(page: Page, name: string) {
  await page.goto(PAGE);
  await deviceTypes(page)
    .getByRole('button', { name: new RegExp(name) })
    .click();
  await expect(nameField(page)).toHaveValue(name);
}

test.describe('UI-027 device types (CU-095)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('UI-027.success AC-REQ-004-01 a new device type is saved, listed as active and every action is reachable', async ({
    page,
  }, testInfo) => {
    const name = uniqueName('Monitor', testInfo.title, testInfo.project.name);
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { name: 'Gerätearten und Merkmale' })).toBeVisible();

    await page.getByRole('button', { name: 'Geräteart anlegen' }).click();
    await nameField(page).fill(name);
    await saveButton(page).click();

    const banner = page.getByRole('status').filter({ hasText: 'Geräteart gespeichert' });
    await expect(banner).toBeVisible();
    const row = deviceTypes(page).getByRole('button', { name: new RegExp(name) });
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(row).toContainText('aktiv');
    await expect(page.getByRole('button', { name: /löschen/i })).toHaveCount(0);
    // DER-33-05: the banner closes after 5 s. Only then the page is checked, so the check does
    // not count the "×" of a banner that closes while it runs.
    await expect(banner).toBeHidden({ timeout: 10_000 });
    await expectReachable(page);
  });

  // QA-D2: a name of 50 characters without spaces wraps itself, not the status chip.
  test('UI-027.default a long name without spaces keeps the status chip on one line', async ({
    page,
    server,
  }, testInfo) => {
    const short = uniqueName('Kurz', testInfo.title, testInfo.project.name);
    const long = uniqueName('W', testInfo.title, testInfo.project.name)
      .replace(' ', '')
      .padEnd(50, 'W');
    await createDeviceType(page, server.baseUrl, short);
    await createDeviceType(page, server.baseUrl, long);
    await page.goto(PAGE);

    const chipOf = (name: string) =>
      deviceTypes(page)
        .getByRole('button', { name: new RegExp(name) })
        .getByText('aktiv', { exact: true });
    const shortChip = await chipOf(short).boundingBox();
    const longChip = await chipOf(long).boundingBox();
    expect(longChip?.height).toBe(shortChip?.height);
    expect(longChip?.width).toBe(shortChip?.width);
  });

  // QA-D1: the check on leaving the field must not move the button between `mousedown` and
  // `mouseup`; one mouse click saves, whether the error line appears or disappears.
  test('UI-027.validation DER-33-06 one mouse click after an invalid or corrected name saves when creating', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Klick', testInfo.title, testInfo.project.name);
    await createDeviceType(page, server.baseUrl, `${name} vergeben`);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Geräteart anlegen' }).click();

    await nameField(page).fill('x'.repeat(51));
    await saveButton(page).click();
    await expect(page.getByText('Name: 1 bis 50 Zeichen')).toBeVisible();
    await expect(nameField(page)).toBeFocused();

    await nameField(page).fill(`${name} vergeben`);
    await saveButton(page).click();
    await expect(page.getByText('Name ist bereits vergeben')).toBeVisible();
    await expect(nameField(page)).toBeFocused();

    await nameField(page).fill(name);
    await saveButton(page).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Geräteart gespeichert' }),
    ).toBeVisible();
  });

  test('UI-027.validation DER-33-06 one mouse click after an invalid or corrected name saves when renaming', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Umbenennen', testInfo.title, testInfo.project.name);
    await createDeviceType(page, server.baseUrl, name);
    await openDeviceType(page, name);

    await nameField(page).fill('x'.repeat(51));
    await saveButton(page).click();
    await expect(page.getByText('Name: 1 bis 50 Zeichen')).toBeVisible();
    await expect(nameField(page)).toBeFocused();

    await nameField(page).fill(`${name} neu`);
    await saveButton(page).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Geräteart gespeichert' }),
    ).toBeVisible();
    await expect(
      deviceTypes(page).getByRole('button', { name: new RegExp(`${name} neu`) }),
    ).toBeVisible();
  });

  test('UI-027.conflict DER-33-08 (a) a save after a change in another window shows P-05 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Konflikt', testInfo.title, testInfo.project.name);
    const created = await createDeviceType(page, server.baseUrl, name);
    await openDeviceType(page, name);
    // The other window renames it, so the version of this page is outdated.
    await page.request.patch(`${server.baseUrl}/api/device-types/${created.id}`, {
      headers: { origin: server.baseUrl },
      data: { version: created.version, name: `${name} B` },
    });

    await nameField(page).fill(`${name} C`);
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'in einem anderen Fenster geändert' });
    await expect(banner.getByRole('button', { name: 'Neu laden' })).toBeVisible();
    await expect(nameField(page)).toHaveValue(`${name} C`);
  });

  test('UI-027.ausgang-unbekannt DER-33-07 a save without answer shows P-08 and locks further writes', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Abbruch', testInfo.title, testInfo.project.name);
    await createDeviceType(page, server.baseUrl, name);
    await openDeviceType(page, name);
    await page.route('**/api/device-types/*', (route) =>
      route.request().method() === 'PATCH' ? route.abort('connectionreset') : route.continue(),
    );

    await nameField(page).fill(`${name} neu`);
    await saveButton(page).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Ausgang unbekannt, bitte neu laden.' }),
    ).toBeVisible();
    await expect(saveButton(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Geräteart anlegen' })).toBeDisabled();
    await expect(nameField(page)).toHaveValue(`${name} neu`);
  });

  test('UI-027.unreachable DER-33-08 (b) the list without answer shows P-06 without replacing the page', async ({
    page,
  }) => {
    await page.route('**/api/device-types?*', (route) => route.abort('connectionrefused'));

    await page.goto(PAGE);

    const banner = page.getByRole('alert').filter({ hasText: 'resellr ist nicht erreichbar.' });
    await expect(banner.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gerätearten und Merkmale' })).toBeVisible();
  });

  test('UI-027.wird-beendet DER-33-08 (c) a save refused with 503 shutting_down shows P-07 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Beenden', testInfo.title, testInfo.project.name);
    await createDeviceType(page, server.baseUrl, name);
    await openDeviceType(page, name);
    // Answer of the write gate in state `stopping` (2.0.4), without ending the shared server and
    // without sending the write: status and body of P-07, headers from a read of the same server.
    await page.route('**/api/device-types/*', async (route) => {
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

    await expect(
      page.getByRole('alert').filter({ hasText: 'resellr wird gerade beendet.' }),
    ).toBeVisible();
    await expect(nameField(page)).toHaveValue(`${name} neu`);
  });
});
