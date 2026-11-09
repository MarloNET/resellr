import type { Kysely } from 'kysely';

import type { Database } from './database.ts';

/**
 * A forward-only migration (Technical Specification 3.8). `name` is the file name without
 * extension, `YYYYMMDD_NNNN_<slug>` (4.2); migrations run in the order of their names.
 */
export interface Migration {
  readonly name: string;
  /**
   * Runs inside the transaction of the migration run. A migration must not switch
   * `foreign_keys` itself (3.8, FIND-228). It is frozen once shipped, so it does not use the
   * schema types of the current program.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  up(db: Kysely<any>): Promise<void>;
}

/** One row of `PRAGMA foreign_key_check`. */
export interface ForeignKeyViolation {
  table: string;
  rowid: number | null;
  parent: string;
  fkid: number;
}

/** The migration run failed and was rolled back; the schema is unchanged (2.19 step 5). */
export class MigrationError extends Error {
  /** The migration whose `up` failed; `null` if `foreign_key_check` or the run itself failed. */
  readonly migration: string | null;
  readonly foreignKeyViolations: ForeignKeyViolation[];

  constructor(
    message: string,
    {
      migration = null,
      foreignKeyViolations = [],
      cause,
    }: { migration?: string | null; foreignKeyViolations?: ForeignKeyViolation[]; cause?: unknown },
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'MigrationError';
    this.migration = migration;
    this.foreignKeyViolations = foreignKeyViolations;
  }
}

const CREATE_MIGRATION_TABLE =
  'CREATE TABLE IF NOT EXISTS app_migration (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)';

/**
 * Runs all pending migrations in **one** transaction (CU-029; Technical Specification 2.19
 * step 5, FIND-211, FIND-228): `foreign_keys = OFF` outside the transaction (SQLite ignores the
 * pragma inside one), `BEGIN IMMEDIATE`, per migration `up(db)` on the same connection and a row
 * in `app_migration`, then `PRAGMA foreign_key_check`; `COMMIT` without findings, otherwise
 * `ROLLBACK`; in any case `foreign_keys = ON` afterwards. Without a pending migration
 * `foreign_keys` stays untouched. Not the Kysely `Migrator`, which migrates SQLite without a
 * transaction.
 *
 * Returns the names of the applied migrations; throws `MigrationError` after the rollback.
 */
export async function runMigrations<DB>(
  { sqlite, db }: Database<DB>,
  migrations: readonly Migration[],
  now: () => Date,
): Promise<string[]> {
  const applied = new Set(readAppliedNames(sqlite));
  const pending = migrations
    .filter((migration) => !applied.has(migration.name))
    .toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (pending.length === 0) return [];

  // Hold the single connection of Kysely for the whole run so no other query can slip into
  // the transaction.
  return db.connection().execute(async (connection) => {
    sqlite.pragma('foreign_keys = OFF');
    try {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        sqlite.exec(CREATE_MIGRATION_TABLE);
        const record = sqlite.prepare('INSERT INTO app_migration (name, applied_at) VALUES (?, ?)');
        for (const migration of pending) {
          try {
            await migration.up(connection);
          } catch (error) {
            throw new MigrationError(`Migration ${migration.name} failed`, {
              migration: migration.name,
              cause: error,
            });
          }
          record.run(migration.name, now().toISOString());
        }
        const violations = sqlite.pragma('foreign_key_check') as ForeignKeyViolation[];
        if (violations.length > 0) {
          throw new MigrationError('Migrations leave foreign key violations', {
            foreignKeyViolations: violations,
          });
        }
        sqlite.exec('COMMIT');
      } catch (error) {
        // SQLite may already have rolled back by itself, e.g. after a full disk.
        if (sqlite.inTransaction) sqlite.exec('ROLLBACK');
        throw error instanceof MigrationError
          ? error
          : new MigrationError('Migration run failed', { cause: error });
      }
    } finally {
      sqlite.pragma('foreign_keys = ON');
    }
    return pending.map((migration) => migration.name);
  });
}

function readAppliedNames(sqlite: Database<unknown>['sqlite']): string[] {
  const exists = sqlite
    .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'app_migration'")
    .get();
  if (exists === undefined) return [];
  return sqlite.prepare('SELECT name FROM app_migration').pluck().all() as string[];
}
