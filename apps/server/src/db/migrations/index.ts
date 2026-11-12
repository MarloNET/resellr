import type { Migration } from '../migrator.ts';
import { initialSchema } from './20261110_0001_initial_schema.ts';
import { seedInitialSettings } from './20261110_0002_seed_initial_settings.ts';

/**
 * All shipped migrations (CU-308, hotspot 4.5), passed by the startup sequence (CU-040) to the
 * migration run (CU-029). A static list because esbuild bundles the server into one file, so
 * there is no folder scan (3.8, Nachtrag MAR-263). Each new migration adds one line.
 */
export const migrations: readonly Migration[] = [initialSchema, seedInitialSettings];
