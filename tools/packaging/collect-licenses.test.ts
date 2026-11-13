import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildNotices,
  bundledPackageDirs,
  checkLicense,
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

    expect(bundledPackageDirs(metafile, '/repo').sort()).toEqual(
      [
        join('/repo', 'node_modules', '@fastify', 'static'),
        join('/repo', 'node_modules', '@fastify', 'static', 'node_modules', 'glob'),
        join('/repo', 'node_modules', 'fastify'),
      ].sort(),
    );
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
