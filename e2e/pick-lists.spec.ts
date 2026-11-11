import { join } from 'node:path';

import type { Page } from '@playwright/test';
import Database from 'better-sqlite3';

import { insertPickLists, PICK_LISTS, pickListId } from '../apps/server/test/pick-lists.ts';
import { type AppServer, expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

const PAGE = '/einstellungen/auswahllisten';

/** File of the database in the data folder (`DATABASE_FILE_NAME`, CU-040). */
const DATABASE_FILE = 'resellr.db';

const lists = (page: Page) => page.getByRole('region', { name: 'Auswahllisten' });
const valueField = (page: Page) => page.getByRole('textbox', { name: /^Wert/ });
const saveButton = (page: Page) => page.getByRole('button', { name: /^Speichern/ });
const row = (page: Page, label: string) =>
  page.getByRole('row').filter({ has: page.getByRole('cell', { name: label, exact: true }) });

/**
 * The nine lists come with the seed migration of #150; until then the test inserts them into
 * the database of the running server (WAL mode allows the second connection).
 */
function ensurePickLists(server: AppServer) {
  const sqlite = new Database(join(server.paths.dataDir, DATABASE_FILE));
  try {
    insertPickLists(sqlite);
  } finally {
    sqlite.close();
  }
}

/** The server keeps its data per worker: each test uses its own values. */
function uniqueLabel(base: string, title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base} ${hash.toString(36)}`;
}

/** Creates a value through the API like the user interface (`local-guard` G-2, G-4). */
async function createValue(page: Page, baseUrl: string, listId: number, label: string) {
  const response = await page.request.post(`${baseUrl}/api/pick-lists/${listId}/values`, {
    headers: { origin: baseUrl },
    data: { label, active: true },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; version: number };
}

async function valueIds(page: Page, baseUrl: string, listId: number) {
  const response = await page.request.get(`${baseUrl}/api/pick-lists/${listId}/values?limit=200`);
  const body = (await response.json()) as { items: { id: number }[] };
  return body.items.map((item) => item.id);
}

async function openList(page: Page, name: string) {
  await page.goto(PAGE);
  await lists(page).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
}

async function startRename(page: Page, label: string) {
  await row(page, label).getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(valueField(page)).toHaveValue(label);
}

test.describe('UI-028 pick lists (CU-096)', () => {
  test.beforeEach(({ server }, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
    ensurePickLists(server);
  });

  test('UI-028.default DER-35-09 the nine lists offer no action to create or delete a list and every action is reachable', async ({
    page,
    server,
  }, testInfo) => {
    const label = uniqueLabel('Wert', testInfo.title, testInfo.project.name);
    await createValue(page, server.baseUrl, pickListId('condition'), label);
    await page.goto(PAGE);

    await expect(lists(page).getByRole('button')).toHaveText(PICK_LISTS.map(({ name }) => name));
    await expect(row(page, label)).toBeVisible();
    await expect(page.getByRole('button', { name: /löschen|Liste anlegen/i })).toHaveCount(0);
    await expectReachable(page);

    // Nor is there an endpoint: creating or deleting a list or a value ends in 404.
    const write = { headers: { origin: server.baseUrl }, data: {} };
    expect((await page.request.post(`${server.baseUrl}/api/pick-lists`, write)).status()).toBe(404);
    expect((await page.request.delete(`${server.baseUrl}/api/pick-lists/1`, write)).status()).toBe(
      404,
    );
    expect(
      (await page.request.delete(`${server.baseUrl}/api/pick-list-values/1`, write)).status(),
    ).toBe(404);
  });

  test('UI-028.reihenfolge DER-35-08 the order changes by dragging and with "Runter", each sent as value-order', async ({
    page,
    server,
  }, testInfo) => {
    const listId = pickListId('port_position');
    const first = uniqueLabel('Links', testInfo.title, testInfo.project.name);
    const second = uniqueLabel('Rechts', testInfo.title, testInfo.project.name);
    const a = await createValue(page, server.baseUrl, listId, first);
    const b = await createValue(page, server.baseUrl, listId, second);
    await openList(page, 'Anschlussposition');
    const before = await valueIds(page, server.baseUrl, listId);
    expect(before.indexOf(a.id)).toBeLessThan(before.indexOf(b.id));

    // Keyboard alternative: "Runter" in the row of the first value.
    const byKeyboard = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().endsWith('/value-order'),
    );
    await row(page, first).getByRole('button', { name: 'Runter' }).focus();
    await page.keyboard.press('Enter');
    const keyboardIds = (await byKeyboard).postDataJSON() as { valueIds: number[] };
    expect(keyboardIds.valueIds.indexOf(b.id)).toBeLessThan(keyboardIds.valueIds.indexOf(a.id));
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
    const afterKeyboard = await valueIds(page, server.baseUrl, listId);
    expect(afterKeyboard).toEqual(keyboardIds.valueIds);

    // Dragging: the first value back onto the row of the second.
    const byDragging = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().endsWith('/value-order'),
    );
    await row(page, first).dragTo(row(page, second));
    const draggedIds = (await byDragging).postDataJSON() as { valueIds: number[] };
    expect(draggedIds.valueIds.indexOf(a.id)).toBeLessThan(draggedIds.valueIds.indexOf(b.id));
    await expect.poll(() => valueIds(page, server.baseUrl, listId)).toEqual(draggedIds.valueIds);
  });

  test('UI-028.speichert UI-028.ausgang-unbekannt DER-35-05 a save shows "Speichern …" with locked inputs, without answer P-08', async ({
    page,
    server,
  }, testInfo) => {
    const label = uniqueLabel('Abbruch', testInfo.title, testInfo.project.name);
    await createValue(page, server.baseUrl, pickListId('storage_type'), label);
    await openList(page, 'Speichertyp');
    await startRename(page, label);
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/pick-list-values/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      await held;
      return route.abort('connectionreset');
    });

    await valueField(page).fill(`${label} neu`);
    await saveButton(page).click();

    await expect(saveButton(page)).toHaveText('Speichern …');
    await expect(saveButton(page)).toBeDisabled();
    await expect(valueField(page)).toBeDisabled();
    await expect(page.getByRole('switch', { name: 'Status' })).toBeDisabled();
    release();

    const banner = page
      .getByRole('alert')
      .filter({ hasText: 'Ausgang unbekannt, bitte neu laden.' });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button')).toHaveCount(0);
    await expect(saveButton(page)).toBeDisabled();
    await expect(valueField(page)).toHaveValue(`${label} neu`);
  });

  test('UI-028.conflict DER-35-06 (a) a save after a change in another window shows P-05 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const label = uniqueLabel('Konflikt', testInfo.title, testInfo.project.name);
    const created = await createValue(page, server.baseUrl, pickListId('power_supply'), label);
    await openList(page, 'Netzteil');
    await startRename(page, label);
    // The other window renames it, so the version of this page is outdated.
    const other = await page.request.patch(`${server.baseUrl}/api/pick-list-values/${created.id}`, {
      headers: { origin: server.baseUrl },
      data: { version: created.version, label: `${label} B` },
    });
    expect(other.status()).toBe(200);

    await valueField(page).fill(`${label} C`);
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'in einem anderen Fenster geändert' });
    await expect(banner.getByRole('button', { name: 'Neu laden' })).toBeVisible();
    await expect(valueField(page)).toHaveValue(`${label} C`);
  });

  test('UI-028.unreachable DER-35-06 (b) the values without answer show P-06 without replacing the page', async ({
    page,
  }) => {
    await page.route('**/api/pick-lists/*/values?*', (route) => route.abort('connectionrefused'));

    await page.goto(PAGE);

    const banner = page.getByRole('alert').filter({ hasText: 'resellr ist nicht erreichbar.' });
    await expect(banner.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Auswahllisten', level: 1 })).toBeVisible();
    await expect(lists(page).getByRole('button', { name: 'Zustand', exact: true })).toBeVisible();
  });

  test('UI-028.wird-beendet DER-35-06 (c) a save refused with 503 shutting_down shows P-07 and keeps the input', async ({
    page,
    server,
  }, testInfo) => {
    const label = uniqueLabel('Beenden', testInfo.title, testInfo.project.name);
    await createValue(page, server.baseUrl, pickListId('operating_system'), label);
    await openList(page, 'Betriebssystem');
    await startRename(page, label);
    // Answer of the write gate in state `stopping` (2.0.4), without ending the shared server and
    // without sending the write: status and body of P-07, headers from a read of the same server.
    await page.route('**/api/pick-list-values/*', async (route) => {
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

    await valueField(page).fill(`${label} neu`);
    await saveButton(page).click();

    const banner = page.getByRole('alert').filter({ hasText: 'resellr wird gerade beendet.' });
    await expect(banner).toBeVisible();
    await expect(banner).not.toContainText('Referenz');
    await expect(valueField(page)).toHaveValue(`${label} neu`);
  });
});
