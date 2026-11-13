import { join } from 'node:path';

import type { Page } from '@playwright/test';
import Database from 'better-sqlite3';

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

/** File of the database in the data folder (`DATABASE_FILE_NAME`, CU-040). */
const DATABASE_FILE = 'resellr.db';

const attributes = (page: Page) => page.getByRole('region', { name: 'Merkmale' });
const attributeRow = (page: Page, label: string) =>
  attributes(page)
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: label, exact: true }) });

/** Creates an attribute through the API like the user interface (`local-guard` G-2, G-4). */
async function createAttribute(
  page: Page,
  baseUrl: string,
  deviceTypeId: number,
  change: Record<string, unknown>,
) {
  const response = await page.request.post(
    `${baseUrl}/api/device-types/${deviceTypeId}/attributes`,
    {
      headers: { origin: baseUrl },
      data: {
        label: 'Merkmal',
        dataType: 'text',
        unit: null,
        unitSpacing: true,
        minValue: null,
        maxValue: null,
        pickListId: null,
        level: 'device',
        variantForming: false,
        required: false,
        datasheetBlock: 'technical',
        active: true,
        ...change,
      },
    },
  );
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; version: number };
}

/**
 * A model template "MacBook Air" with the given default device values. There is no API for model
 * templates before S3, so the test writes it into the database of the running server (WAL mode
 * allows the second connection). `manufacturer` must be unique per test.
 */
function insertModelTemplate(
  dataDir: string,
  deviceTypeId: number,
  manufacturer: string,
  defaultDeviceValues: Record<string, unknown>,
) {
  const sqlite = new Database(join(dataDir, DATABASE_FILE));
  try {
    const now = new Date().toISOString();
    const inserted = sqlite
      .prepare(
        `INSERT INTO manufacturer (name, name_key, active, gpsr_complete, version, created_at, updated_at)
         VALUES (?, ?, 1, 0, 1, ?, ?)`,
      )
      .run(manufacturer, manufacturer.toLowerCase(), now, now);
    return Number(
      sqlite
        .prepare(
          `INSERT INTO model_template (device_type_id, manufacturer_id, model_name, model_name_key,
             mpn_unknown, model_values, default_device_values, search_key, import_review_pending,
             import_review_keys, version, created_at, updated_at)
           VALUES (?, ?, 'MacBook Air', 'macbookair', 1, '{}', ?, 'macbook air', 0, '[]', 1, ?, ?)`,
        )
        .run(deviceTypeId, inserted.lastInsertRowid, JSON.stringify(defaultDeviceValues), now, now)
        .lastInsertRowid,
    );
  } finally {
    sqlite.close();
  }
}

async function attributeList(page: Page, baseUrl: string, deviceTypeId: number) {
  const response = await page.request.get(`${baseUrl}/api/device-types/${deviceTypeId}/attributes`);
  return (
    (await response.json()) as {
      items: { id: number; label: string; active: boolean; variantForming: boolean }[];
    }
  ).items;
}

