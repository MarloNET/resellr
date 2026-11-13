import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildNotices,
  bundledPackageDirs,
  checkLicense,
  collectLicenses,
  nativePackageDirs,
  readPackageNotice,
  webPackageDirs,
} from './collect-licenses.mjs';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'collect-licenses-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A package folder like the ones under `node_modules`. */
function fakePackage(
  manifest: Record<string, unknown>,
  files: Record<string, string> = {},
  base = join(root, 'node_modules'),
) {
  const dir = join(base, String(manifest['name']));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

/** Writes a file and its folder. */
function writeFile(path: string, content: string) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
  return path;
}

describe('checkLicense (FIND-222)', () => {
  it.each([
    'MIT',
    'ISC',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'Apache-2.0',
    '0BSD',
    'OFL-1.1',
    'BlueOak-1.0.0',
  ])('accepts %s', (license) => {
    expect(() => checkLicense('some-package', license)).not.toThrow();
  });

  it('accepts an OR expression with one allowed license', () => {
    expect(() => checkLicense('dual', '(MIT OR GPL-3.0-only)')).not.toThrow();
  });

  it('evaluates parentheses', () => {
    expect(() => checkLicense('nested', 'MIT AND (Apache-2.0 OR GPL-2.0-only)')).not.toThrow();
    expect(() => checkLicense('nested', '(MIT OR ISC) AND GPL-2.0-only')).toThrow(/nested/);
  });

  it('rejects an AND expression with one license that is not allowed and names the package', () => {
    expect(() => checkLicense('mixed', 'MIT AND GPL-2.0-only')).toThrow(/mixed/);
  });

  it('rejects a license that is not allowed and names the package', () => {
    expect(() => checkLicense('copyleft-package', 'GPL-3.0-only')).toThrow(
      /copyleft-package.*GPL-3\.0-only/,
    );
  });

  it('rejects a WITH exception', () => {
    expect(() => checkLicense('with-exception', 'Apache-2.0 WITH LLVM-exception')).toThrow(
      /with-exception/,
    );
  });

  it('rejects a missing license, UNLICENSED and SEE LICENSE IN, naming the package', () => {
    expect(() => checkLicense('no-license-package', undefined)).toThrow(/no-license-package/);
    expect(() => checkLicense('empty-license-package', '')).toThrow(/empty-license-package/);
    expect(() => checkLicense('unlicensed-package', 'UNLICENSED')).toThrow(/unlicensed-package/);
    expect(() => checkLicense('see-package', 'SEE LICENSE IN LICENSE.md')).toThrow(/see-package/);
  });

  it('accepts LGPL-3.0 only for the packages that carry libvips as dynamic library', () => {
    for (const license of ['LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later', 'LGPL-3.0+']) {
      expect(() => checkLicense('@img/sharp-libvips-win32-x64@1.0.0', license)).not.toThrow();
      expect(() => checkLicense('other-package@1.0.0', license)).toThrow(/other-package/);
    }
    expect(() =>
      checkLicense('@img/sharp-win32-x64@0.34.5', 'Apache-2.0 AND LGPL-3.0-or-later'),
    ).not.toThrow();
    expect(() =>
      checkLicense('@img/sharp-win32-x64-fork@0.34.5', 'Apache-2.0 AND LGPL-3.0-or-later'),
    ).toThrow(/sharp-win32-x64-fork/);
  });
});

