import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test as base, expect } from '@playwright/test';
import { CONFIG_FILE_NAME } from '@resellr/runtime-shared/configured-port';
import type { RuntimePaths } from '@resellr/runtime-shared/paths';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SERVER_MAIN = join(REPO_ROOT, 'apps/server/src/main.ts');
const WEB_INDEX = join(REPO_ROOT, 'apps/web/dist/index.html');
const READY_TIMEOUT_MS = 30_000;
/** Time `kill` gives the server to end on SIGTERM before it ends it with SIGKILL. */
const KILL_GRACE_MS = 5_000;
/** Argument of the server for the test clock (`TEST_CLOCK_FLAG`, CU-032). */
const TEST_CLOCK_FLAG = '--test-clock';

/** Length of the data folder path in every E2E run (Technical Specification 6.3, UI-044). */
export const DATA_DIR_PATH_LENGTH = 100;

/** The server of one test worker. */
export interface AppServer {
  port: number;
  /** `http://127.0.0.1:<port>` */
  baseUrl: string;
  paths: RuntimePaths;
  /** Every outbound connection the server has reported since its start (REQ-079). */
  outboundConnections(): OutboundConnection[];
  /**
   * Every successful write operation on the file system of every start of the server so far
   * (REQ-106); only for a worker with `observeFileWrites`, otherwise it throws.
   */
  fileWrites(): FileWrite[];
  /** Ends the server process on purpose; its folders and port stay for `restart`. */
  kill(): Promise<void>;
  /**
   * Ends the server in order like "resellr beenden" (`POST /api/ops/shutdown`, 2.17) and waits
   * for its exit code 0; afterwards the data folder may be copied (AC-REQ-104-05).
   */
  shutdown(): Promise<void>;
  /**
   * Starts the server again on the same port with the same folders, waits until ready. With
   * `testClockAt` it runs with the test clock started at that instant (`--test-clock`, CU-032);
   * without, with the normal clock.
   */
  restart(options?: { testClockAt?: Date }): Promise<void>;
}

/** One outbound connection of a process, reported by the probe below. */
export interface OutboundConnection {
  channel: 'net.client.socket' | 'undici:request:create';
  /** Host name, IP address or pipe path the process connects to. */
  target: string;
}

/** The only destination the server may connect to (REQ-079). */
const LOCAL_TARGET = '127.0.0.1';

/**
 * Test mode of the server in the E2E suite (REQ-079, Technical Specification 6.2): a module the
 * process loads with `--import` before its own code. It subscribes to `node:diagnostics_channel`
 * and appends every outbound connection as one JSON line to `logFile`: for `net.client.socket`
 * (also used by `http`, `https`, `tls` and `fetch`) the host name of a DNS lookup and the
 * address or pipe path of every connection attempt, for `undici:request:create` the host of the
 * request. Returns the `data:` URL of the module.
 */
