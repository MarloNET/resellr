import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFileStore, withHashLock } from './file-store.ts';

const HASH = 'a'.repeat(64);

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'resellr-file-store-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('file store (CU-088)', () => {
  it('names a stored logo after its hash under media/logo', () => {
    const store = createFileStore({ mediaDir: join(root, 'media') });

    expect(store.pathOf('logo', HASH, 'png')).toBe(join(root, 'media', 'logo', `${HASH}.png`));
  });

  it('creates temporary files under media/.incoming and removes them', async () => {
    const store = createFileStore({ mediaDir: join(root, 'media') });

    const path = await store.createIncomingPath();
    writeFileSync(path, 'x');

    expect(dirname(path)).toBe(join(root, 'media', '.incoming'));
    await store.removeIncoming(path);
    expect(existsSync(path)).toBe(false);
    await expect(store.removeIncoming(path)).resolves.toBeUndefined();
  });

  it('moves a temporary file into place, and drops it when the same file is already there', async () => {
    const store = createFileStore({ mediaDir: join(root, 'media') });
    const first = await store.createIncomingPath();
    writeFileSync(first, 'content');
    const second = await store.createIncomingPath();
    writeFileSync(second, 'content');

    await store.place(first, 'logo', HASH, 'png');
    await store.place(second, 'logo', HASH, 'png');

    expect(readFileSync(store.pathOf('logo', HASH, 'png'), 'utf8')).toBe('content');
    expect(readdirSync(join(root, 'media', '.incoming'))).toEqual([]);
    expect(await store.has('logo', HASH, 'png')).toBe(true);
    expect(await store.has('logo', HASH, 'jpg')).toBe(false);
  });
});

describe('withHashLock (CU-088, FIND-226)', () => {
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => (resolve = done));
    return { promise, resolve };
  };

  it('runs holders of the same hash one after the other, other hashes in parallel', async () => {
    const steps: string[] = [];
    const gate = deferred();

    const first = withHashLock(HASH, async () => {
      steps.push('first start');
      await gate.promise;
      steps.push('first end');
    });
    const second = withHashLock(HASH, async () => {
      steps.push('second');
    });
    const other = withHashLock('b'.repeat(64), async () => {
      steps.push('other');
    });

    await other;
    expect(steps).toEqual(['first start', 'other']);
    gate.resolve();
    await Promise.all([first, second]);
    expect(steps).toEqual(['first start', 'other', 'first end', 'second']);
  });

  it('frees the lock when a holder fails and passes the error on', async () => {
    await expect(
      withHashLock(HASH, async () => {
        throw new Error('failed');
      }),
    ).rejects.toThrow('failed');

    await expect(withHashLock(HASH, async () => 'next')).resolves.toBe('next');
  });
});
