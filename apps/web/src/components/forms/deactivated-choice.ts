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
 * stored, deactivated entry carries "(deaktiviert)" (UI-003, UI-010, UI-014, UI-033).
 */
export function choiceOptions(
  items: readonly ChoiceItem[],
  { storedId, markDeactivated = false }: { storedId: number | null; markDeactivated?: boolean },
): ChoiceOption[] {
  return items
    .filter((item) => item.active || item.id === storedId)
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
