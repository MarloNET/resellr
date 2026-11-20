// Public interface of `inventory` (Technical Specification 4.1): its check event handlers
// (CU-290), its route registration (CU-130) and its reader (CU-129).
export { inventoryChecks } from './inventory-checks.ts';
export { inventoryRoutes, type InventoryRoutesOptions } from './inventory.routes.ts';
export {
  createInventoryReader,
  type InventoryReader,
  type ListingStock,
} from './inventory-reader.ts';
