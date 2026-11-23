import type { Page } from '@playwright/test';

import { type AppServer, test as appTest, expect, workerServer } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** The model listings of this spec live on a server of their own, so other specs keep theirs. */
const test = appTest.extend<object, { server: AppServer }>({
  server: [workerServer, { scope: 'worker' }],
});

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

/** Rows below 1366 CSS px, where R-1 stacks the listing values into one column (6.3). */
const REFLOW_ROWS = ['FM-3', 'FM-4'];

/** The server keeps its data per worker: each test uses its own names. */
function uniqueHash(title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/**
 * Creates a model listing like "Neues Modell-Inserat anlegen" in UI-004 through the API
 * (`local-guard` G-2, G-4): a device type of its own without attributes, a manufacturer, a model
 * template, the device "L<hash>" and the model listing from it.
 */
async function createListing(page: Page, baseUrl: string, hash: string) {
  const headers = { origin: baseUrl };
  const created = async <T>(path: string, data: unknown) => {
    const answer = await page.request.post(`${baseUrl}${path}`, { headers, data });
    expect(answer.status(), await answer.text()).toBe(201);
    return (await answer.json()) as T;
  };
  const read = async <T>(path: string) =>
    (await (await page.request.get(`${baseUrl}${path}`)).json()) as T;

  const deviceTypeName = `Inseratgerät ${hash}`;
  const deviceType = await created<{ id: number }>('/api/device-types', {
    name: deviceTypeName,
    active: true,
  });
  const manufacturer = await created<{ id: number }>('/api/manufacturers', {
    name: `Hersteller ${hash}`,
  });
  const modelName = `Modell ${hash}`;
  const template = await created<{ id: number }>('/api/model-templates', {
    deviceTypeId: deviceType.id,
    manufacturerId: manufacturer.id,
    modelName,
    typeDesignation: '',
    mpn: null,
    mpnUnknown: true,
    originalEan: '',
    modelValues: {},
    defaultDeviceValues: {},
  });
  const { items: pickLists } = await read<{ items: { id: number; key: string }[] }>(
    '/api/pick-lists?limit=200',
  );
  const conditionList = pickLists.find(({ key }) => key === 'condition');
  if (conditionList === undefined) throw new Error('Zustand is missing');
  const { items: conditions } = await read<{ items: { id: number; label: string }[] }>(
    `/api/pick-lists/${conditionList.id}/values?limit=200`,
  );
  const used = conditions.find(({ label }) => label === 'gebraucht');
  if (used === undefined) throw new Error('gebraucht is missing');
  const wiNr = `L${hash}`.slice(0, 20);
  const device = await created<{ id: number; version: number }>('/api/devices', {
    wiNr,
    supplierId: null,
    modelTemplateId: template.id,
    conditionValueId: used.id,
    visualGrade: '2',
    conditionDescription: 'Leichte Kratzer am Deckel',
    values: {},
    confirmedKeys: [],
  });
  const listing = await created<{ id: number }>('/api/listings', {
    fromDeviceId: device.id,
    deviceVersion: device.version,
  });
  return { id: listing.id, wiNr, modelName, deviceTypeName };
}

test.describe('UI-014 Modell-Inserat (CU-138, CU-292)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('DER-60-01 after "Neues Modell-Inserat anlegen" UI-014 shows the model listing with quantity 1, its listing values and its device, and stays reachable', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id, wiNr, modelName, deviceTypeName } = await createListing(page, server.baseUrl, hash);

    await page.goto(`/inserate/${id}`);

    await expect(page.getByRole('heading', { level: 1, name: modelName })).toBeVisible();
    await expect(
      page.getByText(`${deviceTypeName} · Stückzahl 1 · Artikelnummer ${wiNr}`),
    ).toBeVisible();
    const values = page.getByRole('region', { name: 'Inseratswerte' });
    await expect(
      values.getByText('Modelldaten werden in der Modellvorlage gepflegt.'),
    ).toBeVisible();
    await expect(values.getByRole('definition')).toHaveText([
      'gebraucht',
      '2',
      '–',
      wiNr,
      'Original (–)',
      'Leichte Kratzer am Deckel',
    ]);
    const devices = page.getByRole('table', { name: 'Geräte' });
    await expect(devices.getByRole('row').filter({ hasText: wiNr }).getByRole('cell')).toHaveText([
      wiNr,
      'verfügbar',
      '–',
      /^\d{2}\.\d{2}\.\d{4}$/,
    ]);
    await expect(page.getByRole('checkbox', { name: 'auch stornierte' })).not.toBeChecked();
    await expectReachable(page);

    await devices.getByRole('link', { name: wiNr }).click();
    await expect(page.getByRole('heading', { level: 1, name: `Gerät ${wiNr}` })).toBeVisible();
  });

  test('UI-014.edit UI-014.success DER-64-01 DER-64-02 changes article number and EAN in the edit view and shows "Inseratswerte gespeichert" with the new values', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id, modelName } = await createListing(page, server.baseUrl, hash);
    const articleNumber = `A-${hash}`;

    await page.goto(`/inserate/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: modelName })).toBeVisible();
    await page.getByRole('button', { name: 'Bearbeiten' }).click();

    const form = page.getByRole('form', { name: 'Inseratswerte bearbeiten' });
    await expect(form.getByRole('combobox', { name: /^Zustand/ })).toHaveValue(/\d+/);
    await expectReachable(page);
    await form.getByRole('textbox', { name: /^Artikelnummer/ }).fill(articleNumber);
    await form.getByRole('combobox', { name: /^EAN-Kennzeichnung/ }).selectOption('own');
    await form.getByRole('textbox', { name: /^Eigene EAN/ }).fill('4255867000014');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();

    await expect(page.getByText('Inseratswerte gespeichert')).toBeVisible();
    const values = page.getByRole('region', { name: 'Inseratswerte' });
    await expect(values.getByRole('definition').filter({ hasText: articleNumber })).toBeVisible();
    await expect(values.getByText('eigene (4255867000014)')).toBeVisible();
  });

  test('UI-014.validation AC-REQ-019-04 rejects the article number of another model listing with "Artikelnummer bereits vergeben" at the field and keeps the stored one', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const taken = await createListing(page, server.baseUrl, `${hash}a`);
    const { id, wiNr, modelName, deviceTypeName } = await createListing(
      page,
      server.baseUrl,
      `${hash}b`,
    );

    await page.goto(`/inserate/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: modelName })).toBeVisible();
    await page.getByRole('button', { name: 'Bearbeiten' }).click();
    const form = page.getByRole('form', { name: 'Inseratswerte bearbeiten' });
    await expect(form.getByRole('combobox', { name: /^Zustand/ })).toHaveValue(/\d+/);
    const articleNumber = form.getByRole('textbox', { name: /^Artikelnummer/ });
    await articleNumber.fill(taken.wiNr);
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();

    await expect(articleNumber).toHaveAccessibleDescription(/Artikelnummer bereits vergeben/);
    await expect(articleNumber).toHaveAttribute('aria-invalid', 'true');
    await expect(articleNumber).toBeFocused();
    await expect(articleNumber).toHaveValue(taken.wiNr);
    await expectReachable(page);

    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(
      page.getByText(`${deviceTypeName} · Stückzahl 1 · Artikelnummer ${wiNr}`),
    ).toBeVisible();
  });

  test('UI-014.abweichung-bestaetigen DER-64-03 names the deviating assigned device, stays reachable and stores the change only after "Änderung trotzdem speichern"', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id, wiNr, modelName } = await createListing(page, server.baseUrl, hash);

    await page.goto(`/inserate/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: modelName })).toBeVisible();
    await page.getByRole('button', { name: 'Bearbeiten' }).click();
    const form = page.getByRole('form', { name: 'Inseratswerte bearbeiten' });
    await form.getByRole('textbox', { name: /^Optik-Note/ }).fill('3');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Zugeordnete Geräte weichen ab' });
    await expect(
      dialog.getByText('Nach dieser Änderung weichen 1 zugeordnete Geräte vom Modell-Inserat ab:'),
    ).toBeVisible();
    await expect(dialog.getByRole('row').filter({ hasText: wiNr })).toHaveText(
      `${wiNr}Optik-Note: Gerät 2, Modell-Inserat 3`,
    );
    await expect(
      dialog.getByText('Die Bestätigung wird im Änderungsprotokoll festgehalten.'),
    ).toBeVisible();
    await expectReachable(page);

    await dialog.getByRole('button', { name: 'Änderung trotzdem speichern' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Inseratswerte gespeichert')).toBeVisible();
    const values = page.getByRole('region', { name: 'Inseratswerte' });
    await expect(values.getByRole('definition').nth(1)).toHaveText('3');
  });

  test('R-1 below 1366 px the listing values stack into one column and everything stays reachable (FM-3, FM-4)', async ({
    page,
    server,
  }, testInfo) => {
    test.skip(!REFLOW_ROWS.includes(testInfo.project.name), 'R-1 sample in FM-3 and FM-4');
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id, modelName } = await createListing(page, server.baseUrl, hash);

    await page.goto(`/inserate/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: modelName })).toBeVisible();

    const values = page.getByRole('region', { name: 'Inseratswerte' });
    const condition = await values
      .getByRole('term')
      .filter({ hasText: 'Zustand' })
      .first()
      .boundingBox();
    const delivery = await values
      .getByRole('term')
      .filter({ hasText: 'Lieferumfang' })
      .boundingBox();
    // One column: the terms stand one below the other at the same left edge.
    expect(delivery?.x).toBeCloseTo(condition?.x ?? -1, 0);
    expect(delivery?.y ?? 0).toBeGreaterThan(condition?.y ?? 0);
    await expectReachable(page);
  });
});
