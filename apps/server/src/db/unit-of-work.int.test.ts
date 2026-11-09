import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ErrorCode } from '@resellr/domain/errors/error-codes';
import type { Generated } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RuleViolation } from '../shared/domain-error.ts';
import type { ListingDeleting } from '../shared/events.ts';
import { openDatabase, type Database } from './database.ts';
import { createUnitOfWork, emptyChangeReport, type UnitOfWork } from './unit-of-work.ts';

interface TestSchema {
  listing: { id: Generated<number>; title: string };
  audit_entry: { id: Generated<number>; action: string };
}

// Domain code of a later step (2.8.3); the error code catalog adds it with its feature.
const DELETE_NOT_ALLOWED = 'delete_not_allowed' as ErrorCode;

let dir: string;
let database: Database<TestSchema>;

const titles = () => database.sqlite.prepare('SELECT title FROM listing ORDER BY id').pluck().all();
const auditActions = () =>
  database.sqlite.prepare('SELECT action FROM audit_entry ORDER BY id').pluck().all();

const insertListing = (uow: UnitOfWork<TestSchema>, title: string) =>
  uow.db.insertInto('listing').values({ title }).execute();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-uow-'));
  database = openDatabase<TestSchema>(join(dir, 'resellr.db'));
  database.sqlite.exec(`
    CREATE TABLE listing (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
    CREATE TABLE audit_entry (id INTEGER PRIMARY KEY, action TEXT NOT NULL);
  `);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('unit of work (CU-031)', () => {
  it('E6 stores the action together with the writes of its handlers', async () => {
    const uow = createUnitOfWork(database.db, {
      change: {
        ListingCreated: async (event, { db }) => {
          await db
            .insertInto('audit_entry')
            .values({ action: `created ${event.listingId}` })
            .execute();
          return emptyChangeReport();
        },
      },
    });

    const { result } = await uow.run(async (tx) => {
      await insertListing(tx, 'ThinkPad T14');
      tx.emit({ type: 'ListingCreated', listingId: 1 });
      return 'done';
    });

    expect(result).toBe('done');
    expect(titles()).toEqual(['ThinkPad T14']);
    expect(auditActions()).toEqual(['created 1']);
  });

  it('E6 stores nothing when the action fails', async () => {
    const uow = createUnitOfWork(database.db);

    const run = uow.run(async (tx) => {
      await insertListing(tx, 'ThinkPad T14');
      throw new Error('disk full');
    });

    await expect(run).rejects.toThrow('disk full');
    expect(titles()).toEqual([]);
  });

  it('E6 rolls the action back when a change event handler fails', async () => {
    const uow = createUnitOfWork(database.db, {
      change: {
        ListingCreated: async (_event, { db }) => {
          await db.insertInto('audit_entry').values({ action: 'created' }).execute();
          throw new Error('recompute failed');
        },
      },
    });

    const run = uow.run(async (tx) => {
      await insertListing(tx, 'ThinkPad T14');
      tx.emit({ type: 'ListingCreated', listingId: 1 });
    });

    await expect(run).rejects.toThrow('recompute failed');
    expect(titles()).toEqual([]);
    expect(auditActions()).toEqual([]);
  });

  it('runs change handlers after the action, before the commit, also for events they emit', async () => {
    const order: string[] = [];
    const uow = createUnitOfWork(database.db, {
      change: {
        ListingCreated: async (event, tx) => {
          order.push(`ListingCreated ${event.listingId}`);
          tx.emit({ type: 'StockChanged', listingId: event.listingId });
          return {
            impact: { updated: 2, rerelease: 0, manualReview: 1 },
            adjustStockChannels: [],
          };
        },
        StockChanged: async (event) => {
          order.push(`StockChanged ${event.listingId}`);
          return {
            impact: { updated: 1, rerelease: 1, manualReview: 0 },
            adjustStockChannels: [3, 1],
          };
        },
      },
    });

    const { report } = await uow.run(async (tx) => {
      tx.emit({ type: 'ListingCreated', listingId: 7 });
      tx.emit({ type: 'StockChanged', listingId: 8 });
      order.push('action end');
    });

    expect(order).toEqual(['action end', 'ListingCreated 7', 'StockChanged 8', 'StockChanged 7']);
    expect(report).toEqual({
      impact: { updated: 4, rerelease: 2, manualReview: 1 },
      adjustStockChannels: [3, 1],
    });
  });

  it('discards the events of a failed action without running their handlers', async () => {
    let handled = 0;
    const uow = createUnitOfWork(database.db, {
      change: {
        ListingCreated: async () => {
          handled += 1;
          return emptyChangeReport();
        },
      },
    });

    const failing = uow.run(async (tx) => {
      tx.emit({ type: 'ListingCreated', listingId: 1 });
      throw new Error('rule broken');
    });
    await expect(failing).rejects.toThrow('rule broken');
    await uow.run(async () => undefined);

    expect(handled).toBe(0);
  });

  it('E7 gives an empty report for a change event without handler', async () => {
    const uow = createUnitOfWork(database.db);

    const { report } = await uow.run(async (tx) => {
      await insertListing(tx, 'ThinkPad T14');
      tx.emit({ type: 'ContentInputsChanged', listingIds: [1] });
      tx.emit({ type: 'StockChanged', listingId: 1 });
    });

    expect(report).toEqual(emptyChangeReport());
    expect(titles()).toEqual(['ThinkPad T14']);
  });

  it('E7 passes a check event without handler', async () => {
    const uow = createUnitOfWork(database.db);

    await uow.run(async (tx) => {
      await tx.check({ type: 'ListingDeleting', listingId: 1 });
      await insertListing(tx, 'ThinkPad T14');
    });

    expect(titles()).toEqual(['ThinkPad T14']);
  });

  it('handles a check event at once and continues when the handler accepts', async () => {
    const checked: ListingDeleting[] = [];
    const uow = createUnitOfWork(database.db, {
      check: {
        ListingDeleting: async (event) => {
          checked.push(event);
        },
      },
    });

    await uow.run(async (tx) => {
      await tx.check({ type: 'ListingDeleting', listingId: 5 });
      expect(checked).toEqual([{ type: 'ListingDeleting', listingId: 5 }]);
      await insertListing(tx, 'ThinkPad T14');
    });

    expect(titles()).toEqual(['ThinkPad T14']);
  });

  it('E8 rolls the transaction back when a check handler rejects with a domain rule', async () => {
    const uow = createUnitOfWork(database.db, {
      check: {
        ListingDeleting: async () => {
          throw new RuleViolation(DELETE_NOT_ALLOWED);
        },
      },
    });

    const run = uow.run(async (tx) => {
      await insertListing(tx, 'ThinkPad T14');
      await tx.check({ type: 'ListingDeleting', listingId: 1 });
      await insertListing(tx, 'never stored');
    });

    await expect(run).rejects.toBeInstanceOf(RuleViolation);
    await expect(run).rejects.toMatchObject({ code: 'delete_not_allowed' });
    expect(titles()).toEqual([]);
  });

  it('E8 rolls back even if the action catches the rejection', async () => {
    const uow = createUnitOfWork(database.db, {
      check: {
        ListingDeleting: async () => {
          throw new RuleViolation(DELETE_NOT_ALLOWED);
        },
      },
    });

    const run = uow.run(async (tx) => {
      await insertListing(tx, 'ThinkPad T14');
      await tx.check({ type: 'ListingDeleting', listingId: 1 }).catch(() => undefined);
    });

    await expect(run).rejects.toMatchObject({ code: 'delete_not_allowed' });
    expect(titles()).toEqual([]);
  });

  it('keeps the original error and stores nothing when SQLite ends the transaction itself', async () => {
    // A full disk: SQLite rolls the transaction back on its own (SQLITE_FULL, FIND-261).
    const pageCount = database.sqlite.pragma('page_count', { simple: true }) as number;
    database.sqlite.pragma(`max_page_count = ${pageCount + 2}`);
    const uow = createUnitOfWork(database.db);

    const run = uow.run(async (tx) => {
      await insertListing(tx, 'ThinkPad T14');
      await insertListing(tx, 'x'.repeat(100_000));
    });

    await expect(run).rejects.toMatchObject({ code: 'SQLITE_FULL' });
    expect(titles()).toEqual([]);
    // The connection is free again for the next action.
    await uow.run(async (tx) => {
      await insertListing(tx, 'Latitude 5440');
    });
    expect(titles()).toEqual(['Latitude 5440']);
  });

  it('rejects events after the action has finished', async () => {
    const uow = createUnitOfWork(database.db);
    let leaked: UnitOfWork<TestSchema> | undefined;

    await uow.run(async (tx) => {
      leaked = tx;
    });

    expect(() => leaked?.emit({ type: 'StockChanged', listingId: 1 })).toThrow(
      'Unit of work is already finished',
    );
  });
});
