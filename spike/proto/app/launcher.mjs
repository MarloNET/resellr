// resellr-spike launcher prototype (throwaway, Windows spike Schnitt 0).
// Commands: supervise | open | stop. See spike assignment v1.2, chapter 3.
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 4310;
const HOST = '127.0.0.1';
const APP_URL = `http://${HOST}:${PORT}/`;
const CRASH_GRACE_MS = 5000;
const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 10 * 60 * 1000;

const appDir = path.dirname(fileURLToPath(import.meta.url));
const localAppData = process.env.LOCALAPPDATA ?? os.tmpdir();
const baseDir = path.join(localAppData, 'resellr-spike');
const logDir = path.join(baseDir, 'Protokolle');
const opsLogFile = path.join(logDir, 'operations.jsonl');
const startResultFile = path.join(logDir, 'start-result.json');
const pipeHash = crypto.createHash('sha256').update(localAppData).digest('hex').slice(0, 16);
const pipePath = process.platform === 'win32'
  ? `\\\\.\\pipe\\resellr-spike-supervisor-${pipeHash}`
  : path.join(os.tmpdir(), `resellr-spike-supervisor-${pipeHash}.sock`);

const command = process.argv[2] ?? '';
let role = command;

function log(event, fields = {}) {
  fs.mkdirSync(logDir, { recursive: true });
  const line = JSON.stringify({ ts: Date.now(), pid: process.pid, role, event, ...fields });
  fs.appendFileSync(opsLogFile, line + '\n');
}

const REF_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function newRefNo() {
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => REF_ALPHABET[b % 32]).join('');
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

function readStartResult() {
  try {
    return JSON.parse(fs.readFileSync(startResultFile, 'utf8'));
  } catch {
    return null;
  }
}

function exitSoon(code) {
  setTimeout(() => process.exit(code), 50);
}

// Resolves with the listening server, or null when another process owns the pipe.
function tryListen() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') resolve({ server: null, code: err.code });
      else reject(err);
    });
    server.listen(pipePath, () => resolve({ server, code: null }));
  });
}

function connectPipe() {
  return new Promise((resolve) => {
    const socket = net.connect(pipePath);
    socket.once('connect', () => resolve(socket));
    socket.once('error', () => resolve(null));
  });
}

function healthCheck(timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port: PORT, path: '/api/ops/health', timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

function onLines(socket, handler) {
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        handler(JSON.parse(line));
      } catch {
        // ignore malformed lines
      }
    }
  });
}

// Supervisor: owns the pipe, starts the server, applies the restart rule.
function runSupervisor(server, via, onPhase = () => {}) {
  role = 'supervisor';
  log('supervisor_started', { via, pipe: pipePath, bootTime: Date.now() - Math.round(os.uptime() * 1000) });
  const subscribers = new Set();
  const restarts = [];
  let lastPhase = { phase: 'starting' };
  let ended = false;

  server.on('connection', (socket) => {
    socket.on('error', () => subscribers.delete(socket));
    socket.on('close', () => subscribers.delete(socket));
    onLines(socket, (msg) => {
      if (msg.cmd === 'subscribe') {
        subscribers.add(socket);
        socket.write(JSON.stringify(lastPhase) + '\n');
      }
    });
  });

  function broadcast(msg) {
    lastPhase = msg;
    onPhase(msg);
    for (const socket of subscribers) socket.write(JSON.stringify(msg) + '\n');
  }

  function end(code) {
    if (ended) return;
    ended = true;
    log('supervisor_ended', { lastPhase: lastPhase.phase });
    for (const socket of subscribers) socket.end();
    server.close();
    exitSoon(code);
  }

  function startServer() {
    const startId = crypto.randomUUID();
    broadcast({ phase: 'starting', startId });
    const child = spawn(process.execPath, [path.join(appDir, 'server.mjs')], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      windowsHide: true,
      env: { ...process.env, RESELLR_SPIKE_START_ID: startId },
    });
    log('server_started', { serverPid: child.pid, startId, restartCount: restarts.length });
    child.on('message', (msg) => {
      if (msg && msg.type === 'ready' && msg.startId === startId) {
        log('server_ready', { serverPid: child.pid, startId });
        broadcast({ phase: 'ready', startId, url: APP_URL });
      }
    });
    child.on('error', (err) => log('server_spawn_error', { message: err.message }));
    child.on('exit', (code, signal) => onServerExit(child.pid, startId, code, signal));
  }

  function onServerExit(serverPid, startId, code, signal) {
    log('server_exit', { serverPid, startId, code, signal, phaseBefore: lastPhase.phase });
    if (code === 0) {
      log('stopped', { serverPid });
      broadcast({ phase: 'stopped' });
      end(0);
    } else if (code === 10) {
      const result = readStartResult();
      const refNo = result && result.startId === startId ? result.refNo : null;
      log('aborted', { serverPid, refNo, code });
      broadcast({ phase: 'aborted', refNo });
      // Exit 10 so a supervised abort is distinguishable from a clean stop (P3.4).
      end(10);
    } else if (code === 11) {
      log('already_running', { serverPid, restartCount: restarts.length });
      broadcast({ phase: 'already_running' });
      end(0);
    } else {
      lastPhase = { phase: 'crash_grace' };
      setTimeout(() => {
        const now = Date.now();
        while (restarts.length && now - restarts[0] > RESTART_WINDOW_MS) restarts.shift();
        const refNo = newRefNo();
        if (restarts.length >= MAX_RESTARTS) {
          writeJsonAtomic(startResultFile, { startId, state: 'gave_up', refNo, at: new Date().toISOString() });
          log('gave_up', { serverPid, code, refNo, restartCount: restarts.length });
          broadcast({ phase: 'gave_up', refNo });
          end(0);
        } else {
          restarts.push(now);
          log('crash', { serverPid, code, refNo, restartCount: restarts.length });
          startServer();
        }
      }, CRASH_GRACE_MS);
    }
  }

  startServer();
}

