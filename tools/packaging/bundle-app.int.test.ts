import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { programFolderPaths } from '@resellr/runtime-shared/paths';

import { bundleApp, sourceTreeTraces, writeMetafile } from './bundle-app.mjs';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const SCRIPT = fileURLToPath(new URL('./bundle-app.mjs', import.meta.url));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

describe('bundleApp', { timeout: 60_000 }, () => {
  let root: string;
  let programDir: string;
  let app: ReturnType<typeof programFolderPaths>;
  let shipped: string[];
  let metafile: Awaited<ReturnType<typeof bundleApp>>['metafile'];

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'resellr-bundle-'));
    programDir = join(root, 'resellr');
    const webDist = join(root, 'web-dist');
    mkdirSync(join(webDist, 'assets'), { recursive: true });
    writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>resellr</title>');
    writeFileSync(join(webDist, 'assets', 'app.js'), 'console.log(1);');
    // A file of an earlier build must not survive.
    mkdirSync(join(programDir, 'app'), { recursive: true });
    writeFileSync(join(programDir, 'app', 'stale.mjs'), '');

    ({ nativePackages: shipped, metafile } = await bundleApp({
      repoRoot: REPO_ROOT,
      programDir,
      webDist,
    }));
    app = programFolderPaths(programDir);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes server, launcher and web UI to app in the program folder (2.19)', () => {
    expect(existsSync(app.serverEntry)).toBe(true);
    expect(existsSync(app.launcherEntry)).toBe(true);
    expect(readFileSync(join(app.webRoot, 'index.html'), 'utf8')).toContain('resellr');
    expect(existsSync(join(app.webRoot, 'assets', 'app.js'))).toBe(true);
    expect(existsSync(join(app.appDir, 'stale.mjs'))).toBe(false);
  });

  it('drops RESELLR_BUNDLED and the source-tree branches from both bundles (Nachtrag MAR-446, MAR-474)', () => {
    const server = readFileSync(app.serverEntry, 'utf8');
    const launcher = readFileSync(app.launcherEntry, 'utf8');

    expect(server).not.toContain('RESELLR_BUNDLED');
    expect(launcher).not.toContain('RESELLR_BUNDLED');
    // Source-tree web root of CU-018 and server entry of CU-264.
    expect(server).not.toContain('web/dist');
    expect(launcher).not.toContain('apps/server/src/main.ts');
  });

  it('keeps native modules external and ships them with their runtime dependencies only', () => {
    expect(readFileSync(app.serverEntry, 'utf8')).toMatch(/from ["']better-sqlite3["']/);
    expect(shipped).toEqual(expect.arrayContaining(['better-sqlite3', 'bindings']));
    const sqlite = join(app.nativeModulesDir, 'better-sqlite3');
    expect(existsSync(join(sqlite, 'build', 'Release', 'better_sqlite3.node'))).toBe(true);
    expect(existsSync(join(sqlite, 'lib', 'index.js'))).toBe(true);
    // C/C++ sources and build tools are not needed at run time.
    expect(existsSync(join(sqlite, 'deps'))).toBe(false);
    expect(existsSync(join(sqlite, 'src'))).toBe(false);
    expect(existsSync(join(app.nativeModulesDir, 'prebuild-install'))).toBe(false);
  });

  it('returns the merged esbuild metafile of server and launcher (Nachtrag MAR-687)', () => {
    const inputs = Object.keys(metafile.inputs);

    expect(inputs).toContain('apps/server/src/main.ts');
    expect(inputs).toContain('tools/launcher/src/cli.ts');
    expect(inputs.some((input) => input.startsWith('node_modules/fastify/'))).toBe(true);
    expect(Object.keys(metafile.outputs).map((output) => basename(output))).toEqual(
      expect.arrayContaining(['server.mjs', 'launcher.mjs']),
    );
  });

  it('writes the metafile outside the program folder and rejects a path inside it (Nachtrag MAR-687)', () => {
    const target = join(root, 'build', 'bundle-meta.json');

    writeMetafile(target, programDir, metafile);

    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual(metafile);
    const inside = join(programDir, 'bundle-meta.json');
    expect(() => writeMetafile(inside, programDir, metafile)).toThrow(/outside the program folder/);
    expect(existsSync(inside)).toBe(false);
  });

  it('builds a launcher that starts and rejects an unknown command with exit code 1', () => {
    const run = spawnSync(process.execPath, [app.launcherEntry, 'unknown'], {
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(run.status).toBe(1);
  });

  it('runs from the program folder: supervise finds app/server.mjs, the server serves app/web', async () => {
    // A copy of the running Node.js in the program folder stands in for resellr-node.exe, so
    // `dirname(process.execPath)` is the program folder as after the installation.
    const runtime = join(programDir, basename(process.execPath));
    copyFileSync(process.execPath, runtime);
    const dataDir = join(root, 'Daten');
    mkdirSync(dataDir, { recursive: true });
    const port = await freePort();
    writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ port }));

    const supervisor: ChildProcess = spawn(runtime, [app.launcherEntry, 'supervise'], {
      stdio: 'ignore',
      env: {
        PATH: process.env.PATH,
        LOCALAPPDATA: root,
        RESELLR_DATA_DIR: dataDir,
        RESELLR_LOG_DIR: join(root, 'Protokolle'),
        RESELLR_HANDOVER_DIR: join(root, 'Fotoübergabe'),
        RESELLR_UPDATE_COPY_DIR: join(root, 'Update-Kopien'),
      },
    });
    const ended = new Promise((resolve) => supervisor.once('exit', resolve));
    try {
      const page = await poll(async () => {
        const response = await fetch(`http://127.0.0.1:${port}/`);
        return response.ok ? response.text() : null;
      });
      expect(page).toContain('<title>resellr</title>');
      const health = await fetch(`http://127.0.0.1:${port}/api/ops/health`);
      expect(health.status).toBe(200);
    } finally {
      supervisor.kill('SIGTERM');
      await ended;
    }
  });
});

