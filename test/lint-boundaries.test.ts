import { join } from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const FIXTURES = join(import.meta.dirname, 'fixtures', 'lint-boundaries');

// The fixtures are ignored by `npm run lint`; here they are linted on purpose.
const eslint = new ESLint({ cwd: ROOT, ignore: false });

async function boundaryErrors(fixture: string): Promise<string[]> {
  const [result] = await eslint.lintFiles([join(FIXTURES, fixture)]);
  return result!.messages
    .filter((message) => message.ruleId === 'boundaries/dependencies')
    .map((message) => message.message);
}

describe('import boundaries from Technical Specification 4.1 (E2)', () => {
  it('fails on an import into the internals of another server component', async () => {
    expect(await boundaryErrors('apps/server/src/inventory/cross-component-internal.ts')).toEqual([
      expect.stringContaining('server-component'),
    ]);
  });

  it('allows an import of another server component through its index.ts', async () => {
    expect(await boundaryErrors('apps/server/src/inventory/cross-component-public.ts')).toEqual([]);
  });

  it('fails on an import from web-ui into the server', async () => {
    expect(await boundaryErrors('apps/web/src/server-import.ts')).toEqual([
      expect.stringContaining('web'),
    ]);
  });

  it('fails on an import from content-engine outside packages/domain', async () => {
    expect(await boundaryErrors('packages/domain/src/content-engine/runtime-import.ts')).toEqual([
      expect.stringContaining('content-engine'),
    ]);
  });

  it('allows a server component to use runtime-shared', async () => {
    expect(await boundaryErrors('apps/server/src/inventory/runtime-import.ts')).toEqual([]);
  });

  it('lets the server entry use components only through their index.ts', async () => {
    expect(await boundaryErrors('apps/server/src/main.ts')).toEqual([]);
    expect(await boundaryErrors('apps/server/src/app.ts')).toEqual([
      expect.stringContaining('server-component'),
    ]);
  });

  it('lets main.ts build the app from app.ts', async () => {
    expect(await boundaryErrors('apps/server/src/main.ts')).toEqual([]);
  });

  it('fails on an import of main.ts from app.ts (no cycle, Nachtrag MAR-240)', async () => {
    expect(await boundaryErrors('entry-cycle/apps/server/src/app.ts')).toEqual([
      expect.stringContaining('server-entry'),
    ]);
  });

  it('makes the lint run fail on a boundary violation', async () => {
    const results = await eslint.lintFiles([
      join(FIXTURES, 'apps/server/src/inventory/cross-component-internal.ts'),
    ]);

    expect(ESLint.getErrorResults(results)).toHaveLength(1);
  });
});
