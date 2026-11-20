import { createServer, type IncomingMessage, type Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDemoApi,
  type DemoApi,
  SEED_AREAS,
  seedDatasheetLayout,
  seedAssignments,
  seedDevices,
  seedListings,
  seedDeviceTypes,
  seedDemoData,
  seedManufacturers,
  seedModelTemplates,
  type SeedArea,
  seedMerchantProfile,
  seedSuppliers,
  seedTextBlocks,
} from './demo-seed.ts';

interface Received {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

describe('createDemoApi', () => {
  let server: Server;
  let baseUrl: string;
  const received: Received[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk: Buffer) => (body += chunk.toString()));
      request.on('end', () => {
        received.push({
          method: request.method ?? '',
          url: request.url ?? '',
          headers: request.headers,
          body,
        });
        response.setHeader('content-type', 'application/json');
        if (request.url === '/api/conflict') {
          response.statusCode = 409;
          response.end(JSON.stringify({ error: { code: 'version_conflict' } }));
        } else if (request.url === '/api/html-error') {
          response.statusCode = 502;
          response.setHeader('content-type', 'text/html');
          response.end('<html>Bad Gateway</html>');
        } else if (request.url === '/api/empty') {
          response.statusCode = 204;
          response.end();
        } else {
          response.end(JSON.stringify({ id: 7 }));
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sends a write with the own origin and JSON, like the user interface (G-2, G-4)', async () => {
    received.length = 0;
    const api = createDemoApi(baseUrl);

    const answer = await api.request('POST', '/api/manufacturers', { name: 'Lenovo' });

    expect(answer).toEqual({ id: 7 });
    const [request] = received;
    expect(request?.headers.host).toBe(baseUrl.slice('http://'.length));
    expect(request?.headers.origin).toBe(baseUrl);
    expect(request?.headers['content-type']).toBe('application/json');
    expect(request?.headers['sec-fetch-site']).toBeUndefined();
    expect(JSON.parse(request?.body ?? '')).toEqual({ name: 'Lenovo' });
  });

  it('sends a read without origin and body', async () => {
    received.length = 0;

    await createDemoApi(baseUrl).request('GET', '/api/ops/status');

    expect(received[0]?.headers.origin).toBeUndefined();
    expect(received[0]?.body).toBe('');
  });

  it('returns undefined for an answer without content', async () => {
    await expect(createDemoApi(baseUrl).request('DELETE', '/api/empty')).resolves.toBeUndefined();
  });

  it('throws for an answer other than 2xx with method, path, status and error code', async () => {
    await expect(createDemoApi(baseUrl).request('PATCH', '/api/conflict', {})).rejects.toThrow(
      'PATCH /api/conflict failed with 409 version_conflict',
    );
  });

  it('throws with method, path and status for an error answer that is no JSON', async () => {
    await expect(createDemoApi(baseUrl).request('GET', '/api/html-error')).rejects.toThrow(
      'GET /api/html-error failed with 502 unknown',
    );
  });

  it('refuses localhost, which local-guard rejects (G-1)', () => {
    expect(() => createDemoApi('http://localhost:4310')).toThrow('needs 127.0.0.1');
  });
});

/** Attributes of the device type Notebook as the demo devices use them. */
const ATTRIBUTES = [
  { id: 14, label: 'RAM', pickListId: null },
  { id: 15, label: 'Speicherkapazität', pickListId: null },
  { id: 16, label: 'Tastaturlayout', pickListId: 11 },
  { id: 13, label: 'Betriebssystem', pickListId: 13 },
  { id: 17, label: 'Netzteil', pickListId: 12 },
  { id: 18, label: 'Akku', pickListId: 10 },
  { id: 19, label: 'Akkukapazität', pickListId: null },
];
/** The answers of the reads of `seedDevices` and `seedAssignments` by path. */
const DEVICE_LISTS: Record<string, unknown> = {
  '/api/model-templates?limit=200': {
    items: [
      { id: 1, modelName: 'ThinkPad E15 Gen 2', deviceType: { id: 1 } },
      { id: 2, modelName: 'ThinkPad T14 Gen 2', deviceType: { id: 1 } },
      { id: 3, modelName: 'EliteBook 840 G8', deviceType: { id: 1 } },
    ],
  },
  '/api/suppliers?limit=200': {
    items: [
      { id: 4, name: 'Lieferant A' },
      { id: 5, name: 'Lieferant B' },
    ],
  },
  '/api/pick-lists?limit=200': {
    items: [
      { id: 1, key: 'condition' },
      { id: 10, key: 'battery' },
    ],
  },
  '/api/pick-lists/1/values?limit=200': {
    items: [
      { id: 21, label: 'gebraucht' },
      { id: 22, label: 'defekt' },
    ],
  },
  '/api/device-types/1/attributes': { items: ATTRIBUTES },
  '/api/pick-lists/10/values?limit=200': {
    items: [
      { id: 101, label: 'mit Akku' },
      { id: 102, label: 'mit Akku (defekt)' },
      { id: 103, label: 'ohne Akku' },
    ],
  },
  '/api/pick-lists/11/values?limit=200': {
    items: [
      { id: 111, label: 'Deutsch (QWERTZ)' },
      { id: 112, label: 'Englisch (QWERTY, US)' },
    ],
  },
  '/api/pick-lists/13/values?limit=200': {
    items: [
      { id: 131, label: 'Windows 11 Pro' },
      { id: 132, label: 'Windows 11 Home' },
      { id: 133, label: 'Windows 10 Pro' },
    ],
  },
  '/api/pick-lists/12/values?limit=200': {
    items: [
      { id: 121, label: 'mit Netzteil (original)' },
      { id: 122, label: 'mit Netzteil (nicht original)' },
      { id: 123, label: 'ohne Netzteil' },
    ],
  },
};

describe('seedDemoData', () => {
  const api: DemoApi = {
    baseUrl: 'http://127.0.0.1:4310',
    request: () => Promise.reject(new Error('not called')),
  };

  it('runs the areas of the build steps in their order: S2 device types, suppliers, manufacturers, merchant profile, text blocks and datasheet layout, S3 model templates, then S4 devices, model listings and assignments', () => {
    expect(SEED_AREAS).toEqual([
      seedDeviceTypes,
      seedSuppliers,
      seedManufacturers,
      seedMerchantProfile,
      seedTextBlocks,
      seedDatasheetLayout,
      seedModelTemplates,
      seedDevices,
      seedListings,
      seedAssignments,
    ]);
  });

  it('creates the demo model listing through POST /api/listings from device "626198" on the version read', async () => {
    const requests: unknown[][] = [];
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (method: string, path: string, body?: unknown) => {
        requests.push([method, path, body]);
        if (path === '/api/devices?wiNr=626198') {
          return {
            items: [
              { id: 7, wiNr: '6261980' },
              { id: 5, wiNr: '626198' },
            ],
          } as never;
        }
        if (path === '/api/devices/5') return { id: 5, version: 3 } as never;
        return { id: 9 } as never;
      },
    };

    await seedListings(recording);

    expect(requests).toEqual([
      ['GET', '/api/devices?wiNr=626198', undefined],
      ['GET', '/api/devices/5', undefined],
      ['POST', '/api/listings', { fromDeviceId: 5, deviceVersion: 3 }],
    ]);
  });

  it('captures the demo device "626200" and assigns it through POST /api/devices/{id}/assignment to the model listing of "626198" on the version of its answer', async () => {
    const requests: unknown[][] = [];
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (method: string, path: string, body?: unknown) => {
        if (path === '/api/devices?wiNr=626198') {
          return {
            items: [
              { id: 7, wiNr: '6261980', listing: null },
              { id: 5, wiNr: '626198', listing: { id: 9, title: 'ThinkPad T14 Gen 2' } },
            ],
          } as never;
        }
        if (method === 'GET') return DEVICE_LISTS[path] as never;
        requests.push([method, path, body]);
        return { id: 12, version: 1 } as never;
      },
    };

    await seedAssignments(recording);

    expect(requests).toEqual([
      [
        'POST',
        '/api/devices',
        {
          wiNr: '626200',
          supplierId: 4,
          modelTemplateId: 2,
          conditionValueId: 21,
          visualGrade: 2,
          conditionDescription: 'Leichte Gebrauchsspuren am Deckel',
          values: { 13: 131, 14: 16, 15: 512, 16: 111, 17: 121, 18: 101, 19: { percent: 79 } },
          confirmedKeys: [],
        },
      ],
      ['POST', '/api/devices/12/assignment', { version: 1, listingId: 9 }],
    ]);
  });

