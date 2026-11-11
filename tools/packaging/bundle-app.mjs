// Bundling (CU-276, ADR-008, Technical Specification 2.19 "Build des Pakets", Nachtrag MAR-446):
// bundles `resellr-server` and `resellr-launcher` with esbuild into one file each, copies the
// built web UI and ships the native modules (external to the bundle) with their run-time
// dependencies, all under `app` of the program folder. The native modules are the ones installed
// by `npm ci` on the build machine, so the package must be built on Windows x64 with the Node.js
// version of `.nvmrc` (the one CU-275 ships).
// Usage: `node tools/packaging/bundle-app.mjs <program folder>` after `vite build` of the web UI.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { build } from 'esbuild';

import { programFolderPaths } from '@resellr/runtime-shared/paths';

import { nodeRuntimeVersion } from './fetch-node-runtime.mjs';

/** Native modules stay external and are shipped as packages (2.19). */
const NATIVE_MODULES = ['better-sqlite3', 'sharp'];
/** Dependencies a native module needs only to install its binary, not at run time. */
const INSTALL_ONLY = new Set(['prebuild-install']);
/** Parts of a compiled package (one with `binding.gyp`) that are not needed at run time. */
const NATIVE_SOURCES = new Set(['src', 'deps', 'binding.gyp']);

const ENTRIES = {
  serverEntry: 'apps/server/src/main.ts',
  launcherEntry: 'tools/launcher/src/cli.ts',
};

// Bundled CommonJS dependencies (for example Fastify) call `require`, which an ES module lacks.
const CJS_REQUIRE_BANNER = [
  "import { createRequire as __resellrCreateRequire } from 'node:module';",
  'const require = __resellrCreateRequire(import.meta.url);',
].join('\n');

/**
 * @param {{ repoRoot: string, programDir: string, webDist?: string }} options
 * @returns {Promise<{ nativePackages: string[] }>} names of the shipped packages
 */
export async function bundleApp({ repoRoot, programDir, webDist }) {
  const paths = programFolderPaths(programDir);
  const webSource = webDist ?? join(repoRoot, 'apps', 'web', 'dist');
  if (!existsSync(join(webSource, 'index.html'))) {
    throw new Error(`Built web UI not found in ${webSource}; run the Vite build first`);
  }
  const nodeMajor = nodeRuntimeVersion(readFileSync(join(repoRoot, '.nvmrc'), 'utf8')).split(
    '.',
  )[0];

  rmSync(paths.appDir, { recursive: true, force: true });
  mkdirSync(paths.appDir, { recursive: true });

  /** @type {Set<string>} */
  const externalImports = new Set();
  for (const [key, entry] of Object.entries(ENTRIES)) {
    const result = await build({
      absWorkingDir: repoRoot,
      entryPoints: [entry],
      outfile: paths[/** @type {keyof typeof ENTRIES} */ (key)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: `node${nodeMajor}`,
      define: { RESELLR_BUNDLED: 'true' },
      external: NATIVE_MODULES,
      banner: { js: CJS_REQUIRE_BANNER },
      metafile: true,
      // Folds `RESELLR_BUNDLED` and dead branches; names stay readable for stack traces.
      minifySyntax: true,
      logLevel: 'warning',
    });
    for (const output of Object.values(result.metafile.outputs)) {
      for (const imported of output.imports) {
        if (imported.external) externalImports.add(packageName(imported.path));
      }
    }
  }

  cpSync(webSource, paths.webRoot, { recursive: true });

  const roots = NATIVE_MODULES.filter((name) => externalImports.has(name));
  const nativePackages = shipPackages(repoRoot, roots, paths.nativeModulesDir);
  return { nativePackages };
}

/** @param {string} specifier for example `better-sqlite3` or `@img/sharp-win32-x64/sharp.node` */
function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

/**
 * Copies the packages and their run-time dependency closure (`dependencies` and the installed
 * `optionalDependencies`, such as `@img/sharp-win32-x64`) flat into `targetDir`.
 * @param {string} repoRoot
 * @param {string[]} roots
 * @param {string} targetDir
 * @returns {string[]}
 */
function shipPackages(repoRoot, roots, targetDir) {
  /** @type {Map<string, string>} name → source folder */
  const shipped = new Map();
  /** @type {Array<{ name: string, from: string, optional: boolean }>} */
  const queue = roots.map((name) => ({ name, from: repoRoot, optional: false }));

  for (let next = queue.shift(); next; next = queue.shift()) {
    const { name, from, optional } = next;
    if (INSTALL_ONLY.has(name)) continue;
    const dir = findPackage(name, from, repoRoot);
    if (dir === null) {
      if (optional) continue;
      throw new Error(`Package ${name} needed at run time is not installed`);
    }
    const known = shipped.get(name);
    if (known !== undefined) {
      if (known !== dir) throw new Error(`Two versions of ${name} would be shipped`);
      continue;
    }
    shipped.set(name, dir);

    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      queue.push({ name: dependency, from: dir, optional: false });
    }
    for (const dependency of Object.keys(manifest.optionalDependencies ?? {})) {
      queue.push({ name: dependency, from: dir, optional: true });
    }
  }

  for (const [name, dir] of shipped) {
    const compiled = existsSync(join(dir, 'binding.gyp'));
    cpSync(dir, join(targetDir, name), {
      recursive: true,
      filter: (source) => keepFile(relative(dir, source), compiled),
    });
  }
  return [...shipped.keys()].sort();
}

/**
 * @param {string} path relative to the package folder
 * @param {boolean} compiled whether the package builds a native binary
 */
function keepFile(path, compiled) {
  const [top, ...rest] = path.split(sep);
  if (top === 'node_modules') return false;
  if (!compiled || top === undefined) return true;
  if (NATIVE_SOURCES.has(top)) return false;
  // Of the build folder only the binary itself: `build/Release/<name>.node`.
  if (top === 'build') {
    return (
      rest.length < 2 || (rest[0] === 'Release' && rest.length === 2 && path.endsWith('.node'))
    );
  }
  return true;
}

/**
 * Resolves a package like Node.js does: `node_modules/<name>` in `from` or a folder above it,
 * not above the repository root.
 * @param {string} name
 * @param {string} from
 * @param {string} repoRoot
 * @returns {string | null}
 */
function findPackage(name, from, repoRoot) {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dir === repoRoot || dirname(dir) === dir) return null;
  }
}

/** @param {string | undefined} programDir */
async function main(programDir) {
  if (!programDir) {
    process.stderr.write('Usage: bundle-app.mjs <program folder>\n');
    process.exitCode = 1;
    return;
  }
  const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
  try {
    // The native modules of `npm ci` must fit the shipped runtime (2.19).
    const version = nodeRuntimeVersion(readFileSync(join(repoRoot, '.nvmrc'), 'utf8'));
    if (process.platform !== 'win32' || process.arch !== 'x64') {
      throw new Error(`Build on Windows x64, not ${process.platform}-${process.arch}`);
    }
    if (process.version !== `v${version}`) {
      throw new Error(`Build with Node.js ${version} from .nvmrc, not ${process.version}`);
    }
    const { nativePackages } = await bundleApp({ repoRoot, programDir });
    process.stdout.write(
      `Bundled into ${programFolderPaths(programDir).appDir}; native packages: ${nativePackages.join(', ')}\n`,
    );
  } catch (error) {
    process.stderr.write(`Bundling failed: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await main(process.argv[2]);