describe('bundle-app.mjs --metafile', () => {
  it('rejects a metafile path in the program folder with exit code 1 before bundling (Nachtrag MAR-687)', () => {
    const root = mkdtempSync(join(tmpdir(), 'resellr-bundle-cli-'));
    try {
      const programDir = join(root, 'resellr');
      const run = spawnSync(
        process.execPath,
        [SCRIPT, programDir, '--metafile', join(programDir, 'bundle-meta.json')],
        { encoding: 'utf8', timeout: 20_000 },
      );

      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(/must lie outside the program folder/);
      expect(existsSync(programDir)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('sourceTreeTraces', () => {
  const unfolded = [
    '// apps/server/src/main.ts',
    'var IS_BUNDLED = typeof RESELLR_BUNDLED !== "undefined";',
    'const entry = new URL("../../../../apps/server/src/main.ts", import.meta.url);',
    'const web = new URL("../../web/dist", import.meta.url);',
  ].join('\n');

  it('names the source-tree traces a bundle still contains (Nachtrag MAR-474)', () => {
    expect(sourceTreeTraces('serverEntry', unfolded)).toEqual(['web/dist', 'RESELLR_BUNDLED']);
    expect(sourceTreeTraces('launcherEntry', unfolded)).toEqual([
      'apps/server/src/main.ts',
      'RESELLR_BUNDLED',
    ]);
  });

  it('accepts the module comment of the server entry in server.mjs', () => {
    expect(sourceTreeTraces('serverEntry', '// apps/server/src/main.ts\nstart(webRoot);')).toEqual(
      [],
    );
  });
});

/** Calls `attempt` until it returns a value; connection errors count as "not yet". */
async function poll<T>(attempt: () => Promise<T | null>, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const value = await attempt();
      if (value !== null) return value;
    } catch {
      // The server is not listening yet.
    }
    if (Date.now() > deadline) throw new Error('Timed out');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
