import { fileURLToPath } from 'node:url';

import { resolveRuntimePaths } from '@resellr/runtime-shared/paths';

import { buildApp } from './app.ts';
import { LISTEN_HOST } from './http/index.ts';
import { createErrorLog, createLifecycleState } from './ops/index.ts';
import { createClock, TEST_CLOCK_FLAG } from './shared/clock.ts';

// Standard port of `config.json` (Technical Specification 2.19); the configuration file and
// the startup sequence follow with #112.
const DEFAULT_PORT = 4310;
const APP_VERSION = '0.1.0';

const paths = resolveRuntimePaths();
const clock = createClock({ testClock: process.argv.includes(TEST_CLOCK_FLAG) });
const errorLog = createErrorLog({
  dir: paths.logDir,
  appVersion: APP_VERSION,
  startId: process.env.RESELLR_START_ID || null,
  now: clock.now,
});
const lifecycle = createLifecycleState();
const { app } = buildApp({
  port: DEFAULT_PORT,
  webRoot: fileURLToPath(new URL('../../web/dist', import.meta.url)),
  errorLog,
  lifecycle,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    lifecycle.set('stopping');
    void app.close().then(() => process.exit(0));
  });
}

// Replaced by the startup sequence (CU-040) with #112. A failure to listen ends the process
// with a code other than 0.
await app.listen({ host: LISTEN_HOST, port: DEFAULT_PORT });
lifecycle.set('ready');
