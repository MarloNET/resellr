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
  createSupervisorIpc,
  runStartup,
} from './ops/index.ts';
import { createClock, TEST_CLOCK_FLAG } from './shared/clock.ts';

const APP_VERSION = '0.1.0';

const paths = resolveRuntimePaths();
const startId = process.env.RESELLR_START_ID || null;
const clock = createClock({ testClock: process.argv.includes(TEST_CLOCK_FLAG) });
const errorLog = createErrorLog({
  dir: paths.logDir,
  appVersion: APP_VERSION,
  startId,
  now: clock.now,
});
const lifecycle = createLifecycleState();
// Before the start, so a channel that closes during the start is noticed afterwards (H-13).
const supervisorIpc = createSupervisorIpc(process, startId);
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
  supervisorIpc,
  buildApp: ({ port, db }) =>
    buildApp({
      port,
      db,
      webRoot,
      errorLog,
      lifecycle,
      ops: { startId, dataDirPath: paths.dataDir, appVersion: APP_VERSION },
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
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => closeAndExit(0));
  }
  // Coupling (H-13, S-3): without the supervisor the server ends in order; closing the database
  // checkpoints the WAL file.
  supervisorIpc.onSupervisorLost(() => closeAndExit(ExitCode.SupervisorLost));
}