export function outboundConnectionProbe(logFile: string): string {
  const source = `
    import { subscribe } from 'node:diagnostics_channel';
    import { appendFileSync } from 'node:fs';
    const report = (channel, target) =>
      appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({ channel, target: String(target) }) + '\\n');
    subscribe('net.client.socket', ({ socket }) => {
      socket.on('lookup', (_error, _address, _family, host) => report('net.client.socket', host));
      socket.on('connectionAttempt', (address) => report('net.client.socket', address));
    });
    subscribe('undici:request:create', ({ request }) => {
      let target = request.origin;
      try { target = new URL(String(request.origin)).hostname; } catch {}
      report('undici:request:create', target);
    });
  `;
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

/** One successful write operation of a process on the file system, observed by `strace`. */
export interface FileWrite {
  syscall: string;
  /** Absolute path of the file or folder the operation changes. */
  path: string;
}

/**
 * Path arguments of the system calls that change the file system (REQ-106, Technical
 * Specification 6.2): `path` is the index of a path string, `dir` the index of the folder file
 * descriptor it is relative to (or, without `path`, of the file descriptor the call changes).
 * Writing through a file descriptor (`write`, `ftruncate`, `fallocate`, ...) needs one opened for
 * writing, so the `open` calls with a writing flag cover it. A `?` lets `strace` skip a call the
 * architecture lacks. Limits: operations submitted through io_uring bypass these system calls, so
 * the observed server runs with `UV_USE_IO_URING=0`; for the calls except `open` the path is
 * taken from the argument, so an operation through a symbolic link is seen at the link (the
 * server creates none, and creating one is observed).
 */
const WRITE_SYSCALLS: Record<string, { dir?: number; path?: number }[]> = {
  open: [{ path: 0 }],
  creat: [{ path: 0 }],
  openat: [{ dir: 0, path: 1 }],
  openat2: [{ dir: 0, path: 1 }],
  mkdir: [{ path: 0 }],
  mkdirat: [{ dir: 0, path: 1 }],
  mknod: [{ path: 0 }],
  mknodat: [{ dir: 0, path: 1 }],
  rmdir: [{ path: 0 }],
  unlink: [{ path: 0 }],
  unlinkat: [{ dir: 0, path: 1 }],
  rename: [{ path: 0 }, { path: 1 }],
  renameat: [
    { dir: 0, path: 1 },
    { dir: 2, path: 3 },
  ],
  renameat2: [
    { dir: 0, path: 1 },
    { dir: 2, path: 3 },
  ],
  link: [{ path: 1 }],
  linkat: [{ dir: 2, path: 3 }],
  symlink: [{ path: 1 }],
  symlinkat: [{ dir: 1, path: 2 }],
  truncate: [{ path: 0 }],
  chmod: [{ path: 0 }],
  fchmod: [{ dir: 0 }],
  fchmodat: [{ dir: 0, path: 1 }],
  fchmodat2: [{ dir: 0, path: 1 }],
  chown: [{ path: 0 }],
  lchown: [{ path: 0 }],
  fchown: [{ dir: 0 }],
  fchownat: [{ dir: 0, path: 1 }],
  utime: [{ path: 0 }],
  utimes: [{ path: 0 }],
  utimensat: [{ dir: 0, path: 1 }],
  futimesat: [{ dir: 0, path: 1 }],
  setxattr: [{ path: 0 }],
  lsetxattr: [{ path: 0 }],
  fsetxattr: [{ dir: 0 }],
  removexattr: [{ path: 0 }],
  lremovexattr: [{ path: 0 }],
  fremovexattr: [{ dir: 0 }],
};

/** Index of the flags of the `open` calls; they only write with one of `WRITING_OPEN_FLAGS`. */
const OPEN_FLAGS_ARG: Record<string, number> = { open: 1, openat: 2, openat2: 2 };
const WRITING_OPEN_FLAGS = /\bO_(WRONLY|RDWR|CREAT|TRUNC|APPEND)\b/;

/**
 * Arguments of `strace` that observe every process and thread of a command (`-f`), one output
 * file per process (`-ff`, `<prefix>.<pid>`) and only successful calls (`-z`), with the path
 * behind every file descriptor (`-y`) and complete strings (`-s`).
 */
export function fileWriteTraceArgs(outputPrefix: string): string[] {
  const syscalls = Object.keys(WRITE_SYSCALLS).map((name) => `?${name}`);
  return [
    '-f',
    '-ff',
    '-qq',
    '-z',
    '-y',
    '-s',
    '65535',
    '-e',
    'signal=none',
    '-e',
    `trace=${syscalls.join(',')}`,
    '-o',
    outputPrefix,
  ];
}

/** Decodes a C string literal of `strace` (`\"`, `\303\274` for "ü", ...) to UTF-8 text. */
function decodeStraceString(literal: string): string {
  const escapes: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13 };
  const bytes: number[] = [];
  for (const [, octal, hex, escaped, text] of literal.matchAll(
    /\\(?:([0-7]{1,3})|x([0-9a-fA-F]{2})|(.))|([^\\]+)/gsu,
  )) {
    if (text !== undefined) bytes.push(...Buffer.from(text, 'utf8'));
    else if (octal !== undefined) bytes.push(parseInt(octal, 8));
    else if (hex !== undefined) bytes.push(parseInt(hex, 16));
    else if (escaped !== undefined) bytes.push(escapes[escaped] ?? escaped.charCodeAt(0));
  }
  return Buffer.from(bytes).toString('utf8');
}