describe('readPackageNotice', () => {
  it('reads name, version, license and the license file of a package', () => {
    const dir = fakePackage(
      { name: 'left-pad', version: '1.3.0', license: 'MIT' },
      { LICENSE: 'MIT License\n\nCopyright (c) left-pad authors\n', 'README.md': 'readme' },
    );

    expect(readPackageNotice(dir)).toEqual({
      name: 'left-pad',
      version: '1.3.0',
      license: 'MIT',
      text: 'MIT License\n\nCopyright (c) left-pad authors',
      dir,
    });
  });

  it('joins every file starting with LICENSE, LICENCE or COPYING, in any case', () => {
    const dir = fakePackage(
      { name: 'several-files', version: '2.0.0', license: 'MIT OR Apache-2.0' },
      {
        'LICENSE-APACHE': 'Apache License 2.0',
        'license-mit.md': 'MIT License',
        'Licence.txt': 'Licence',
        COPYING: 'Copying',
        NOTICE: 'not a license file',
      },
    );

    expect(readPackageNotice(dir).text).toBe(
      'Copying\n\nApache License 2.0\n\nLicence\n\nMIT License',
    );
  });

  it('reads a BlueOak-1.0.0 package with its LICENSE.md', () => {
    const dir = fakePackage(
      { name: 'glob', version: '14.0.4', license: 'BlueOak-1.0.0' },
      { 'LICENSE.md': '# Blue Oak Model License' },
    );

    expect(readPackageNotice(dir).license).toBe('BlueOak-1.0.0');
  });

  it('fails for a package with a license that is not allowed, naming the package', () => {
    const dir = fakePackage(
      { name: 'copyleft', version: '1.0.0', license: 'GPL-3.0-only' },
      { LICENSE: 'GNU GENERAL PUBLIC LICENSE' },
    );

    expect(() => readPackageNotice(dir)).toThrow(/copyleft@1\.0\.0/);
  });

  it('fails for a package without license field, naming the package', () => {
    const dir = fakePackage({ name: 'no-field', version: '1.0.0' }, { LICENSE: 'MIT License' });

    expect(() => readPackageNotice(dir)).toThrow(/no-field@1\.0\.0/);
  });

  it('fails for a package with only the deprecated licenses field', () => {
    const dir = fakePackage(
      { name: 'old-field', version: '1.0.0', licenses: [{ type: 'MIT' }] },
      { LICENSE: 'MIT License' },
    );

    expect(() => readPackageNotice(dir)).toThrow(/old-field@1\.0\.0/);
  });

  it('fails for a package without license text, naming the package', () => {
    const dir = fakePackage({ name: 'no-text', version: '1.0.0', license: 'MIT' });

    expect(() => readPackageNotice(dir)).toThrow(/no-text@1\.0\.0.*license text/);
  });

  describe('packages without license file (Nachtrag MAR-693)', () => {
    const entry = { license: 'MIT', file: 'no-file.txt', source: 'https://example.org/license' };
    let licensesDir: string;

    beforeEach(() => {
      licensesDir = join(root, 'licenses');
      writeFile(join(licensesDir, 'packages', 'no-file.txt'), 'MIT License\n\nCopyright (c) X\n');
    });

    it('takes the text from a matching entry and names its source', () => {
      const dir = fakePackage({ name: 'no-file', version: '2.0.1', license: 'MIT' });

      expect(
        readPackageNotice(dir, { missingLicenseFiles: { 'no-file': entry }, licensesDir }).text,
      ).toBe(
        'Lizenztext nicht im Paket enthalten, Quelle: https://example.org/license\n\nMIT License\n\nCopyright (c) X',
      );
    });

    it('reads the text of a scoped package from scope__name.txt', () => {
      writeFile(join(licensesDir, 'packages', 'scope__name.txt'), 'Scoped MIT License\n');
      const dir = fakePackage({ name: '@scope/name', version: '1.0.0', license: 'MIT' });
      const scoped = { ...entry, file: 'scope__name.txt' };

      expect(
        readPackageNotice(dir, { missingLicenseFiles: { '@scope/name': scoped }, licensesDir })
          .text,
      ).toBe(
        'Lizenztext nicht im Paket enthalten, Quelle: https://example.org/license\n\nScoped MIT License',
      );
    });

    it('fails if the license of the package differs from the entry', () => {
      const dir = fakePackage({ name: 'no-file', version: '2.0.1', license: 'ISC' });

      expect(() =>
        readPackageNotice(dir, { missingLicenseFiles: { 'no-file': entry }, licensesDir }),
      ).toThrow(/no-file@2\.0\.1/);
    });

    it('fails if the text file of the entry is missing', () => {
      const dir = fakePackage({ name: 'no-file', version: '2.0.1', license: 'MIT' });
      const missing = { ...entry, file: 'other.txt' };

      expect(() =>
        readPackageNotice(dir, { missingLicenseFiles: { 'no-file': missing }, licensesDir }),
      ).toThrow(/no-file@2\.0\.1.*other\.txt/);
    });

    it('fails without an entry', () => {
      const dir = fakePackage({ name: 'no-file', version: '2.0.1', license: 'MIT' });

      expect(() => readPackageNotice(dir, { missingLicenseFiles: {}, licensesDir })).toThrow(
        /no-file@2\.0\.1/,
      );
    });

    it('still checks the allowed licenses for a package with entry', () => {
      const dir = fakePackage({ name: 'no-file', version: '2.0.1', license: 'GPL-3.0-only' });
      const gpl = { ...entry, license: 'GPL-3.0-only' };

      expect(() =>
        readPackageNotice(dir, { missingLicenseFiles: { 'no-file': gpl }, licensesDir }),
      ).toThrow(/no-file@2\.0\.1.*not allowed/);
    });

    it('uses the own license file of a package and logs the unused entry', () => {
      const dir = fakePackage(
        { name: 'no-file', version: '3.0.0', license: 'MIT' },
        { LICENSE: 'Own MIT License' },
      );
      const log: string[] = [];

      const notice = readPackageNotice(dir, {
        missingLicenseFiles: { 'no-file': entry },
        licensesDir,
        log: (line) => log.push(line),
      });

      expect(notice.text).toBe('Own MIT License');
      expect(log).toEqual([expect.stringMatching(/no-file@3\.0\.0.*unused/)]);
    });
  });

  describe('libvips packages without license file (Nachtrag MAR-758)', () => {
    it('accepts a libvips package under LGPL-3.0 alone without entry and refers to the appended texts', () => {
      const dir = fakePackage(
        { name: '@img/sharp-libvips-linux-x64', version: '1.3.4', license: 'LGPL-3.0-or-later' },
        { 'versions.json': '{}', 'README.md': 'readme' },
      );

      expect(readPackageNotice(dir, { missingLicenseFiles: {} }).text).toBe(
        'Lizenztext nicht im Paket enthalten. Es gelten LGPL-3.0 und GPL-3.0, Texte am Ende dieser Datei; Bibliotheken und Quellcode im Abschnitt „libvips aus @img/sharp-libvips-linux-x64@1.3.4“.',
      );
    });

    it('fails for the same package under MIT', () => {
      const dir = fakePackage({
        name: '@img/sharp-libvips-linux-x64',
        version: '1.3.4',
        license: 'MIT',
      });

      expect(() => readPackageNotice(dir, { missingLicenseFiles: {} })).toThrow(
        /sharp-libvips-linux-x64@1\.3\.4 ships no license text/,
      );
    });

    it('fails for a libvips package with another license part', () => {
      const dir = fakePackage({
        name: '@img/sharp-win32-x64',
        version: '0.35.5',
        license: 'Apache-2.0 AND LGPL-3.0-or-later',
      });

      expect(() => readPackageNotice(dir, { missingLicenseFiles: {} })).toThrow(
        /sharp-win32-x64@0\.35\.5 ships no license text/,
      );
    });

    it('fails for an LGPL-3.0 package outside the libvips packages', () => {
      const dir = fakePackage({
        name: '@other/sharp-libvips-linux-x64',
        version: '1.3.4',
        license: 'LGPL-3.0-or-later',
      });

      expect(() => readPackageNotice(dir, { missingLicenseFiles: {} })).toThrow(
        /@other\/sharp-libvips-linux-x64@1\.3\.4.*not allowed/,
      );
    });
  });
});

