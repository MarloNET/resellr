import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const PAGE = '/einstellungen/textbausteine';

const textBlocks = (page: Page) => page.getByRole('region', { name: 'Textbausteine' });
const nameField = (page: Page) => page.getByRole('textbox', { name: /^Name/ });
const bodyField = (page: Page) => page.getByRole('textbox', { name: /^Text/ });
const kindField = (page: Page) => page.getByRole('combobox', { name: /^Art/ });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Speichern', exact: true });
const createButton = (page: Page) => page.getByRole('button', { name: 'Textbaustein anlegen' });

/** The server keeps its data per worker: each test uses its own names. */
function uniqueName(base: string, title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base} ${hash.toString(36)}`;
}

/** Creates a text block through the API like the user interface (`local-guard` G-2, G-4). */
async function createTextBlock(page: Page, baseUrl: string, name: string) {
  const response = await page.request.post(`${baseUrl}/api/text-blocks`, {
    headers: { origin: baseUrl },
    data: {
      name,
      kind: 'pickup_contact',
      body: 'Abholung nach Absprache.',
      allDeviceTypes: true,
      deviceTypeIds: [],
      allChannels: true,
      channelIds: [],
    },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { textBlock: { id: number; version: number } }).textBlock;
}

async function openTextBlock(page: Page, name: string) {
  await page.goto(PAGE);
  await textBlocks(page)
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click();
  await expect(nameField(page)).toHaveValue(name);
}

test.describe('UI-030 text blocks (CU-101)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('UI-030.success DER-39-03 a new text block is saved, listed with kind and status and every action is reachable', async ({
    page,
  }, testInfo) => {
    const name = uniqueName('Akku', testInfo.title, testInfo.project.name);
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Textbausteine' })).toBeVisible();

    await createButton(page).first().click();
    await expect(saveButton(page)).toBeDisabled();
    await nameField(page).fill(name);
    await kindField(page).selectOption({ label: 'Akku-Hinweis' });
    await bodyField(page).fill('Die Akkukapazität beträgt {Akkukapazität}.');
    await saveButton(page).click();

    // DER-39-10: UI-043 follows the save; in S2 it is always `.empty` (QH-1) and Esc closes it.
    const impact = page.getByRole('dialog', { name: 'Auswirkung der Änderung' });
    await expect(impact).toContainText('Keine Kanal-Inhalte betroffen');
    await page.keyboard.press('Escape');
    await expect(impact).toBeHidden();
    const banner = page.getByRole('status').filter({ hasText: 'Gespeichert' });
    await expect(banner).toBeVisible();
    const row = textBlocks(page).getByRole('button', { name: new RegExp(`^${name}`) });
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(row).toContainText('Akku-Hinweis');
    await expect(row).toContainText('aktiv');
    // DER-39-08: without a further change "Speichern" is disabled again.
    await expect(saveButton(page)).toBeDisabled();
    // DER-39-13: only "Deaktivieren", no deletion.
    await expect(page.getByRole('button', { name: `Deaktivieren: ${name}` })).toBeVisible();
    await expect(page.getByRole('button', { name: /löschen/i })).toHaveCount(0);
    await expect(banner).toBeHidden({ timeout: 10_000 });
    await expectReachable(page);
  });

  test('UI-030.validation AC-REQ-026-02 DER-39-05 unknown placeholders, {Baustein:Name} and a taken name are rejected at the field', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Doppelt', testInfo.title, testInfo.project.name);
    await createTextBlock(page, server.baseUrl, name);
    await page.goto(PAGE);
    await createButton(page).click();
    await nameField(page).fill(`${name} neu`);

    await bodyField(page).fill('Garantie {Garantiezeit}');
    await saveButton(page).click();
    await expect(page.getByText('Unbekannter Platzhalter {Garantiezeit}')).toBeVisible();
    await expect(bodyField(page)).toBeFocused();

    await bodyField(page).fill('Siehe {Baustein:Abholung}');
    await saveButton(page).click();
    await expect(
      page.getByText('{Baustein:Name} ist im Textbaustein nicht zulässig'),
    ).toBeVisible();

    await nameField(page).fill(name.toLowerCase());
    await bodyField(page).fill('Abholung');
    await saveButton(page).click();
    await expect(page.getByText('Name ist bereits vergeben')).toBeVisible();
    await expect(nameField(page)).toBeFocused();
  });

  test('UI-030.conflict DER-39-07 (a) a save after a change in another window shows P-05 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Konflikt', testInfo.title, testInfo.project.name);
    const created = await createTextBlock(page, server.baseUrl, name);
    await openTextBlock(page, name);
    await page.request.patch(`${server.baseUrl}/api/text-blocks/${created.id}`, {
      headers: { origin: server.baseUrl },
      data: { version: created.version, body: 'Anderes Fenster' },
    });

    await bodyField(page).fill('Dieses Fenster');
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'in einem anderen Fenster geändert' });
    await expect(banner.getByRole('button', { name: 'Neu laden' })).toBeVisible();
    await expect(bodyField(page)).toHaveValue('Dieses Fenster');
  });

  test('UI-030.unreachable DER-39-07 (b) the list without answer shows P-06 without replacing the page', async ({
    page,
  }) => {
    await page.route('**/api/text-blocks?*', (route) => route.abort('connectionrefused'));

    await page.goto(PAGE);

    const banner = page.getByRole('alert').filter({ hasText: 'resellr ist nicht erreichbar.' });
    await expect(banner.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Textbausteine' })).toBeVisible();
  });

  test('UI-030.wird-beendet DER-39-07 (c) a save refused with 503 shutting_down shows P-07 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Beenden', testInfo.title, testInfo.project.name);
    await createTextBlock(page, server.baseUrl, name);
    await openTextBlock(page, name);
    // Answer of the write gate in state `stopping` (2.0.4), without ending the shared server.
    await page.route('**/api/text-blocks/*', async (route) => {
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

    await bodyField(page).fill('Neu');
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'resellr wird gerade beendet.' });
    await expect(banner).toBeVisible();
    await expect(banner).not.toContainText(/R-[0-9A-Z]{4}-/);
    await expect(bodyField(page)).toHaveValue('Neu');
  });

  test('UI-030.speichert UI-030.ausgang-unbekannt DER-39-06 a running save shows "Speichern …" and a save without answer shows P-08 and locks further writes', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Abbruch', testInfo.title, testInfo.project.name);
    await createTextBlock(page, server.baseUrl, name);
    await openTextBlock(page, name);
    let abort = () => {};
    await page.route('**/api/text-blocks/*', (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      return new Promise<void>((resolve) => {
        abort = () => void route.abort('connectionreset').then(resolve);
      });
    });

    await bodyField(page).fill('Neu');
    await saveButton(page).click();

    await expect(page.getByRole('button', { name: 'Speichern …' })).toBeDisabled();
    await expect(bodyField(page)).toBeDisabled();
    await expect(nameField(page)).toBeDisabled();
    abort();

    const banner = page
      .getByRole('alert')
      .filter({ hasText: 'Ausgang unbekannt, bitte neu laden.' });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button')).toHaveCount(0);
    await expect(saveButton(page)).toBeDisabled();
    await expect(createButton(page)).toBeDisabled();
    await expect(bodyField(page)).toHaveValue('Neu');
  });
});
