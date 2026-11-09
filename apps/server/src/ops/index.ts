// Public interface of `ops` for the server entry, the app and `http` (Technical Specification 4.1).
export { createErrorLog, type ErrorLog, type ErrorLogOptions } from './error-log.ts';
export {
  createLifecycleState,
  type LifecycleState,
  type LifecycleStateName,
} from './lifecycle-state.ts';
