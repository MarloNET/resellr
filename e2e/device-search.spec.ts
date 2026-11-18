import type { Page } from '@playwright/test';

import { type AppServer, test as appTest, expect, workerServer } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** The devices of this spec live on a server of their own, so other specs keep their lists. */
const test = appTest.extend<object, { server: AppServer }>({
  server: [workerServer, { scope: 'worker' }],
});

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

/** The server keeps its data per worker: each test uses its own names. */
function uniqueHash(title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/**
 * Creates a device through the API like the user interface (`local-guard` G-2, G-4): a device
 * type of its own without attributes, so the device needs only condition and visual grade, a
 * manufacturer, a model template and the device "S<hash>".
 */
async function createDevice(page: Page, baseUrl: string, hash: string) {
  const headers = { origin: baseUrl };
  const created = async <T>(path: string, data: unknown) => {
    const answer = await page.request.post(`${baseUrl}${path}`, { headers, data });
    expect(answer.status()).toBe(201);
    return (await answer.json()) as T;
  };
  const read = async <T>(path: string) =>
    (await (await page.request.get(`${baseUrl}${path}`)).json()) as T;

  const deviceType = await created<{ id: number }>('/api/device-types', {
    name: `Testgerät ${hash}`,
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
  const wiNr = `S${hash}`.slice(0, 20);
  const device = await created<{ id: number }>('/api/devices', {
    wiNr,
    supplierId: null,
    modelTemplateId: template.id,
    conditionValueId: used.id,
    visualGrade: '2',
    conditionDescription: '',
    values: {},
    confirmedKeys: [],
  });
  return { id: device.id, wiNr, modelName };
}

test.describe('UI-009 Geräte and UI-010 Gerät (CU-136, CU-137)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('DER-54-09 DER-54-10 a device is found by a part of its WI-Nr and opened with Enter, and both screens stay reachable', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id, wiNr, modelName } = await createDevice(page, server.baseUrl, hash);
    await page.goto('/');

    await page.getByRole('navigation').getByRole('link', { name: 'Geräte', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Geräte' })).toBeVisible();
    const search = page.getByRole('searchbox', { name: 'WI-Nr' });
    await expect(search).toBeFocused();
    await search.fill(wiNr.slice(1).toUpperCase());

    const hits = page.getByRole('table', { name: 'Treffer' });
    const row = hits.getByRole('row').filter({ hasText: wiNr });
    await expect(row.getByRole('cell')).toHaveText([
      wiNr,
      modelName,
      'nicht zugeordnet',
      'verfügbar',
      'geprüft',
    ]);
    await expectReachable(page);

    await row.getByRole('link', { name: wiNr }).press('Enter');

    await expect(page).toHaveURL(new RegExp(`/geraete/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: `Gerät ${wiNr}` })).toBeVisible();
    const head = page.getByLabel('Gerätekopf');
    await expect(head.getByRole('definition')).toHaveText([
      modelName,
      'nicht zugeordnet',
      'verfügbar',
      'geprüft',
    ]);
    await expectReachable(page);
  });

  test('UI-010 a click on a hit row opens the device', async ({ page, server }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id, wiNr, modelName } = await createDevice(page, server.baseUrl, hash);
    await page.goto('/geraete');

    await page.getByRole('searchbox', { name: 'WI-Nr' }).fill(wiNr);
    await page
      .getByRole('table', { name: 'Treffer' })
      .getByRole('cell', { name: modelName })
      .click();

    await expect(page).toHaveURL(new RegExp(`/geraete/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: `Gerät ${wiNr}` })).toBeVisible();
  });

  test('UI-010.success DER-56-01 the changed visual grade is saved with "Gerätewerte speichern" and stays after a reload', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id } = await createDevice(page, server.baseUrl, hash);
    await page.goto(`/geraete/${id}`);

    const grade = page.getByRole('textbox', { name: 'Optik-Note' });
    await expect(grade).toHaveValue('2');
    await expect(page.getByRole('textbox', { name: 'WI-Nr' })).toHaveCount(0);
    await grade.fill('4');
    await page.getByRole('button', { name: 'Gerätewerte speichern' }).click();

    await expect(page.getByText('Gerät gespeichert')).toBeVisible();
    await expectReachable(page);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Optik-Note' })).toHaveValue('4');
  });

  test('DER-87-02 Enter in the search field opens the only hit', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id, wiNr } = await createDevice(page, server.baseUrl, hash);
    await page.goto('/geraete');

    await page.getByRole('searchbox', { name: 'WI-Nr' }).fill(wiNr);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(new RegExp(`/geraete/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: `Gerät ${wiNr}` })).toBeVisible();
  });

  test('DER-87-05 the button "Gerät einbuchen" opens UI-003', async ({ page }) => {
    await page.goto('/geraete');

    await page.getByRole('main').getByRole('link', { name: 'Gerät einbuchen' }).click();

    await expect(page).toHaveURL(/\/geraete\/neu$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Gerät einbuchen' })).toBeVisible();
});
});
