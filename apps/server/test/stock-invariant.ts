import { vi } from 'vitest';

import type { Database } from '../src/db/database.ts';
import type { DB } from '../src/db/schema.ts';

// Invariant test of the stock columns (DER-65-03; Technical Specification 3.3, FIND-221), set up
// for every test of `apps/server`: closing a database compares `quantity`, `stock_json` and
// `stock_hash` of every model listing with what CU-128 forms anew from the devices and fails the
// test on a difference. Every integration test closes its database after it, so the check runs
// after each of them. The comparison at startup belongs to CU-247 (S10, #132).

/** The differences of an open database; imported late, as `stock.ts` reaches `database.ts`. */
async function differencesOf(database: Database<DB>) {
  if (!database.sqlite.open) return [];
  const { stockColumnDifferences } = await import('./stock.ts');
  return stockColumnDifferences(database.db);
}

vi.mock('../src/db/database.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/db/database.ts')>();
  return {
    ...original,
    openDatabase<T>(filePath: string): Database<T> {
      const database = original.openDatabase<T>(filePath);
      const close = database.close.bind(database);
      database.close = async () => {
        // The database is closed even if the comparison fails.
        const differences = await differencesOf(database as unknown as Database<DB>).finally(close);
        if (differences.length > 0) {
          throw new Error(
            `stock columns differ from the devices (DER-65-03): ${JSON.stringify(differences)}`,
          );
        }
      };
      return database;
    },
  };
});
