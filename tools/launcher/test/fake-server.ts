/**
 * Stand-in for `resellr-server`, started by the supervisor through the test hook
 * `RESELLR_TEST_SERVER_ENTRY`. `FAKE_SERVER_RUNS` lists one behaviour per start, in order:
 *
 * - `ready`: answers `GET /api/ops/health` with `ready` and reports IPC `ready` with its `startId`
 * - `ready-other-start`: reports IPC `ready` with another `startId`
 * - `exit-<code>`: ends at once with this exit code
 * - `exit-<code>-after-health`: answers `starting` and ends with this code 300 ms after the first
 *   health request
 * - `aborted` / `aborted-other-start`: writes `start-result.json` for this / another start, exit 10
 * - `hang`: never reports `ready` and ignores SIGTERM, like a start that hangs (K-07)
 * - `hang-in-migration`: like `hang`, but first opens `resellr.db` in the data folder and stops in
 *   the middle of a migration run in one transaction (CU-029): `BEGIN IMMEDIATE`, a new table
 *   `half_done` with rows, a row in `app_migration`, then a line `in-migration` in `FAKE_SERVER_DIR`
 *
 * `FAKE_SERVER_DELAY_MS` lets every start wait that long before its behaviour, like a long start.
 *
 * Every start appends a JSON line with its environment to `starts.jsonl` in `FAKE_SERVER_DIR`.
 * Like the server, it ends with exit code 12 when the IPC channel closes.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { readConfiguredPort } from '@resellr/runtime-shared/configured-port';
import { writeStartResult } from '@resellr/runtime-shared/runtime-state-files';

import { FAKE_REF_NO } from './fake-programs.ts';

const dir = process.env.FAKE_SERVER_DIR!;
const startsFile = join(dir, 'starts.jsonl');
const run = existsSync(startsFile) ? readFileSync(startsFile, 'utf8').split('\n').length - 1 : 0;
const behaviour = (process.env.FAKE_SERVER_RUNS ?? 'ready').split(',')[run] ?? 'ready';
const startId = process.env.RESELLR_START_ID ?? '';
const dataDir = process.env.RESELLR_DATA_DIR!;
const logDir = process.env.RESELLR_LOG_DIR!;

appendFileSync(
  startsFile,
  `${JSON.stringify({
    behaviour,
    pid: process.pid,
    ipc: typeof process.send === 'function',
    env: Object.fromEntries(
      Object.entries(process.env).filter(([name]) => name.startsWith('RESELLR_')),
    ),
  })}\n`,
);

process.on('disconnect', () => process.exit(12));

const delayMs = Number(process.env.FAKE_SERVER_DELAY_MS ?? 0);
if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

function serveHealth(state: 'ready' | 'starting', onRequest: () => void = () => {}) {
  const server = createServer((_, response) => {
    onRequest();
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ state, startId }));
  });
  server.listen(readConfiguredPort(dataDir).port, '127.0.0.1');
  return server;
}

const exitMatch = /^exit-(\d+)(-after-health)?$/.exec(behaviour);
if (behaviour === 'ready') {
  serveHealth('ready').on('listening', () => process.send?.({ type: 'ready', startId }));
} else if (behaviour === 'ready-other-start') {
  process.send?.({ type: 'ready', startId: 'another-start' });
} else if (behaviour === 'aborted' || behaviour === 'aborted-other-start') {
  mkdirSync(logDir, { recursive: true });
  writeStartResult(logDir, {
    startId: behaviour === 'aborted' ? startId : 'another-start',
    state: 'aborted',
    refNo: FAKE_REF_NO,
    at: new Date().toISOString(),
  });
  process.exit(10);
} else if (behaviour === 'hang' || behaviour === 'hang-in-migration') {
  if (behaviour === 'hang-in-migration') beginMigrationAndStop();
  process.on('SIGTERM', () => {});
  setInterval(() => {}, 60_000);
} else if (exitMatch?.[2]) {
  let asked = false;
  serveHealth('starting', () => {
    if (asked) return;
    asked = true;
    setTimeout(() => process.exit(Number(exitMatch[1])), 300);
  });
} else if (exitMatch) {
  process.exit(Number(exitMatch[1]));
} else {
  throw new Error(`Unknown behaviour ${behaviour}`);
}

/** Opens `resellr.db` like the server and leaves a migration run open in its transaction. */
function beginMigrationAndStop() {
  const db = new DatabaseSync(join(dataDir, 'resellr.db'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(
    'CREATE TABLE IF NOT EXISTS app_migration (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)',
  );
  db.exec('BEGIN IMMEDIATE');
  db.exec('CREATE TABLE half_done (id INTEGER PRIMARY KEY, note TEXT NOT NULL)');
  const insert = db.prepare('INSERT INTO half_done (note) VALUES (?)');
  for (let row = 0; row < 5000; row++) insert.run(`row ${row} `.repeat(20));
  db.prepare('INSERT INTO app_migration (name, applied_at) VALUES (?, ?)').run(
    '20261101_0002_test_hanging',
    new Date().toISOString(),
  );
  writeFileSync(join(dir, 'in-migration'), `${process.pid}\n`);
}
