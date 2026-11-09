import { existsSync, globSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

function compilerOptions(configPath: string): ts.CompilerOptions {
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  return ts.parseJsonConfigFileContent(config, ts.sys, join(configPath, '..'), {}, configPath)
    .options;
}

const STRICT_FAMILY = [
  'noImplicitAny',
  'noImplicitThis',
  'strictNullChecks',
  'strictFunctionTypes',
  'strictBindCallApply',
  'strictPropertyInitialization',
  'strictBuiltinIteratorReturn',
  'alwaysStrict',
  'useUnknownInCatchVariables',
] as const;

const workspaceConfigs = globSync('{apps,packages,tools}/*/tsconfig.json', { cwd: ROOT });

describe('strict TypeScript (E3)', () => {
  it('sets strict: true in tsconfig.base.json', () => {
    expect(compilerOptions(join(ROOT, 'tsconfig.base.json')).strict).toBe(true);
  });

  it('finds the tsconfig.json of every workspace package', () => {
    const packages = globSync('{apps,packages,tools}/*/package.json', { cwd: ROOT });
    expect(packages.length).toBeGreaterThan(0);
    for (const manifest of packages) {
      expect(existsSync(join(ROOT, manifest, '..', 'tsconfig.json')), manifest).toBe(true);
    }
  });

  it.each(['tsconfig.json', ...workspaceConfigs])(
    '%s extends tsconfig.base.json and keeps strict mode',
    (config) => {
      const { config: raw } = ts.readConfigFile(join(ROOT, config), ts.sys.readFile);
      expect(join(ROOT, config, '..', raw.extends)).toBe(join(ROOT, 'tsconfig.base.json'));

      const options = compilerOptions(join(ROOT, config));
      expect(options.strict).toBe(true);
      for (const flag of STRICT_FAMILY) expect(options[flag], flag).not.toBe(false);
    },
  );
});
