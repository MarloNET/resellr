// License notices (CU-298, FIND-222, Technical Specification 2.19 "Build des Pakets", 4.3,
// Nachtrag MAR-687, MAR-693, MAR-711, MAR-719, MAR-720, MAR-758): writes `THIRD-PARTY-NOTICES.txt` with the license texts of
// everything the package ships and fails the build for a shipped package whose license is
// missing or not allowed.
// Usage: `node tools/packaging/collect-licenses.mjs <program folder> --metafile <path>` after
// `bundle-app.mjs <program folder> --metafile <path>` (CU-276).
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { findPackage } from './bundle-app.mjs';

const LICENSES_DIR = fileURLToPath(new URL('licenses', import.meta.url));
export const NOTICES_FILE = 'THIRD-PARTY-NOTICES.txt';

/** Licenses that allow shipping (4.3, FIND-222, Nachtrag MAR-693). */
const ALLOWED_LICENSES = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'OFL-1.1',
  'BlueOak-1.0.0',
]);
/** LGPL-3.0 is allowed only for libvips, which is shipped as an unchanged dynamic library. */
const LGPL_LICENSES = new Set(['LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later', 'LGPL-3.0+']);
/** The packages that carry libvips as dynamic library (Nachtrag MAR-687). */
const LIBVIPS_PACKAGE = /^@img\/(sharp-win32-x64|sharp-libvips-[^@/]+)(@|$)/;
const LIBVIPS_SOURCES = [
  'https://github.com/libvips/libvips',
  'https://github.com/lovell/sharp-libvips',
];

/** Files of a package that carry its license text (Nachtrag MAR-687). */
const LICENSE_FILE = /^(licen[cs]e|copying)/i;
/** Packages that `web-ui` ships in its CSS although they are not `dependencies` (Nachtrag MAR-687). */
const WEB_CSS_PACKAGES = ['tailwindcss'];
const OWN_PACKAGE = /^@resellr\//;

const RULE = '='.repeat(80);

/**
 * @typedef {{ license: string, file: string, source: string }} MissingLicenseEntry
 * @typedef {Record<string, MissingLicenseEntry>} MissingLicenseFiles
 * @typedef {{ name: string, version: string, license: string, text: string, dir: string }} PackageNotice
 * @typedef {{ version: string, license: string, file: string | null, source: string }} LibvipsLibrary
 * @typedef {Record<string, LibvipsLibrary>} LibvipsLibraries
 */

/**
 * Throws, naming the package, unless the SPDX expression allows shipping it: every operand of
 * an `AND`, at least one of an `OR`. Parentheses are allowed, `WITH` exceptions are not.
 * @param {string} pkg name (and version) of the package, for the message
 * @param {string | undefined} expression SPDX license expression from `package.json`
 */
export function checkLicense(pkg, expression) {
  if (!expression?.trim()) throw new Error(`${pkg} has no license`);
  if (expression.trim() === 'UNLICENSED' || /^SEE LICEN[CS]E IN /i.test(expression.trim())) {
    throw new Error(`${pkg} has the license "${expression}", which is not allowed`);
  }
  const libvips = LIBVIPS_PACKAGE.test(pkg);
  const allowed = (/** @type {string} */ id) =>
    ALLOWED_LICENSES.has(id) || (libvips && LGPL_LICENSES.has(id));
  if (!evaluate(tokenize(expression), allowed)) {
    throw new Error(`${pkg} has the license "${expression}", which is not allowed`);
  }
}

/** @param {string} expression */
function tokenize(expression) {
  return expression
    .replace(/([()])/g, ' $1 ')
    .trim()
    .split(/\s+/);
}

/**
 * Evaluates `or := and ("OR" and)*`, `and := term ("AND" term)*`, `term := id | "(" or ")"`.
 * @param {string[]} tokens
 * @param {(id: string) => boolean} allowed
 */