/** Splits the argument list of a call at the commas outside strings and brackets. */
function splitArguments(list: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let current = '';
  for (const char of list) {
    if (char === ',' && depth === 0 && !inString) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += char;
    if (escaped) escaped = false;
    else if (inString && char === '\\') escaped = true;
    else if (char === '"') inString = !inString;
    else if (!inString && '([{<'.includes(char)) depth++;
    else if (!inString && ')]}>'.includes(char)) depth--;
  }
  if (current.trim() !== '') args.push(current.trim());
  return args;
}

/** The path a file descriptor argument stands for (`AT_FDCWD</cwd>`, `20</path>`). */
function descriptorPath(arg: string | undefined): string | undefined {
  const path = /^[^<]*<(.*)>$/.exec(arg ?? '')?.[1];
  return path === undefined ? undefined : decodeStraceString(path);
}

/**
 * The write operations in the output of `strace` with `fileWriteTraceArgs` for one process.
 * Paths without a folder file descriptor are relative to `cwd`. For an `open` call the path is
 * the one the kernel resolved for the returned file descriptor (`= 4</real/path>`), so a symbolic
 * link does not hide the target; a call cut off by the end of the process has none and keeps the
 * argument. A line it does not understand fails the parsing, so nothing is lost unnoticed.
 */
export function parseFileWrites(trace: string, cwd: string): FileWrite[] {
  const writes: FileWrite[] = [];
  for (const line of trace.split('\n')) {
    if (line.trim() === '') continue;
    const {
      syscall = '',
      list = '',
      result = '',
    } = /^(?<syscall>\w+)\((?<list>.*)\)\s+=\s+(?<result>.+)$/.exec(line)?.groups ?? {};
    const pathArgs = WRITE_SYSCALLS[syscall];
    if (!pathArgs) throw new Error(`Unexpected line of strace: ${line}`);
    const args = splitArguments(list);
    const flagsArg = OPEN_FLAGS_ARG[syscall];
    if (flagsArg !== undefined && !WRITING_OPEN_FLAGS.test(args[flagsArg] ?? '')) continue;
    const opened =
      syscall === 'creat' || flagsArg !== undefined ? descriptorPath(result) : undefined;
    if (opened !== undefined) {
      writes.push({ syscall, path: opened });
      continue;
    }
    for (const { dir, path } of pathArgs) {
      const base = dir === undefined ? cwd : (descriptorPath(args[dir]) ?? cwd);
      const literal = path === undefined ? undefined : /^"(.*)"$/.exec(args[path] ?? '')?.[1];
      const name = literal === undefined ? '' : decodeStraceString(literal);
      writes.push({
        syscall,
        path: isAbsolute(name) ? resolvePath(name) : resolvePath(base, name),
      });
    }
  }
  return writes;
}

/** All write operations in the `strace` output files in `traceDir`. */
export function readFileWrites(traceDir: string, cwd: string): FileWrite[] {
  if (!existsSync(traceDir)) return [];
  return readdirSync(traceDir)
    .sort()
    .flatMap((file) => parseFileWrites(readFileSync(join(traceDir, file), 'utf8'), cwd));
}

/** Fails early with a clear message if `strace` is missing (REQ-106 runs only under Linux). */
export function requireStrace(): void {
  const result = spawnSync('strace', ['-V'], { stdio: 'ignore' });
  if (result.error || result.status !== 0) {
    throw new Error('strace is needed to observe the file writes of the server (REQ-106)');
  }
}

/** The connections to another destination than `127.0.0.1`. */
export function foreignConnections(connections: OutboundConnection[]): OutboundConnection[] {
  return connections.filter(({ target }) => target !== LOCAL_TARGET);
}

/** Reads the log of `outboundConnectionProbe`; no file means no connection. */
export function readOutboundConnections(logFile: string): OutboundConnection[] {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as OutboundConnection);
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (address === null || typeof address === 'string') throw new Error('No free port');
  return address.port;
}

async function waitUntilReady(server: AppServer, process: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`The server ended during the start with exit code ${process.exitCode}`);
    }
    try {
      const response = await fetch(`${server.baseUrl}/api/ops/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok && ((await response.json()) as { state: string }).state === 'ready') return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The server did not report ready within ${READY_TIMEOUT_MS} ms`);
}

/**
 * Data folder below `root` whose path has exactly `DATA_DIR_PATH_LENGTH` characters, so the
 * backup notice UI-044 shows a 100-character path in every row of the matrix (6.3).
 */
