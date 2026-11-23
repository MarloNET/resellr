import type { Page } from '@playwright/test';
import sharp from 'sharp';

import { type AppServer, test as appTest, expect, workerServer } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** The model listings of this spec live on a server of their own, so other specs keep theirs. */
const test = appTest.extend<object, { server: AppServer }>({
  server: [workerServer, { scope: 'worker' }],
});

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

/** Rows of DER-80-10 (UI-015 "Fenstergröße und Bedienung"). */
const DER_80_10_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4'];

/** The server keeps its data per worker: each test uses its own names. */
function uniqueHash(title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/** A synthetic photo of 800 × 600 pixels in one color, no real photo. */
async function photo(name: string, red: number) {
  const buffer = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: red, g: 90, b: 160 } },
  })
    .jpeg()
    .toBuffer();
  return { name, mimeType: 'image/jpeg', buffer };
}

/**
 * Creates a model listing like "Neues Modell-Inserat anlegen" in UI-004 through the API
 * (`local-guard` G-2, G-4): a device type of its own without attributes, a manufacturer, a model
 * template, the device "F<hash>" and the model listing from it.
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

  const deviceType = await created<{ id: number }>('/api/device-types', {
    name: `Fotogerät ${hash}`,
    active: true,
  });
  const manufacturer = await created<{ id: number }>('/api/manufacturers', {
    name: `Fotohersteller ${hash}`,
  });
  const modelName = `Fotomodell ${hash}`;
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
  const device = await created<{ id: number; version: number }>('/api/devices', {
    wiNr: `F${hash}`.slice(0, 20),
    supplierId: null,
    modelTemplateId: template.id,
    conditionValueId: used.id,
    visualGrade: '2',
    conditionDescription: '',
    values: {},
    confirmedKeys: [],
  });
  const listing = await created<{ id: number }>('/api/listings', {
    fromDeviceId: device.id,
    deviceVersion: device.version,
  });
  return { id: listing.id, modelName };
}

/** Uploads photos through the API, one request per file (2.11). */
async function uploadPhotos(page: Page, baseUrl: string, listingId: number, count: number) {
  for (let index = 1; index <= count; index += 1) {
    const answer = await page.request.post(`${baseUrl}/api/listings/${listingId}/photos`, {
      headers: { origin: baseUrl },
      multipart: { file: await photo(`Foto ${index}.jpg`, index * 40) },
    });
    expect(answer.status(), await answer.text()).toBe(201);
  }
}