  it('stops with the WI-Nr when the demo model listing to assign to is missing', async () => {
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async () => ({ items: [{ id: 5, wiNr: '626198', listing: null }] }) as never,
    };

    await expect(seedAssignments(recording)).rejects.toThrow(
      'Demo data: model listing of 626198 is missing',
    );
  });

  it('stops with the WI-Nr when the demo device is missing', async () => {
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async () => ({ items: [] }) as never,
    };

    await expect(seedListings(recording)).rejects.toThrow('Demo data: device 626198 is missing');
  });

  it('captures the demo devices through POST /api/devices with the ids of model template, supplier, condition and pick list values', async () => {
    const requests: unknown[][] = [];
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (method: string, path: string, body?: unknown) => {
        if (method !== 'GET') requests.push([method, path, body]);
        return (method === 'GET' ? DEVICE_LISTS[path] : { id: requests.length }) as never;
      },
    };

    await seedDevices(recording);

    expect(requests).toEqual([
      [
        'POST',
        '/api/devices',
        {
          wiNr: '626198',
          supplierId: 4,
          modelTemplateId: 2,
          conditionValueId: 21,
          visualGrade: 2,
          conditionDescription: 'Leichte Gebrauchsspuren am Deckel',
          values: { 13: 131, 14: 16, 15: 512, 16: 111, 17: 121, 18: 101, 19: { percent: 87 } },
          confirmedKeys: [],
        },
      ],
      [
        'POST',
        '/api/devices',
        {
          wiNr: 'A637607',
          supplierId: null,
          modelTemplateId: 1,
          conditionValueId: 21,
          visualGrade: 3,
          conditionDescription: '',
          values: { 13: 133, 14: 8, 15: 256, 16: 111, 17: 123, 18: 103 },
          confirmedKeys: [],
        },
      ],
      [
        'POST',
        '/api/devices',
        {
          wiNr: '626199',
          supplierId: 5,
          modelTemplateId: 3,
          conditionValueId: 22,
          visualGrade: 4,
          conditionDescription: 'Display mit Pixelfehlern',
          values: {
            13: 132,
            14: 16,
            15: 512,
            16: 112,
            17: 122,
            18: 102,
            19: { notDeterminable: true },
          },
          confirmedKeys: [],
        },
      ],
    ]);
  });

  it('stops with the name when a demo model template is missing', async () => {
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (_method: string, path: string) =>
        (path === '/api/pick-lists?limit=200'
          ? { items: [{ id: 1, key: 'condition' }] }
          : { items: [] }) as never,
    };

    await expect(seedDevices(recording)).rejects.toThrow(
      'Demo data: ThinkPad T14 Gen 2 is missing',
    );
  });

  it('creates the demo model templates through POST /api/model-templates with the ids of device type and manufacturer', async () => {
    const requests: unknown[][] = [];
    const lists: Record<string, unknown> = {
      '/api/device-types?limit=200': {
        items: [
          { id: 1, name: 'Notebook' },
          { id: 2, name: 'PC/Mini-PC' },
        ],
      },
      '/api/manufacturers?limit=200': {
        items: [
          { id: 11, name: 'Lenovo' },
          { id: 12, name: 'HP' },
          { id: 13, name: 'Fujitsu' },
        ],
      },
      '/api/device-types/1/attributes': {
        items: [
          { id: 101, label: 'Prozessor' },
          { id: 102, label: 'Displaygröße' },
        ],
      },
      '/api/device-types/2/attributes': { items: [{ id: 201, label: 'Prozessor' }] },
    };
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (method: string, path: string, body?: unknown) => {
        requests.push(body === undefined ? [method, path] : [method, path, body]);
        return (method === 'GET' ? lists[path] : { id: requests.length }) as never;
      },
    };

    await seedModelTemplates(recording);

    expect(requests).toEqual([
      ['GET', '/api/device-types?limit=200'],
      ['GET', '/api/manufacturers?limit=200'],
      ['GET', '/api/device-types/1/attributes'],
      [
        'POST',
        '/api/model-templates',
        {
          deviceTypeId: 1,
          manufacturerId: 11,
          modelName: 'ThinkPad E15 Gen 2',
          typeDesignation: '20TD',
          mpn: '20TD002MGE',
          mpnUnknown: false,
          originalEan: '',
          modelValues: { 101: 'Intel Core i5-1135G7', 102: '15.6' },
          defaultDeviceValues: {},
        },
      ],
      ['GET', '/api/device-types/1/attributes'],
      [
        'POST',
        '/api/model-templates',
        {
          deviceTypeId: 1,
          manufacturerId: 11,
          modelName: 'ThinkPad T14 Gen 2',
          typeDesignation: '20W0',
          mpn: '20W000T9GE',
          mpnUnknown: false,
          originalEan: '2000000177007',
          modelValues: { 101: 'Intel Core i5-1145G7', 102: '14' },
          defaultDeviceValues: {},
        },
      ],
      ['GET', '/api/device-types/1/attributes'],
      [
        'POST',
        '/api/model-templates',
        {
          deviceTypeId: 1,
          manufacturerId: 12,
          modelName: 'EliteBook 840 G8',
          typeDesignation: '',
          mpn: '6FY52AV',
          mpnUnknown: false,
          originalEan: '',
          modelValues: { 101: 'Intel Core i5-1135G7', 102: '14' },
          defaultDeviceValues: {},
        },
      ],
      ['GET', '/api/device-types/2/attributes'],
      [
        'POST',
        '/api/model-templates',
        {
          deviceTypeId: 2,
          manufacturerId: 13,
          modelName: 'Esprimo Q957',
          typeDesignation: '',
          mpn: null,
          mpnUnknown: true,
          originalEan: '',
          modelValues: { 201: 'Intel Core i5-7500T' },
          defaultDeviceValues: {},
        },
      ],
    ]);
  });

  it('stops with the name when a demo manufacturer is missing', async () => {
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async () => ({ items: [] }) as never,
    };

    await expect(seedModelTemplates(recording)).rejects.toThrow('Demo data: Notebook is missing');
  });

  it('creates the demo device types through POST /api/device-types', async () => {
    const requests: unknown[][] = [];
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (...args: unknown[]) => {
        requests.push(args);
        return undefined as never;
      },
    };

    await seedDeviceTypes(recording);

    expect(requests).toEqual([
      ['POST', '/api/device-types', { name: 'Beamer', active: true }],
      ['POST', '/api/device-types', { name: 'Drucker', active: false }],
    ]);
  });

  it('creates the demo suppliers through POST /api/suppliers', async () => {
    const requests: unknown[][] = [];
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (...args: unknown[]) => {
        requests.push(args);
        return undefined as never;
      },
    };

    await seedSuppliers(recording);

    expect(requests).toEqual([
      ['POST', '/api/suppliers', { name: 'Lieferant A', active: true }],
      ['POST', '/api/suppliers', { name: 'Lieferant B', active: true }],
      ['POST', '/api/suppliers', { name: 'Lieferant C', active: false }],
    ]);
  });

  it('creates the demo manufacturers through POST /api/manufacturers and deactivates Toshiba', async () => {
    const requests: unknown[][] = [];
    let id = 0;
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (...args: unknown[]) => {
        requests.push(args);
        id += 1;
        return { id, version: 1 } as never;
      },
    };

    await seedManufacturers(recording);

    expect(requests).toEqual([
      ['POST', '/api/manufacturers', { name: 'Lenovo' }],
      ['POST', '/api/manufacturers', { name: 'HP' }],
      ['POST', '/api/manufacturers', { name: 'Fujitsu' }],
      ['POST', '/api/manufacturers', { name: 'Toshiba' }],
      ['PATCH', '/api/manufacturers/4', { version: 1, active: false }],
    ]);
  });

  it('saves the demo merchant profile through PUT /api/merchant-profile on the version read', async () => {
    const requests: unknown[][] = [];
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (...args: unknown[]) => {
        requests.push(args);
        return { version: 1 } as never;
      },
    };

    await seedMerchantProfile(recording);

    expect(requests).toEqual([
      ['GET', '/api/merchant-profile'],
      [
        'PUT',
        '/api/merchant-profile',
        {
          version: 1,
          brandName: 'Demo-Händler',
          contactText: 'Demo-Händler GmbH\nMusterstraße 1\n12345 Musterstadt\nTel. 0000 000000',
        },
      ],
    ]);
  });

  it('saves the demo datasheet layout through PUT /api/datasheet-layout on the state read, with "Anschlüsse" before "Technik"', async () => {
    const requests: unknown[][] = [];
    const read = {
      version: 1,
      headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:'],
      blockOrder: [
        'identification',
        'condition',
        'delivery_scope',
        'technical',
        'ports',
        'software',
      ],
      attributeOrder: { '1': [3, 4] },
    };
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (...args: unknown[]) => {
        requests.push(args);
        return read as never;
      },
    };

    await seedDatasheetLayout(recording);

    expect(requests).toEqual([
      ['GET', '/api/datasheet-layout'],
      [
        'PUT',
        '/api/datasheet-layout',
        {
          version: 1,
          headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:'],
          blockOrder: [
            'identification',
            'condition',
            'delivery_scope',
            'ports',
            'technical',
            'software',
          ],
          attributeOrder: { '1': [3, 4] },
        },
      ],
    ]);
  });

  it('creates the demo text blocks through POST /api/text-blocks and deactivates "Hinweis Zubehör"', async () => {
    const requests: unknown[][] = [];
    let id = 0;
    const recording: DemoApi = {
      baseUrl: 'http://127.0.0.1:4310',
      request: async (...args: unknown[]) => {
        requests.push(args);
        id += 1;
        return { textBlock: { id, version: 1 } } as never;
      },
    };

    await seedTextBlocks(recording);

    expect(requests.map(([method, path]) => `${method} ${path}`)).toEqual([
      'POST /api/text-blocks',
      'POST /api/text-blocks',
      'POST /api/text-blocks',
      'POST /api/text-blocks',
      'PATCH /api/text-blocks/4',
    ]);
    expect(requests[0]?.[2]).toEqual({
      name: 'Akku-Hinweis',
      kind: 'battery_notice',
      body: 'Die Akkukapazität beträgt {Akkukapazität}. Bei gebrauchten Akkus ist eine verringerte Laufzeit normal.',
      allDeviceTypes: true,
      deviceTypeIds: [],
      allChannels: true,
      channelIds: [],
    });
    expect(requests[4]?.[2]).toEqual({ version: 1, active: false });
  });

  it('runs the seed functions one after the other in list order with the API', async () => {
    const calls: string[] = [];
    const area =
      (name: string): SeedArea =>
      async (target) => {
        calls.push(`${name} start ${target.baseUrl}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        calls.push(`${name} end`);
      };

    await seedDemoData(api, [area('settings'), area('catalog')]);

    expect(calls).toEqual([
      'settings start http://127.0.0.1:4310',
      'settings end',
      'catalog start http://127.0.0.1:4310',
      'catalog end',
    ]);
  });

  it('stops at the first area that fails', async () => {
    const calls: string[] = [];
    const failing: SeedArea = async () => {
      calls.push('settings');
      throw new Error('POST /api/x failed with 422 validation_failed');
    };
    const next: SeedArea = async () => {
      calls.push('catalog');
    };

    await expect(seedDemoData(api, [failing, next])).rejects.toThrow('422 validation_failed');
    expect(calls).toEqual(['settings']);
  });
});
