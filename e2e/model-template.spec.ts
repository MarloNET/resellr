import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

/** Rows below 1366 CSS px, where R-1 stacks the form into one column (6.3). */
const REFLOW_ROWS = ['FM-3', 'FM-4'];

const form = (page: Page) => page.getByRole('form', { name: 'Modellvorlage anlegen' });
const field = (page: Page, name: string) => form(page).getByLabel(new RegExp(`^${name}\\*?$`));
const saveButton = (page: Page) => page.getByRole('button', { name: 'Modellvorlage speichern' });

/** The server keeps its data per worker: each test uses its own names. */
function uniqueName(base: string, title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base} ${hash.toString(36)}`;
}

/**
 * Fills the required attributes of the level model of a notebook (initial settings,
 * Requirements 9.3: Prozessor, Displaygröße; AC-REQ-008-05).
 */
async function fillNotebookAttributes(page: Page) {
  await field(page, 'Prozessor').fill('Intel Core i5-1135G7');
  await field(page, 'Displaygröße').fill('15,6');
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

test.describe('UI-007 Modellvorlage anlegen (CU-114)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('AC-REQ-008-01 a model template created from UI-006 is saved, the banner shows on UI-006 and the search finds it', async ({
    page,
    server,
  }, testInfo) => {
    const manufacturer = uniqueName('Lenovo', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, manufacturer);
    await page.goto('/modelle');

    await page.getByRole('link', { name: 'Modellvorlage anlegen' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Modellvorlage anlegen' }),
    ).toBeVisible();
    await expectReachable(page);
    await field(page, 'Geräteart').selectOption({ label: 'Notebook' });
    await fillNotebookAttributes(page);
    await field(page, 'Hersteller').selectOption({ label: manufacturer });
    await field(page, 'Modellbezeichnung').fill('ThinkPad E15 Gen 2');
    await field(page, 'Typbezeichnung').fill('20TD');
    await field(page, 'Herstellernummer').fill(' 20TD002MGE ');
    await field(page, 'Original-EAN').fill('2000000177007');
    await saveButton(page).click();

    await expect(page).toHaveURL(/\/modelle$/);
    await expect(page.getByText('Modellvorlage gespeichert')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Suchbegriff' }).fill(manufacturer);
    const row = page
      .getByRole('table', { name: 'Modellvorlagen' })
      .getByRole('row')
      .filter({ hasText: manufacturer });
    await expect(row.getByRole('cell')).toHaveText([
      'Notebook',
      manufacturer,
      'ThinkPad E15 Gen 2',
      '20TD',
      '20TD002MGE',
    ]);
  });

  test('AC-REQ-008-03 a model template with MPN "unbekannt" is listed as "unbekannt"', async ({
    page,
    server,
  }, testInfo) => {
    const manufacturer = uniqueName('Fujitsu', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, manufacturer);
    await page.goto('/modelle/neu');

    await field(page, 'Geräteart').selectOption({ label: 'Notebook' });
    await fillNotebookAttributes(page);
    await field(page, 'Hersteller').selectOption({ label: manufacturer });
    await field(page, 'Modellbezeichnung').fill('Esprimo Q957');
    await form(page).getByRole('checkbox', { name: 'unbekannt' }).check();
    await saveButton(page).click();

    await expect(page.getByText('Modellvorlage gespeichert')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Suchbegriff' }).fill(manufacturer);
    await expect(
      page
        .getByRole('table', { name: 'Modellvorlagen' })
        .getByRole('row')
        .filter({ hasText: manufacturer })
        .getByRole('cell')
        .last(),
    ).toHaveText('unbekannt');
  });

  test('UI-007.validation AC-REQ-101-02 DER-50-18 a manufacturer deactivated in another window is rejected at the field "Hersteller", leaves the choice and is never sent again (2.4, Nachträge MAR-904, MAR-925)', async ({
    page,
    server,
  }, testInfo) => {
    const manufacturer = uniqueName('Fujitsu', testInfo.title, testInfo.project.name);
    const { id, version } = await createManufacturer(page, server.baseUrl, manufacturer);
    const sent: unknown[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (request.method() === 'POST' && url.pathname === '/api/model-templates') {
        sent.push(request.postDataJSON());
      }
    });
    await page.goto('/modelle/neu');
    await field(page, 'Geräteart').selectOption({ label: 'Notebook' });
    await fillNotebookAttributes(page);
    await field(page, 'Hersteller').selectOption({ label: manufacturer });
    await field(page, 'Modellbezeichnung').fill('Lifebook E5510');
    await field(page, 'Herstellernummer').fill('E5510MP5');

    // "Another window" deactivates the manufacturer after UI-007 has read the choices.
    const deactivated = await page.request.patch(`${server.baseUrl}/api/manufacturers/${id}`, {
      headers: { origin: server.baseUrl },
      data: { version, active: false },
    });
    expect(deactivated.status()).toBe(200);
    await saveButton(page).click();

    await expect(form(page).getByText(`Hersteller ${manufacturer} ist deaktiviert`)).toBeVisible();
    await expect(field(page, 'Hersteller')).toBeFocused();
    await expect(field(page, 'Hersteller').getByRole('option', { name: manufacturer })).toHaveCount(
      0,
    );
    // The field shows what it sends: nothing (FIND-397-04, Design v0.6.7).
    await expect(field(page, 'Hersteller')).toHaveValue('');
    await expect(field(page, 'Hersteller').locator('option:checked')).toHaveText('Bitte wählen');
    await expect(field(page, 'Modellbezeichnung')).toHaveValue('Lifebook E5510');
    await expect(page).toHaveURL(/\/modelle\/neu$/);
    await expectReachable(page);

    await saveButton(page).click();
    await expect(form(page).getByText('Hersteller fehlt')).toBeVisible();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ manufacturerId: id });
  });

  test('UI-007.default UI-007.validation AC-REQ-008-05 DER-50-11 the fields of the device type appear after choosing it, and a missing required attribute is named at its field', async ({
    page,
    server,
  }, testInfo) => {
    const manufacturer = uniqueName('HP', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, manufacturer);
    await page.goto('/modelle/neu');
    await expect(
      form(page).getByText('Geräteart wählen, dann erscheinen die Merkmale'),
    ).toHaveCount(2);

    await field(page, 'Geräteart').selectOption({ label: 'Notebook' });
    const modelAttributes = form(page).getByRole('group', { name: 'Merkmale Ebene Modell' });
    await expect(modelAttributes.getByText('Prozessor*', { exact: true })).toBeVisible();
    await expect(
      form(page).getByRole('group', { name: 'Vorbelegungswerte für Geräte' }).getByLabel(/^RAM$/),
    ).toBeVisible();
    // Prozessor stays the only missing required field, so it is the first error.
    await field(page, 'Hersteller').selectOption({ label: manufacturer });
    await field(page, 'Modellbezeichnung').fill('ProBook 450 G8');
    await form(page).getByRole('checkbox', { name: 'unbekannt' }).check();
    await field(page, 'Displaygröße').fill('15,6');
    await saveButton(page).click();

    await expect(form(page).getByText('Prozessor fehlt')).toBeVisible();
    await expect(field(page, 'Prozessor')).toBeFocused();
    await expectReachable(page);
  });

  test('UI-007.validation DER-50-20 a pick list value deactivated in another window is rejected at the field of its attribute, emptied and no longer offered (2.0.11, Nachtrag MAR-904)', async ({
    page,
    server,
  }, testInfo) => {
    // Two saves with a reachability check each.
    test.slow();
    const manufacturer = uniqueName('Dell', testInfo.title, testInfo.project.name);
    const surface = uniqueName('satiniert', testInfo.title, testInfo.project.name);
    await createManufacturer(page, server.baseUrl, manufacturer);
    const headers = { origin: server.baseUrl };
    const lists = (await (
      await page.request.get(`${server.baseUrl}/api/pick-lists?limit=200`)
    ).json()) as {
      items: { id: number; key: string }[];
    };
    const listId = lists.items.find(({ key }) => key === 'display_surface')?.id;
    const created = await page.request.post(`${server.baseUrl}/api/pick-lists/${listId}/values`, {
      headers,
      data: { label: surface, active: true },
    });
    expect(created.status()).toBe(201);
    const value = (await created.json()) as { id: number; version: number };
    const sent: Record<string, unknown>[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (request.method() === 'POST' && url.pathname === '/api/model-templates') {
        sent.push(request.postDataJSON() as Record<string, unknown>);
      }
    });
    await page.goto('/modelle/neu');
    await field(page, 'Geräteart').selectOption({ label: 'Notebook' });
    await fillNotebookAttributes(page);
    await field(page, 'Display-Oberfläche').selectOption({ label: surface });
    await field(page, 'Hersteller').selectOption({ label: manufacturer });
    await field(page, 'Modellbezeichnung').fill('Latitude 5520');
    await form(page).getByRole('checkbox', { name: 'unbekannt' }).check();

    // "Another window" deactivates the value after UI-007 has read the choices.
    const deactivated = await page.request.patch(
      `${server.baseUrl}/api/pick-list-values/${value.id}`,
      { headers, data: { version: value.version, active: false } },
    );
    expect(deactivated.status()).toBe(200);
    await saveButton(page).click();

    await expect(
      form(page).getByText(`Display-Oberfläche: ${surface} ist deaktiviert`),
    ).toBeVisible();
    await expect(field(page, 'Display-Oberfläche')).toBeFocused();
    await expect(field(page, 'Display-Oberfläche')).toHaveValue('');
    await expect(
      field(page, 'Display-Oberfläche').getByRole('option', { name: surface }),
    ).toHaveCount(0);
    await expect(field(page, 'Prozessor')).toHaveValue('Intel Core i5-1135G7');
    expect(sent).toHaveLength(1);
    expect(Object.values(sent[0]?.modelValues as Record<string, unknown>)).toContain(value.id);
    await expectReachable(page);

    // The attribute is optional: saving without a choice stores the model template.
    await saveButton(page).click();
    await expect(page.getByText('Modellvorlage gespeichert')).toBeVisible();
    expect(Object.values(sent[1]?.modelValues as Record<string, unknown>)).not.toContain(value.id);
  });

  test('UI-007.validation DER-50-17 AC-REQ-008-02 the browser shows one message per field and focuses the first error', async ({
    page,
  }) => {
    await page.goto('/modelle/neu');

    await field(page, 'Herstellernummer').fill(`${'A'.repeat(20)}#${'B'.repeat(24)}`);
    await field(page, 'Original-EAN').fill('0194252146836');
    await saveButton(page).click();

    await expect(field(page, 'Geräteart')).toBeFocused();
    await expect(form(page).getByText('Geräteart fehlt')).toBeVisible();
    await expect(form(page).getByText('Hersteller fehlt')).toBeVisible();
    await expect(form(page).getByText('Modellbezeichnung: 1 bis 100 Zeichen')).toBeVisible();
    await expect(form(page).getByText('Herstellernummer: höchstens 40 Zeichen')).toBeVisible();
    await expect(form(page).getByText(/^Herstellernummer:/)).toHaveCount(1);
    await expect(
      form(page).getByText('EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer'),
    ).toBeVisible();
    await field(page, 'Herstellernummer').fill('');
    await field(page, 'Herstellernummer').blur();
    await expect(
      form(page).getByText('Herstellernummer: Wert eingeben oder ‚unbekannt‘ wählen'),
    ).toBeVisible();
    await expectReachable(page);
  });

  test('R-1 below 1366 px the form stacks into one column and every field and action stays reachable (FM-3, FM-4)', async ({
    page,
  }, testInfo) => {
    test.skip(!REFLOW_ROWS.includes(testInfo.project.name), 'R-1 sample in FM-3 and FM-4');
    await page.goto('/modelle/neu');
    await expect(form(page)).toBeVisible();

    const formBox = await form(page).boundingBox();
    const sectionBox = await form(page).getByRole('region', { name: 'Modelldaten' }).boundingBox();
    expect(sectionBox?.width).toBeCloseTo(formBox?.width ?? 0, 0);
    await expectReachable(page);
    await saveButton(page).click();
    await expect(field(page, 'Geräteart')).toBeFocused();
    await expectReachable(page);
  });

  test.describe('UI-007.dublette possible duplicate (REQ-011, 2.4)', () => {
    /** Creates "MacBook Pro 13" of the manufacturer through the API; returns its id. */
    async function createExisting(page: Page, baseUrl: string, manufacturerId: number) {
      const types = await page.request.get(`${baseUrl}/api/device-types`);
      const { items } = (await types.json()) as { items: { id: number; name: string }[] };
      const deviceTypeId = items.find(({ name }) => name === 'Notebook')?.id;
      const attributes = await page.request.get(
        `${baseUrl}/api/device-types/${deviceTypeId}/attributes`,
      );
      const attributeItems = (
        (await attributes.json()) as { items: { id: number; label: string }[] }
      ).items;
      const attributeId = (label: string) =>
        attributeItems.find((attribute) => attribute.label === label)?.id;
      const response = await page.request.post(`${baseUrl}/api/model-templates`, {
        headers: { origin: baseUrl },
        data: {
          deviceTypeId,
          manufacturerId,
          modelName: 'MacBook Pro 13',
          typeDesignation: '',
          mpn: 'MHGT3D/A',
          mpnUnknown: false,
          originalEan: '',
          // The required attributes of the level model of a notebook (fillNotebookAttributes).
          modelValues: {
            [String(attributeId('Prozessor'))]: 'Intel Core i5-1135G7',
            [String(attributeId('Displaygröße'))]: '15,6',
          },
          defaultDeviceValues: {},
        },
      });
      expect(response.status()).toBe(201);
      return ((await response.json()) as { id: number }).id;
    }

    async function saveDuplicate(page: Page, manufacturer: string) {
      await page.goto('/modelle/neu');
      await field(page, 'Geräteart').selectOption({ label: 'Notebook' });
      await fillNotebookAttributes(page);
      await field(page, 'Hersteller').selectOption({ label: manufacturer });
      await field(page, 'Modellbezeichnung').fill('MacBook  pro 13');
      await field(page, 'Herstellernummer').fill('MNEH3D/A');
      await saveButton(page).click();
      const dialog = page.getByRole('dialog', { name: 'Mögliche Dublette' });
      await expect(dialog).toBeVisible();
      return dialog;
    }

    test('AC-REQ-011-01 DER-53-01 DER-53-03 shows the existing model template, Esc stores nothing, "Trotzdem anlegen" stores the second one', async ({
      page,
      server,
    }, testInfo) => {
      const manufacturer = uniqueName('Apple', testInfo.title, testInfo.project.name);
      const { id } = await createManufacturer(page, server.baseUrl, manufacturer);
      await createExisting(page, server.baseUrl, id);

      const dialog = await saveDuplicate(page, manufacturer);

      await expect(
        dialog.getByText(
          'Es gibt bereits eine Modellvorlage mit gleichem Hersteller und gleicher Modellbezeichnung.',
        ),
      ).toBeVisible();
      await expect(dialog.getByRole('row').nth(1).getByRole('cell')).toHaveText([
        manufacturer,
        'MacBook Pro 13',
        'MHGT3D/A',
        'Vorhandene verwenden',
      ]);
      await expectReachable(page);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(field(page, 'Modellbezeichnung')).toHaveValue('MacBook  pro 13');

      await saveButton(page).click();
      await dialog.getByRole('button', { name: 'Trotzdem anlegen' }).click();

      await expect(page).toHaveURL(/\/modelle$/);
      await expect(page.getByText('Modellvorlage gespeichert')).toBeVisible();
      await page.getByRole('searchbox', { name: 'Suchbegriff' }).fill(manufacturer);
      await expect(
        page.getByRole('table', { name: 'Modellvorlagen' }).getByRole('row').filter({
          hasText: manufacturer,
        }),
      ).toHaveCount(2);
    });

    test('DER-53-02 "Vorhandene verwenden" creates nothing and opens the existing model template', async ({
      page,
      server,
    }, testInfo) => {
      const manufacturer = uniqueName('Apple', testInfo.title, testInfo.project.name);
      const { id } = await createManufacturer(page, server.baseUrl, manufacturer);
      const existing = await createExisting(page, server.baseUrl, id);

      const dialog = await saveDuplicate(page, manufacturer);
      await dialog.getByRole('button', { name: 'Vorhandene verwenden' }).click();

      await expect(page).toHaveURL(new RegExp(`/modelle/${existing}$`));
      const list = await page.request.get(
        `${server.baseUrl}/api/model-templates?q=${encodeURIComponent(manufacturer)}`,
      );
      expect(((await list.json()) as { total: number }).total).toBe(1);
    });
  });
});
