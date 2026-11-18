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

    // A model template of a device type without attributes, so a device needs only condition
    // and visual grade.
    const deviceType = await api.write<{ id: number }>('/api/device-types', {
      name: `Zuordnung ${hash}`,
      active: true,
    });
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
    const capture = (wiNr: string) =>
      api.write<{ id: number; version: number }>('/api/devices', {
        wiNr,
        supplierId: null,
        modelTemplateId: template.id,
        conditionValueId: used.id,
        visualGrade: '2',
        conditionDescription: '',
        values: {},
        confirmedKeys: [],
      });

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
