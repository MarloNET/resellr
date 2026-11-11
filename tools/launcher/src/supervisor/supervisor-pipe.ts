import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { unlinkSync } from 'node:fs';
import { connect, createServer, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

/** Requests to the supervisor, one JSON line each (Technical Specification 2.18). */
export type PipeRequest = { cmd: 'subscribe' } | { cmd: 'stop' };

/** Phases the supervisor reports over the pipe (2.18). */
export type SupervisorPhase =
  'starting' | 'ready' | 'aborted' | 'gave_up' | 'already_running' | 'stopped' | 'error';

/** Event `phase`, one JSON line; `startId` names the start attempt, `refNo` the reference number. */
export interface PhaseEvent {
  event: 'phase';
  phase: SupervisorPhase;
  startId?: string;
  refNo?: string;
}

const PHASES: readonly unknown[] = [
  'starting',
  'ready',
  'aborted',
  'gave_up',
  'already_running',
  'stopped',
  'error',
];

/**
 * Name of the pipe of the supervisor, one per user (H-14, FIND-112): `<h>` is the first 16 hex
 * characters of SHA-256 over `%LOCALAPPDATA%`. Under Linux (development, tests) it is a Unix
 * socket in the temporary folder.
 */
export function supervisorPipePath(
  localAppData: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const hash = createHash('sha256').update(localAppData).digest('hex').slice(0, 16);
  return platform === 'win32'
    ? `\\\\.\\pipe\\resellr-supervisor-${hash}`
    : join(tmpdir(), `resellr-supervisor-${hash}.sock`);
}

export function encodeMessage(message: PipeRequest | PhaseEvent): string {
  return `${JSON.stringify(message)}\n`;
}

export function parseRequest(value: unknown): PipeRequest | null {
  const cmd = (value as { cmd?: unknown } | null)?.cmd;
  return cmd === 'subscribe' || cmd === 'stop' ? { cmd } : null;
}

export function parsePhaseEvent(value: unknown): PhaseEvent | null {
  if (typeof value !== 'object' || value === null) return null;
  const { event, phase, startId, refNo } = value as Record<string, unknown>;
  if (event !== 'phase' || !PHASES.includes(phase)) return null;
  return {
    event,
    phase: phase as SupervisorPhase,
    ...(typeof startId === 'string' ? { startId } : {}),
    ...(typeof refNo === 'string' ? { refNo } : {}),
  };
}

/** Calls `handle` with every JSON line the socket receives; other lines are ignored. */
function onJsonLines(socket: Socket, handle: (value: unknown) => void): void {
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (line === '') continue;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        continue;
      }
      handle(value);
    }
  });
}

export interface SupervisorPipeServer {
  /** Calls `handle` with every valid request; `reply` writes an event to the asking connection. */
  onRequest(handle: (request: PipeRequest, reply: (event: PhaseEvent) => void) => void): void;
  /** Sends the event to every connection that has sent `subscribe`. */
  broadcast(event: PhaseEvent): void;
  /** Ends every connection after the events written so far and frees the pipe. */
  close(): Promise<void>;
}

/** Waits up to this long before taking a Unix socket file nobody accepts on as stale. */
const STALE_SOCKET_RECHECK_MS = 100;

/**
 * Opens the pipe of the supervisor (CU-263). Resolves with null if another process holds it.
 * Windows frees a pipe at the end of its process, also after a crash; a Unix socket file stays,
 * so under Linux a file without anyone accepting on it is removed and the pipe opened once more.
 */
export async function listenSupervisorPipe(path: string): Promise<SupervisorPipeServer | null> {
  let server = await tryListen(path);
  if (server === null && process.platform !== 'win32' && (await isStaleSocket(path))) {
    try {
      unlinkSync(path);
    } catch {
      // Another process removed it first.
    }
    server = await tryListen(path);
  }
  return server === null ? null : wrapServer(server);
}

async function tryListen(path: string): Promise<Server | null> {
  const server = createServer();
  try {
    server.listen(path);
    await once(server, 'listening');
    return server;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EADDRINUSE' || code === 'EACCES') return null;
    throw error;
  }
}

/** True if nobody accepts on the socket file, checked twice so a supervisor just binding counts. */
async function isStaleSocket(path: string): Promise<boolean> {
  if (await canConnect(path)) return false;
  await sleep(STALE_SOCKET_RECHECK_MS);
  return !(await canConnect(path));
}

async function canConnect(path: string): Promise<boolean> {
  const socket = await connectSocket(path);
  socket?.destroy();
  return socket !== null;
}

function connectSocket(path: string): Promise<Socket | null> {
  return new Promise((resolve) => {
    const socket = connect(path);
    socket.once('connect', () => {
      socket.removeAllListeners('error');
      resolve(socket);
    });
    socket.once('error', () => resolve(null));
  });
}

function wrapServer(server: Server): SupervisorPipeServer {
  const connections = new Set<Socket>();
  const subscribers = new Set<Socket>();
  let handleRequest: (request: PipeRequest, reply: (event: PhaseEvent) => void) => void = () => {};

  const write = (socket: Socket, event: PhaseEvent) => {
    if (!socket.writableEnded) socket.write(encodeMessage(event));
  };

  server.on('connection', (socket) => {
    connections.add(socket);
    const forget = () => {
      connections.delete(socket);
      subscribers.delete(socket);
    };
    socket.on('close', forget);
    // A client that goes away is no failure of the supervisor.
    socket.on('error', forget);
    onJsonLines(socket, (value) => {
      const request = parseRequest(value);
      if (request === null) return;
      if (request.cmd === 'subscribe') subscribers.add(socket);
      handleRequest(request, (event) => write(socket, event));
    });
  });

  return {
    onRequest: (handle) => {
      handleRequest = handle;
    },
    broadcast: (event) => {
      for (const socket of subscribers) write(socket, event);
    },
    close: async () => {
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      for (const socket of connections) socket.end();
      await closed;
    },
  };
}

/** Result of waiting after `subscribe`: a final event, or `closed` without one (2.18 step 2). */
export type SubscribeResult = PhaseEvent | { phase: 'closed' };

/** Phases that end the wait of `open` (2.18 step 2); `starting` and `error` do not. */
const FINAL_PHASES: readonly SupervisorPhase[] = [
  'ready',
  'aborted',
  'gave_up',
  'already_running',
  'stopped',
];

/**
 * Connects to the pipe of the supervisor, sends `subscribe` and waits for a final event
 * (CU-263, 2.18 step 2). Resolves with null if no supervisor listens on the pipe.
 */
export async function subscribeToSupervisor(path: string): Promise<SubscribeResult | null> {
  const socket = await connectSocket(path);
  if (socket === null) return null;
  return new Promise((resolve) => {
    const finish = (result: SubscribeResult) => {
      socket.destroy();
      resolve(result);
    };
    onJsonLines(socket, (value) => {
      const event = parsePhaseEvent(value);
      if (event !== null && FINAL_PHASES.includes(event.phase)) finish(event);
    });
    socket.on('close', () => finish({ phase: 'closed' }));
    socket.on('error', () => finish({ phase: 'closed' }));
    socket.write(encodeMessage({ cmd: 'subscribe' }));
  });
}