function longDataDir(root: string): string {
  const prefix = join(root, 'Daten-');
  const padding = DATA_DIR_PATH_LENGTH - prefix.length;
  if (padding < 1) {
    throw new Error(
      `The temporary folder ${root} is too long for a ${DATA_DIR_PATH_LENGTH}-character data folder path`,
    );
  }
  return prefix + 'x'.repeat(padding);
}

/**
 * Starts `resellr-server` for one test worker (CU-062): own temporary data, log, handover and
 * update-copy folder, `config.json` with a free port, migrated empty database. The data folder
 * path has 100 characters. The user interface comes from `apps/web/dist` (`npm run build`).
 * With `observeFileWrites`, every start runs under `strace` from its first system call to its
 * end (REQ-106); `strace` ends the server at once on SIGTERM, so such a test ends it with
 * `shutdown()`.
 */
async function startServer({ observeFileWrites }: { observeFileWrites: boolean }): Promise<{
  server: AppServer;
  /** Ends the server and returns all its outbound connections up to its end. */
  stop(): Promise<OutboundConnection[]>;
}> {
  if (!existsSync(WEB_INDEX)) {
    throw new Error('apps/web/dist is missing: run `npm run build` before the E2E suite');
  }
  const root = mkdtempSync(join(tmpdir(), 'resellr-e2e-'));
  const paths: RuntimePaths = {
    dataDir: longDataDir(root),
    logDir: join(root, 'Protokolle'),
    handoverDir: join(root, 'Fotoübergabe'),
    updateCopyDir: join(root, 'Update-Kopien'),
  };
  const port = await freePort();
  const connectionLog = join(root, 'outbound-connections.jsonl');
  const traceDir = join(root, 'file-writes');
  let starts = 0;
  if (observeFileWrites) {
    requireStrace();
    mkdirSync(traceDir);
  }
  mkdirSync(paths.dataDir);
  writeFileSync(join(paths.dataDir, CONFIG_FILE_NAME), JSON.stringify({ port }));

  const probe = `--import=${outboundConnectionProbe(connectionLog)}`;
  const spawnServer = (args: string[] = []) => {
    const serverArgs = [probe, SERVER_MAIN, ...args];
    const [command, commandArgs] = observeFileWrites
      ? [
          'strace',
          [
            ...fileWriteTraceArgs(join(traceDir, `start-${++starts}`)),
            '--',
            process.execPath,
            ...serverArgs,
          ],
        ]
      : [process.execPath, serverArgs];
    const serverProcess = spawn(command, commandArgs, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: {
        ...process.env,
        RESELLR_DATA_DIR: paths.dataDir,
        RESELLR_LOG_DIR: paths.logDir,
        RESELLR_HANDOVER_DIR: paths.handoverDir,
        RESELLR_UPDATE_COPY_DIR: paths.updateCopyDir,
        // libuv may submit file operations through io_uring, which `strace` does not see.
        ...(observeFileWrites && { UV_USE_IO_URING: '0' }),
      },
    });
    const exited = new Promise<number | null>((resolve) =>
      serverProcess.once('exit', (code) => resolve(code)),
    );
    return { process: serverProcess, exited };
  };
  let child = spawnServer();
  const kill = async () => {
    const { process: running, exited } = child;
    if (running.exitCode !== null || running.signalCode !== null) return void (await exited);
    running.kill('SIGTERM');
    // On SIGTERM the server waits for every open connection; a connection the browser opened
    // in advance without a request keeps it running, so it is killed after the grace time.
    const timer = setTimeout(() => running.kill('SIGKILL'), KILL_GRACE_MS);
    await exited;
    clearTimeout(timer);
  };
  const server: AppServer = {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    paths,
    outboundConnections: () => readOutboundConnections(connectionLog),
    fileWrites: () => {
      if (!observeFileWrites)
        throw new Error('The file writes are observed only with observeFileWrites');
      // The connection probe of the test mode writes its log itself; it is no write of the server.
      return readFileWrites(traceDir, REPO_ROOT).filter(({ path }) => path !== connectionLog);
    },
    kill,
    shutdown: async () => {
      // Like the launcher (G-3): without Origin and Sec-Fetch-Site.
      const response = await fetch(`${server.baseUrl}/api/ops/shutdown`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      expect(response.status, 'answer of POST /api/ops/shutdown').toBe(200);
      expect(await child.exited, 'exit code after the orderly shutdown').toBe(0);
    },
    restart: async ({ testClockAt } = {}) => {
      await kill();
      child = spawnServer(testClockAt ? [`${TEST_CLOCK_FLAG}=${testClockAt.toISOString()}`] : []);
      await waitUntilReady(server, child.process);
    },
  };
  const stop = async () => {
    await kill();
    const connections = server.outboundConnections();
    rmSync(root, { recursive: true, force: true });
    return connections;
  };

  try {
    await waitUntilReady(server, child.process);
  } catch (error) {
    await stop();
    throw error;
  }
  return { server, stop };
}

