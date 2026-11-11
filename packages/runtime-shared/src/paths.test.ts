import { describe, expect, it } from 'vitest';

import { join } from 'node:path';

import { IS_BUNDLED, programFolderPaths, resolveRuntimePaths } from './paths.ts';

const LOCAL_APP_DATA = 'C:\\Users\\haendler\\AppData\\Local';

describe('runtime paths (E8)', () => {
  it('takes every folder from its environment variable', () => {
    expect(
      resolveRuntimePaths({
        LOCALAPPDATA: LOCAL_APP_DATA,
        RESELLR_DATA_DIR: '/tmp/resellr/data',
        RESELLR_LOG_DIR: '/tmp/resellr/logs',
        RESELLR_HANDOVER_DIR: '/tmp/resellr/handover',
        RESELLR_UPDATE_COPY_DIR: '/tmp/resellr/update-copies',
      }),
    ).toEqual({
      dataDir: '/tmp/resellr/data',
      logDir: '/tmp/resellr/logs',
      handoverDir: '/tmp/resellr/handover',
      updateCopyDir: '/tmp/resellr/update-copies',
    });
  });

  it('falls back to the default folders under %LOCALAPPDATA%\\resellr (Technical Specification 2.19)', () => {
    expect(resolveRuntimePaths({ LOCALAPPDATA: LOCAL_APP_DATA })).toEqual({
      dataDir: `${LOCAL_APP_DATA}\\resellr\\Daten`,
      logDir: `${LOCAL_APP_DATA}\\resellr\\Protokolle`,
      handoverDir: `${LOCAL_APP_DATA}\\resellr\\Fotoübergabe`,
      updateCopyDir: `${LOCAL_APP_DATA}\\resellr\\Update-Kopien`,
    });
  });

  it('resolves each folder independently and treats an empty variable as unset', () => {
    expect(
      resolveRuntimePaths({
        LOCALAPPDATA: LOCAL_APP_DATA,
        RESELLR_DATA_DIR: '/tmp/resellr/data',
        RESELLR_LOG_DIR: '',
      }),
    ).toEqual({
      dataDir: '/tmp/resellr/data',
      logDir: `${LOCAL_APP_DATA}\\resellr\\Protokolle`,
      handoverDir: `${LOCAL_APP_DATA}\\resellr\\Fotoübergabe`,
      updateCopyDir: `${LOCAL_APP_DATA}\\resellr\\Update-Kopien`,
    });
  });

  it('fails when a default folder is needed but LOCALAPPDATA is not set', () => {
    expect(() => resolveRuntimePaths({ RESELLR_DATA_DIR: '/tmp/resellr/data' })).toThrow(
      /LOCALAPPDATA/,
    );
  });

  it('does not need LOCALAPPDATA when every folder comes from the environment', () => {
    expect(
      resolveRuntimePaths({
        RESELLR_DATA_DIR: 'a',
        RESELLR_LOG_DIR: 'b',
        RESELLR_HANDOVER_DIR: 'c',
        RESELLR_UPDATE_COPY_DIR: 'd',
      }),
    ).toEqual({ dataDir: 'a', logDir: 'b', handoverDir: 'c', updateCopyDir: 'd' });
  });
});

describe('program folder paths (Technical Specification 2.19, Nachtrag MAR-446)', () => {
  it('builds the files under app of the program folder', () => {
    const programDir = join('/home', 'haendler', 'Programs', 'resellr');

    expect(programFolderPaths(programDir)).toEqual({
      appDir: join(programDir, 'app'),
      serverEntry: join(programDir, 'app', 'server.mjs'),
      launcherEntry: join(programDir, 'app', 'launcher.mjs'),
      webRoot: join(programDir, 'app', 'web'),
      nativeModulesDir: join(programDir, 'app', 'node_modules'),
    });
  });

  it('is not bundled in the source tree, where RESELLR_BUNDLED is not defined', () => {
    expect(IS_BUNDLED).toBe(false);
  });
});
