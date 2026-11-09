import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildApp } from '../src/app.ts';
import { createErrorLog, createLifecycleState } from '../src/ops/index.ts';

export const TEST_PORT = 4310;
export const HOST = `127.0.0.1:${TEST_PORT}`;
export const ORIGIN = `http://${HOST}`;

/** Headers Chrome sends with a write request from the own user interface (2.0.2). */
export const SAME_ORIGIN_WRITE = {
  host: HOST,
  origin: ORIGIN,
  'sec-fetch-site': 'same-origin',
  'content-type': 'application/json',
} as const;

export const INDEX_HTML = '<!doctype html><title>resellr</title>';
export const ASSET_JS = 'console.log("resellr");';

/**
 * Builds the app with a temporary log folder and a test web folder holding an `index.html`
 * (the real user interface follows with #113). Routes for a test are added before `ready()`.
 */
export function createTestApp() {
  const root = mkdtempSync(join(tmpdir(), 'resellr-server-'));
  const logDir = join(root, 'Protokolle');
  const webRoot = join(root, 'web');
  mkdirSync(join(webRoot, 'assets'), { recursive: true });
  writeFileSync(join(webRoot, 'index.html'), INDEX_HTML);
  writeFileSync(join(webRoot, 'assets', 'app.js'), ASSET_JS);
  writeFileSync(join(webRoot, 'assets', '.hidden'), 'not served');

  const errorLog = createErrorLog({ dir: logDir, appVersion: '0.1.0-test', startId: null });
  const lifecycle = createLifecycleState('ready');
  const { app, writeGate } = buildApp({ port: TEST_PORT, webRoot, errorLog, lifecycle });

  /** All entries of the error log, oldest first. */
  const readErrorLog = (): Record<string, unknown>[] => {
    let names: string[];
    try {
      names = readdirSync(logDir).sort();
    } catch {
      return [];
    }
    return names.flatMap((name) =>
      readFileSync(join(logDir, name), 'utf8')
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    );
  };

  const close = async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  };

  return { app, lifecycle, writeGate, webRoot, readErrorLog, close };
}