/** A browser request may only go to the own server or to a local file (REQ-079). */
export function isLocalRequest(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  return protocol === 'file:' || (protocol === 'http:' && hostname === '127.0.0.1');
}

/** Directives of `Content-Security-Policy` every response must carry (REQ-079, 2.0.2). */
export const REQUIRED_CSP_DIRECTIVES = [
  "connect-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
];

/** The required directives a `Content-Security-Policy` value lacks. */
export function missingCspDirectives(policy: string | null): string[] {
  const directives = (policy ?? '').split(';').map((directive) => directive.trim());
  return REQUIRED_CSP_DIRECTIVES.filter((required) => !directives.includes(required));
}

/** Worker options of the fixture, set per project in `playwright.config.ts`. */
export interface AppFixtureOptions {
  observeFileWrites: boolean;
}

/**
 * The worker fixture `server`: one server with data of its own per worker. A spec whose data
 * must not show in the lists of other specs overrides `server` with it again, which gives it
 * workers and so a server of its own.
 */
export async function workerServer(
  { observeFileWrites }: AppFixtureOptions,
  use: (server: AppServer) => Promise<void>,
): Promise<void> {
  const { server, stop } = await startServer({ observeFileWrites });
  await use(server);
  // Also during the shutdown the server connects nowhere else (REQ-079).
  const connections = await stop();
  expect(foreignConnections(connections), 'outbound connections of the server').toEqual([]);
}

export const test = base.extend<
  { browserRequests: string[]; serverResponseHeaders: void; serverConnections: void },
  { server: AppServer } & AppFixtureOptions
>({
  /**
   * Runs every start of the worker's server under `strace` and offers its write operations in
   * `server.fileWrites()` (REQ-106, Technical Specification 6.2). Set by the project.
   */
  observeFileWrites: [false, { scope: 'worker', option: true }],

  server: [workerServer, { scope: 'worker' }],

  baseURL: async ({ server }, use) => {
    await use(server.baseUrl);
  },

  /**
   * Every request of the browser in this test (REQ-079, Technical Specification 6.2). After
   * the test, all of them must have gone to `127.0.0.1` or to `file://`.
   */
  browserRequests: [
    async ({ context }, use) => {
      const urls: string[] = [];
      context.on('request', (request) => urls.push(request.url()));
      await use(urls);
      expect(urls.filter((url) => !isLocalRequest(url))).toEqual([]);
    },
    { auto: true },
  ],

  /**
   * Every response of the own server the browser receives in this test carries
   * `Content-Security-Policy` with the directives of REQ-079 (Technical Specification 2.0.2).
   */
  serverResponseHeaders: [
    async ({ context, server }, use) => {
      const checks: Promise<string | null>[] = [];
      context.on('response', (response) => {
        if (!response.url().startsWith(`${server.baseUrl}/`)) return;
        checks.push(
          response.headerValue('content-security-policy').then((policy) => {
            const missing = missingCspDirectives(policy);
            return missing.length === 0 ? null : `${response.url()} lacks ${missing.join(', ')}`;
          }),
        );
      });
      await use();
      expect((await Promise.all(checks)).filter((problem) => problem !== null)).toEqual([]);
    },
    { auto: true },
  ],

  /**
   * The server has reported no outbound connection to another destination than `127.0.0.1`
   * up to the end of this test (REQ-079, Technical Specification 6.2).
   */
  serverConnections: [
    async ({ server }, use) => {
      await use();
      expect(
        foreignConnections(server.outboundConnections()),
        'outbound connections of the server',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
