import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isReferenceNumber } from '@resellr/runtime-shared/reference-number';
import BetterSqlite3 from 'better-sqlite3';
import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openDatabase, type Database } from '../db/database.ts';
import { ShuttingDownError } from '../shared/domain-error.ts';
import { createErrorLog } from './error-log.ts';
import { createLifecycleState, type LifecycleState } from './lifecycle-state.ts';
import { createOperationsLog } from './operations-log.ts';
import {
  createShutdownService,
  SHUTDOWN_MARKER_FILE_NAME,
  type ShutdownService,
} from './shutdown-service.ts';

const ENDED_AT = new Date('2026-11-10T17:30:00.000Z');

let root: string;
let dataDir: string;
let logDir: string;
let database: Database<unknown>;
let lifecycle: LifecycleState;
let waitForWrites: ReturnType<typeof vi.fn<(timeoutMs: number) => Promise<boolean>>>;
let exit: ReturnType<typeof vi.fn<(code: number) => void>>;
let service: ShutdownService;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'resellr-shutdown-'));
  dataDir = join(root, 'Daten');
  logDir = join(root, 'Protokolle');
  mkdirSync(dataDir);
  database = openDatabase(join(dataDir, 'resellr.db'));
  database.sqlite.exec('CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
  await sql`INSERT INTO item (name) VALUES (${'Laptop'})`.execute(database.db);
  lifecycle = createLifecycleState('ready');
  waitForWrites = vi.fn(async () => true);
  exit = vi.fn();
  const now = () => ENDED_AT;
  service = createShutdownService({
    lifecycle,
    waitForWrites,
    database,
    dataDir,
    appVersion: '0.1.0',
    startId: 'start-1',
    now,
    errorLog: createErrorLog({ dir: logDir, appVersion: '0.1.0', startId: 'start-1', now }),
    operationsLog: createOperationsLog({
      dir: logDir,
      appVersion: '0.1.0',
      startId: 'start-1',
      now,
    }),
    exit,
  });
});

afterEach(async () => {
  vi.useRealTimers();
  await database.close();
  rmSync(root, { recursive: true, force: true });
});

const readLog = (kind: 'operations' | 'errors'): Record<string, unknown>[] => {
  if (!existsSync(logDir)) return [];
  return readdirSync(logDir)
    .filter((name) => name.startsWith(`${kind}-`))
    .flatMap((name) =>
      readFileSync(join(logDir, name), 'utf8')
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    );
};

const markerPath = () => join(dataDir, SHUTDOWN_MARKER_FILE_NAME);

const itemNames = async () =>
  (await sql<{ name: string }>`SELECT name FROM item`.execute(database.db)).rows;

/** Holds a read snapshot from a second connection, so the checkpoint cannot finish (busy). */
function holdReader(): BetterSqlite3.Database {
  // No waiting for the lock in the test; the server waits up to 5 s (2.0.4).
  database.sqlite.pragma('busy_timeout = 0');
  const reader = new BetterSqlite3(join(dataDir, 'resellr.db'));
  reader.exec('BEGIN');
  reader.prepare('SELECT count(*) FROM item').get();
  return reader;
}

