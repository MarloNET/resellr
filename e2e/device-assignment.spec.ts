import type { Page } from '@playwright/test';

import { type AppServer, test as appTest, expect, workerServer } from './fixtures/app-fixture.ts';

/** The devices of this spec live on a server of their own, so other specs keep their lists. */
const test = appTest.extend<object, { server: AppServer }>({
  server: [workerServer, { scope: 'worker' }],
});

/** The server keeps its data per worker: each test uses its own names. */
function uniqueHash(title: string, project: string) {
  let hash = 0;
  for (const char of `${title}${project}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/**
 * The API as the user interface calls it (`local-guard` G-2, G-4): a write with the own origin
 * expecting `status`, a read.
 */
function apiOf(page: Page, baseUrl: string) {
  return {
    async write<T>(path: string, data: unknown, status = 201) {
      const answer = await page.request.post(`${baseUrl}${path}`, {
        headers: { origin: baseUrl },
        data,
      });
      expect(answer.status(), await answer.text()).toBe(status);
      return (await answer.json()) as T;
    },
    async read<T>(path: string) {
      const answer = await page.request.get(`${baseUrl}${path}`);
      expect(answer.status()).toBe(200);
      return (await answer.json()) as T;
    },
  };
}

/**
 * A model template of a device type without attributes, so a device needs only condition and
 * visual grade, and `capture` for its devices; with `ram` the device type has the variant
 * attribute RAM (integer, GB, level device, optional), whose ID is `ramId`.
 */
async function setUpTemplate(
  api: ReturnType<typeof apiOf>,
  hash: string,
  { ram = false }: { ram?: boolean } = {},
) {
  const deviceType = await api.write<{ id: number }>('/api/device-types', {
    name: `Zuordnung ${hash}`,
    active: true,
  });
  const ramAttribute = ram
    ? await api.write<{ id: number }>(`/api/device-types/${deviceType.id}/attributes`, {
        label: 'RAM',
        dataType: 'integer',
        unit: 'GB',
        unitSpacing: true,
        minValue: null,
        maxValue: null,
        pickListId: null,
        level: 'device',
        variantForming: true,
        required: false,
        datasheetBlock: 'technical',
        active: true,
      })
    : undefined;
  const manufacturer = await api.write<{ id: number }>('/api/manufacturers', {
    name: `Hersteller ${hash}`,
  });
  const template = await api.write<{ id: number }>('/api/model-templates', {
    deviceTypeId: deviceType.id,
    manufacturerId: manufacturer.id,
    modelName: `Modell ${hash}`,
    typeDesignation: '',
    mpn: null,
    mpnUnknown: true,
    originalEan: '',
    modelValues: {},
    defaultDeviceValues: {},
  });
  const { items: pickLists } = await api.read<{ items: { id: number; key: string }[] }>(
    '/api/pick-lists?limit=200',
  );
  const conditionList = pickLists.find(({ key }) => key === 'condition');
  if (conditionList === undefined) throw new Error('Zustand is missing');
  const { items: conditions } = await api.read<{ items: { id: number; label: string }[] }>(
    `/api/pick-lists/${conditionList.id}/values?limit=200`,
  );
  const used = conditions.find(({ label }) => label === 'gebraucht');
  if (used === undefined) throw new Error('gebraucht is missing');
  const capture = (wiNr: string, visualGrade = '2', values: Record<string, unknown> = {}) =>
    api.write<{ id: number; version: number }>('/api/devices', {
      wiNr,
      supplierId: null,
      modelTemplateId: template.id,
      conditionValueId: used.id,
      visualGrade,
      conditionDescription: '',
      values,
      confirmedKeys: [],
    });
  return { template, capture, ramId: ramAttribute?.id };
}

test.describe('FLOW-02 Zuordnen ohne Abweichung (CU-123, CU-294; Technical Specification 2.6)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    // The flow runs through the API only and does not depend on the window size.
    test.skip(testInfo.project.name !== 'FM-1', 'API flow, checked once');
  });

  test('AC-REQ-017-01 FLOW-02 steps 1 to 3: a second device of the model template without deviation is assigned to MI-A, whose quantity rises from 1 to 2', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const api = apiOf(page, server.baseUrl);

    const { template, capture } = await setUpTemplate(api, hash);

    // MI-A with quantity 1 from the first device.
    const first = await capture(`A${hash}`.slice(0, 20));
    const miA = await api.write<{ id: number; quantity: number }>('/api/listings', {
      fromDeviceId: first.id,
      deviceVersion: first.version,
    });
    expect(miA.quantity).toBe(1);

    // Step 1 and 2: the next device is captured; step 3: UI-004 lists MI-A, "Zuordnen".
    const second = await capture(`B${hash}`.slice(0, 20));
    const choice = await api.read<{ items: { id: number; quantity: number }[] }>(
      `/api/model-templates/${template.id}/listings`,
    );
    expect(choice.items).toEqual([expect.objectContaining({ id: miA.id, quantity: 1 })]);
    const assignment = await api.write<{
      listing: { id: number; quantity: number };
      adjustStockChannels: number[];
    }>(
      `/api/devices/${second.id}/assignment`,
      { version: second.version, listingId: miA.id, confirmDeviation: false },
      200,
    );

    expect(assignment.listing).toEqual({ id: miA.id, quantity: 2 });
    expect(assignment.adjustStockChannels).toEqual([]);
    const device = await api.read<{ listing: { id: number } | null }>(`/api/devices/${second.id}`);
    expect(device.listing?.id).toBe(miA.id);
    const after = await api.read<{ items: { id: number; quantity: number }[] }>(
      `/api/model-templates/${template.id}/listings`,
    );
    expect(after.items).toEqual([expect.objectContaining({ id: miA.id, quantity: 2 })]);
  });
});

test.describe('FLOW-02 Zuordnen mit Abweichung (CU-123, CU-119, REQ-018; Technical Specification 2.6)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    // The flow runs through the API only and does not depend on the window size; UI-005 has no
    // entry in a screen yet (UI-004 is mounted by a later task), its states are component tests.
    test.skip(testInfo.project.name !== 'FM-1', 'API flow, checked once');
  });

  test('AC-REQ-018-02 FLOW-02 with deviation: "Zuordnen" answers variant_deviation, "Trotzdem zuordnen" assigns to MI-A, whose visual grade stays 2', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const api = apiOf(page, server.baseUrl);
    const { template, capture } = await setUpTemplate(api, hash);
    const first = await capture(`A${hash}`.slice(0, 20));
    const miA = await api.write<{ id: number }>('/api/listings', {
      fromDeviceId: first.id,
      deviceVersion: first.version,
    });
    const second = await capture(`B${hash}`.slice(0, 20), '4');

    // UI-004 "Zuordnen": the question of UI-005, nothing is stored.
    const question = await page.request.post(
      `${server.baseUrl}/api/devices/${second.id}/assignment`,
      {
        headers: { origin: server.baseUrl },
        data: { version: second.version, listingId: miA.id, confirmDeviation: false },
      },
    );
    expect(question.status()).toBe(422);
    expect((await question.json()).error).toMatchObject({
      code: 'confirmation_required',
      message: 'Das Gerät weicht vom Modell-Inserat ab.',
      details: {
        kind: 'variant_deviation',
        deviations: [
          { key: 'visualGrade', label: 'Optik-Note', deviceValue: '4', listingValue: '2' },
        ],
      },
    });
    // The data of UI-005: MI-A with its deviation to the device.
    const targets = await api.read<{ items: { id: number; deviations: unknown[] }[] }>(
      `/api/model-templates/${template.id}/listings?deviceId=${second.id}`,
    );
    expect(targets.items).toEqual([
      expect.objectContaining({
        id: miA.id,
        deviations: [expect.objectContaining({ key: 'visualGrade' })],
      }),
    ]);

    // UI-005 "Trotzdem zuordnen".
    const assignment = await api.write<{ listing: { id: number; quantity: number } }>(
      `/api/devices/${second.id}/assignment`,
      { version: second.version, listingId: miA.id, confirmDeviation: true },
      200,
    );

    expect(assignment.listing).toEqual({ id: miA.id, quantity: 2 });
    const after = await api.read<{
      items: { id: number; quantity: number; variantSummary: { visualGrade: number } }[];
    }>(`/api/model-templates/${template.id}/listings`);
    expect(after.items).toEqual([
      expect.objectContaining({
        id: miA.id,
        quantity: 2,
        variantSummary: expect.objectContaining({ visualGrade: 2 }),
      }),
    ]);
  });
});

test.describe('FLOW-02 Neues Modell-Inserat aus der Abweichungsanzeige (CU-123, CU-135, REQ-019; Technical Specification 2.6)', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  test.beforeEach(({}, testInfo) => {
    // The flow runs through the API only and does not depend on the window size; UI-004 and
    // UI-005 have no entry in a screen yet, their states are component tests.
    test.skip(testInfo.project.name !== 'FM-1', 'API flow, checked once');
  });

  test('AC-REQ-019-05 a device with RAM 8 GB deviates from MI-A with RAM 16 GB; "Neues Modell-Inserat anlegen" in UI-005 creates a second model listing of MV-A with RAM 8 GB', async ({
    page,
    server,
  }, testInfo) => {
    const hash = uniqueHash(testInfo.title, testInfo.project.name);
    const api = apiOf(page, server.baseUrl);
    const { template, capture, ramId } = await setUpTemplate(api, hash, { ram: true });
    const ram = String(ramId);

    // MI-A of MV-A with RAM 16 GB.
    const first = await capture(`A${hash}`.slice(0, 20), '2', { [ram]: '16' });
    const miA = await api.write<{ id: number; variantValues: Record<string, unknown> }>(
      '/api/listings',
      { fromDeviceId: first.id, deviceVersion: first.version },
    );
    expect(miA.variantValues).toEqual({ [ram]: 16 });

    // UI-004 "Zuordnen" of a device with RAM 8 GB: UI-005 with the deviation, nothing is stored.
    const second = await capture(`B${hash}`.slice(0, 20), '2', { [ram]: '8' });
    const question = await page.request.post(
      `${server.baseUrl}/api/devices/${second.id}/assignment`,
      {
        headers: { origin: server.baseUrl },
        data: { version: second.version, listingId: miA.id, confirmDeviation: false },
      },
    );
    expect(question.status()).toBe(422);
    expect((await question.json()).error).toMatchObject({
      code: 'confirmation_required',
      details: {
        kind: 'variant_deviation',
        deviations: [{ key: ram, label: 'RAM', deviceValue: '8 GB', listingValue: '16 GB' }],
      },
    });
    // The data of UI-005: the device deviates from every model listing, so "Neues
    // Modell-Inserat anlegen" is available.
    const targets = await api.read<{ items: { id: number; deviations: unknown[] }[] }>(
      `/api/model-templates/${template.id}/listings?deviceId=${second.id}`,
    );
    expect(targets.items.every(({ deviations }) => deviations.length > 0)).toBe(true);

    // UI-005 "Neues Modell-Inserat anlegen" sends the creation of UI-004.
    const created = await api.write<{
      id: number;
      modelTemplateId: number;
      variantValues: Record<string, unknown>;
      quantity: number;
    }>('/api/listings', { fromDeviceId: second.id, deviceVersion: second.version });

    expect(created).toMatchObject({
      modelTemplateId: template.id,
      variantValues: { [ram]: 8 },
      quantity: 1,
    });
    expect(created.id).not.toBe(miA.id);
    const device = await api.read<{ listing: { id: number } | null }>(`/api/devices/${second.id}`);
    expect(device.listing?.id).toBe(created.id);
    const after = await api.read<{ items: { id: number; quantity: number }[] }>(
      `/api/model-templates/${template.id}/listings`,
    );
    expect(after.items).toHaveLength(2);
    expect(after.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: miA.id, quantity: 1 }),
        expect.objectContaining({ id: created.id, quantity: 1 }),
      ]),
    );
    // The unshortened shop title "Apple MacBook Pro 13 (A1989), intel Core i5-8279U, 8GB RAM,
    // 512GB Space Gray" comes with the title formation per channel from S5 (#66, 2.8.2); until
    // then the display title is the model name (MAR-1053) and this test checks the creation.
  });
});
