/**
 * Comparison key for names: trimmed, lower case, Unicode NFC (REQ-004). Inner spaces stay.
 * NFC comes last because lower-casing can produce combining characters.
 */
export function toKey(value: string): string {
  return value.trim().toLowerCase().normalize('NFC');
}

/** Comparison key for model names: like `toKey`, without any white space (REQ-011). */
export function toModelNameKey(value: string): string {
  return toKey(value).replace(/\s+/gu, '');
}
