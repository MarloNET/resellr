import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ExitCode } from '@resellr/runtime-shared/exit-codes';
import { resolveRuntimePaths } from '@resellr/runtime-shared/paths';

import { buildApp } from './app.ts';
import { LISTEN_HOST } from './http/index.ts';
import {
  createErrorLog,
  createLifecycleState,
  createOperationsLog,
  runStartup,
} from './ops/index.ts';
import { createClockFromArgs } from './shared/clock.ts';

const APP_VERSION = '0.1.0';

const paths = resolveRuntimePaths();
const startId = process.env.RESELLR_START_ID || null;
const clock = createClockFromArgs(process.argv);
const errorLog = createErrorLog({
  dir: paths.logDir,
  appVersion: APP_VERSION,
  startId,
  now: clock.now,
});
const operationsLog = createOperationsLog({
  dir: paths.logDir,
  appVersion: APP_VERSION,
  startId,
  now: clock.now,
});
const lifecycle = createLifecycleState();
const webRoot = fileURLToPath(new URL('../../web/dist', import.meta.url));

const result = await runStartup({
  paths,
  // `resellr-node.exe` lies in the program folder (2.19).
  programDir: dirname(process.execPath),
  homeDir: homedir(),
  appVersion: APP_VERSION,
  startId,
  clock,
  errorLog,
  lifecycle,
  host: LISTEN_HOST,
  buildApp: ({ port, database }) =>
    buildApp({
      port,
      database,
      webRoot,
      errorLog,
      lifecycle,
      ops: { startId, dataDirPath: paths.dataDir, appVersion: APP_VERSION },
      operationsLog,
      now: clock.now,
      // After an orderly shutdown (2.17 step 7): exit code 0, the supervisor restarts nothing.
      exit: (code) => process.exit(code),
    }).app,
});

if (result.state === 'aborted') {
  process.exitCode = ExitCode.StartAborted;
} else {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      lifecycle.set('stopping');
      void result.close().then(() => process.exit(0));
    });
  }
}
