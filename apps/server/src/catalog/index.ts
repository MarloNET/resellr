// Public interface of `catalog` (Technical Specification 4.1): its reader (CU-108) and its route
// registration.
export { createCatalogReader, type CatalogReader } from './catalog-reader.ts';
export { catalogRoutes, type CatalogRoutesOptions } from './catalog.routes.ts';
