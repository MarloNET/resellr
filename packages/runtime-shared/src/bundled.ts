// Bundle flag (CU-313, Nachtrag MAR-474). This file must not import anything, not even a type:
// esbuild only inlines `IS_BUNDLED` into other modules when its module has no imports, and only
// then are the source-tree branches dropped from the bundle (checked by CU-276).

// Set to `true` by the packaging step (CU-276, esbuild `define`); not defined in the source tree.
declare const RESELLR_BUNDLED: boolean | undefined;

/** True in `app/server.mjs` and `app/launcher.mjs`, false in the source tree. */
export const IS_BUNDLED = typeof RESELLR_BUNDLED !== 'undefined' && RESELLR_BUNDLED === true;
