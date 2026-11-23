import type { Page } from '@playwright/test';

import { type AppServer, test as appTest, expect, workerServer } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

// A required attribute deactivated and activated again (REQ-005, Technical Specification 2.5,
// 6.2): UI-003 asks for it again, and UI-010 names its missing value with M-32 "<Merkmal> fehlt"
// on the state after the change (AC-REQ-005-11 part capture, AC-REQ-005-12 (b)).

/** The device types of this spec live on a server of their own, so other specs keep theirs. */
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
 * Creates through the API like the user interface (`local-guard` G-2, G-4) a device type
 * "Notebook <hash>" of its own with the required variant attribute RAM of the level device, a
 * manufacturer and a model template; returns what the steps need, with the id of "gebraucht".
 */
async function createNotebook(page: Page, baseUrl: string, hash: string) {
  const headers = { origin: baseUrl };
  const created = async <T>(path: string, data: unknown) => {
    const answer = await page.request.post(`${baseUrl}${path}`, { headers, data });
    expect(answer.status()).toBe(201);
    return (await answer.json()) as T;
  };
  const read = async <T>(path: string) =>
    (await (await page.request.get(`${baseUrl}${path}`)).json()) as T;

  const deviceTypeName = `Notebook ${hash}`;
  const deviceType = await created<{ id: number }>('/api/device-types', {
    name: deviceTypeName,
    active: true,
  });
  const ram = await created<{ id: number; version: number }>(
    `/api/device-types/${deviceType.id}/attributes`,
    {
      label: 'RAM',
      dataType: 'integer',
      unit: 'GB',
      unitSpacing: true,
      minValue: null,
      maxValue: null,
      pickListId: null,
      level: 'device',
      variantForming: true,
      required: true,
      datasheetBlock: 'technical',
      active: true,
    },
  );
  const manufacturer = `Lenovo ${hash}`;
  const { id: manufacturerId } = await created<{ id: number }>('/api/manufacturers', {
    name: manufacturer,
  });
  const modelName = `ThinkPad T14 ${hash}`;
  const template = await created<{ id: number }>('/api/model-templates', {
    deviceTypeId: deviceType.id,
    manufacturerId,
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
  return {
    deviceTypeId: deviceType.id,
    deviceTypeName,
    ram,
    templateId: template.id,
    modelName,
    templateLine: new RegExp(`^${manufacturer} ${modelName}`),
    usedId: used.id,
  };
}

/** Sets the flag "aktiv" of an attribute through the API like UI-027; returns the new version. */
async function setActive(
  page: Page,
  baseUrl: string,
  attribute: { id: number; version: number },
  active: boolean,
) {
  const answer = await page.request.patch(`${baseUrl}/api/attributes/${attribute.id}`, {
    headers: { origin: baseUrl },
    data: { version: attribute.version, active },
  });
  expect(answer.status()).toBe(200);
  return { id: attribute.id, version: ((await answer.json()) as { version: number }).version };
}

const intakeForm = (page: Page) => page.getByRole('form', { name: 'Gerät einbuchen' });
const valuesCard = (page: Page) => page.getByRole('form', { name: 'Gerätewerte' });
/** The control of a field by its label; "*" follows the label of a required field. */
const fieldIn = (form: ReturnType<Page['getByRole']>, name: string) =>
  form.getByLabel(new RegExp(`^${name}\\*?$`));
const ramRow = (page: Page) =>
  page
    .getByRole('region', { name: 'Merkmale' })
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'RAM', exact: true }) });

/** UI-027 with the device type `name` chosen. */
async function openDeviceType(page: Page, name: string) {
  await page.goto('/einstellungen/geraetearten');
  await page
    .getByRole('region', { name: 'Gerätearten' })
    .getByRole('button', { name: new RegExp(name) })
    .click();
  await expect(ramRow(page)).toBeVisible();
}

/** The text below a field, linked with `aria-describedby` (CU-057). */
async function errorOf(page: Page, control: ReturnType<Page['getByRole']>) {
  const id = await control.getAttribute('aria-describedby');
  return id === null ? null : page.locator(`[id="${id}"]`).textContent();
}

/**
 * UI-003 with WI-Nr entered and the model template chosen, once the attributes of its device type
 * are read and its device values are shown.
 */
