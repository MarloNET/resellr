import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ExitCode } from '@resellr/runtime-shared/exit-codes';
import { IS_BUNDLED, programFolderPaths, resolveRuntimePaths } from '@resellr/runtime-shared/paths';

import { buildApp } from './app.ts';
import { LISTEN_HOST } from './http/index.ts';
import {
  createErrorLog,
  createLifecycleState,
  createOperationsLog,
  createSupervisorIpc,
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
// Before the start, so a channel that closes during the start is noticed afterwards (H-13).
const supervisorIpc = createSupervisorIpc(process, startId);
// `resellr-node.exe` lies in the program folder (2.19).
const programDir = dirname(process.execPath);
const webRoot = IS_BUNDLED
  ? programFolderPaths(programDir).webRoot
  : fileURLToPath(new URL('../../web/dist', import.meta.url));

const result = await runStartup({
  paths,
  programDir,
  homeDir: homedir(),
  appVersion: APP_VERSION,
  startId,
  clock,
  errorLog,
  lifecycle,
  host: LISTEN_HOST,
  supervisorIpc,
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
      clock,
      // After an orderly shutdown (2.17 step 7): exit code 0, the supervisor restarts nothing.
      exit: (code) => process.exit(code),
    }).app,
});

if (result.state === 'aborted') {
  process.exitCode = ExitCode.StartAborted;
} else {
  let closing = false;
  const closeAndExit = (code: number) => {
    if (closing) return;
    closing = true;
    lifecycle.set('stopping');
    void result.close().then(() => process.exit(code));
  };
  // Linux only (development, CI, tests): no orderly shutdown of 2.17, no end marker.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => closeAndExit(0));
  }
  // Coupling (H-13, S-3): without the supervisor the server ends in order; SQLite checkpoints the
  // WAL file when the last connection closes.
  supervisorIpc.onSupervisorLost(() => closeAndExit(ExitCode.SupervisorLost));
}
