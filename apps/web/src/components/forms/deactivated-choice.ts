/** An entry of a choice list with its name and status, e.g. a pick list value. */
export interface ChoiceEntry {
  id: number;
  name: string;
  active: boolean;
}

/** A choice of the form, and the list it chooses from. */
export interface ChoiceInForm {
  /** Field path like `fields[].path`, e.g. `modelValues.14`. */
  path: string;
  /** The value of the form at the end of the reload; `null` for an empty field. */
  id: number | null;
  /** Key of the list in `reloadedLists`. */
  list: string;
  /** Text of the usage with the name of the entry, from CU-012. */
  message: (name: string) => string;
}

/** A list before and after reading it again; `after` is `null` if the read failed. */
export interface ReloadedList {
  before: readonly ChoiceEntry[];
  after: readonly ChoiceEntry[] | null;
}

/** A choice whose entry is missing after reading the lists again, with its text. */
export interface MissingChoice {
  path: string;
  id: number;
  message: string;
}

/**
 * Choices whose new value is missing after the lists were read again (CU-319; Technical
 * Specification 2.0.11 "Auswahl nach der Ablehnung", Nachtrag MAR-929, MAR-963): the server
 * names only the first deactivated entry, so the form passes every choice with a new value, also
 * the one at `details.path`, with its value at the end of the reload; an empty one is not
 * checked. Its entry is missing if the reloaded list lacks it or holds it deactivated; the text
 * names the entry as the list did before the reload. A list whose read failed decides nothing; the screen treats
 * only the rejected id as missing then. Values, texts and the state "not chosen" set the screen.
 */
export function findMissingChoices(
  fields: readonly ChoiceInForm[],
  reloadedLists: Readonly<Record<string, ReloadedList>>,
): MissingChoice[] {
  const missing: MissingChoice[] = [];
  for (const { path, id, list, message } of fields) {
    if (id === null) continue;
    const lists = reloadedLists[list];
    if (lists?.after == null) continue;
    if (lists.after.some((entry) => entry.id === id && entry.active)) continue;
    const name = lists.before.find((entry) => entry.id === id)?.name ?? '';
    missing.push({ path, id, message: message(name) });
  }
  return missing;
}
