// Public interface of `media` (Technical Specification 4.1, exception (1)): its route
// registration and the file intake (CU-090) for the logo of `settings`.
export {
  createMediaFileIntake,
  type MediaFileIntake,
  type RegisterFile,
} from './media-file-intake.ts';
export { mediaRoutes, type MediaRoutesOptions } from './media.routes.ts';
