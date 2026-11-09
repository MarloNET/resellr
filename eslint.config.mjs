// Lint rules for the whole workspace (CU-002): code format via Prettier and the import
// boundaries between components from Technical Specification 4.1.
import { builtinModules } from 'node:module';

import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const SOURCE_FILES = ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'];

// Element patterns match from the right end of a path, so the lint fixtures under
// `test/fixtures/` are classified exactly like the production code they mimic.
const ELEMENTS = [
  { type: 'server-shared', pattern: 'apps/server/src/shared' },
  { type: 'server-db', pattern: 'apps/server/src/db' },
  { type: 'server-component', pattern: 'apps/server/src/*', capture: ['component'] },
  { type: 'server-test-support', pattern: 'apps/server/test' },
  { type: 'web', pattern: 'apps/web/src' },
  { type: 'content-engine', pattern: 'packages/domain/src/content-engine' },
  { type: 'domain', pattern: 'packages/domain' },
  { type: 'runtime-shared', pattern: 'packages/runtime-shared' },
  { type: 'seed-data', pattern: 'packages/seed-data' },
  { type: 'test-data', pattern: 'packages/test-data' },
  { type: 'tool', pattern: 'tools/*', capture: ['tool'] },
  { type: 'e2e', pattern: 'e2e' },
];

// `main.ts` and `app.ts` are single files, not folders, so they are file categories.
const FILES = [
  { category: 'server-entry', pattern: '**/apps/server/src/{main,app}.ts' },
  { category: 'test', pattern: '**/*.{test,int.test,spec}.{ts,tsx}' },
];

const to = (...types) => ({ to: { element: { types: { anyOf: types } } } });
const PUBLIC_COMPONENT_API = {
  to: { element: { type: 'server-component', fileInternalPath: 'index.ts' } },
};

const DOMAIN = ['domain', 'content-engine'];
const SERVER_BASE = ['server-shared', 'server-db', ...DOMAIN, 'runtime-shared'];

const POLICIES = [
  // Server components use shared/, db/, domain and runtime-shared freely, but another
  // component only through its public `index.ts`; the same holds for main.ts and app.ts.
  { from: { element: { type: 'server-component' } }, allow: to(...SERVER_BASE) },
  { from: { element: { type: 'server-component' } }, allow: PUBLIC_COMPONENT_API },
  { from: { file: { categories: 'server-entry' } }, allow: to(...SERVER_BASE) },
  { from: { file: { categories: 'server-entry' } }, allow: PUBLIC_COMPONENT_API },
  // main.ts builds the app from app.ts (CU-018, CU-019).
  {
    from: { file: { categories: 'server-entry' } },
    allow: { to: { file: { categories: 'server-entry' } } },
  },
  {
    from: { element: { type: 'server-db' } },
    allow: to('server-shared', ...DOMAIN, 'runtime-shared'),
  },
  { from: { element: { type: 'server-shared' } }, allow: to(...DOMAIN, 'runtime-shared') },
  {
    from: { element: { type: 'server-test-support' } },
    allow: [
      to('server-component', ...SERVER_BASE, 'seed-data', 'test-data'),
      { to: { file: { categories: 'server-entry' } } },
    ],
  },
  { from: { file: { categories: 'test' } }, allow: to('server-test-support', 'test-data') },
  { from: { element: { type: 'web' } }, allow: to(...DOMAIN) },
  // `content-engine` may import nothing except `packages/domain` (4.1).
  { from: { element: { type: 'content-engine' } }, allow: to('domain') },
  { from: { element: { type: 'domain' } }, allow: to('content-engine') },
  { from: { element: { type: 'seed-data' } }, allow: to(...DOMAIN) },
  { from: { element: { type: 'test-data' } }, allow: to(...DOMAIN, 'seed-data') },
  {
    from: { element: { type: 'tool' } },
    allow: to(...DOMAIN, 'runtime-shared', 'seed-data', 'test-data'),
  },
  { from: { element: { type: 'e2e' } }, allow: to(...DOMAIN, 'runtime-shared', 'test-data') },
];

const NODE_BUILTINS = [...builtinModules, ...builtinModules.map((name) => `node:${name}`)];

export default defineConfig(
  {
    ignores: ['**/node_modules/', '**/dist/', '**/coverage/', 'test/fixtures/'],
  },
  {
    files: SOURCE_FILES,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    files: SOURCE_FILES,
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': import.meta.dirname,
      'boundaries/elements': ELEMENTS,
      'boundaries/elements-single-match': true,
      'boundaries/files': FILES,
      'boundaries/include': SOURCE_FILES,
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      'boundaries/dependencies': ['error', { default: 'disallow', policies: POLICIES }],
    },
  },
  {
    // `packages/domain` holds no input/output (4.1).
    files: ['packages/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: NODE_BUILTINS.map((name) => ({ name, message: 'packages/domain has no I/O.' })) },
      ],
    },
  },
  prettierRecommended,
);
