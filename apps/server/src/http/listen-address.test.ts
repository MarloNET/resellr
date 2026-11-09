import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';

import { describe, expect, it } from 'vitest';

import { createTestApp } from '../../test/test-app.ts';
import { LISTEN_HOST } from './listen-address.ts';

describe('listen address (E1)', () => {
  it('AC-REQ-001-07 is fixed to 127.0.0.1 (ADR-002)', () => {
    expect(LISTEN_HOST).toBe('127.0.0.1');
  });

  it('is a constant in the code, not a configuration value', () => {
    const source = readFileSync(new URL('./listen-address.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/export const LISTEN_HOST = '127\.0\.0\.1';/);
    expect(source).not.toMatch(/process\.|import /);
  });

  it('is the only host the server entry listens on', () => {
    const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');

    expect(main).toMatch(/listen\(\{ host: LISTEN_HOST, port/);
    expect(main).not.toMatch(/0\.0\.0\.0|'::'|localhost/);
  });

  it('the app listens on 127.0.0.1 only', async () => {
    const t = createTestApp();
    try {
      await t.app.listen({ host: LISTEN_HOST, port: 0 });

      expect((t.app.server.address() as AddressInfo).address).toBe('127.0.0.1');
    } finally {
      await t.close();
    }
  });
});