function evaluate(tokens, allowed) {
  let position = 0;
  /** @type {() => boolean} */
  const or = () => {
    let result = and();
    while (tokens[position] === 'OR') {
      position++;
      result = and() || result;
    }
    return result;
  };
  /** @type {() => boolean} */
  const and = () => {
    let result = term();
    while (tokens[position] === 'AND') {
      position++;
      result = term() && result;
    }
    return result;
  };
  /** @type {() => boolean} */
  const term = () => {
    const token = tokens[position++];
    if (token === '(') {
      const result = or();
      if (tokens[position++] !== ')') return false;
      return result;
    }
    return token !== undefined && !['AND', 'OR', 'WITH', ')'].includes(token) && allowed(token);
  };
  const result = or();
  // Anything left over (for example a `WITH` exception) is not an allowed expression.
  return result && position === tokens.length;
}

/** @param {string} expression */
function hasLgpl(expression) {
  return tokenize(expression).some((token) => LGPL_LICENSES.has(token));
}

/**
 * Name, version, checked license and license text of an installed package. A package without
 * license file needs an entry in `missingLicenseFiles` (Nachtrag MAR-693), unless it is a libvips
 * package under LGPL-3.0 alone (Nachtrag MAR-758).
 * @param {string} dir package folder
 * @param {{ missingLicenseFiles?: MissingLicenseFiles, licensesDir?: string,
 *   log?: (line: string) => void }} [options]
 * @returns {PackageNotice}
 */
export function readPackageNotice(dir, options = {}) {
  const { missingLicenseFiles = {}, licensesDir = LICENSES_DIR, log = () => {} } = options;
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const pkg = `${manifest.name}@${manifest.version}`;
  // Only the SPDX expression in `license` counts, not the deprecated `licenses` array.
  const license = typeof manifest.license === 'string' ? manifest.license : undefined;
  checkLicense(pkg, license);
  const entry = Object.hasOwn(missingLicenseFiles, manifest.name)
    ? missingLicenseFiles[manifest.name]
    : undefined;

  const files = readdirSync(dir)
    .filter((file) => LICENSE_FILE.test(file) && statSync(join(dir, file)).isFile())
    .sort();
  let text = files
    .map((file) => readFileSync(join(dir, file), 'utf8').trim())
    .filter((content) => content.length > 0)
    .join('\n\n');
  if (text.length > 0) {
    if (entry)
      log(`${pkg} ships its own license file; its entry in missing-license-files.json is unused`);
  } else if (entry) {
    if (entry.license !== license) {
      throw new Error(
        `${pkg} has the license "${license}", but its entry in missing-license-files.json says "${entry.license}"`,
      );
    }
    const file = join(licensesDir, 'packages', entry.file);
    if (!existsSync(file)) {
      throw new Error(
        `${pkg}: the license text ${entry.file} from missing-license-files.json is missing`,
      );
    }
    text = `Lizenztext nicht im Paket enthalten, Quelle: ${entry.source}\n\n${readFileSync(file, 'utf8').trim()}`;
  } else if (LIBVIPS_PACKAGE.test(pkg) && LGPL_LICENSES.has(license?.trim() ?? '')) {
    // A libvips package under LGPL-3.0 alone gets the texts of LGPL-3.0 and GPL-3.0 and its libvips
    // section appended by `buildNotices` (Nachtrag MAR-758).
    text = `Lizenztext nicht im Paket enthalten. Es gelten LGPL-3.0 und GPL-3.0, Texte am Ende dieser Datei; Bibliotheken und Quellcode im Abschnitt „libvips aus ${pkg}“.`;
  } else {
    throw new Error(`${pkg} ships no license text`);
  }
  return { name: manifest.name, version: manifest.version, license, text, dir };
}

/**
 * @typedef {{ name: string, from: string, optional: boolean } | { name: string, dir: string }}
 *   ClosureStart a package to resolve with `findPackage` from `from`, or one in a known folder
 */

