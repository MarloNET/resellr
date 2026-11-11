import { join, win32 } from 'node:path';

export interface RuntimePaths {
  dataDir: string;
  logDir: string;
  handoverDir: string;
  updateCopyDir: string;
}

export type RuntimeEnv = Readonly<Record<string, string | undefined>>;

// Environment variable set by the supervisor and default folder under
// %LOCALAPPDATA%\resellr (Technical Specification 2.18, 2.19).
const FOLDERS: Record<keyof RuntimePaths, { envVar: string; defaultName: string }> = {
  dataDir: { envVar: 'RESELLR_DATA_DIR', defaultName: 'Daten' },
  logDir: { envVar: 'RESELLR_LOG_DIR', defaultName: 'Protokolle' },
  handoverDir: { envVar: 'RESELLR_HANDOVER_DIR', defaultName: 'Fotoübergabe' },
  updateCopyDir: { envVar: 'RESELLR_UPDATE_COPY_DIR', defaultName: 'Update-Kopien' },
};

/**
 * Resolves the data, log, handover and update-copy folders. A non-empty environment
 * variable wins; otherwise the default folder under %LOCALAPPDATA%\resellr applies.
 */
export function resolveRuntimePaths(env: RuntimeEnv = process.env): RuntimePaths {
  const resolve = (folder: keyof RuntimePaths): string => {
    const { envVar, defaultName } = FOLDERS[folder];
    const fromEnv = env[envVar];
    if (fromEnv) return fromEnv;

    const localAppData = env.LOCALAPPDATA;
    if (!localAppData) {
      throw new Error(`Neither ${envVar} nor LOCALAPPDATA is set`);
    }
    return win32.join(localAppData, 'resellr', defaultName);
  };

  return {
    dataDir: resolve('dataDir'),
    logDir: resolve('logDir'),
    handoverDir: resolve('handoverDir'),
    updateCopyDir: resolve('updateCopyDir'),
  };
}

/** Files of the program folder under `app` (Technical Specification 2.19, Nachtrag MAR-446). */
export interface ProgramFolderPaths {
  appDir: string;
  serverEntry: string;
  launcherEntry: string;
  webRoot: string;
  /** Only the native modules; everything else is bundled into the two entries. */
  nativeModulesDir: string;
}

// Kept in an import-free module so esbuild can inline it (CU-313, Nachtrag MAR-474).
export { IS_BUNDLED } from './bundled.ts';

/**
 * Layout of `app` in the program folder. `node:path` instead of `win32`, so checks of the bundle
 * also run under Linux.
 */
export function programFolderPaths(programDir: string): ProgramFolderPaths {
  const appDir = join(programDir, 'app');
  return {
    appDir,
    serverEntry: join(appDir, 'server.mjs'),
    launcherEntry: join(appDir, 'launcher.mjs'),
    webRoot: join(appDir, 'web'),
    nativeModulesDir: join(appDir, 'node_modules'),
  };
}
