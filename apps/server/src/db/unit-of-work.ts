import type { Kysely, Transaction } from 'kysely';

import type { ChangeEvent, CheckEvent } from '../shared/events.ts';

/** Counts of REQ-053 for the response field `impact` (2.8.4). */
export interface Impact {
  updated: number;
  rerelease: number;
  manualReview: number;
}

/**
 * Report of the change event handlers that the triggering service takes into its response
 * (2.0.4): `impact` and the channel ids for `adjustStockChannels`.
 */
export interface ChangeReport {
  impact: Impact;
  adjustStockChannels: number[];
}

export const emptyChangeReport = (): ChangeReport => ({
  impact: { updated: 0, rerelease: 0, manualReview: 0 },
  adjustStockChannels: [],
});

/** The open transaction of one action (CU-031). */
export interface UnitOfWork<DB> {
  readonly db: Transaction<DB>;
  /** Collects a change event; its handler runs before the commit. */
  emit(event: ChangeEvent): void;
  /**
   * Handles a check event at once. A handler rejects with a domain rule; the error is thrown
   * here and the transaction rolls back, even if the action catches it.
   */
  check(event: CheckEvent): Promise<void>;
}

type EventOf<E extends { type: string }, T extends E['type']> = Extract<E, { type: T }>;

/**
 * Handlers of the components (CU-169, CU-290), exactly one per event (4.5). An event without
 * a handler gives an empty report or passes the check (2.0.4, 4.4.0).
 */
export interface EventHandlers<DB> {
  change?: {
    [T in ChangeEvent['type']]?: (
      event: EventOf<ChangeEvent, T>,
      uow: UnitOfWork<DB>,
    ) => Promise<ChangeReport>;
  };
  check?: {
    [T in CheckEvent['type']]?: (
      event: EventOf<CheckEvent, T>,
      uow: UnitOfWork<DB>,
    ) => Promise<void>;
  };
}

export interface UnitOfWorkResult<T> {
  result: T;
  report: ChangeReport;
}

/** Runs each action in its own transaction (`uow` in the services, 4.2). */
export interface UnitOfWorkRunner<DB> {
  /**
   * One action, one transaction (2.0.4, Baseline 9.3): the action, the handlers of its change
   * events and everything they write are stored together or not at all. Inside the action and
   * its handlers use only `uow.db`: the transaction holds the single connection until the commit,
   * so a query through the outer `db` waits for it and hangs forever (2.0.4, MAR-263). Do not
   * swallow database errors inside the action or its handlers: after some of them (e.g.
   * SQLITE_FULL) SQLite has already rolled the transaction back, and later writes would then run
   * outside of it (FIND-262). Let them propagate; `run` rolls back and rethrows the original error.
   */
  run<T>(action: (uow: UnitOfWork<DB>) => Promise<T>): Promise<UnitOfWorkResult<T>>;
}

export function createUnitOfWork<DB>(
  db: Kysely<DB>,
  handlers: EventHandlers<DB> = {},
): UnitOfWorkRunner<DB> {
  // The mapped handler types guarantee that each handler gets its own event type.
  type AnyChangeHandler = (event: ChangeEvent, uow: UnitOfWork<DB>) => Promise<ChangeReport>;
  type AnyCheckHandler = (event: CheckEvent, uow: UnitOfWork<DB>) => Promise<void>;
  const changeHandlers = (handlers.change ?? {}) as Partial<Record<string, AnyChangeHandler>>;
  const checkHandlers = (handlers.check ?? {}) as Partial<Record<string, AnyCheckHandler>>;

  return {
    run: async (action) => {
      const trx = await db.startTransaction().execute();
      const pending: ChangeEvent[] = [];
      // The first rejection of a check handler; it rolls back even if the action catches it.
      const rejections: unknown[] = [];
      let open = true;
      const assertOpen = () => {
        if (!open) throw new Error('Unit of work is already finished');
      };

      const uow: UnitOfWork<DB> = {
        db: trx,
        emit: (event) => {
          assertOpen();
          pending.push(event);
        },
        check: async (event) => {
          assertOpen();
          const handler = checkHandlers[event.type];
          if (handler === undefined) return;
          try {
            await handler(event, uow);
          } catch (error) {
            rejections.push(error);
            throw error;
          }
        },
      };

      try {
        const result = await action(uow);
        if (rejections.length > 0) throw rejections[0];
        // Handlers may emit further events; all of them run before the commit.
        const report = emptyChangeReport();
        for (let event = pending.shift(); event !== undefined; event = pending.shift()) {
          const handler = changeHandlers[event.type];
          if (handler !== undefined) mergeReport(report, await handler(event, uow));
        }
        if (rejections.length > 0) throw rejections[0];
        open = false;
        await trx.commit().execute();
        return { result, report };
      } catch (error) {
        open = false;
        // SQLite may already have rolled back by itself, e.g. after a full disk (SQLITE_FULL,
        // SQLITE_IOERR); the rollback then fails with "no transaction is active". The original
        // error is the one that counts (FIND-261). Kysely releases the connection in any case.
        await trx
          .rollback()
          .execute()
          .catch(() => undefined);
        throw error;
      }
    },
  };
}

function mergeReport(into: ChangeReport, from: ChangeReport): void {
  into.impact.updated += from.impact.updated;
  into.impact.rerelease += from.impact.rerelease;
  into.impact.manualReview += from.impact.manualReview;
  for (const channelId of from.adjustStockChannels) {
    if (!into.adjustStockChannels.includes(channelId)) into.adjustStockChannels.push(channelId);
  }
}
