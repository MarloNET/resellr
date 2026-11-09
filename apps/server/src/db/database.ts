import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

/** Wait for a short lock up to 5 s; no retry and no other time limit in the server (2.0.4). */
export const BUSY_TIMEOUT_MS = 5000;

/**
 * One open SQLite database (CU-027, ADR-004). `sqlite` and `db` share the same connection, so
 * the migration run (CU-029) can control the transaction on `sqlite` and run `up(db)` in it.
 */
export interface Database<DB> {
  readonly sqlite: BetterSqlite3.Database;
  readonly db: Kysely<DB>;
  /** Closes the Kysely instance and the connection. */
  close(): Promise<void>;
}

/**
 * Opens or creates the database file with the pragmas of Technical Specification 2.19 step 2:
 * WAL, `synchronous = FULL` (every confirmed transaction survives a power loss, FIND-217),
 * `busy_timeout = 5000` and `foreign_keys = ON`.
 */
export function openDatabase<DB>(filePath: string): Database<DB> {
  const sqlite = new BetterSqlite3(filePath, { timeout: BUSY_TIMEOUT_MS });
  try {
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = FULL');
    sqlite.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
    sqlite.pragma('foreign_keys = ON');
  } catch (error) {
    sqlite.close();
    throw error;
  }
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  return {
    sqlite,
    db,
    close: async () => {
      await db.destroy();
      // Kysely closes the connection only if it has run a query.
      if (sqlite.open) sqlite.close();
    },
  };
}
