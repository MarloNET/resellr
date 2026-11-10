import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test as base } from '@playwright/test';

import {
  expect,
  foreignConnections,
  missingCspDirectives,
  outboundConnectionProbe,
  readOutboundConnections,
  REQUIRED_CSP_DIRECTIVES,
  test,
} from './fixtures/app-fixture.ts';

const NAVIGATION = [
  'Inserate',
  'Gerät einbuchen',
  'Modell-Bibliothek',
  'Geräte',
  'Änderungsprotokoll',
  'Einstellungen',
];

/** Runs `script` as an ES module in a Node process with the probe of the test mode. */
async function runWithProbe(script: string, logFile: string): Promise<void> {
  const child = spawn(
    process.execPath,
    [`--import=${outboundConnectionProbe(logFile)}`, '--input-type=module', '-e', script],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  const exitCode = await new Promise<number | null>((resolve) => child.once('exit', resolve));
  expect(exitCode).toBe(0);
}

base.describe('REQ-079 probe of the test mode', () => {
  base('reports connections over net, tls, http and fetch with their destination', async () => {
    const local = createServer((_request, response) => response.end('ok'));
    await new Promise<void>((resolve) => local.listen(0, '127.0.0.1', resolve));
    const address = local.address();
    if (address === null || typeof address === 'string') throw new Error('No port');
    const dir = mkdtempSync(join(tmpdir(), 'resellr-probe-'));
    const logFile = join(dir, 'connections.jsonl');
    try {
      // 192.0.2.1 (TEST-NET-1) and `.invalid` never reach a real server.
      await runWithProbe(
        `
          import net from 'node:net';
          import tls from 'node:tls';
          import https from 'node:https';
          const ended = (socket) => new Promise((resolve) => {
            socket.on('connectionAttempt', () => setImmediate(() => socket.destroy()));
            socket.on('error', resolve).on('close', resolve);
          });
          await ended(net.connect(443, '192.0.2.1'));
          await ended(tls.connect(443, 'shop.invalid'));
          await new Promise((resolve) => https.get('https://ebay.invalid/').on('error', resolve));
          await fetch('https://kleinanzeigen.invalid/').catch(() => {});
          await (await fetch('http://127.0.0.1:${address.port}/')).text();
          `,
        logFile,
      );
      const connections = readOutboundConnections(logFile);

      expect(connections).toEqual(
        expect.arrayContaining([
          { channel: 'net.client.socket', target: '192.0.2.1' },
          { channel: 'net.client.socket', target: 'shop.invalid' },
          { channel: 'net.client.socket', target: 'ebay.invalid' },
          { channel: 'net.client.socket', target: 'kleinanzeigen.invalid' },
          { channel: 'undici:request:create', target: 'kleinanzeigen.invalid' },
          { channel: 'net.client.socket', target: '127.0.0.1' },
          { channel: 'undici:request:create', target: '127.0.0.1' },
        ]),
      );
      expect(foreignConnections(connections).map(({ target }) => target)).not.toContain(
        '127.0.0.1',
      );
      expect(foreignConnections(connections).length).toBeGreaterThanOrEqual(5);
    } finally {
      local.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  base('a policy without the required directives is detected', () => {
    expect(missingCspDirectives(null)).toEqual(REQUIRED_CSP_DIRECTIVES);
    expect(missingCspDirectives("default-src 'self'; connect-src *; script-src 'self'")).toEqual([
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ]);
  });
});

test.describe('REQ-079 no outbound connections (Technical Specification 2.20, 6.2)', () => {
  test('the server reports 0 outbound connections to another destination than 127.0.0.1 along the user journeys', async ({
    page,
    server,
  }) => {
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
    for (const label of NAVIGATION) {
      await navigation.getByRole('link', { name: label, exact: true }).click();
      await expect(navigation.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
    await page.reload();

    expect(foreignConnections(server.outboundConnections())).toEqual([]);
  });

  test('every kind of response carries the Content-Security-Policy of REQ-079', async ({
    page,
  }) => {
    await page.goto('/');
    const asset = await page.locator('script[src^="/assets/"]').first().getAttribute('src');
    const responses = await Promise.all([
      page.request.get('/'),
      page.request.get('/inserate/9'),
      page.request.get(asset ?? '/assets/missing.js'),
      page.request.get('/assets/missing.js'),
      page.request.get('/api/ops/health'),
      page.request.get('/api/unknown'),
      page.request.fetch('/api/ops/health', { method: 'OPTIONS' }),
      page.request.post('/api/ops/health', {
        data: 'x',
        headers: { 'content-type': 'text/plain' },
      }),
    ]);

    expect(responses.map((response) => response.status())).toEqual([
      200, 200, 200, 404, 200, 404, 405, 403,
    ]);
    for (const response of responses) {
      expect(
        missingCspDirectives(response.headers()['content-security-policy'] ?? null),
        response.url(),
      ).toEqual([]);
    }
  });
});
