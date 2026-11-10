import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { type AddressInfo, connect, createServer } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MAIN = fileURLToPath(new URL('../main.ts', import.meta.url));
const READY_TIMEOUT_MS = 15_000;
const CONNECT_TIMEOUT_MS = 2_000;

/**
 * Addresses of this machine other than `127.0.0.1`: another loopback address, the IPv6
 * loopback and every network address of the machine (the address a second device in the same
 * local network would use). Link-local IPv6 addresses need a zone and are left out.
 */
function otherAddressesOfThisMachine(): string[] {
  const network = Object.values(networkInterfaces())
    .flat()
    .filter((info) => info !== undefined && !info.internal && !info.address.startsWith('fe80:'))
    .map((info) => info!.address);
  return ['127.0.0.2', '::1', ...network];
}

/** The network addresses alone; without one the replacement for the second device is missing. */
const networkAddresses = () =>
  otherAddressesOfThisMachine().filter((address) => !['127.0.0.2', '::1'].includes(address));

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

/**
 * Opens a TCP connection to `address:port` and sends a request for the data of
 * `GET /api/ops/status` with the own `Host`, so `local-guard` would let it through. Resolves
 * with the bytes received and the connection error, if any.
 */
function attempt(address: string, port: number): Promise<{ received: string; error: string }> {
  return new Promise((resolve) => {
    let received = '';
    const socket = connect({ host: address, port, timeout: CONNECT_TIMEOUT_MS });
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      socket.write(`GET /api/ops/status HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n\r\n`);
    });
    socket.on('data', (chunk: string) => (received += chunk));
    socket.on('timeout', () => socket.destroy(new Error('ETIMEDOUT')));
    socket.on('error', (error: NodeJS.ErrnoException) =>
      resolve({ received, error: error.code ?? error.message }),
    );
    socket.on('close', () => resolve({ received, error: '' }));
  });
}

/** Whether `address` reaches a server listening on all addresses (control of the attempt). */
async function reachableWhenListeningOnAllAddresses(address: string): Promise<boolean> {
  const server = createServer((socket) => socket.write('reached', () => socket.destroy()));
  // Without IPv6 on this machine `::` cannot be bound; the address is then not reachable either.
  const listening = await new Promise<boolean>((resolve) => {
    server.once('error', () => resolve(false));
    server.listen(0, address.includes(':') ? '::' : '0.0.0.0', () => resolve(true));
  });
  if (!listening) return false;
  try {
    const { port } = server.address() as AddressInfo;
    return (await attempt(address, port)).received === 'reached';
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

let root: string;
let logDir: string;
let port: number;
let child: ChildProcess;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'resellr-listen-'));
  const dataDir = join(root, 'Daten');
  logDir = join(root, 'Protokolle');
  mkdirSync(dataDir);
  port = await freePort();
  writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ port }));

  child = spawn(process.execPath, [MAIN], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      RESELLR_DATA_DIR: dataDir,
      RESELLR_LOG_DIR: logDir,
      RESELLR_HANDOVER_DIR: join(root, 'Fotoübergabe'),
      RESELLR_UPDATE_COPY_DIR: join(root, 'Update-Kopien'),
    },
  });

  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/ops/health`);
      if (((await response.json()) as { state: string }).state === 'ready') break;
    } catch {
      // Not listening yet.
    }
    if (child.exitCode !== null) throw new Error(`resellr-server ended with ${child.exitCode}`);
    if (Date.now() > deadline) throw new Error('resellr-server did not report ready');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}, READY_TIMEOUT_MS + 5_000);

afterAll(async () => {
  if (child.exitCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill('SIGTERM');
    await exited;
  }
  rmSync(root, { recursive: true, force: true });
});

describe('reachability only from this machine (ADR-002, TH-01)', () => {
  it('this machine has a network address besides loopback for the attempt', () => {
    expect(networkAddresses(), 'network addresses of this machine').not.toEqual([]);
  });

  it.each(otherAddressesOfThisMachine())(
    'AC-REQ-001-07 a connection attempt to %s of the same machine fails: no data, no function',
    async (address) => {
      // The address works as such: a server on all addresses is reached through it.
      expect(
        await reachableWhenListeningOnAllAddresses(address),
        `${address} reached by a server listening on all addresses`,
      ).toBe(true);

      const { received, error } = await attempt(address, port);

      expect(received).toBe('');
      expect(error).not.toBe('');
      // The request never reached resellr: not even local-guard noted a rejection.
      expect(readdirSync(logDir).filter((name) => name.startsWith('errors-'))).toEqual([]);
    },
  );

  it('AC-REQ-001-07 resellr keeps running and answers on 127.0.0.1 after the attempts', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/ops/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: 'ready', startId: null });
  });
});
