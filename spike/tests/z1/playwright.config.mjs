import path from 'node:path';
import { defineConfig } from '@playwright/test';

const resultsDir = path.resolve(process.env.Z1_RESULTS_DIR ?? 'z1-results');

export default defineConfig({
  testDir: '.',
  testMatch: 'z1.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  outputDir: path.join(resultsDir, 'test-output'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(resultsDir, 'playwright-report'), open: 'never' }],
    ['json', { outputFile: path.join(resultsDir, 'playwright-report.json') }],
  ],
  use: {
    channel: process.env.Z1_CHANNEL ?? 'chrome',
    headless: true,
    screenshot: 'off',
  },
});
