// Public interface of `settings` (Technical Specification 4.1): its reader (CU-086) and its
// route registration (CU-087).
export {
  type AttributeEntry,
  createSettingsReader,
  type PickListValueEntry,
  type SettingsReader,
} from './settings-reader.ts';
export { settingsRoutes, type SettingsRoutesOptions } from './settings.routes.ts';