async function openIntake(
  page: Page,
  wiNr: string,
  { deviceTypeId, modelName, templateLine }: Awaited<ReturnType<typeof createNotebook>>,
) {
  await page.goto('/geraete/neu');
  await fieldIn(intakeForm(page), 'WI-Nr').fill(wiNr);
  await intakeForm(page)
    .getByRole('searchbox', { name: /^Modellvorlage suchen/ })
    .fill(modelName);
  const attributesRead = page.waitForResponse((answer) =>
    answer.url().endsWith(`/api/device-types/${deviceTypeId}/attributes`),
  );
  await page.getByRole('button', { name: templateLine }).click();
  await attributesRead;
  await expect(fieldIn(intakeForm(page), 'Optik-Note')).toBeVisible();
}

test.describe('REQ-005 attribute activated again (M-32, CU-111, CU-132, CU-137)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    test.skip(!FRAME_ROWS.includes(testInfo.project.name), 'full frame only');
  });

  test('AC-REQ-005-11 RAM deactivated in UI-027 is no longer asked for in UI-003; activated again, UI-003 asks for RAM again as required field "*"', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const notebook = await createNotebook(page, server.baseUrl, hash);
    const wiNr = `R${hash}`.slice(0, 20);

    await openDeviceType(page, notebook.deviceTypeName);
    await ramRow(page).getByRole('button', { name: 'Deaktivieren' }).click();
    await expect(ramRow(page).getByText('deaktiviert')).toBeVisible();

    await openIntake(page, wiNr, notebook);
    await expect(fieldIn(intakeForm(page), 'RAM')).toHaveCount(0);

    await openDeviceType(page, notebook.deviceTypeName);
    await ramRow(page).getByRole('button', { name: 'Wieder aktivieren' }).click();
    await expect(ramRow(page).getByText('aktiv', { exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Merkmal aktiviert' })).toBeVisible();

    await openIntake(page, wiNr, notebook);
    const ram = fieldIn(intakeForm(page), 'RAM');
    await expect(ram).toBeVisible();
    await expect(ram).toHaveValue('');
    await expect(ram).toHaveAttribute('aria-required', 'true');
    await expect(intakeForm(page).locator('label', { hasText: /^RAM\*$/ })).toBeVisible();
    await expectReachable(page);
  });

  test('AC-REQ-005-12 a device captured without RAM while RAM was deactivated: changing only the visual grade in UI-010 names "RAM fehlt" at RAM, saved after entering RAM', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const notebook = await createNotebook(page, server.baseUrl, hash);
    const deactivated = await setActive(page, server.baseUrl, notebook.ram, false);
    const answer = await page.request.post(`${server.baseUrl}/api/devices`, {
      headers: { origin: server.baseUrl },
      data: {
        wiNr: `V${hash}`.slice(0, 20),
        supplierId: null,
        modelTemplateId: notebook.templateId,
        conditionValueId: notebook.usedId,
        visualGrade: '2',
        conditionDescription: '',
        values: {},
        confirmedKeys: [],
      },
    });
    expect(answer.status()).toBe(201);
    const { id } = (await answer.json()) as { id: number };
    await setActive(page, server.baseUrl, deactivated, true);
    const patches: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().endsWith(`/api/devices/${id}`)) {
        patches.push(request.url());
      }
    });

    await page.goto(`/geraete/${id}`);
    const ram = fieldIn(valuesCard(page), 'RAM');
    await expect(ram).toHaveValue('');
    await fieldIn(valuesCard(page), 'Optik-Note').fill('3');
    await page.getByRole('button', { name: 'Gerätewerte speichern' }).click();

    await expect(ram).toHaveAttribute('aria-invalid', 'true');
    expect(await errorOf(page, ram)).toBe('RAM fehlt');
    await expect(ram).toBeFocused();
    await expect(fieldIn(valuesCard(page), 'Optik-Note')).toHaveValue('3');
    expect(patches).toEqual([]);
    await expectReachable(page);

    await ram.fill('16');
    await page.getByRole('button', { name: 'Gerätewerte speichern' }).click();

    await expect(page.getByText('Gerät gespeichert')).toBeVisible();
    const stored = (await (
      await page.request.get(`${server.baseUrl}/api/devices/${id}`)
    ).json()) as {
      visualGrade: number;
      values: Record<string, unknown>;
    };
    expect(stored.visualGrade).toBe(3);
    expect(stored.values[String(notebook.ram.id)]).toBe(16);
  });
});
