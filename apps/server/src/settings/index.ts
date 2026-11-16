// Public interface of `settings` (Technical Specification 4.1): its reader (CU-086) and its
// route registration (CU-087).
export { createSettingsReader, type SettingsReader } from './settings-reader.ts';
export { settingsRoutes, type SettingsRoutesOptions } from './settings.routes.ts';