describe('shipped packages (Nachtrag MAR-687)', () => {
  it('takes bundled packages from the metafile inputs under node_modules, without own code', () => {
    const metafile = {
      inputs: {
        'apps/server/src/main.ts': {},
        'packages/domain/src/index.ts': {},
        'node_modules/fastify/fastify.js': {},
        'node_modules/fastify/lib/route.js': {},
        'node_modules/@fastify/static/index.js': {},
        'node_modules/@fastify/static/node_modules/glob/dist/esm/index.js': {},
        'node_modules/@resellr/domain/src/index.ts': {},
        '(disabled):node_modules/ignored/index.js': {},
      },
    };
    const modules = join(root, 'node_modules');
    const fastify = fakePackage({ name: 'fastify' }, {}, modules);
    const fastifyStatic = fakePackage({ name: '@fastify/static' }, {}, modules);
    const glob = fakePackage({ name: 'glob' }, {}, join(fastifyStatic, 'node_modules'));
    fakePackage({ name: '@resellr/domain' }, {}, modules);

    expect(bundledPackageDirs(metafile, root).sort()).toEqual(
      [fastifyStatic, glob, fastify].sort(),
    );
  });

  describe('closure over dependencies of bundled packages (Nachtrag MAR-720)', () => {
    const metafile = (...names: string[]) => ({
      inputs: Object.fromEntries(names.map((name) => [`node_modules/${name}/index.js`, {}])),
    });

    it('adds dependencies that are not in the metafile, over two levels', () => {
      const modules = join(root, 'node_modules');
      const glob = fakePackage(
        { name: 'glob', dependencies: { minimatch: '1' } },
        {},
        join(modules, '@fastify', 'static', 'node_modules'),
      );
      const minimatch = fakePackage(
        { name: 'minimatch', dependencies: { 'brace-expansion': '1' } },
        {},
        modules,
      );
      const braceExpansion = fakePackage({ name: 'brace-expansion' }, {}, modules);

      expect(
        bundledPackageDirs(
          { inputs: { 'node_modules/@fastify/static/node_modules/glob/index.min.js': {} } },
          root,
        ).sort(),
      ).toEqual([glob, minimatch, braceExpansion].sort());
    });

    it('skips a missing optional dependency and ignores peer and dev dependencies', () => {
      const pino = fakePackage(
        {
          name: 'pino',
          optionalDependencies: { absent: '1' },
          peerDependencies: { 'peer-absent': '1' },
          devDependencies: { 'dev-absent': '1' },
        },
        {},
        join(root, 'node_modules'),
      );

      expect(bundledPackageDirs(metafile('pino'), root)).toEqual([pino]);
    });

    it('fails for a missing dependency, naming the package', () => {
      fakePackage({ name: 'ajv', dependencies: { 'require-from-string': '1' } });

      expect(() => bundledPackageDirs(metafile('ajv'), root)).toThrow(/require-from-string/);
    });

    it('lists a package in metafile and closure once', () => {
      const fastify = fakePackage({ name: 'fastify', dependencies: { pino: '1' } });
      const pino = fakePackage({ name: 'pino' });

      expect(bundledPackageDirs(metafile('fastify', 'pino'), root).sort()).toEqual(
        [fastify, pino].sort(),
      );
    });
  });

  it('takes native packages from each folder in app/node_modules, with scope', () => {
    const nativeDir = join(root, 'app', 'node_modules');
    const sqlite = fakePackage({ name: 'better-sqlite3' }, {}, nativeDir);
    const sharp = fakePackage({ name: '@img/sharp-win32-x64' }, {}, nativeDir);

    expect(nativePackageDirs(nativeDir).sort()).toEqual([sharp, sqlite].sort());
    expect(nativePackageDirs(join(root, 'missing'))).toEqual([]);
  });

  it('takes the web-ui packages from the dependency closure of apps/web plus tailwindcss', () => {
    const modules = join(root, 'node_modules');
    const webDir = join(root, 'apps', 'web');
    writeFile(
      join(webDir, 'package.json'),
      JSON.stringify({
        name: '@resellr/web',
        dependencies: { react: '1', '@resellr/domain': '1' },
        devDependencies: { vitest: '1', tailwindcss: '1' },
      }),
    );
    const react = fakePackage(
      { name: 'react', dependencies: { scheduler: '1' }, optionalDependencies: { absent: '1' } },
      {},
      modules,
    );
    const scheduler = fakePackage({ name: 'scheduler' }, {}, modules);
    fakePackage({ name: '@resellr/domain', dependencies: { zod: '1' } }, {}, modules);
    const zod = fakePackage({ name: 'zod' }, {}, modules);
    const tailwind = fakePackage({ name: 'tailwindcss' }, {}, modules);
    fakePackage({ name: 'vitest' }, {}, modules);

    expect(webPackageDirs(root, webDir).sort()).toEqual([react, scheduler, tailwind, zod].sort());
  });
});

