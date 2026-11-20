import { describe, expect, it } from 'vitest';

import {
  deviceAssignmentBodySchema,
  listingCreateBodySchema,
  listingDetailQuerySchema,
  listingDetailSchema,
  listingPriceBodySchema,
  listingPricesSchema,
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

const PRICE_RULE = 'Preis: Zahl größer 0 mit höchstens zwei Nachkommastellen';

describe('listingPriceBodySchema (CU-116, Technical Specification 2.7)', () => {
  it('takes the version, the amount in cents and the flag VB', () => {
    expect(listingPriceBodySchema.parse({ version: 2, amountCents: 26900, vb: false })).toEqual({
      version: 2,
      amountCents: 26900,
      vb: false,
    });
  });

  it.each([
    ['0', 0],
    ['12,345', 1234.5],
    ['a negative amount', -100],
    ['an unsafe amount', 2 ** 53],
  ])('rejects %s with the price rule as a field rule', (_, amountCents) => {
    const result = listingPriceBodySchema.safeParse({ version: 1, amountCents, vb: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ code: 'custom', path: ['amountCents'], message: PRICE_RULE }),
    ]);
  });

  it.each([
    ['a missing vb', { version: 1, amountCents: 100 }],
    ['a string amount', { version: 1, amountCents: '100', vb: false }],
    ['an unknown field', { version: 1, amountCents: 100, vb: false, source: 'rule' }],
  ])('rejects %s as a structural error', (_, body) => {
    const result = listingPriceBodySchema.safeParse(body);
    expect(result.success).toBe(false);
    expect(result.error?.issues.every((issue) => issue.code !== 'custom')).toBe(true);
  });
});

describe('listingPricesSchema (CU-116, Technical Specification 2.7)', () => {
  it('holds the new version and the prices of all channels', () => {
    const answer = {
      listing: { version: 3 },
      prices: [
        { channelId: 1, amountCents: 26900, vb: false, source: 'manual' },
        { channelId: 2, amountCents: 5000, vb: true, source: 'manual' },
      ],
    };
    expect(listingPricesSchema.parse(answer)).toEqual(answer);
  });
});
