import { describe, expect, it } from 'vitest';

import { buildStock, type StockDevice, stockHash } from './stock.ts';

let nextId = 1;
/** An available device with a battery, assigned at the given minute, without battery capacity. */
function device(overrides: Partial<StockDevice> = {}): StockDevice {
  const id = nextId++;
  return {
    id,
    wiNr: String(626100 + id),
    stockStatus: 'available',
    assignedAt: `2026-11-20T08:${String(id).padStart(2, '0')}:00.000Z`,
    batteryCapacity: null,
    batteryPresent: true,
    ...overrides,
  };
}

const percent = (value: number) => ({ percent: value });
const notDeterminable = { notDeterminable: true } as const;

describe('buildStock (CU-120, Technical Specification 2.8.2)', () => {
  it('DER-65-01 counts only the assigned devices that are available as quantity', () => {
    const stock = buildStock([
      device(),
      device({ stockStatus: 'sold' }),
      device(),
      device({ stockStatus: 'cancelled' }),
    ]);

    expect(stock.quantity).toBe(2);
  });

  it('is quantity 0, no WI-Nrs and an empty battery text without devices', () => {
    expect(buildStock([])).toEqual({ quantity: 0, wiNrs: [], batteryText: '' });
  });

  it('DER-65-01 lists the WI-Nrs of the available devices by assigned_at, then id', () => {
    const at = '2026-11-20T09:00:00.000Z';
    const stock = buildStock([
      device({ id: 30, wiNr: '626130', assignedAt: '2026-11-20T10:00:00.000Z' }),
      device({ id: 21, wiNr: '626121', assignedAt: at }),
      device({ id: 20, wiNr: '626120', assignedAt: at }),
      device({ id: 10, wiNr: '626110', assignedAt: '2026-11-20T08:00:00.000Z' }),
      device({ id: 11, wiNr: '626111', stockStatus: 'sold' }),
    ]);

    expect(stock.wiNrs).toEqual(['626110', '626120', '626121', '626130']);
  });

  describe('DER-65-01 battery text by the rules 1 to 4 of Requirements 9.7', () => {
    it.each([
      ['one value', [percent(85)], '85 %'],
      ['equal values', [percent(85), percent(85)], '85 %'],
      ['different values as range', [percent(90), percent(82), percent(85)], '82–90 %'],
      [
        'numbers and not determinable',
        [percent(85), notDeterminable],
        '85 % bzw. nicht ermittelbar',
      ],
      [
        'range and not determinable',
        [notDeterminable, percent(82), percent(90)],
        '82–90 % bzw. nicht ermittelbar',
      ],
      ['only not determinable', [notDeterminable, notDeterminable], 'nicht ermittelbar'],
      ['the bounds 0 and 100', [percent(0), percent(100)], '0–100 %'],
    ])('%s', (_case, capacities, expected) => {
      const stock = buildStock(capacities.map((batteryCapacity) => device({ batteryCapacity })));

      expect(stock.batteryText).toBe(expected);
    });

    it('rule 1: only available devices with a battery capacity enter', () => {
      const stock = buildStock([
        device({ batteryCapacity: percent(85) }),
        device({ batteryCapacity: percent(40), stockStatus: 'sold' }),
        device({ batteryCapacity: notDeterminable, stockStatus: 'cancelled' }),
        device({ batteryCapacity: null }),
      ]);

      expect(stock.batteryText).toBe('85 %');
    });

    it('rule 1: a device whose battery value has no battery does not enter (AC-REQ-036-05)', () => {
      const stock = buildStock([
        device({ batteryCapacity: notDeterminable }),
        device({ batteryCapacity: null, batteryPresent: false }),
        device({ batteryCapacity: percent(70), batteryPresent: false }),
      ]);

      expect(stock.batteryText).toBe('nicht ermittelbar');
    });

    it('rule 1: without the attribute battery a device with a battery capacity enters', () => {
      const stock = buildStock([device({ batteryCapacity: percent(77), batteryPresent: null })]);

      expect(stock.batteryText).toBe('77 %');
    });

    it('rule 4: empty when no device enters', () => {
      const stock = buildStock([
        device({ batteryCapacity: null }),
        device({ batteryCapacity: percent(85), stockStatus: 'sold' }),
        device({ batteryCapacity: percent(85), batteryPresent: false }),
      ]);

      expect(stock.batteryText).toBe('');
    });
  });
});

describe('stockHash (CU-120, Technical Specification 2.8.2)', () => {
  it('is the SHA-256 in hex of the canonical JSON of quantity, WI-Nrs and battery text', async () => {
    // sha256('{"batteryText":"","quantity":1,"wiNrs":[]}')
    expect(await stockHash({ quantity: 1, wiNrs: [], batteryText: '' })).toBe(
      '9d39697f4b5752ceebe936742f18908e8569fa8215c0424d072eb862152de52b',
    );
  });

  it('DER-65-01 changes exactly when the stock data change, not with the order of the keys', async () => {
    const base = { quantity: 2, wiNrs: ['626198', '626199'], batteryText: '82–90 %' };
    const hash = await stockHash(base);

    expect(
      await stockHash({ batteryText: '82–90 %', wiNrs: ['626198', '626199'], quantity: 2 }),
    ).toBe(hash);
    expect(await stockHash({ ...base })).toBe(hash);
    expect(await stockHash({ ...base, quantity: 3 })).not.toBe(hash);
    expect(await stockHash({ ...base, wiNrs: ['626199', '626198'] })).not.toBe(hash);
    expect(await stockHash({ ...base, batteryText: '82 %' })).not.toBe(hash);
  });
});
