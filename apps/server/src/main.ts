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
import { type Clock, createClockFromArgs } from './shared/clock.ts';

const APP_VERSION = '0.1.0';

// An invalid `--test-clock` value aborts before the startup sequence, without touching the data
// and log folder (Nachtrag MAR-424); an unhandled error would end with exit code 1, a crash (2.18).
let clock: Clock;
try {
  clock = createClockFromArgs(process.argv);
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(ExitCode.StartAborted);
}

const paths = resolveRuntimePaths();
const startId = process.env.RESELLR_START_ID || null;
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
  // Linux only (development, CI, tests): no orderly shutdown of 2.17, no end marker.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      lifecycle.set('stopping');
      void result.close().then(() => process.exit(0));
    });
  }
}
