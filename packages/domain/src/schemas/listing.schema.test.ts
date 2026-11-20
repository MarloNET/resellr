import { describe, expect, it } from 'vitest';

import {
  deviceAssignmentBodySchema,
  listingCreateBodySchema,
  listingDetailQuerySchema,
  listingDetailSchema,
  listingUpdateBodySchema,
  listingValuesSchema,
  toArticleNumberKey,
} from './listing.schema.ts';

const RULE = 'Artikelnummer: 1 bis 30 Zeichen, nur Buchstaben, Ziffern und „-“';

describe('listingCreateBodySchema (CU-116, Technical Specification 2.6)', () => {
  it('takes a device with its version, with or without an article number', () => {
    expect(listingCreateBodySchema.parse({ fromDeviceId: 41, deviceVersion: 1 })).toEqual({
      fromDeviceId: 41,
      deviceVersion: 1,
    });
    expect(
      listingCreateBodySchema.parse({ fromDeviceId: 41, deviceVersion: 2, articleNumber: 'MI-A2' }),
    ).toEqual({ fromDeviceId: 41, deviceVersion: 2, articleNumber: 'MI-A2' });
  });

  it.each(['', 'MI A', 'MI_A', 'Ä1', 'x'.repeat(31)])(
    'rejects the article number %j with the rule of UI-004',
    (articleNumber) => {
      const result = listingCreateBodySchema.safeParse({
        fromDeviceId: 41,
        deviceVersion: 1,
        articleNumber,
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({ path: ['articleNumber'], message: RULE });
    },
  );

  it('accepts 30 characters', () => {
    const articleNumber = 'A-1'.repeat(10);
    expect(
      listingCreateBodySchema.safeParse({ fromDeviceId: 41, deviceVersion: 1, articleNumber })
        .success,
    ).toBe(true);
  });

  it('rejects other fields', () => {
    expect(
      listingCreateBodySchema.safeParse({ fromDeviceId: 41, deviceVersion: 1, listingId: 9 })
        .success,
    ).toBe(false);
  });
});

describe('toArticleNumberKey (3.3)', () => {
  it('is the article number in lower case', () => {
    expect(toArticleNumberKey('MI-A626198')).toBe('mi-a626198');
  });
});

describe('deviceAssignmentBodySchema (CU-116, Technical Specification 2.6)', () => {
  it('takes the version of the device and the chosen model listing, without confirmation by default', () => {
    expect(deviceAssignmentBodySchema.parse({ version: 1, listingId: 9 })).toEqual({
      version: 1,
      listingId: 9,
      confirmDeviation: false,
    });
    expect(
      deviceAssignmentBodySchema.parse({ version: 2, listingId: 9, confirmDeviation: true }),
    ).toEqual({ version: 2, listingId: 9, confirmDeviation: true });
  });

  it.each([
    { listingId: 9 },
    { version: 1 },
    { version: 1, listingId: 0 },
    { version: 1, listingId: 9, targetListingId: 3 },
  ])('rejects %j', (body) => {
    expect(deviceAssignmentBodySchema.safeParse(body).success).toBe(false);
  });
});

describe('listingDetailQuerySchema (CU-116, Technical Specification 2.7)', () => {
  it('reads includeCancelled as a flag, false without it', () => {
    expect(listingDetailQuerySchema.parse({})).toEqual({ includeCancelled: false });
    expect(listingDetailQuerySchema.parse({ includeCancelled: 'true' })).toEqual({
      includeCancelled: true,
    });
    expect(listingDetailQuerySchema.parse({ includeCancelled: 'false' })).toEqual({
      includeCancelled: false,
    });
  });

  it('rejects another value and an unknown parameter', () => {
    expect(listingDetailQuerySchema.safeParse({ includeCancelled: '1' }).success).toBe(false);
    expect(listingDetailQuerySchema.safeParse({ limit: '5' }).success).toBe(false);
  });
});

describe('listingDetailSchema (CU-116, Technical Specification 2.7)', () => {
  const listing = {
    id: 9,
    modelTemplateId: 7,
    conditionValueId: 1,
    visualGrade: 2,
    conditionDescription: '',
    variantValues: { '3': 16 },
    otherValues: {},
    deliveryScopeTextBlockIds: [4],
    articleNumber: '626198',
    eanMode: 'original',
    ownEan: null,
    displayTitle: 'MacBook Pro 13',
    quantity: 1,
    version: 1,
  };
  const detail = {
    ...listing,
    stock: { quantity: 1, wiNrs: [], batteryText: '', stockHash: 'ab12' },
    prices: [{ channelId: 1, amountCents: 26900, vb: false, source: 'manual' }],
    devices: [
      {
        id: 41,
        wiNr: '626198',
        stockStatus: 'available',
        soldChannelId: null,
        soldOn: null,
        batteryCapacity: { percent: 85 },
        capturedOn: '2026-11-16',
      },
      {
        id: 42,
        wiNr: '626199',
        stockStatus: 'cancelled',
        soldChannelId: null,
        soldOn: null,
        batteryCapacity: null,
        capturedOn: '2026-11-17',
      },
    ],
    deliveryScope: [{ id: 4, name: 'Netzteil' }],
  };

  it('extends the model listing by stock, prices, devices and delivery scope', () => {
    expect(listingDetailSchema.parse(detail)).toEqual(detail);
  });

  it('rejects a detail without its devices', () => {
    expect(listingDetailSchema.safeParse({ ...detail, devices: undefined }).success).toBe(false);
  });
});

describe('listingUpdateBodySchema (CU-116, Technical Specification 2.7)', () => {
  it('takes the version alone and every listing value', () => {
    expect(listingUpdateBodySchema.parse({ version: 3 })).toEqual({ version: 3 });
    const body = {
      version: 3,
      conditionValueId: 7,
      visualGrade: '2',
      conditionDescription: 'leichte Gebrauchsspuren',
      variantValues: { '14': 9 },
      otherValues: { '20': true },
      deliveryScopeTextBlockIds: [5, 2],
      articleNumber: 'MI-A',
      eanMode: 'own',
      ownEan: '4255867000014',
      confirmDeviatingDevices: false,
    };
    expect(listingUpdateBodySchema.parse(body)).toEqual(body);
  });

  it('AC-REQ-088-06 has no model data: a processor or a model template is an unknown field', () => {
    for (const modelData of [{ processor: 'i7' }, { modelTemplateId: 2 }, { modelValues: {} }]) {
      const result = listingUpdateBodySchema.safeParse({ version: 1, ...modelData });
      expect(result.error?.issues[0]?.code).toBe('unrecognized_keys');
    }
  });
});

describe('listingValuesSchema (CU-116, Technical Specification 2.7)', () => {
  const ram = {
    id: 14,
    label: 'RAM',
    dataType: 'integer',
    systemRole: null,
    minValue: '1',
    maxValue: '1024',
    level: 'device',
    required: true,
    active: true,
  } as const;
  const colour = { ...ram, id: 20, label: 'Farbe', dataType: 'text', required: false } as const;
  const schema = listingValuesSchema({ variantAttributes: [ram], otherAttributes: [colour] });
  const valid = {
    conditionValueId: 7,
    visualGrade: '2',
    conditionDescription: '',
    variantValues: { '14': 16 },
    otherValues: {},
    deliveryScopeTextBlockIds: [],
    articleNumber: 'MI-A',
    eanMode: 'original',
    ownEan: null,
  };
  const messageAt = (input: unknown, path: string) =>
    schema.safeParse(input).error?.issues.find((issue) => issue.path.join('.') === path)?.message;

  it('stores the visual grade as number and no own EAN with the marking "Original"', () => {
    expect(schema.parse({ ...valid, ownEan: '4255867000014' })).toMatchObject({
      visualGrade: 2,
      ownEan: null,
    });
  });

  it('AC-REQ-088-04 rejects the own EAN 4255867000015 with the design text and takes 4255867000014', () => {
    const rule = 'EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer';
    expect(messageAt({ ...valid, eanMode: 'own', ownEan: '4255867000015' }, 'ownEan')).toBe(rule);
    expect(messageAt({ ...valid, eanMode: 'own', ownEan: null }, 'ownEan')).toBe(rule);
    expect(messageAt({ ...valid, eanMode: 'own', ownEan: '' }, 'ownEan')).toBe(rule);
    expect(schema.parse({ ...valid, eanMode: 'own', ownEan: '4255867000014' }).ownEan).toBe(
      '4255867000014',
    );
  });

  it.each(['', 'MI A', 'x'.repeat(31)])(
    'DER-64-04 rejects the article number %j with the text of POST /api/listings',
    (articleNumber) => {
      expect(messageAt({ ...valid, articleNumber }, 'articleNumber')).toBe(RULE);
    },
  );

  it('reports every field at once: a missing condition, a missing required variant value and the EAN', () => {
    const result = schema.safeParse({
      ...valid,
      conditionValueId: null,
      variantValues: {},
      eanMode: 'own',
      ownEan: '1',
    });
    expect(result.error?.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual(
      expect.arrayContaining([
        ['conditionValueId', 'Zustand fehlt'],
        ['variantValues.14', 'RAM fehlt'],
        ['ownEan', 'EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer'],
      ]),
    );
  });

  it('takes a variant value only in variantValues and another value only in otherValues', () => {
    expect(schema.safeParse({ ...valid, otherValues: { '14': 16 } }).success).toBe(false);
    expect(schema.safeParse({ ...valid, otherValues: { '20': 'Blau' } }).success).toBe(true);
  });
});