describe('buildNotices', () => {
  let nodeLicense: string;
  let interLicense: string;

  beforeEach(() => {
    nodeLicense = writeFile(join(root, 'node', 'LICENSE'), 'Node.js is licensed under MIT');
    interLicense = writeFile(join(root, 'fonts', 'LICENSE-Inter.txt'), 'SIL Open Font License');
  });

  it('contains Node.js, Inter and each package version once, without libvips section', () => {
    const left = fakePackage(
      { name: 'left-pad', version: '1.3.0', license: 'MIT' },
      { LICENSE: 'left-pad text' },
    );
    const otherVersion = fakePackage(
      { name: 'left-pad', version: '1.0.0', license: 'MIT' },
      { LICENSE: 'old left-pad text' },
      join(root, 'nested', 'node_modules'),
    );

    const text = buildNotices({
      packageDirs: [left, otherVersion, left],
      nodeLicense,
      interLicense,
    });

    expect(text).toContain('Node.js is licensed under MIT');
    expect(text).toContain('SIL Open Font License');
    expect(text.match(/^left-pad@1\.3\.0$/gm)).toHaveLength(1);
    expect(text.match(/^left-pad@1\.0\.0$/gm)).toHaveLength(1);
    expect(text).not.toContain('libvips');
    expect(text).not.toContain('GNU LESSER GENERAL PUBLIC LICENSE');
  });

  it('fails if the license of Node.js or Inter is missing', () => {
    expect(() =>
      buildNotices({ packageDirs: [], nodeLicense: join(root, 'missing'), interLicense }),
    ).toThrow(/Node\.js/);
    expect(() =>
      buildNotices({ packageDirs: [], nodeLicense, interLicense: join(root, 'missing') }),
    ).toThrow(/Inter/);
  });

  it('adds the libvips section with versions.json, sources and the LGPL-3.0 and GPL-3.0 texts', () => {
    const sharp = fakePackage(
      {
        name: '@img/sharp-win32-x64',
        version: '0.34.5',
        license: 'Apache-2.0 AND LGPL-3.0-or-later',
      },
      { LICENSE: 'Apache License 2.0', 'versions.json': '{"vips":"8.17.3"}' },
    );

    const text = buildNotices({ packageDirs: [sharp], nodeLicense, interLicense });

    expect(text).toContain('libvips aus @img/sharp-win32-x64@0.34.5');
    expect(text).toContain('{"vips":"8.17.3"}');
    expect(text).toContain('https://github.com/libvips/libvips');
    expect(text).toContain('https://github.com/lovell/sharp-libvips');
    expect(text).toContain('GNU LESSER GENERAL PUBLIC LICENSE');
    expect(text).toContain('GNU GENERAL PUBLIC LICENSE');
  });

  it('fails for the same libvips package under another name', () => {
    const fork = fakePackage(
      { name: 'sharp-win32-x64', version: '0.34.5', license: 'Apache-2.0 AND LGPL-3.0-or-later' },
      { LICENSE: 'Apache License 2.0', 'versions.json': '{}' },
    );

    expect(() => buildNotices({ packageDirs: [fork], nodeLicense, interLicense })).toThrow(
      /sharp-win32-x64@0\.34\.5/,
    );
  });
});

