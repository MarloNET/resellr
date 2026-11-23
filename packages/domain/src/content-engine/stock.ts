import type { BatteryCapacityValue } from '../schemas/attribute-values.schema.ts';
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
  id: number;
  wiNr: string;
  stockStatus: string;
  /** Orders the WI-Nrs (2.6); ISO time stamp. */
  assignedAt: string | null;
  /** The value of the attribute with the role `battery_capacity`, `null` without one. */
  batteryCapacity: BatteryCapacityValue | null;
  /**
   * The flag "Akku vorhanden" of the battery value of the device; `null` if its device type has
   * no attribute battery, then the flag sets no condition (Requirements 9.7 rule 1).
   */
  batteryPresent: boolean | null;
}

const NOT_DETERMINABLE = 'nicht ermittelbar';

function byAssignment(a: StockDevice, b: StockDevice): number {
  const [x, y] = [a.assignedAt ?? '', b.assignedAt ?? ''];
  return x === y ? a.id - b.id : x < y ? -1 : 1;
}

/**
 * `{Akkukapazität}` by Requirements 9.7 rules 1 to 4 (A-16): of the available devices those with
 * a battery capacity whose battery value, if any, has a battery; their numbers as "N %" or
 * "min–max %", with "bzw. nicht ermittelbar" for devices without a determinable value; empty if
 * no device enters.
 */
function batteryTextOf(available: readonly StockDevice[]): string {
  const entering = available.filter(
    (device) => device.batteryCapacity !== null && device.batteryPresent !== false,
  );
  const numbers = entering.flatMap(({ batteryCapacity }) =>
    batteryCapacity !== null && 'percent' in batteryCapacity ? [batteryCapacity.percent] : [],
  );
  const someNotDeterminable = numbers.length < entering.length;
  if (numbers.length === 0) return someNotDeterminable ? NOT_DETERMINABLE : '';
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const numberPart = min === max ? `${min} %` : `${min}–${max} %`;
  return someNotDeterminable ? `${numberPart} bzw. ${NOT_DETERMINABLE}` : numberPart;
}

/**
 * Stock data of a model listing from its assigned devices (CU-120, REQ-091; Technical
 * Specification 2.8.2): `quantity` = number of devices in the status *verfügbar*, `wiNrs` = their
 * WI-Nrs by `assigned_at`, then `id`, and `batteryText` by Requirements 9.7 rules 1 to 4.
 */
export function buildStock(devices: readonly StockDevice[]): Stock {
  const available = devices
    .filter((device) => device.stockStatus === 'available')
    .sort(byAssignment);
  return {
    quantity: available.length,
    wiNrs: available.map((device) => device.wiNr),
    batteryText: batteryTextOf(available),
  };
}

/**
 * `stockHash` (2.8.2, Nachtrag MAR-1053): SHA-256 over the canonical form of
 * `{ quantity, wiNrs, batteryText }`, both from CU-152; `stock_json` stores the same object.
 */
export async function stockHash({ quantity, wiNrs, batteryText }: Stock): Promise<string> {
  return sha256Hex(canonicalJson({ quantity, wiNrs, batteryText }));
}
