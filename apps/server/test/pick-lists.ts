import type BetterSqlite3 from 'better-sqlite3';

/**
 * The nine pick lists of the initial settings (Technical Specification 3.1, Requirements 9.2)
 * in their order; ids 1 to 9. Tests insert them themselves, because the lists come with the
 * seed migration CU-071 (#150) and there is no endpoint to create one (RQ-07).
 */
export const PICK_LISTS = [
  { key: 'condition', name: 'Zustand' },
  { key: 'keyboard_layout', name: 'Tastaturlayout' },
  { key: 'power_supply', name: 'Netzteil' },
  { key: 'battery', name: 'Akku' },
  { key: 'storage_type', name: 'Speichertyp' },
  { key: 'display_surface', name: 'Display-Oberfläche' },
  { key: 'operating_system', name: 'Betriebssystem' },
  { key: 'port_type', name: 'Anschlusstyp' },
  { key: 'port_position', name: 'Anschlussposition' },
] as const;

export type PickListKeyOfTest = (typeof PICK_LISTS)[number]['key'];

/** Id of a list inserted by `insertPickLists`. */
export const pickListId = (key: PickListKeyOfTest) =>
  PICK_LISTS.findIndex((list) => list.key === key) + 1;

/** Inserts the nine lists, unless the seed migration already did (`INSERT OR IGNORE`). */
export function insertPickLists(sqlite: BetterSqlite3.Database) {
  const insert = sqlite.prepare(
    'INSERT OR IGNORE INTO pick_list (id, key, name, is_battery_list, version) VALUES (?, ?, ?, ?, 1)',
  );
  PICK_LISTS.forEach(({ key, name }, index) => {
    insert.run(index + 1, key, name, key === 'battery' ? 1 : 0);
  });
}
