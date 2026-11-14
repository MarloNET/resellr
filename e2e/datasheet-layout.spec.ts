import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const PAGE = '/einstellungen/datenblatt-layout';

const labelField = (page: Page, position: number) =>
  page.getByRole('textbox', { name: new RegExp(`^Kopfzeilentext ${position}`) });
const saveButton = (page: Page) => page.getByRole('button', { name: /^Speichern/ });
const blockList = (page: Page) =>
  page.getByRole('region', { name: 'Blockreihenfolge' }).getByRole('list');

interface Layout {
  headerLabels: string[];
  blockOrder: string[];
  attributeOrder: Record<string, number[]>;
  version: number;
}

/**
 * The layout is a single row and the server keeps its data per worker: each test reads the
 * current layout and uses its own header label.
 */
async function readLayout(page: Page, baseUrl: string): Promise<Layout> {
  const response = await page.request.get(`${baseUrl}/api/datasheet-layout`);
  expect(response.status()).toBe(200);
  return (await response.json()) as Layout;
}

function uniqueLabel(base: string, title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base} ${hash.toString(36)}`;
}

async function openPage(page: Page) {
  await page.goto(PAGE);
  await expect(page.getByRole('heading', { level: 1, name: 'Datenblatt-Layout' })).toBeVisible();
  await expect(labelField(page, 1)).toBeEnabled();
}

test.describe('UI-039 datasheet layout (CU-102)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('UI-039.success DER-85-01 DER-85-05 DER-85-06 a header label and the block order changed with the keyboard are saved', async ({
    page,
    server,
  }, testInfo) => {
    const label = uniqueLabel('Shop', testInfo.title, testInfo.project.name);
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await openPage(page);
    const before = await readLayout(page, server.baseUrl);

    // DER-85-05: nothing changed yet.
    await expect(saveButton(page)).toBeDisabled();
    // DER-85-06: the preview link is disabled until UI-023 exists.
    await expect(page.getByRole('link', { name: 'Vorschau am Beispielgerät' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await labelField(page, 1).fill(label);
    // Keyboard alternative of P-01: "Runter" in the first row of the block order.
    await blockList(page)
      .getByRole('listitem')
      .first()
      .getByRole('button', { name: 'Runter' })
      .focus();
    await page.keyboard.press('Enter');
    await saveButton(page).click();

    await expect(
      page.getByRole('status').filter({ hasText: 'Datenblatt-Layout gespeichert' }),
    ).toBeVisible();
    const after = await readLayout(page, server.baseUrl);
    expect(after.headerLabels[0]).toBe(label);
    expect(after.blockOrder).toEqual([
      before.blockOrder[1],
      before.blockOrder[0],
      ...before.blockOrder.slice(2),
    ]);
    expect(requested.some((url) => url.includes('/api/datasheets/preview-device'))).toBe(false);

    // The saved values are shown again after reloading.
    await openPage(page);
    await expect(labelField(page, 1)).toHaveValue(label);
  });

  test('UI-039.default every action is reachable', async ({ page }) => {
    // Each row of the block and attribute orders has its own "Hoch" and "Runter" (P-01).
    test.slow();
    await openPage(page);
    await expect(page.getByRole('region', { name: 'Merkmalsreihenfolge' })).not.toContainText(
      'Lade Einstellungen …',
    );
    await expectReachable(page);
  });

  test('UI-039.validation DER-85-02 a header label with 51 characters is rejected at the field', async ({
    page,
  }) => {
    await openPage(page);

    await labelField(page, 2).fill('x'.repeat(51));
    await saveButton(page).click();

    await expect(page.getByText('Kopfzeilentext: höchstens 50 Zeichen')).toBeVisible();
    await expect(labelField(page, 2)).toBeFocused();
  });

  test('UI-039.conflict DER-85-09 (a) a save after a change in another window shows P-05 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const label = uniqueLabel('Konflikt', testInfo.title, testInfo.project.name);
    await openPage(page);
    // The other window saves, so the version of this page is outdated.
    const { version, headerLabels, blockOrder, attributeOrder } = await readLayout(
      page,
      server.baseUrl,
    );
    const other = await page.request.put(`${server.baseUrl}/api/datasheet-layout`, {
      headers: { origin: server.baseUrl },
      data: {
        version,
        headerLabels: [`${label} B`, ...headerLabels.slice(1)],
        blockOrder,
        attributeOrder,
      },
    });
    expect(other.status()).toBe(200);

    await labelField(page, 1).fill(`${label} C`);
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'in einem anderen Fenster geändert' });
    await expect(banner.getByRole('button', { name: 'Neu laden' })).toBeVisible();
    await expect(labelField(page, 1)).toHaveValue(`${label} C`);

    await banner.getByRole('button', { name: 'Neu laden' }).click();
    await expect(labelField(page, 1)).toHaveValue(`${label} B`);
  });

  test('UI-039.unreachable DER-85-09 (d) the layout without answer shows P-06 without replacing the page', async ({
    page,
  }) => {
    await page.route('**/api/datasheet-layout', (route) => route.abort('connectionrefused'));

    await page.goto(PAGE);

    const banner = page.getByRole('alert').filter({ hasText: 'resellr ist nicht erreichbar.' });
    await expect(banner.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Datenblatt-Layout' })).toBeVisible();
  });

  test('UI-039.wird-beendet DER-85-09 (b) a save refused with 503 shutting_down shows P-07 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const label = uniqueLabel('Beenden', testInfo.title, testInfo.project.name);
    await openPage(page);
    // Answer of the write gate in state `stopping` (2.0.4), without ending the shared server and
    // without sending the write: status and body of P-07, headers from a read of the same server.
    await page.route('**/api/datasheet-layout', async (route) => {
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

    await labelField(page, 1).fill(label);
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'resellr wird gerade beendet.' });
    await expect(banner).toBeVisible();
    await expect(banner).not.toContainText(/R-[0-9A-Z]{4}-/);
    await expect(labelField(page, 1)).toHaveValue(label);
  });

  test('UI-039.speichert UI-039.ausgang-unbekannt DER-85-09 (c) "Speichern …" locks the inputs, a save without answer shows P-08 and locks further writes', async ({
    page,
  }, testInfo) => {
    const label = uniqueLabel('Abbruch', testInfo.title, testInfo.project.name);
    await openPage(page);
    // The write hangs until the test lets it break off without an HTTP answer.
    let breakOff = () => {};
    const broken = new Promise<void>((resolve) => (breakOff = resolve));
    await page.route('**/api/datasheet-layout', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      await broken;
      return route.abort('connectionreset');
    });

    await labelField(page, 1).fill(label);
    await saveButton(page).click();

    await expect(page.getByRole('button', { name: 'Speichern …' })).toBeDisabled();
    await expect(labelField(page, 1)).toBeDisabled();
    breakOff();

    const banner = page
      .getByRole('alert')
      .filter({ hasText: 'Ausgang unbekannt, bitte neu laden.' });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button')).toHaveCount(0);
    await expect(saveButton(page)).toBeDisabled();
    await expect(labelField(page, 1)).toHaveValue(label);
  });
});
