// Public interface of `inventory` (Technical Specification 4.1): its reader (CU-129), its check
// event handlers (CU-290) and its route registration (CU-130).
export { inventoryChecks } from './inventory-checks.ts';
export {
  createInventoryReader,
  type InventoryReader,
  type ListingEntry,
} from './inventory-reader.ts';
export { inventoryRoutes, type InventoryRoutesOptions } from './inventory.routes.ts';
