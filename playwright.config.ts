import { defineConfig } from '@playwright/test';

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

/**
 * E2E foundation (CU-062, Technical Specification 6.1): Playwright in Google Chrome (channel
 * `chrome`), one project per row of the window-size matrix. All flows run in FM-1 to FM-6, FM-7
 * only runs tests tagged `@fm-7`. Each test worker starts its own server with its own data
 * folder (`e2e/fixtures/app-fixture.ts`). The project `demo-start` runs `npm run demo` first; it
 * also builds the user interface the matrix projects serve. The project `launcher-pages` checks
 * the built launcher pages without a server.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
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
    ...WINDOW_SIZE_MATRIX.map(({ name, width, height, deviceScaleFactor }) => ({
      name,
      testIgnore: [DEMO_START_SPEC, LAUNCHER_PAGES_SPEC],
      dependencies: ['demo-start'],
      ...(name === 'FM-7' && { grep: FM_7_TAG }),
      use: { viewport: { width, height }, deviceScaleFactor },
    })),
  ],
});