describe('collectLicenses', () => {
  it('writes the packages of all three sources, Node.js and Inter into the program folder', () => {
    const modules = join(root, 'node_modules');
    const license = (name: string) => ({ LICENSE: `${name} license text` });
    fakePackage(
      { name: 'fastify', version: '5.0.0', license: 'MIT', dependencies: { pino: '1' } },
      license('fastify'),
    );
    fakePackage({ name: 'pino', version: '9.0.0', license: 'MIT' }, license('pino'));
    const programDir = join(root, 'resellr');
    fakePackage(
      { name: 'better-sqlite3', version: '12.0.0', license: 'MIT' },
      license('better-sqlite3'),
      join(programDir, 'app', 'node_modules'),
    );
    writeFile(
      join(root, 'apps', 'web', 'package.json'),
      JSON.stringify({ name: '@resellr/web', dependencies: { react: '1' } }),
    );
    writeFile(
      join(root, 'apps', 'web', 'src', 'assets', 'fonts', 'LICENSE-Inter.txt'),
      'Inter OFL',
    );
    fakePackage({ name: 'react', version: '19.0.0', license: 'MIT' }, license('react'), modules);
    fakePackage(
      { name: 'tailwindcss', version: '4.0.0', license: 'MIT' },
      license('tailwindcss'),
      modules,
    );
    const nodeLicense = writeFile(join(root, 'node', 'LICENSE'), 'Node.js license text');

    const target = collectLicenses({
      repoRoot: root,
      programDir,
      metafile: { inputs: { 'node_modules/fastify/fastify.js': {} } },
      nodeLicense,
    });

    expect(target).toBe(join(programDir, 'THIRD-PARTY-NOTICES.txt'));
    const text = readFileSync(target, 'utf8');
    for (const pkg of [
      'fastify@5.0.0',
      'pino@9.0.0',
      'better-sqlite3@12.0.0',
      'react@19.0.0',
      'tailwindcss@4.0.0',
    ]) {
      expect(text).toMatch(new RegExp(`^${pkg}$`, 'm'));
    }
    expect(text).toContain('Node.js license text');
    expect(text).toContain('Inter OFL');
  });
});
