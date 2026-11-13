// Public interface of `media` (Technical Specification 4.1, exception (1)): its route
// registration, the media store and the file intake (CU-090) for the logo of `settings`.
export { createFileStore, type FileStore } from './file-store.ts';
export {
  createMediaFileIntake,
  type MediaFileIntake,
  type RegisterFile,
} from './media-file-intake.ts';
export { mediaRoutes, type MediaRoutesOptions } from './media.routes.ts';
