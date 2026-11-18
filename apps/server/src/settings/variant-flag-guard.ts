import type { DB } from '../db/schema.ts';
import type { UnitOfWork } from '../db/unit-of-work.ts';
import { createDeviceTypeRepository, type AttributeRow } from './device-type-repository.ts';

/** The fields of an attribute that decide whether it belongs to the variant set (2.1). */
export interface VariantFlagState {
  level: string;
  variantForming: boolean;
}

const isVariantAttribute = ({ level, variantForming }: VariantFlagState) =>
  level === 'device' && variantForming;

const variantStateOf = (row: AttributeRow): VariantFlagState => ({
  level: row.level,
  variantForming: row.variant_forming === 1,
});

/**
 * Variant set check (CU-075, REQ-005; Technical Specification 2.1, 2.0.4). The variant set of a
 * device type are all its attributes at level device with the flag "variantenbildend", active
 * and deactivated ones (K-03). Only removing the flag makes it smaller; deactivating or
 * activating an attribute and setting the flag do not, and report nothing.
 *
 * Call it inside the action after the change is stored. If the attribute left the set, it
 * reports the check event `VariantSetChanging` with the set after the change; the handler of
 * `inventory` (CU-290) rejects when two model listings would then match, and the transaction
 * rolls back (AC-REQ-005-09). Until that handler exists the check passes (4.4.0).
 */
export async function checkVariantSetChange(
  tx: UnitOfWork<DB>,
  {
    deviceTypeId,
    before,
    after,
  }: {
    deviceTypeId: number;
    before: VariantFlagState;
    after: VariantFlagState;
  },
): Promise<void> {
  if (!isVariantAttribute(before) || isVariantAttribute(after)) return;
  const attributes = await createDeviceTypeRepository(tx.db).listAttributes(deviceTypeId);
  const variantAttributeIds = attributes
    .filter((row) => isVariantAttribute(variantStateOf(row)))
    .map((row) => row.id);
  await tx.check({ type: 'VariantSetChanging', deviceTypeId, variantAttributeIds });
}
