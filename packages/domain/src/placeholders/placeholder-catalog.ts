import { toKey } from '../text/normalize-key.ts';

// Placeholder catalog (CU-068; Requirements chapter 9.7, Technical Specification 2.1, 2.2). It
// holds the only list of the fixed placeholder names, their groups and the admissibility of the
// placeholders per usage.

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

/** Groups of Requirements chapter 9.7. */
export type PlaceholderGroup =
  'model_data' | 'listing_values' | 'channel' | 'merchant' | 'compositions' | 'stock';

/** Group of each fixed placeholder (Requirements chapter 9.7). */
const FIXED_PLACEHOLDER_GROUPS = {
  Hersteller: 'model_data',
  Modellbezeichnung: 'model_data',
  Typbezeichnung: 'model_data',
  Herstellernummer: 'model_data',
  Geräteart: 'model_data',
  Artikelnummer: 'listing_values',
  EAN: 'listing_values',
  Zustand: 'listing_values',
  'Optik-Note': 'listing_values',
  Zustandsbeschreibung: 'listing_values',
  Lieferumfang: 'listing_values',
  Preis: 'listing_values',
  'Zustandsbezeichnung Kanal': 'channel',
  Händlermarke: 'merchant',
  'Händler-Kontakt': 'merchant',
  Merkmalsliste: 'compositions',
  'WI-Nr': 'stock',
  Stückzahl: 'stock',
  Akkukapazität: 'stock',
} as const satisfies Record<FixedPlaceholderName, PlaceholderGroup>;

/** Prefix of the placeholder `{Baustein:Name}` (text block by name). */
const TEXT_BLOCK_PREFIX = 'Baustein:';
const TEXT_BLOCK_PREFIX_KEY = toKey(TEXT_BLOCK_PREFIX);

const FIXED_BY_KEY = new Map<string, FixedPlaceholderName>(
  FIXED_PLACEHOLDER_NAMES.map((name) => [toKey(name), name]),
);

/**
 * Whether a name is taken by a fixed placeholder (2.1): equal to one of the fixed names, or
 * starting with "Baustein:", compared like the uniqueness of attribute labels, i.e. after
 * trimming and without regard to case (`toKey`).
 */
export function isFixedPlaceholderName(name: string): boolean {
  const key = toKey(name);
  return FIXED_BY_KEY.has(key) || key.startsWith(TEXT_BLOCK_PREFIX_KEY);
}

/** Usages of Requirements chapter 9.7, table "Zulässigkeit je Verwendung". */
export type PlaceholderUsage =
  'title_pattern' | 'condition_extra' | 'description_template' | 'text_block';

/**
 * A placeholder of the catalog: a fixed one, `{Merkmalsbezeichnung}` of an attribute, or
 * `{Baustein:Name}` (group "Zusammenstellungen").
 */
export type CatalogPlaceholder =
  | { kind: 'fixed'; name: FixedPlaceholderName; group: PlaceholderGroup }
  | { kind: 'attribute' }
  | { kind: 'text_block' };

/**
 * The catalog entry of the name inside `{…}`, or `undefined` for an unknown placeholder. Names
 * are compared like `isFixedPlaceholderName` (`toKey`); `attributeLabelKeys` are the `toKey`
 * of the attribute labels that `{Merkmalsbezeichnung}` may name. A fixed name wins over an
 * attribute label, so the attribute with the role `battery_capacity` stays `{Akkukapazität}`.
 */
export function lookUpPlaceholder(
  name: string,
  attributeLabelKeys: ReadonlySet<string>,
): CatalogPlaceholder | undefined {
  const key = toKey(name);
  const fixed = FIXED_BY_KEY.get(key);
  if (fixed !== undefined) {
    return { kind: 'fixed', name: fixed, group: FIXED_PLACEHOLDER_GROUPS[fixed] };
  }
  if (key.startsWith(TEXT_BLOCK_PREFIX_KEY)) return { kind: 'text_block' };
  if (attributeLabelKeys.has(key)) return { kind: 'attribute' };
  return undefined;
}

/** Fixed placeholders of the listing values that title pattern and condition extra exclude. */
const NOT_IN_TITLE: ReadonlySet<FixedPlaceholderName> = new Set(['Lieferumfang', 'Preis']);

/**
 * Admissibility per usage (Requirements chapter 9.7): title pattern and condition extra take
 * model data and listing values without `{Lieferumfang}` and `{Preis}`; the description
 * template takes all; the text block all but `{Baustein:Name}`. `{Merkmalsbezeichnung}` is
 * model data or a listing value (level "Modell" or "Gerät"), so every usage takes it.
 */
export function isPlaceholderAllowed(usage: PlaceholderUsage, placeholder: CatalogPlaceholder) {
  switch (usage) {
    case 'title_pattern':
    case 'condition_extra':
      if (placeholder.kind === 'attribute') return true;
      if (placeholder.kind === 'text_block') return false;
      return (
        placeholder.group === 'model_data' ||
        (placeholder.group === 'listing_values' && !NOT_IN_TITLE.has(placeholder.name))
      );
    case 'description_template':
      return true;
    case 'text_block':
      return placeholder.kind !== 'text_block';
  }
}

/**
 * Fixed placeholders a usage takes, as `{Name}` in the order of Requirements chapter 9.7, e.g.
 * the list of placeholders in the detail area of UI-030.
 */
export function fixedPlaceholdersFor(usage: PlaceholderUsage): string[] {
  return FIXED_PLACEHOLDER_NAMES.filter((name) =>
    isPlaceholderAllowed(usage, { kind: 'fixed', name, group: FIXED_PLACEHOLDER_GROUPS[name] }),
  ).map((name) => `{${name}}`);
}
