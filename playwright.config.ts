import { defineConfig } from '@playwright/test';

import type { AppFixtureOptions } from './e2e/fixtures/app-fixture.ts';

/**
 * Window-size matrix FM-1 to FM-7 (Technical Specification 6.3, REQ-077): CSS pixels of the
 * viewport; page zoom and display scaling are modelled as a smaller viewport with a matching
 * `deviceScaleFactor`.
 */
const WINDOW_SIZE_MATRIX = [
  { name: 'FM-1', width: 1366, height: 600, deviceScaleFactor: 1 },
  { name: 'FM-2', width: 1366, height: 520, deviceScaleFactor: 1 },
  { name: 'FM-3', width: 1092, height: 480, deviceScaleFactor: 1.25 },
  { name: 'FM-4', width: 910, height: 400, deviceScaleFactor: 1.5 },
  { name: 'FM-5', width: 480, height: 600, deviceScaleFactor: 1 },
  { name: 'FM-6', width: 1920, height: 950, deviceScaleFactor: 1 },
  { name: 'FM-7', width: 480, height: 1000, deviceScaleFactor: 1 },
] as const;

/** FM-7 checks only the narrow view of UI-019; the tests for it carry this tag (6.3). */
const FM_7_TAG = /@fm-7/;

const DEMO_START_SPEC = 'demo-start.spec.ts';
/** The launcher pages are `file://` pages without a server (2.18, 6.1); they set their own viewports. */
const LAUNCHER_PAGES_SPEC = 'launcher-pages.spec.ts';
/** The complete run of REQ-106 under `strace` does not depend on the window size; it runs once. */
const WRITE_PATHS_SPEC = 'write-paths.spec.ts';

/**
 * E2E foundation (CU-062, Technical Specification 6.1): Playwright in Google Chrome (channel
 * `chrome`), one project per row of the window-size matrix. All flows run in FM-1 to FM-6, FM-7
 * only runs tests tagged `@fm-7`. Each test worker starts its own server with its own data
 * folder (`e2e/fixtures/app-fixture.ts`). The project `demo-start` runs `npm run demo` first; it
 * also builds the user interface the matrix projects serve. The project `write-paths` observes
 * the file writes of the server along a complete run once (REQ-106, Technical Specification 6.2).
 * The project `launcher-pages` checks the built launcher pages without a server.
 */
export default defineConfig<object, AppFixtureOptions>({
  testDir: 'e2e',
  fullyParallel: true,
  // The CI runner has 2 vCPUs, so Playwright would start 1 worker. Each worker starts its own
  // server (app fixture), so 2 workers run side by side (Technical Specification 10.2, MAR-787).
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'demo-start',
      testMatch: DEMO_START_SPEC,
      use: { viewport: { width: 1366, height: 600 }, deviceScaleFactor: 1 },
    },
    {
      name: 'launcher-pages',
      testMatch: LAUNCHER_PAGES_SPEC,
      use: { viewport: { width: 480, height: 600 }, deviceScaleFactor: 1 },
    },
    {
      name: 'write-paths',
      testMatch: WRITE_PATHS_SPEC,
      dependencies: ['demo-start'],
      use: {
        viewport: { width: 1366, height: 600 },
        deviceScaleFactor: 1,
        observeFileWrites: true,
      },
    },
    ...WINDOW_SIZE_MATRIX.map(({ name, width, height, deviceScaleFactor }) => ({
      name,
      testIgnore: [DEMO_START_SPEC, LAUNCHER_PAGES_SPEC, WRITE_PATHS_SPEC],
      dependencies: ['demo-start'],
      ...(name === 'FM-7' && { grep: FM_7_TAG }),
      use: { viewport: { width, height }, deviceScaleFactor },
    })),
  ],
});