/**
 * Package folders of the given packages and their closure over `dependencies` and installed
 * `optionalDependencies`, resolved with `findPackage` from the folder of the dependent package.
 * A missing dependency from `dependencies` fails, naming the package; `peerDependencies` and
 * `devDependencies` are not followed. Workspace packages are own code, but their dependencies are
 * followed (Nachtrag MAR-687, MAR-720).
 * @param {ClosureStart[]} start
 * @param {string} repoRoot
 * @param {string} shippedIn for the message
 * @returns {string[]}
 */
function dependencyClosure(start, repoRoot, shippedIn) {
  /** @type {ClosureStart[]} */
  const queue = [...start];
  const visited = new Set();
  const dirs = [];
  for (let next = queue.shift(); next; next = queue.shift()) {
    const { name } = next;
    const found = 'dir' in next ? next.dir : findPackage(name, next.from, repoRoot);
    if (found === null) {
      if ('optional' in next && next.optional) continue;
      throw new Error(`Package ${name} shipped in ${shippedIn} is not installed`);
    }
    const dir = realpathSync(found);
    if (visited.has(dir)) continue;
    visited.add(dir);
    if (!OWN_PACKAGE.test(name)) dirs.push(dir);
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      queue.push({ name: dependency, from: dir, optional: false });
    }
    for (const dependency of Object.keys(manifest.optionalDependencies ?? {})) {
      queue.push({ name: dependency, from: dir, optional: true });
    }
  }
  return dirs;
}

/**
 * Package folders of the npm packages bundled into server and launcher: every metafile input
 * under `node_modules/`, cut after the package name (with scope) behind the last `node_modules/`,
 * and their closure over `dependencies`, because a pre-bundled file of a package carries the code
 * of its dependencies without them showing up in the metafile (Nachtrag MAR-720). Inputs from
 * the workspaces are own code.
 * @param {{ inputs: Record<string, unknown> }} metafile esbuild metafile of CU-276
 * @param {string} repoRoot folder the metafile paths are relative to
 * @returns {string[]}
 */
export function bundledPackageDirs(metafile, repoRoot) {
  /** @type {Map<string, ClosureStart>} */
  const start = new Map();
  for (const input of Object.keys(metafile.inputs)) {
    const path = input.replaceAll('\\', '/');
    const index = path.lastIndexOf('node_modules/');
    if (index === -1 || /^[^/]*:/.test(path)) continue;
    const rest = path.slice(index + 'node_modules/'.length).split('/');
    const name = rest[0]?.startsWith('@') ? rest.slice(0, 2).join('/') : rest[0];
    if (!name || OWN_PACKAGE.test(name)) continue;
    const dir = join(repoRoot, path.slice(0, index), 'node_modules', name);
    start.set(dir, { name, dir });
  }
  return dependencyClosure([...start.values()], repoRoot, 'server or launcher');
}

/**
 * Package folders of the shipped native packages: each folder in `app/node_modules` (flat, with
 * scope).
 * @param {string} nativeModulesDir
 * @returns {string[]}
 */