describe('shutdown service (CU-245)', () => {
  it('stops in order: stopping, waits up to 10 s for writes, checkpoint, close, marker, stopped_by_user', async () => {
    let lifecycleWhileWaiting: string | undefined;
    let openWhileWaiting: boolean | undefined;
    waitForWrites.mockImplementation(async () => {
      lifecycleWhileWaiting = lifecycle.get();
      openWhileWaiting = database.sqlite.open;
      return true;
    });

    const result = await service.shutdown();

    expect(result).toEqual({ state: 'stopped', dataDirPath: dataDir });
    expect(waitForWrites).toHaveBeenCalledWith(10_000);
    expect(lifecycleWhileWaiting).toBe('stopping');
    expect(openWhileWaiting).toBe(true);
    expect(lifecycle.get()).toBe('stopping');
    // The database is the single file resellr.db, next to the marker (2.17 steps 4 to 6).
    expect(database.sqlite.open).toBe(false);
    expect(readdirSync(dataDir).sort()).toEqual(['resellr.db', SHUTDOWN_MARKER_FILE_NAME]);
    expect(JSON.parse(readFileSync(markerPath(), 'utf8'))).toStrictEqual({
      endedAt: ENDED_AT.toISOString(),
      appVersion: '0.1.0',
      startId: 'start-1',
    });
    expect(readLog('operations')).toEqual([
      expect.objectContaining({ level: 'info', event: 'stopped_by_user', startId: 'start-1' }),
    ]);
    expect(readLog('errors')).toEqual([]);
    // The process ends only after the response (step 7).
    expect(exit).not.toHaveBeenCalled();
  });

  it('keeps the data written before the shutdown in resellr.db', async () => {
    await service.shutdown();

    const copy = new BetterSqlite3(join(dataDir, 'resellr.db'), { readonly: true });
    try {
      expect(copy.prepare('SELECT name FROM item').pluck().all()).toEqual(['Laptop']);
    } finally {
      copy.close();
    }
  });

  it('goes on after the 10 s for running writes have passed', async () => {
    waitForWrites.mockResolvedValue(false);

    await expect(service.shutdown()).resolves.toEqual({ state: 'stopped', dataDirPath: dataDir });
  });

  it.each(['starting', 'stopping'] as const)(
    'rejects with shutting_down in state %s and changes nothing (step 1)',
    async (state) => {
      lifecycle.set(state);

      await expect(service.shutdown()).rejects.toBeInstanceOf(ShuttingDownError);

      expect(lifecycle.get()).toBe(state);
      expect(waitForWrites).not.toHaveBeenCalled();
      expect(database.sqlite.open).toBe(true);
      expect(existsSync(markerPath())).toBe(false);
    },
  );

  it('DER-96-08 checkpoint reports busy: state ready, error log entry with reference number, no marker, resellr usable', async () => {
    const reader = holdReader();
    let result;
    try {
      result = await service.shutdown();
    } finally {
      reader.close();
    }

    expect(result).toEqual({ state: 'failed', refNo: expect.any(String) });
    const refNo = result.state === 'failed' ? result.refNo : '';
    expect(isReferenceNumber(refNo)).toBe(true);
    expect(lifecycle.get()).toBe('ready');
    expect(existsSync(markerPath())).toBe(false);
    expect(readLog('errors')).toEqual([
      expect.objectContaining({ level: 'error', refNo, function: 'ops.shutdown' }),
    ]);
    expect(readLog('operations')).toEqual([
      expect.objectContaining({ level: 'warn', event: 'shutdown_failed', refNo }),
    ]);
    expect(await itemNames()).toEqual([{ name: 'Laptop' }]);
    expect(exit).not.toHaveBeenCalled();
  });

  it('a failed checkpoint inside a running write transaction fails the shutdown as well', async () => {
    database.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const result = await service.shutdown();

      expect(result.state).toBe('failed');
      expect(lifecycle.get()).toBe('ready');
      expect(database.sqlite.inTransaction).toBe(true);
    } finally {
      database.sqlite.exec('ROLLBACK');
    }
  });

  it('a failed marker reopens the database: state ready, reference number, resellr usable (step 8)', async () => {
    // A folder in the place of the marker makes writing it fail after the database is closed.
    mkdirSync(join(markerPath(), 'blocker'), { recursive: true });

    const result = await service.shutdown();

    expect(result.state).toBe('failed');
    expect(lifecycle.get()).toBe('ready');
    expect(database.sqlite.open).toBe(true);
    expect(await itemNames()).toEqual([{ name: 'Laptop' }]);
    await sql`INSERT INTO item (name) VALUES (${'PC'})`.execute(database.db);
    expect(readLog('errors')).toEqual([
      expect.objectContaining({ refNo: result.state === 'failed' ? result.refNo : '' }),
    ]);
    expect(readLog('operations').map((entry) => entry.event)).toEqual(['shutdown_failed']);
  });

  it('a failed reopen after a failed marker still ends in state ready with one reference number (step 8, FIND-284)', async () => {
    mkdirSync(join(markerPath(), 'blocker'), { recursive: true });
    vi.spyOn(database, 'reopen').mockImplementation(() => {
      throw new Error('disk full');
    });

    const result = await service.shutdown();

    expect(result).toEqual({ state: 'failed', refNo: expect.any(String) });
    const refNo = result.state === 'failed' ? result.refNo : '';
    expect(isReferenceNumber(refNo)).toBe(true);
    expect(lifecycle.get()).toBe('ready');
    expect(existsSync(join(markerPath(), 'blocker'))).toBe(true);
    // Both the original error and the error of the reopen, under the same reference number.
    const errors = readLog('errors');
    expect(errors).toHaveLength(2);
    expect(errors).toEqual([
      expect.objectContaining({ level: 'error', refNo, function: 'ops.shutdown' }),
      expect.objectContaining({
        level: 'error',
        refNo,
        function: 'ops.shutdown',
        message: 'Error: disk full',
      }),
    ]);
    expect(errors[0]?.message).not.toBe('Error: disk full');
    expect(readLog('operations')).toEqual([
      expect.objectContaining({ level: 'warn', event: 'shutdown_failed', refNo }),
    ]);
    expect(exit).not.toHaveBeenCalled();
  });

  it('a later shutdown succeeds after a failed one', async () => {
    const reader = holdReader();
    try {
      expect((await service.shutdown()).state).toBe('failed');
    } finally {
      reader.close();
    }

    await expect(service.shutdown()).resolves.toEqual({ state: 'stopped', dataDirPath: dataDir });
  });

  describe('end after the response (step 7, FIND-217)', () => {
    const response = () => new EventEmitter() as unknown as ServerResponse;

    it('ends with exit code 0 once the response is sent', () => {
      const res = response();
      service.exitAfterResponse(res);
      expect(exit).not.toHaveBeenCalled();

      res.emit('finish');
      res.emit('close');

      expect(exit).toHaveBeenCalledOnce();
      expect(exit).toHaveBeenCalledWith(0);
    });

    it('ends with exit code 0 when the browser closes the connection before', () => {
      const res = response();
      service.exitAfterResponse(res);

      res.emit('close');

      expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    });

    it('ends with exit code 0 at the latest 5 s after sending', () => {
      vi.useFakeTimers();
      service.exitAfterResponse(response());

      vi.advanceTimersByTime(4999);
      expect(exit).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    });
  });
});
