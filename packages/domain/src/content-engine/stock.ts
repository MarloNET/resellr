import { canonicalJson, sha256Hex } from './content-hash.ts';

/**
 * The stock data of a model listing (Technical Specification 2.8.2, 3.4 `listing.stock_json`):
 * quantity, WI-Nrs and battery capacity text.
 */
export interface Stock {
  quantity: number;
  wiNrs: string[];
  batteryText: string;
}

/** An assigned device as the stock data need it. */
export interface StockDevice {
  stockStatus: string;
}

/**
 * Stock data of a model listing from its assigned devices (CU-120, REQ-091; Technical
 * Specification 2.8.2): `quantity` = number of devices in the status *verfügbar*. The WI-Nrs and
 * the battery capacity text follow with #209; until then they are empty.
 */
export function buildStock(devices: readonly StockDevice[]): Stock {
  return {
    quantity: devices.filter((device) => device.stockStatus === 'available').length,
    wiNrs: [],
    batteryText: '',
  };
}

/**
 * `stockHash` (2.8.2, Nachtrag MAR-1053): SHA-256 over the canonical form of
 * `{ quantity, wiNrs, batteryText }`, both from CU-152; `stock_json` stores the same object.
 */
export async function stockHash({ quantity, wiNrs, batteryText }: Stock): Promise<string> {
  return sha256Hex(canonicalJson({ quantity, wiNrs, batteryText }));
}
