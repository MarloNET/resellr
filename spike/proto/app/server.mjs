// resellr-spike server prototype (throwaway, Windows spike Schnitt 0).
// Instance lock, SQLite in WAL mode, sharp, HTTP on 127.0.0.1:4310, IPC ready.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PORT = 4310;
const HOST = '127.0.0.1';
const EXIT_STOPPED = 0;
const EXIT_ABORTED = 10;
const EXIT_ALREADY_RUNNING = 11;
const EXIT_SUPERVISOR_LOST = 12;

const appDir = path.dirname(fileURLToPath(import.meta.url));
const localAppData = process.env.LOCALAPPDATA ?? os.tmpdir();
const baseDir = path.join(localAppData, 'resellr-spike');
const dataDir = path.join(baseDir, 'Daten');
const logDir = path.join(baseDir, 'Protokolle');
const opsLogFile = path.join(logDir, 'operations.jsonl');
const startResultFile = path.join(logDir, 'start-result.json');
const startId = process.env.RESELLR_SPIKE_START_ID ?? crypto.randomUUID();

function log(event, fields = {}) {
  fs.mkdirSync(logDir, { recursive: true });
  const line = JSON.stringify({ ts: Date.now(), pid: process.pid, role: 'server', event, startId, ...fields });
  fs.appendFileSync(opsLogFile, line + '\n');
}

const REF_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function newRefNo() {
  const chars = [...crypto.randomBytes(8)].map((b) => REF_ALPHABET[b % 32]).join('');
  return `R-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      if (attempt >= 20) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
}

function abortStart(reason, extra = {}) {
  const refNo = newRefNo();
  writeJsonAtomic(startResultFile, { startId, state: 'aborted', refNo, at: new Date().toISOString() });
  log('start_aborted', { refNo, reason, ...extra });
  process.exit(EXIT_ABORTED);
}

const t0 = Date.now();
log('server_boot', {
  ipc: typeof process.send === 'function',
  execPath: process.execPath,
  node: process.version,
  modulesAbi: process.versions.modules,
});

const tImport = Date.now();
const { default: Database } = await import('better-sqlite3');
let importMs = Date.now() - tImport;

// Instance lock (H-8, H-14): an OS file lock held until process end. Taken before anything else
// touches the data folder, so a second server ends without further file access.
fs.mkdirSync(dataDir, { recursive: true });
const lockDb = new Database(path.join(dataDir, 'instance.lock'), { timeout: 0 });
try {
  lockDb.pragma('locking_mode = EXCLUSIVE');
  lockDb.exec('BEGIN EXCLUSIVE');
} catch (err) {
  log('lock_busy', { code: err.code ?? null, message: err.message });
  process.exit(EXIT_ALREADY_RUNNING);
}
log('lock_acquired');

const tImportSharp = Date.now();
const { default: sharp } = await import('sharp');
importMs += Date.now() - tImportSharp;
const modulePaths = {
  betterSqlite3: fileURLToPath(import.meta.resolve('better-sqlite3')),
  sharp: fileURLToPath(import.meta.resolve('sharp')),
};

if (process.env.SPIKE_ABORT === '1') {
  // Stands in for a failing start check; the delay lets a waiting `open` subscribe first.
  const delayMs = Number(process.env.SPIKE_ABORT_DELAY_MS ?? 3000);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  abortStart('spike_abort', { delayMs });
}

const db = new Database(path.join(dataDir, 'resellr.db'));
const journalMode = db.pragma('journal_mode = WAL', { simple: true });
db.pragma('synchronous = FULL');
const integrity = db.pragma('integrity_check', { simple: true });
log('integrity_check', { result: integrity, journalMode });
db.exec('CREATE TABLE IF NOT EXISTS spike_item (id INTEGER PRIMARY KEY, start_id TEXT NOT NULL, n INTEGER NOT NULL, payload TEXT NOT NULL)');

// Self test for S-5: 1000 rows and two sharp outputs.
const tDb = Date.now();
const insert = db.prepare('INSERT INTO spike_item (start_id, n, payload) VALUES (?, ?, ?)');
db.transaction(() => {
  for (let n = 0; n < 1000; n++) insert.run(startId, n, `row-${n}`);
})();
const rowsRead = db.prepare('SELECT n FROM spike_item WHERE start_id = ? ORDER BY n').all(startId);
const rowsOk = rowsRead.length === 1000 && rowsRead.every((row, i) => row.n === i);
const dbMs = Date.now() - tDb;

const tSharp = Date.now();
const selftestDir = path.join(dataDir, 'selftest');
fs.mkdirSync(selftestDir, { recursive: true });
const input = path.join(appDir, 'assets', 'test-4000x3000.jpg');
const outputs = [];
for (const width of [1600, 320]) {
  const out = path.join(selftestDir, `out-${width}.jpg`);
  const info = await sharp(input).resize({ width }).jpeg({ quality: 80 }).toFile(out);
  outputs.push({ file: out, width: info.width, height: info.height, size: info.size });
}
const sharpMs = Date.now() - tSharp;
log('selftest', {
  modulePaths,
  importMs,
  journalMode,
  rowsWritten: 1000,
  rowsRead: rowsRead.length,
  rowsOk,
  dbMs,
  sharpVersion: sharp.versions,
  sharpOutputs: outputs,
  sharpMs,
});

let stopping = false;

function closeDatabases() {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
  } catch (err) {
    log('close_error', { message: err.message });
  }
  try {
    lockDb.close();
  } catch {
    // process exit releases the lock anyway
  }
}

const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/ops/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: stopping ? 'stopping' : 'ready', startId, pid: process.pid }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/ops/shutdown') {
    if (stopping) {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 'shutting_down' }));
      return;
    }
    stopping = true;
    log('shutdown_requested');
    closeDatabases();
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' });
    res.end(JSON.stringify({ status: 'stopping', startId }), () => {
      log('shutdown_response_sent');
      httpServer.close();
      setTimeout(() => process.exit(EXIT_STOPPED), 100);
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code: 'not_found' }));
});

httpServer.on('error', (err) => abortStart('listen_failed', { code: err.code ?? null }));

process.on('disconnect', () => {
  log('ipc_disconnect');
  closeDatabases();
  process.exit(EXIT_SUPERVISOR_LOST);
});

httpServer.listen(PORT, HOST, () => {
  writeJsonAtomic(startResultFile, { startId, state: 'ready', refNo: null, at: new Date().toISOString() });
  log('server_ready_local', { startupMs: Date.now() - t0 });
  if (typeof process.send === 'function') process.send({ type: 'ready', startId });
});
