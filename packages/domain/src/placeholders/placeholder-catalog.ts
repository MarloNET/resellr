import { toKey } from '../text/normalize-key.ts';

// Placeholder catalog (CU-068; Requirements chapter 9.7, Technical Specification 2.1). It holds
// the only list of the fixed placeholder names; the groups and their admissibility per usage
// are added by the features that resolve placeholders.

/** Names of the fixed placeholders of Requirements chapter 9.7, written as in `{Name}`. */
export const FIXED_PLACEHOLDER_NAMES = [
  'Hersteller',
  'Modellbezeichnung',
  'Typbezeichnung',
  'Herstellernummer',
  'Geräteart',
  'Artikelnummer',
  'EAN',
  'Zustand',
  'Optik-Note',
  'Zustandsbeschreibung',
  'Lieferumfang',
  'Preis',
  'Zustandsbezeichnung Kanal',
  'Händlermarke',
  'Händler-Kontakt',
  'Merkmalsliste',
  'WI-Nr',
  'Stückzahl',
  'Akkukapazität',
] as const;
export type FixedPlaceholderName = (typeof FIXED_PLACEHOLDER_NAMES)[number];

/** Prefix of the placeholder `{Baustein:Name}` (text block by name). */
const TEXT_BLOCK_PREFIX = 'Baustein:';

const FIXED_KEYS = new Set<string>(FIXED_PLACEHOLDER_NAMES.map(toKey));

/**
 * Whether a name is taken by a fixed placeholder (2.1): equal to one of the fixed names, or
 * starting with "Baustein:", compared like the uniqueness of attribute labels, i.e. after
 * trimming and without regard to case (`toKey`).
 */
export function isFixedPlaceholderName(name: string): boolean {
  const key = toKey(name);
  return FIXED_KEYS.has(key) || key.startsWith(toKey(TEXT_BLOCK_PREFIX));
}
