import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SERVER_DIR = 'apps/server';

/** Libraries whose purpose is to send HTTP requests (REQ-079, Technical Specification 2.20). */
const HTTP_CLIENT_LIBRARIES = [
  '@fastify/http-proxy',
  '@fastify/reply-from',
  '@hapi/wreck',
  '@octokit/request',
  'axios',
  'bent',
  'centra',
  'cross-fetch',
  'follow-redirects',
  'gaxios',
  'got',
  'http-proxy',
  'isomorphic-fetch',
  'ky',
  'make-fetch-happen',
  'minipass-fetch',
  'needle',
  'node-fetch',
  'node-libcurl',
  'ofetch',
  'phin',
  'request',
  'simple-get',
  'superagent',
  'undici',
  'urllib',
  'wretch',
];

/**
 * `simple-get` downloads the prebuilt binary of `better-sqlite3` while `npm install` runs
 * (`prebuild-install`); the server never loads it.
 */
const INSTALL_TIME_ONLY = [{ name: 'simple-get', below: 'prebuild-install' }];

interface Manifest {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface LockEntry {
  name?: string;
  link?: boolean;
  resolved?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;

const httpClientsIn = (names: string[]) =>
  names.filter((name) => HTTP_CLIENT_LIBRARIES.includes(name));

/** Workspace packages the server source imports, e.g. `packages/domain`. */
function importedWorkspaceDirs(): string[] {
  const workspaceDirs = new Map(
    readdirSync(join(ROOT, 'packages')).map((dir) => [
      readJson<Manifest>(`packages/${dir}/package.json`).name,
      `packages/${dir}`,
    ]),
  );
  const source = readdirSync(join(ROOT, SERVER_DIR, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => readFileSync(join(ROOT, SERVER_DIR, 'src', file), 'utf8'))
    .join('\n');
  const names = new Set([...source.matchAll(/from '(@resellr\/[a-z-]+)/g)].map(([, name]) => name));
  return [...names].map((name) => {
    const dir = workspaceDirs.get(name!);
    if (dir === undefined) throw new Error(`${name} is no workspace package`);
    return dir;
  });
}

/** The dependency list of a manifest: `dependencies` and `devDependencies`. */
const dependencyList = (manifest: Manifest) => [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {}),
];

/**
 * Every package the server needs at runtime according to `package-lock.json`, starting at the
 * `dependencies` of `dirs`, resolved like Node: from the nearest `node_modules` upwards. Each
 * package comes with the chain of packages that pulls it in.
 */
function runtimeClosure(dirs: string[]): { name: string; chain: string[] }[] {
  const { packages } = readJson<{ packages: Record<string, LockEntry> }>('package-lock.json');
  const resolve = (from: string, name: string): string => {
    for (let dir = from; ; dir = dir === '.' || dir === '' ? '' : dirname(dir)) {
      const path = dir === '' ? `node_modules/${name}` : `${dir}/node_modules/${name}`;
      if (packages[path] !== undefined) return path;
      if (dir === '') throw new Error(`${name} below ${from} is missing in package-lock.json`);
    }
  };
  const found: { name: string; chain: string[] }[] = [];
  const seen = new Set<string>();
  const visit = (path: string, chain: string[]) => {
    const entry = packages[path]!;
    const location = entry.link ? entry.resolved! : path;
    if (seen.has(location)) return;
    seen.add(location);
    const deps = {
      ...packages[location]!.dependencies,
      ...packages[location]!.optionalDependencies,
    };
    for (const name of Object.keys(deps)) {
      found.push({ name, chain });
      visit(resolve(location, name), [...chain, name]);
    }
  };
  for (const dir of dirs) visit(dir, []);
  return found;
}

describe('REQ-079 no HTTP client library in apps/server (Technical Specification 2.20, 6.2)', () => {
  it('the dependency list of apps/server contains no HTTP client library', () => {
    expect(httpClientsIn(dependencyList(readJson<Manifest>(`${SERVER_DIR}/package.json`)))).toEqual(
      [],
    );
  });

  it('the dependency lists of the workspace packages the server imports contain none', () => {
    const dirs = importedWorkspaceDirs();

    expect(dirs).toEqual(expect.arrayContaining(['packages/domain', 'packages/runtime-shared']));
    for (const dir of dirs) {
      expect(httpClientsIn(dependencyList(readJson<Manifest>(`${dir}/package.json`))), dir).toEqual(
        [],
      );
    }
  });

  it('no runtime dependency of the server pulls in an HTTP client library', () => {
    const closure = runtimeClosure([SERVER_DIR, ...importedWorkspaceDirs()]);
    const clients = closure.filter(
      ({ name, chain }) =>
        HTTP_CLIENT_LIBRARIES.includes(name) &&
        !INSTALL_TIME_ONLY.some(
          (allowed) => allowed.name === name && chain.at(-1) === allowed.below,
        ),
    );

    expect(closure.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['fastify', 'better-sqlite3', 'zod']),
    );
    expect(clients).toEqual([]);
  });

  it('detects an HTTP client library in a dependency list', () => {
    const manifest: Manifest = {
      name: 'example',
      dependencies: { fastify: '5.0.0', axios: '1.0.0' },
      devDependencies: { undici: '7.0.0' },
    };

    expect(httpClientsIn(dependencyList(manifest))).toEqual(['axios', 'undici']);
  });
});
