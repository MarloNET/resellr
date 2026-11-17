import type { Page } from '@playwright/test';

import { type AppServer, test as appTest, expect, workerServer } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/**
 * UI-006 lists every model template of its server: the model templates of this spec live on a
 * server of their own, so the lists of the other specs stay as they expect them.
 */
const test = appTest.extend<object, { server: AppServer }>({
  server: [workerServer, { scope: 'worker' }],
});

/** Rows of the matrix with the full frame (FM-5 and FM-7 only check the narrow UI-019, 6.3). */
const FRAME_ROWS = ['FM-1', 'FM-2', 'FM-3', 'FM-4', 'FM-6'];

/** Rows below 1366 CSS px, where R-1 stacks the form into one column (6.3). */
const REFLOW_ROWS = ['FM-3', 'FM-4'];

const form = (page: Page) => page.getByRole('form', { name: 'Gerät einbuchen' });
const field = (page: Page, name: string) => form(page).getByLabel(new RegExp(`^${name}\\*?$`));
const saveButton = (page: Page) => page.getByRole('button', { name: 'Gerät speichern' });

/** The server keeps its data per worker: each test uses its own names. */
function uniqueHash(title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

interface AttributeEntry {
  id: number;
  label: string;
  level: 'model' | 'device';
  dataType: string;
  required: boolean;
  active: boolean;
}

/**
 * Creates a manufacturer and a notebook model template through the API like the user interface
 * (`local-guard` G-2, G-4), with a value for every active required attribute of the level model.
 * The attributes are read, because other specs change those of the notebook on this server.
 */
async function createNotebookTemplate(
  page: Page,
  baseUrl: string,
  hash: string,
  defaults: Record<string, unknown> = {},
) {
  const headers = { origin: baseUrl };
  const types = (await (
    await page.request.get(`${baseUrl}/api/device-types?limit=200`)
  ).json()) as {
    items: { id: number; name: string }[];
  };
  const notebook = types.items.find(({ name }) => name === 'Notebook');
  if (notebook === undefined) throw new Error('Notebook is missing');
  const attributes = (await (
    await page.request.get(`${baseUrl}/api/device-types/${notebook.id}/attributes`)
  ).json()) as { items: AttributeEntry[] };
  const modelValues = Object.fromEntries(
    attributes.items
      .filter(({ level, required, active }) => level === 'model' && required && active)
      .map(({ id, dataType }) => [id, dataType === 'text' ? 'Intel Core i5-1135G7' : '14']),
  );
  // Defaults of the level device by attribute label, e.g. `{ RAM: 16 }` (REQ-013).
  const defaultDeviceValues = Object.fromEntries(
    Object.entries(defaults).map(([label, value]) => {
      const attribute = attributes.items.find((entry) => entry.label === label);
      if (attribute === undefined) throw new Error(`${label} is missing`);
      return [attribute.id, value];
    }),
  );

  const manufacturer = await page.request.post(`${baseUrl}/api/manufacturers`, {
    headers,
    data: { name: `Lenovo ${hash}` },
  });
  expect(manufacturer.status()).toBe(201);
  const { id: manufacturerId } = (await manufacturer.json()) as { id: number };
  const template = await page.request.post(`${baseUrl}/api/model-templates`, {
    headers,
    data: {
      deviceTypeId: notebook.id,
      manufacturerId,
      modelName: `ThinkPad T14 ${hash}`,
      typeDesignation: '20W0',
      mpn: '20W000T9GE',
      mpnUnknown: false,
      originalEan: '',
      modelValues,
      defaultDeviceValues,
    },
  });
  expect(template.status()).toBe(201);
  return { modelName: `ThinkPad T14 ${hash}`, manufacturer: `Lenovo ${hash}` };
}

test.describe('UI-003 Gerät einbuchen (CU-132)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('AC-REQ-012-01 a notebook is captured from the navigation with every required device value and stored unassigned', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const wiNr = `E${hash}`.slice(0, 20);
    const { modelName, manufacturer } = await createNotebookTemplate(page, server.baseUrl, hash);
    await page.goto('/');

    await page.getByRole('navigation').getByRole('link', { name: 'Gerät einbuchen' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Gerät einbuchen' })).toBeVisible();
    await expect(field(page, 'WI-Nr')).toBeFocused();
    await field(page, 'WI-Nr').fill(wiNr);
    await form(page)
      .getByRole('searchbox', { name: /^Modellvorlage suchen/ })
      .fill(modelName);
    await page.getByRole('button', { name: new RegExp(`^${manufacturer} ${modelName}`) }).click();

    await field(page, 'Zustand').selectOption({ label: 'gebraucht' });
    await field(page, 'Optik-Note').fill('2');
    await field(page, 'RAM').fill('16');
    await field(page, 'Speicherkapazität').fill('512');
    await field(page, 'Tastaturlayout').selectOption({ label: 'Deutsch (QWERTZ)' });
    await field(page, 'Betriebssystem').selectOption({ label: 'Windows 11 Pro' });
    await field(page, 'Netzteil').selectOption({ label: 'mit Netzteil (original)' });
    await field(page, 'Akku').selectOption({ label: 'mit Akku' });
    await field(page, 'Akkukapazität').fill('87');
    await expectReachable(page);

    const created = page.waitForResponse(
      (answer) => answer.request().method() === 'POST' && answer.url().endsWith('/api/devices'),
    );
    await saveButton(page).click();

    const answer = await created;
    expect(answer.status()).toBe(201);
    await expect(page.getByText(`Gerät ${wiNr} gespeichert`)).toBeVisible();
    const { id } = (await answer.json()) as { id: number };
    const device = (await (
      await page.request.get(`${server.baseUrl}/api/devices/${id}`)
    ).json()) as {
      wiNr: string;
      stockStatus: string;
      listing: unknown;
      values: Record<string, unknown>;
    };
    expect(device).toMatchObject({ wiNr, stockStatus: 'available', listing: null });
    expect(Object.values(device.values)).toContainEqual({ percent: 87 });
  });

  test('AC-REQ-013-01 AC-REQ-013-04 prefilled values carry "zu prüfen" until confirmed, then the device is stored as checked', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const wiNr = `P${hash}`.slice(0, 20);
    const { modelName, manufacturer } = await createNotebookTemplate(page, server.baseUrl, hash, {
      RAM: 16,
      Speicherkapazität: 512,
    });
    await page.goto('/geraete/neu');
    await field(page, 'WI-Nr').fill(wiNr);
    await form(page)
      .getByRole('searchbox', { name: /^Modellvorlage suchen/ })
      .fill(modelName);
    await page.getByRole('button', { name: new RegExp(`^${manufacturer} ${modelName}`) }).click();

    await expect(field(page, 'RAM')).toHaveValue('16');
    await expect(field(page, 'Speicherkapazität')).toHaveValue('512');
    await expect(form(page).getByText('zu prüfen')).toHaveCount(2);
    await expect(
      page.getByRole('complementary', { name: 'Modelldaten (nur lesen)' }).getByText('zu prüfen'),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        'Noch 2 Werte zu prüfen. Das Gerät kann gespeichert, aber noch nicht zugeordnet werden.',
      ),
    ).toBeVisible();
    const assign = page.getByRole('button', { name: 'Speichern und zuordnen' });
    await expect(assign).toBeDisabled();
    await expect(assign).toHaveAttribute('title', 'Erst Werte prüfen');
    await expect(page.getByText('Erst Werte prüfen: RAM, Speicherkapazität')).toBeVisible();

    await page.getByRole('button', { name: 'RAM bestätigen' }).click();
    await expect(field(page, 'RAM')).toBeFocused();
    await field(page, 'Speicherkapazität').fill('256');
    await expect(page.getByText('Alle Werte geprüft.')).toBeVisible();
    await expect(form(page).getByText('zu prüfen')).toHaveCount(0);

    await field(page, 'Zustand').selectOption({ label: 'gebraucht' });
    await field(page, 'Optik-Note').fill('2');
    await field(page, 'Tastaturlayout').selectOption({ label: 'Deutsch (QWERTZ)' });
    await field(page, 'Betriebssystem').selectOption({ label: 'Windows 11 Pro' });
    await field(page, 'Netzteil').selectOption({ label: 'mit Netzteil (original)' });
    await field(page, 'Akku').selectOption({ label: 'ohne Akku' });
    await expectReachable(page);
    const created = page.waitForResponse(
      (answer) => answer.request().method() === 'POST' && answer.url().endsWith('/api/devices'),
    );
    await saveButton(page).click();

    const answer = await created;
    expect(answer.status()).toBe(201);
    expect(await answer.json()).toMatchObject({ captureStatus: 'checked', reviewKeys: [] });
  });

  test('R-1 below 1366 px the form stacks into one column and every field and action stays reachable (FM-3, FM-4)', async ({
    page,
  }, testInfo) => {
    test.skip(!REFLOW_ROWS.includes(testInfo.project.name), 'R-1 sample in FM-3 and FM-4');
    await page.goto('/geraete/neu');
    await expect(form(page)).toBeVisible();

    const formBox = await form(page).boundingBox();
    const cardBox = await form(page)
      .getByRole('region', { name: 'Gerät', exact: true })
      .boundingBox();
    expect(cardBox?.width).toBeCloseTo(formBox?.width ?? 0, 0);
    await expectReachable(page);
    await saveButton(page).click();
    await expect(field(page, 'WI-Nr')).toBeFocused();
    await expectReachable(page);
  });
});
