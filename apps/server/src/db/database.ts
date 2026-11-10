import BetterSqlite3 from 'better-sqlite3';
import { Kysely, type SqliteDatabase, SqliteDialect } from 'kysely';

/** Wait for a short lock up to 5 s; no retry and no other time limit in the server (2.0.4). */
export const BUSY_TIMEOUT_MS = 5000;

/**
 * One open SQLite database (CU-027, ADR-004). `sqlite` and `db` share the same connection, so
 * the migration run (CU-029) can control the transaction on `sqlite` and run `up(db)` in it.
 */
export interface Database<DB> {
  /** The current connection; a new one after `reopen()`. */
  readonly sqlite: BetterSqlite3.Database;
  readonly db: Kysely<DB>;
  /**
   * `PRAGMA wal_checkpoint(TRUNCATE)`: moves the WAL into the database file and empties it.
   * Throws if SQLite fails or reports `busy` (2.17 step 4).
   */
  checkpoint(): void;
  /**
   * Closes only the connection, so the database is the single file `resellr.db` (2.17 step 5).
   * `db` stays usable after `reopen()`; until then every query fails.
   */
  closeConnection(): void;
  /** Opens the connection again with the same pragmas, e.g. after a failed shutdown (2.17 step 8). */
  reopen(): void;
  /** Closes the Kysely instance and the connection. */
  close(): Promise<void>;
}

/**
 * Opens or creates the file with the pragmas of Technical Specification 2.19 step 2:
 * WAL, `synchronous = FULL` (every confirmed transaction survives a power loss, FIND-217),
 * `busy_timeout = 5000` and `foreign_keys = ON`.
 */
function openConnection(filePath: string): BetterSqlite3.Database {
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
  return sqlite;
}

/** Opens or creates the database file (2.19 step 2). */
export function openDatabase<DB>(filePath: string): Database<DB> {
  let sqlite = openConnection(filePath);
  // Kysely keeps the object it gets for its whole life; this one forwards to the current
  // connection, so services keep their `db` across `closeConnection()` and `reopen()`.
  const connection: SqliteDatabase = {
    prepare: (query) => sqlite.prepare(query),
    close: () => {
      if (sqlite.open) sqlite.close();
    },
  };
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: connection }) });
  return {
    get sqlite() {
      return sqlite;
    },
    db,
    checkpoint: () => {
      const [result] = sqlite.pragma('wal_checkpoint(TRUNCATE)') as { busy: number }[];
      if (result?.busy !== 0) throw new Error('wal_checkpoint(TRUNCATE) reported busy');
    },
    closeConnection: () => {
      if (sqlite.open) sqlite.close();
    },
    reopen: () => {
      if (!sqlite.open) sqlite = openConnection(filePath);
    },
    close: async () => {
      await db.destroy();
      // Kysely closes the connection only if it has run a query.
      connection.close();
    },
  };
}
