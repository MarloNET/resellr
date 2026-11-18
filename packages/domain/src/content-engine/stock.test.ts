import { describe, expect, it } from 'vitest';

import { buildStock, stockHash } from './stock.ts';

describe('buildStock (CU-120, Technical Specification 2.8.2)', () => {
  it('counts the assigned devices that are available as quantity', () => {
    const stock = buildStock([
      { stockStatus: 'available' },
      { stockStatus: 'sold' },
      { stockStatus: 'available' },
      { stockStatus: 'cancelled' },
    ]);

    expect(stock.quantity).toBe(2);
  });

  it('is quantity 0 without devices', () => {
    expect(buildStock([])).toEqual({ quantity: 0, wiNrs: [], batteryText: '' });
  });
});

describe('stockHash (CU-120, Technical Specification 2.8.2)', () => {
  it('is the SHA-256 in hex of the canonical JSON of quantity, WI-Nrs and battery text', async () => {
    // sha256('{"batteryText":"","quantity":1,"wiNrs":[]}')
    expect(await stockHash({ quantity: 1, wiNrs: [], batteryText: '' })).toBe(
      '9d39697f4b5752ceebe936742f18908e8569fa8215c0424d072eb862152de52b',
    );
  });

  it('changes with the quantity and not with the order of the keys', async () => {
    const one = await stockHash({ quantity: 1, wiNrs: [], batteryText: '' });
    const two = await stockHash({ quantity: 2, wiNrs: [], batteryText: '' });
    const reordered = await stockHash({ batteryText: '', wiNrs: [], quantity: 1 });

    expect(two).not.toBe(one);
    expect(reordered).toBe(one);
  });
});
