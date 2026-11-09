import { table as appTable } from './app.ts';
import { catalogTable } from './catalog/index.ts';

export const table = catalogTable;
export const tables = [appTable, catalogTable];