test.describe('UI-027 attributes (CU-095, REQ-005)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('UI-027.default DER-34-06 the order changes by dragging and with "Runter", each sent as the complete attribute-order', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Notebook', testInfo.title, testInfo.project.name);
    const deviceType = await createDeviceType(page, server.baseUrl, name);
    const cpu = await createAttribute(page, server.baseUrl, deviceType.id, { label: 'Prozessor' });
    const ram = await createAttribute(page, server.baseUrl, deviceType.id, { label: 'RAM' });
    const ssd = await createAttribute(page, server.baseUrl, deviceType.id, { label: 'SSD' });
    await openDeviceType(page, name);
    await expect(attributeRow(page, 'SSD')).toBeVisible();
    await expectReachable(page);

    // Keyboard alternative: "Runter" in the row of "Prozessor".
    const byKeyboard = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().endsWith('/attribute-order'),
    );
    await attributeRow(page, 'Prozessor').getByRole('button', { name: 'Runter' }).focus();
    await page.keyboard.press('Enter');
    expect(((await byKeyboard).postDataJSON() as { attributeIds: number[] }).attributeIds).toEqual([
      ram.id,
      cpu.id,
      ssd.id,
    ]);
    await expect(page.getByRole('status').filter({ hasText: 'Merkmal gespeichert' })).toBeVisible();

    // Dragging "SSD" onto the first row.
    const byDragging = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().endsWith('/attribute-order'),
    );
    await attributeRow(page, 'SSD').dragTo(attributeRow(page, 'RAM'));
    expect(((await byDragging).postDataJSON() as { attributeIds: number[] }).attributeIds).toEqual([
      ssd.id,
      ram.id,
      cpu.id,
    ]);
    await expect
      .poll(async () =>
        (await attributeList(page, server.baseUrl, deviceType.id)).map((item) => item.label),
      )
      .toEqual(['SSD', 'RAM', 'Prozessor']);
    await expect(
      attributes(page).getByRole('button', { name: /^(Prozessor|RAM|SSD)$/ }),
    ).toHaveText(['SSD', 'RAM', 'Prozessor']);

    // An incomplete list is a state from before another window created an attribute (2.1).
    const devices = await page.request.get(`${server.baseUrl}/api/device-types?limit=200`);
    const { version } = (
      (await devices.json()) as { items: { id: number; version: number }[] }
    ).items.find((item) => item.id === deviceType.id) ?? { version: 0 };
    const incomplete = await page.request.put(
      `${server.baseUrl}/api/device-types/${deviceType.id}/attribute-order`,
      { headers: { origin: server.baseUrl }, data: { version, attributeIds: [ssd.id, ram.id] } },
    );
    expect(incomplete.status()).toBe(409);
  });

  test('UI-027.default DER-34-07 deactivating a variant attribute answers 200, shows "deaktiviert", keeps the stored values and the variant set', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Notebook', testInfo.title, testInfo.project.name);
    const deviceType = await createDeviceType(page, server.baseUrl, name);
    const ram = await createAttribute(page, server.baseUrl, deviceType.id, {
      label: 'RAM',
      dataType: 'integer',
      unit: 'GB',
      variantForming: true,
    });
    const modelTemplateId = insertModelTemplate(server.paths.dataDir, deviceType.id, name, {
      [ram.id]: 16,
    });
    await openDeviceType(page, name);

    const response = page.waitForResponse(
      (answer) =>
        answer.request().method() === 'PATCH' && answer.url().endsWith(`/api/attributes/${ram.id}`),
    );
    await attributeRow(page, 'RAM').getByRole('button', { name: 'Merkmal deaktivieren' }).click();

    const answer = await response;
    expect(answer.status()).toBe(200);
    expect(await answer.text()).not.toContain('variant_flag_would_merge_listings');
    await expect(attributeRow(page, 'RAM').getByText('deaktiviert')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Merkmal gespeichert' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const [stored] = await attributeList(page, server.baseUrl, deviceType.id);
    expect(stored).toMatchObject({ id: ram.id, active: false, variantForming: true });
    const check = new Database(join(server.paths.dataDir, DATABASE_FILE), { readonly: true });
    try {
      const row = check
        .prepare('SELECT default_device_values FROM model_template WHERE id = ?')
        .get(modelTemplateId) as { default_device_values: string };
      expect(JSON.parse(row.default_device_values)).toEqual({ [ram.id]: 16 });
    } finally {
      check.close();
    }
  });
  test('UI-027.disabled DER-34-10 with stored values data type and level are locked with the reason inline, and the server rejects a change', async ({
    page,
    server,
  }, testInfo) => {
    const name = uniqueName('Notebook', testInfo.title, testInfo.project.name);
    const deviceType = await createDeviceType(page, server.baseUrl, name);
    const ram = await createAttribute(page, server.baseUrl, deviceType.id, {
      label: 'RAM',
      dataType: 'integer',
      unit: 'GB',
      variantForming: true,
    });
    insertModelTemplate(server.paths.dataDir, deviceType.id, name, { [ram.id]: 16 });
    await openDeviceType(page, name);

    await attributes(page).getByRole('button', { name: 'RAM', exact: true }).click();
    const form = page.getByRole('form', { name: 'Merkmal bearbeiten' });
    const dataType = form.getByRole('combobox', { name: /^Datentyp/ });
    const level = form.getByRole('combobox', { name: /^Ebene/ });
    await expect(dataType).toBeDisabled();
    await expect(level).toBeDisabled();
    await expect(dataType).toHaveAccessibleDescription(
      'Datentyp kann nicht geändert werden, weil bereits Werte gespeichert sind.',
    );
    await expect(level).toHaveAccessibleDescription(
      'Ebene kann nicht geändert werden, weil bereits Werte gespeichert sind.',
    );
    await expect(form.getByRole('textbox', { name: /^Einheit/ })).toBeEnabled();

    // AC-REQ-005-08 against the running server: level device to model is rejected.
    const rejected = await page.request.patch(`${server.baseUrl}/api/attributes/${ram.id}`, {
      headers: { origin: server.baseUrl },
      data: { version: ram.version, level: 'model', variantForming: false },
    });
    expect(rejected.status()).toBe(422);
    expect(((await rejected.json()) as { error: { code: string } }).error.code).toBe(
      'attribute_has_values',
    );
  });
});