async function cmdSupervise() {
  const { server, code } = await tryListen();
  if (!server) {
    log('already_supervised', { pipe: pipePath, listenError: code });
    exitSoon(0);
    return;
  }
  runSupervisor(server, 'supervise');
}

// Waits for a terminal phase from the supervisor; resolves { phase, ... } or { phase: 'closed' }.
function subscribe(socket) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (msg) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(msg);
    };
    onLines(socket, (msg) => {
      if (['ready', 'aborted', 'gave_up', 'already_running', 'stopped', 'error'].includes(msg.phase)) finish(msg);
    });
    socket.on('close', () => finish({ phase: 'closed' }));
    socket.on('error', () => finish({ phase: 'closed' }));
    socket.write(JSON.stringify({ cmd: 'subscribe' }) + '\n');
  });
}

function reportOpenResult(msg, via) {
  log('open_result', { phase: msg.phase, refNo: msg.refNo ?? null, startId: msg.startId ?? null, via });
  if (msg.phase === 'ready') log('would_open_chrome', { url: msg.url ?? APP_URL, via });
  else if (msg.phase === 'aborted' || msg.phase === 'gave_up') log('would_open_lp02', { refNo: msg.refNo ?? null, via });
}

async function cmdOpen() {
  log('open_started');
  let retriedAfterStop = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    const health = await healthCheck(1000);
    if (health && health.status === 'ready') {
      reportOpenResult({ phase: 'ready', startId: health.startId, url: APP_URL }, 'health');
      exitSoon(0);
      return;
    }
    const socket = await connectPipe();
    if (socket) {
      const msg = await subscribe(socket);
      if (msg.phase === 'already_running') continue;
      if (msg.phase === 'stopped' || msg.phase === 'closed') {
        if (retriedAfterStop) {
          log('open_result', { phase: msg.phase, via: 'pipe' });
          exitSoon(1);
          return;
        }
        retriedAfterStop = true;
        continue;
      }
      reportOpenResult(msg, 'pipe');
      exitSoon(0);
      return;
    }
    const { server } = await tryListen();
    if (server) {
      let reported = false;
      runSupervisor(server, 'open', (msg) => {
        if (reported) return;
        if (['ready', 'aborted', 'gave_up', 'already_running'].includes(msg.phase)) {
          reported = true;
          role = 'supervisor';
          reportOpenResult(msg, 'own_supervisor');
        }
      });
      return;
    }
  }
  log('open_result', { phase: 'gave_up_connecting' });
  exitSoon(1);
}

function cmdStop() {
  log('stop_requested');
  const req = http.request(
    { host: HOST, port: PORT, path: '/api/ops/shutdown', method: 'POST', timeout: 10000 },
    (res) => {
      res.resume();
      res.on('end', () => {
        log('stop_response', { status: res.statusCode });
        exitSoon(res.statusCode === 200 ? 0 : 1);
      });
    },
  );
  req.on('timeout', () => req.destroy(new Error('timeout')));
  req.on('error', (err) => {
    log('stop_response', { status: null, error: err.code ?? err.message });
    exitSoon(err.code === 'ECONNREFUSED' ? 0 : 1);
  });
  req.end();
}

try {
  if (command === 'supervise') await cmdSupervise();
  else if (command === 'open') await cmdOpen();
  else if (command === 'stop') cmdStop();
  else {
    log('unknown_command', { argv: process.argv.slice(2) });
    exitSoon(2);
  }
} catch (err) {
  log('launcher_error', { message: err.message, stack: err.stack });
  exitSoon(3);
}
