import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';

/** An entry of a choice: supplier, device type, manufacturer or pick list value. */
export interface ChoiceItem {
  id: number;
  label: string;
  active: boolean;
}

/** An entry as the choice offers it. */
export interface ChoiceOption {
  id: number;
  label: string;
}

/**
 * Entries a choice offers (Technical Specification 2.0.11 "Anzeige vorher", addendum MAR-929):
 * the active ones and the stored one, even if deactivated meanwhile. With `markDeactivated` the
 * stored, deactivated entry carries "(deaktiviert)" (UI-003, UI-010, UI-014, UI-033). A field
 * holding several entries of one list (types of *Mehrfachangabe Anzahl × Typ*) passes them as
 * `storedIds`.
 */
export function choiceOptions(
  items: readonly ChoiceItem[],
  {
    storedId,
    storedIds = [],
    markDeactivated = false,
  }: { storedId: number | null; storedIds?: readonly number[]; markDeactivated?: boolean },
): ChoiceOption[] {
  return items
    .filter((item) => item.active || item.id === storedId || storedIds.includes(item.id))
    .map((item) => ({
      id: item.id,
      label:
        !item.active && markDeactivated ? FIXED_TEXTS.deactivatedChoice(item.label) : item.label,
    }));
}

/** A choice of the form, checked after the lists were reloaded. */
export interface ChoiceField {
  /** Path of the field in the request (`fields[].path`, `details.path`). */
  path: string;
  /** Chosen id; `null` = nothing chosen. */
  id: number | null;
  /** Stored id of the entry being changed; `null` while a new one is entered. */
  storedId: number | null;
  /** Entries before the reload, for the name in the text. */
  before: readonly ChoiceItem[];
  /** Text of the usage from the message catalog CU-012, e.g. "Lieferant <Name> ist deaktiviert". */
  message: (name: string) => string;
}

/** A field whose new value is no longer offered. */
export interface MissingChoice {
  path: string;
  id: number;
  message: string;
}

/**
 * Fields with a new value that the reloaded list no longer offers (2.0.11 "Erkennen nach dem
 * Neuladen", addendum MAR-929). The server reports only the first hit, so the form checks every
 * choice itself. A stored value is never missing, as it stays in the choice. A field without a
 * reloaded list (the reload failed) is not checked.
 */
export function findMissingChoices(
  fields: readonly ChoiceField[],
  reloadedLists: Readonly<Record<string, readonly ChoiceItem[] | undefined>>,
): MissingChoice[] {
  return fields.flatMap(({ path, id, storedId, before, message }) => {
    const reloaded = reloadedLists[path];
    if (id === null || id === storedId || reloaded === undefined) return [];
    if (reloaded.some((item) => item.id === id && item.active)) return [];
    const name = before.find((item) => item.id === id)?.label ?? '';
    return [{ path, id, message: message(name) }];
  });
}

/** A list of entries before and after it was read again; `after` is `null` if the read failed. */
export interface ReloadedList {
  before: readonly ChoiceItem[];
  after: readonly ChoiceItem[] | null;
}

/** An entry chosen in a field, with the key of the list it comes from. */
export interface ListChoice {
  /** Path of the field in the request; a field may hold several choices (port entries). */
  path: string;
  id: number;
  /** Whether the stored value of the field holds the id (changing an entry); never missing. */
  stored: boolean;
  /** Key of the list in `lists` of `findMissingListChoices`. */
  list: string;
  message: (name: string) => string;
}

/**
 * The choices whose entry is missing in their reloaded list, in the order given (2.0.11
 * "Erkennen nach dem Neuladen", addendum MAR-929, MAR-963), each through `findMissingChoices`
 * against the list it comes from. If that list could not be read again, only the rejected entry
 * at the field of `details.path` counts as missing, with the name before the reload.
 */
export function findMissingListChoices(
  choices: readonly ListChoice[],
  lists: Readonly<Record<string, ReloadedList>>,
  rejected: { path: string; id: number },
): MissingChoice[] {
  return choices.flatMap(({ path, id, stored, list, message }) => {
    const before = lists[list]?.before ?? [];
    if (lists[list]?.after === null) {
      if (stored || path !== rejected.path || id !== rejected.id) return [];
      return [{ path, id, message: message(before.find((item) => item.id === id)?.label ?? '') }];
    }
    return findMissingChoices([{ path, id, storedId: stored ? id : null, before, message }], {
      [path]: lists[list]?.after ?? undefined,
    });
  });
}