/** Chooses files with "Fotos hinzufügen" (UI-015). */
async function chooseFiles(page: Page, files: Awaited<ReturnType<typeof photo>>[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Fotos hinzufügen' }).click();
  await (await chooser).setFiles(files);
}

const grid = (page: Page) => page.getByRole('listbox', { name: 'Fotos' });

test.describe('UI-015 Fotos verwalten (CU-214, CU-215)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('UI-015.empty UI-015.default DER-80-01 DER-80-02 AC-REQ-042-02 "Fotos verwalten" opens UI-015; chosen files are uploaded one after the other, a GIF is rejected at its file; "Fertig" leads back to UI-014', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id, modelName } = await createListing(page, server.baseUrl, hash);

    await page.goto(`/inserate/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: modelName })).toBeVisible();
    await page
      .getByRole('region', { name: 'Fotos' })
      .getByRole('link', { name: 'Fotos verwalten' })
      .click();

    await expect(page).toHaveURL(new RegExp(`/inserate/${id}/fotos$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Fotos verwalten' })).toBeVisible();
    await expect(
      page.getByText('Noch keine Fotos. Fotos hinzufügen oder hierher ziehen.'),
    ).toBeVisible();
    await expect(page.getByText('0 von 20 Fotos')).toBeVisible();
    await expectReachable(page);

    const gif = await sharp({
      create: { width: 40, height: 40, channels: 3, background: '#2da44e' },
    })
      .gif()
      .toBuffer();
    await chooseFiles(page, [
      await photo('Vorderseite.jpg', 10),
      { name: 'Animation.gif', mimeType: 'image/gif', buffer: gif },
      await photo('Rückseite.jpg', 200),
    ]);

    await expect(page.getByText('2 von 20 Fotos')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText('Animation.gif: nur JPEG oder PNG bis 20 MB');
    await expect(grid(page).getByRole('option')).toHaveText([
      /^01Vorderseite\.jpg\d+ KB$/,
      /^02Rückseite\.jpg\d+ KB$/,
    ]);
    await expect(grid(page).getByRole('img', { name: 'Vorderseite.jpg' })).toHaveJSProperty(
      'complete',
      true,
    );
    // UI-015.success: the grid is the feedback, no banner.
    await expect(page.getByText(/gespeichert/)).toHaveCount(0);
    await expectReachable(page);

    await page.getByRole('link', { name: 'Fertig' }).click();
    await expect(page.getByRole('heading', { level: 1, name: modelName })).toBeVisible();
  });

  test('UI-015.disabled DER-80-03 with 20 photos "Fotos hinzufügen" is deactivated', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id } = await createListing(page, server.baseUrl, hash);
    await uploadPhotos(page, server.baseUrl, id, 20);

    await page.goto(`/inserate/${id}/fotos`);

    await expect(page.getByText('20 von 20 Fotos')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fotos hinzufügen' })).toBeDisabled();
    await expect(grid(page).getByRole('option')).toHaveCount(20);
    await expectReachable(page);
  });

  test('DER-80-10 the grid adapts to the width, the arrow keys select a photo, and the page does not scroll sideways (FM-1 to FM-4)', async ({
    page,
    server,
  }, testInfo) => {
    test.skip(!DER_80_10_ROWS.includes(testInfo.project.name), 'FM-1 to FM-4');
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id } = await createListing(page, server.baseUrl, hash);
    await uploadPhotos(page, server.baseUrl, id, 7);

    await page.goto(`/inserate/${id}/fotos`);
    await expect(page.getByText('7 von 20 Fotos')).toBeVisible();

    // Every photo lies inside the grid; the photos of a row are equally wide.
    const box = await grid(page).boundingBox();
    const options = await grid(page).getByRole('option').all();
    const boxes = await Promise.all(options.map((option) => option.boundingBox()));
    const firstRow = boxes.filter((entry) => entry?.y === boxes[0]?.y);
    expect(firstRow.length).toBeGreaterThan(1);
    for (const entry of boxes) {
      expect(entry!.x).toBeGreaterThanOrEqual(box!.x - 1);
      expect(entry!.x + entry!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
      expect(entry!.width).toBeCloseTo(boxes[0]!.width, 0);
    }
    // As many columns of at least 10rem (160 px) with a gap of 16 px as the width allows.
    expect(firstRow.length).toBe(Math.min(7, Math.floor((box!.width + 16) / (160 + 16))));

    await options[0]!.focus();
    await page.keyboard.press('ArrowRight');
    await expect(options[1]!).toBeFocused();
    await expect(options[1]!).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(options[2]!).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(options[1]!).toHaveAttribute('aria-selected', 'true');
    await expectReachable(page);
  });

  test('UI-015.ausgang-unbekannt DER-80-05 with the server ended during an upload the photo management stays locked until reload, without "Erneut versuchen"; after the reload the grid shows the actual state', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const { id } = await createListing(page, server.baseUrl, hash);
    await uploadPhotos(page, server.baseUrl, id, 1);
    // The server ends exactly when the upload is sent, so it gets no HTTP answer (P-08).
    await page.route(`**/api/listings/${id}/photos`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await server.kill();
      return route.continue();
    });

    try {
      await page.goto(`/inserate/${id}/fotos`);
      await expect(page.getByText('1 von 20 Fotos')).toBeVisible();

      await chooseFiles(page, [await photo('Neu.jpg', 90), await photo('Danach.jpg', 120)]);

      const banner = page.getByRole('alert');
      await expect(banner).toContainText('Ausgang unbekannt, bitte neu laden.', {
        timeout: 15_000,
      });
      await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Fotos hinzufügen' })).toBeDisabled();
      await expect(page.getByText(/^Lade /)).toHaveCount(0);
      await expect(grid(page).getByRole('option')).toHaveCount(1);

      await page.unroute(`**/api/listings/${id}/photos`);
      await server.restart();
      await page.reload();

      await expect(page.getByText('1 von 20 Fotos')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Fotos hinzufügen' })).toBeEnabled();
      await expect(page.getByText('Ausgang unbekannt, bitte neu laden.')).toHaveCount(0);
    } finally {
      // The other tests of this worker need the server.
      await server.restart();
    }
  });
});