export function nativePackageDirs(nativeModulesDir) {
  if (!existsSync(nativeModulesDir)) return [];
  return readdirSync(nativeModulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .flatMap((entry) => {
      const dir = join(nativeModulesDir, entry.name);
      if (!entry.name.startsWith('@')) return [dir];
      return readdirSync(dir, { withFileTypes: true })
        .filter((scoped) => scoped.isDirectory())
        .map((scoped) => join(dir, scoped.name));
    })
    .filter((dir) => existsSync(join(dir, 'package.json')));
}

/**
 * Package folders of the packages Vite bundles into `web-ui`: the `dependencies` of
 * `apps/web/package.json` and their closure over `dependencies` and installed
 * `optionalDependencies`, plus `tailwindcss`. Workspace packages are own code, but their
 * dependencies are followed (Nachtrag MAR-687).
 * @param {string} repoRoot
 * @param {string} [webDir] folder of the web UI workspace
 * @returns {string[]}
 */
export function webPackageDirs(repoRoot, webDir = join(repoRoot, 'apps', 'web')) {
  const web = JSON.parse(readFileSync(join(webDir, 'package.json'), 'utf8'));
  const start = [...Object.keys(web.dependencies ?? {}), ...WEB_CSS_PACKAGES].map((name) => ({
    name,
    from: webDir,
    optional: false,
  }));
  return dependencyClosure(start, repoRoot, 'web-ui');
}

/**
 * Text of `THIRD-PARTY-NOTICES.txt` for all shipped packages, Node.js and Inter, with the libvips
 * section (with the libraries built into its binaries) and the texts of LGPL-3.0 and GPL-3.0 as
 * soon as a package has an LGPL-3.0 part.
 * @param {{ packageDirs: string[], nodeLicense: string, interLicense: string,
 *   missingLicenseFiles?: MissingLicenseFiles, libvipsLibraries?: LibvipsLibraries,
 *   licensesDir?: string, log?: (line: string) => void }} options
 * @returns {string}
 */
export function buildNotices(options) {
  const { packageDirs, nodeLicense, interLicense, licensesDir = LICENSES_DIR } = options;
  /** @type {Map<string, PackageNotice>} name@version → notice */
  const notices = new Map();
  for (const dir of packageDirs) {
    const notice = readPackageNotice(dir, options);
    const key = `${notice.name}@${notice.version}`;
    if (!notices.has(key)) notices.set(key, notice);
  }
  const packages = [...notices.values()].sort(
    (a, b) => compare(a.name, b.name) || compare(a.version, b.version),
  );

  const sections = [
    section('Node.js', 'MIT', readRequired(nodeLicense, 'Node.js license')),
    section('Inter', 'OFL-1.1', readRequired(interLicense, 'Inter license')),
    ...packages.map((notice) =>
      section(`${notice.name}@${notice.version}`, notice.license, notice.text),
    ),
  ];

  const libvips = packages.filter((notice) => hasLgpl(notice.license));
  for (const notice of libvips) {
    const pkg = `${notice.name}@${notice.version}`;
    const content = readRequired(join(notice.dir, 'versions.json'), `versions.json of ${pkg}`);
    sections.push(
      section(
        `libvips aus ${pkg}`,
        notice.license,
        [
          'Unverändert als dynamische Bibliothek ausgeliefert. Enthaltene Bibliotheken (versions.json):',
          '',
          content,
          '',
          'Quellcode:',
          ...LIBVIPS_SOURCES.map((url) => `  ${url}`),
          '',
          libraryNotices(pkg, JSON.parse(content), { ...options, licensesDir }),
        ].join('\n'),
      ),
    );
  }
  if (libvips.length > 0) {
    for (const id of ['LGPL-3.0', 'GPL-3.0']) {
      sections.push(section(id, id, readRequired(join(licensesDir, `${id}.txt`), `${id} text`)));
    }
  }

  return (
    ['Lizenzhinweise zu den mit resellr ausgelieferten Komponenten Dritter', ...sections].join(
      '\n\n',
    ) + '\n'
  );
}

/**
 * Name, version, license, source and text of each library built into the libvips binaries of a
 * package, from `libvips-libraries.json`. Fails, naming library and package, for a key of
 * `versions.json` without entry, a differing version or a missing text file; an entry without key
 * in `versions.json` is unused and logged (Nachtrag MAR-711, MAR-719).
 * @param {string} pkg name@version of the libvips package
 * @param {Record<string, string>} versions content of its `versions.json`
 * @param {{ libvipsLibraries?: LibvipsLibraries, licensesDir: string,
 *   log?: (line: string) => void }} options
 * @returns {string}
 */
function libraryNotices(pkg, versions, options) {
  const { libvipsLibraries = {}, licensesDir, log = () => {} } = options;
  const blocks = Object.keys(versions)
    .sort(compare)
    .map((key) => {
      const version = versions[key];
      const entry = Object.hasOwn(libvipsLibraries, key) ? libvipsLibraries[key] : undefined;
      if (!entry) {
        throw new Error(`${pkg}: library ${key} ${version} has no entry in libvips-libraries.json`);
      }
      if (entry.version !== version) {
        throw new Error(
          `${pkg}: library ${key} has version ${version}, but its entry in libvips-libraries.json says ${entry.version}`,
        );
      }
      let text = 'Es gelten LGPL-3.0 und GPL-3.0, Texte am Ende dieser Datei.';
      if (entry.file !== null) {
        const file = join(licensesDir, 'libvips', entry.file);
        if (!existsSync(file)) {
          throw new Error(
            `${pkg}: library ${key}: the license text ${entry.file} from libvips-libraries.json is missing`,
          );
        }
        text = readFileSync(file, 'utf8').trim();
      }
      return [
        `--- ${key} ${version}`,
        `Lizenz: ${entry.license}`,
        `Quelle: ${entry.source}`,
        '',
        text,
      ].join('\n');
    });
  for (const key of Object.keys(libvipsLibraries)) {
    if (!Object.hasOwn(versions, key)) {
      log(`libvips-libraries.json: entry ${key} is unused, it is not in versions.json of ${pkg}`);
    }
  }
  return ['Lizenzen der enthaltenen Bibliotheken:', '', blocks.join('\n\n')].join('\n');
}

/**
 * @param {string} title
 * @param {string} license
 * @param {string} text
 */
function section(title, license, text) {
  return [RULE, title, `Lizenz: ${license}`, RULE, '', text.trim()].join('\n');
}

/**
 * @param {string} path
 * @param {string} what for the message
 */
function readRequired(path, what) {
  if (!existsSync(path)) throw new Error(`${what} not found: ${path}`);
  return readFileSync(path, 'utf8').trim();
}

/**
 * @param {string} a
 * @param {string} b
 */
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Writes `THIRD-PARTY-NOTICES.txt` into the program folder.
 * @param {{ repoRoot: string, programDir: string, metafile: { inputs: Record<string, unknown> },
 *   nodeLicense: string, log?: (line: string) => void }} options
 * @returns {string} path of the written file
 */
export function collectLicenses({ repoRoot, programDir, metafile, nodeLicense, log }) {
  const missingLicenseFiles = JSON.parse(
    readFileSync(join(LICENSES_DIR, 'missing-license-files.json'), 'utf8'),
  );
  const libvipsLibraries = JSON.parse(
    readFileSync(join(LICENSES_DIR, 'libvips-libraries.json'), 'utf8'),
  );
  const packageDirs = [
    ...bundledPackageDirs(metafile, repoRoot),
    ...nativePackageDirs(join(programDir, 'app', 'node_modules')),
    ...webPackageDirs(repoRoot),
  ];
  const text = buildNotices({
    packageDirs,
    nodeLicense,
    interLicense: join(repoRoot, 'apps', 'web', 'src', 'assets', 'fonts', 'LICENSE-Inter.txt'),
    missingLicenseFiles,
    libvipsLibraries,
    log,
  });
  const target = join(programDir, NOTICES_FILE);
  writeFileSync(target, text);
  return target;
}

/** @param {string[]} args */
function main(args) {
  const [programDir, option, metafilePath] = args;
  if (!programDir || option !== '--metafile' || !metafilePath) {
    process.stderr.write('Usage: collect-licenses.mjs <program folder> --metafile <path>\n');
    process.exitCode = 1;
    return;
  }
  try {
    const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
    const target = collectLicenses({
      repoRoot,
      programDir,
      metafile: JSON.parse(readFileSync(metafilePath, 'utf8')),
      // The running Node.js is the shipped runtime; CU-276 checks its version against `.nvmrc`.
      nodeLicense: join(dirname(process.execPath), 'LICENSE'),
      log: (line) => process.stdout.write(`${line}\n`),
    });
    process.stdout.write(`Wrote ${target}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) main(process.argv.slice(2));
